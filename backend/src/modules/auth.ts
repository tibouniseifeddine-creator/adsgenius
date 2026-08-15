import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { prisma } from '../infrastructure/database/client.js';
import { AppError } from '../shared/errors.js';

const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_COOKIE = 'adsgenius_access';
const REFRESH_COOKIE = 'adsgenius_refresh';

export type AuthContext = { userId: string; email: string; name: string };
type SessionTokens = { accessToken: string; refreshToken: string; accessExpiresAt: Date; refreshExpiresAt: Date };

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new AppError('VALIDATION_ERROR', 'Email is required.', 400);
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('VALIDATION_ERROR', 'A valid email is required.', 400);
  return email;
}

function requiredString(value: unknown, field: string, max = 120): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new AppError('VALIDATION_ERROR', `${field} is required.`, 400);
  const result = value.trim();
  if (result.length > max) throw new AppError('VALIDATION_ERROR', `${field} is too long.`, 400);
  return result;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 }).toString('hex');
  return `scrypt$16384$8$1$${salt}$${hash}`;
}

function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, n, r, p, salt, expectedHex] = encoded.split('$');
  if (algorithm !== 'scrypt' || !n || !r || !p || !salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64, { N: Number(n), r: Number(r), p: Number(p) });
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
function newToken(): string { return randomBytes(48).toString('base64url'); }

function setCookie(response: ServerResponse, name: string, value: string, maxAge: number): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const cookie = `${name}=${value}; Max-Age=${Math.floor(maxAge / 1000)}; Path=/; HttpOnly; SameSite=Strict${secure}`;
  const existing = response.getHeader('set-cookie');
  response.setHeader('set-cookie', [...(Array.isArray(existing) ? existing : existing ? [String(existing)] : []), cookie]);
}

export function clearAuthCookies(response: ServerResponse): void {
  setCookie(response, ACCESS_COOKIE, '', 0);
  setCookie(response, REFRESH_COOKIE, '', 0);
}

function readCookies(request: IncomingMessage): Record<string, string> {
  const header = request.headers.cookie ?? '';
  return Object.fromEntries(header.split(';').flatMap((part) => {
    const index = part.indexOf('=');
    if (index < 0) return [];
    return [[part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]];
  }));
}

function accessTokenFrom(request: IncomingMessage): string | undefined {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7).trim();
  return readCookies(request)[ACCESS_COOKIE];
}
function refreshTokenFrom(request: IncomingMessage): string | undefined { return readCookies(request)[REFRESH_COOKIE]; }

async function createSession(userId: string): Promise<SessionTokens> {
  const accessToken = newToken();
  const refreshToken = newToken();
  const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await prisma.authSession.create({ data: { userId, accessTokenHash: hashToken(accessToken), refreshTokenHash: hashToken(refreshToken), expiresAt: accessExpiresAt, refreshExpiresAt } });
  return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt };
}

export async function authenticate(request: IncomingMessage): Promise<AuthContext> {
  const token = accessTokenFrom(request);
  if (!token) throw new AppError('UNAUTHORIZED', 'Authentication is required.', 401);
  const session = await prisma.authSession.findUnique({ where: { accessTokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new AppError('UNAUTHORIZED', 'The access session is invalid or expired.', 401);
  return { userId: session.user.id, email: session.user.email, name: session.user.name };
}

export async function register(input: Record<string, unknown>, response: ServerResponse, requestId: string) {
  const email = normalizeEmail(input.email);
  const name = requiredString(input.name, 'Name');
  const password = requiredString(input.password, 'Password', 200);
  if (password.length < 8) throw new AppError('VALIDATION_ERROR', 'Password must contain at least 8 characters.', 400);
  const workspaceName = requiredString(input.workspaceName ?? `${name}'s Workspace`, 'Workspace name');
  if (await prisma.user.findUnique({ where: { email } })) throw new AppError('CONFLICT', 'An account with this email already exists.', 409);
  const slugBase = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'workspace';
  const slug = `${slugBase}-${randomBytes(3).toString('hex')}`;
  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({ data: { email, name, passwordHash: hashPassword(password) } });
    const workspace = await tx.workspace.create({ data: { name: workspaceName, slug } });
    await tx.workspaceMember.create({ data: { userId: createdUser.id, workspaceId: workspace.id, role: 'OWNER' } });
    await tx.auditLog.create({ data: { workspaceId: workspace.id, userId: createdUser.id, action: 'auth.register', entityType: 'User', entityId: createdUser.id, requestReference: requestId } });
    return createdUser;
  });
  const tokens = await createSession(user.id);
  setCookie(response, ACCESS_COOKIE, tokens.accessToken, ACCESS_TTL_MS);
  setCookie(response, REFRESH_COOKIE, tokens.refreshToken, REFRESH_TTL_MS);
  return { user: { id: user.id, email: user.email, name: user.name }, tokens };
}

export async function login(input: Record<string, unknown>, response: ServerResponse, requestId: string) {
  const email = normalizeEmail(input.email);
  const password = requiredString(input.password, 'Password', 200);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) throw new AppError('UNAUTHORIZED', 'Invalid email or password.', 401);
  const tokens = await createSession(user.id);
  await prisma.auditLog.create({ data: { userId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id, requestReference: requestId } });
  setCookie(response, ACCESS_COOKIE, tokens.accessToken, ACCESS_TTL_MS);
  setCookie(response, REFRESH_COOKIE, tokens.refreshToken, REFRESH_TTL_MS);
  return { user: { id: user.id, email: user.email, name: user.name }, tokens };
}

export async function refresh(request: IncomingMessage, response: ServerResponse, requestId: string) {
  const refreshToken = refreshTokenFrom(request);
  if (!refreshToken) throw new AppError('UNAUTHORIZED', 'Refresh authentication is required.', 401);
  const current = await prisma.authSession.findUnique({ where: { refreshTokenHash: hashToken(refreshToken) } });
  if (!current || current.revokedAt || current.refreshExpiresAt <= new Date()) throw new AppError('UNAUTHORIZED', 'The refresh session is invalid or expired.', 401);
  const tokens = await createSession(current.userId);
  await prisma.authSession.update({ where: { id: current.id }, data: { revokedAt: new Date() } });
  await prisma.auditLog.create({ data: { userId: current.userId, action: 'auth.refresh', entityType: 'AuthSession', entityId: current.id, requestReference: requestId } });
  setCookie(response, ACCESS_COOKIE, tokens.accessToken, ACCESS_TTL_MS);
  setCookie(response, REFRESH_COOKIE, tokens.refreshToken, REFRESH_TTL_MS);
  return tokens;
}

export async function logout(request: IncomingMessage, response: ServerResponse, requestId: string): Promise<void> {
  const token = accessTokenFrom(request);
  if (token) {
    const session = await prisma.authSession.findUnique({ where: { accessTokenHash: hashToken(token) } });
    if (session && !session.revokedAt) {
      await prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      await prisma.auditLog.create({ data: { userId: session.userId, action: 'auth.logout', entityType: 'AuthSession', entityId: session.id, requestReference: requestId } });
    }
  }
  clearAuthCookies(response);
}

export async function me(request: IncomingMessage) {
  const auth = await authenticate(request);
  const memberships = await prisma.workspaceMember.findMany({ where: { userId: auth.userId, status: 'ACTIVE' }, include: { workspace: true }, orderBy: { createdAt: 'asc' } });
  return { user: { id: auth.userId, email: auth.email, name: auth.name }, workspaces: memberships.map(({ workspace, role }) => ({ ...workspace, role })) };
}
