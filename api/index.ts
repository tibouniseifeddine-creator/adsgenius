import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

export const app = express();
const port = Number(process.env.PORT ?? 4000);
let prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is not configured');
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
}

// Fail CLOSED (not open) when FRONTEND_ORIGIN isn't set: reflecting any
// origin (the previous `?? true` fallback) would let any website make
// credentialed requests against this API. `origin: false` disables
// cross-origin access entirely until FRONTEND_ORIGIN is explicitly
// configured -- verify it is set in every real deployment environment.
const allowedOrigins = process.env.FRONTEND_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : false, credentials: true }));
// Raised from the default ~100kb so a product photo (sent as a base64 data
// URL by the AI Creative Pack Engine, see /api/creative-packs/analyze below) fits.
// Images are compressed client-side first, but this is the server-side
// backstop -- see parseImageDataUrl()'s own MAX_IMAGE_BYTES check below.
app.use(express.json({ limit: '8mb' }));
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Image is too large -- please use a smaller photo (under ~4MB)' });
  }
  return next(err);
});

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // must match the JWT's own expiresIn below

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Issues a signed JWT AND records it in AuthSession so it can actually be
// revoked server-side later (see requireAuth/verifyAccessToken and POST
// /api/auth/logout below) -- previously a logout only ever forgot the token
// on the client, so a copy of it elsewhere (a shared device, a leaked token)
// stayed valid until its natural 7-day expiry. See audit finding P26.
// Deliberately NOT best-effort/non-fatal: if this insert fails, the caller's
// register/login should fail loudly too, rather than hand back a token that
// requireAuth would immediately reject on the very next request.
async function tokenFor(db: PrismaClient, userId: string): Promise<string> {
  const token = jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: '7d' });
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  // This app has no refresh-token flow (a single 7-day access JWT only), but
  // the AuthSession table (pre-existing in the schema) requires a unique
  // refreshTokenHash/refreshExpiresAt pair -- it was clearly designed for a
  // future refresh-token feature that was never built. Fill them with an
  // unused, never-checked placeholder rather than leaving the fields out.
  await db.authSession.create({
    data: {
      userId,
      accessTokenHash: hashToken(token),
      refreshTokenHash: hashToken(crypto.randomUUID()),
      expiresAt,
      refreshExpiresAt: expiresAt
    }
  });
  return token;
}

// Shared by requireAuth and GET /api/auth/me: checks the JWT's own
// signature/expiry AND that its AuthSession hasn't been revoked (logout) or
// expired server-side. Throws on any failure -- callers turn that into a 401.
async function verifyAccessToken(db: PrismaClient, authHeader: string | undefined): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized');
  const token = authHeader.slice(7);
  const payload = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
  const userId = String(payload.sub);
  const session = await db.authSession.findUnique({ where: { accessTokenHash: hashToken(token) } });
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    throw new Error('Unauthorized');
  }
  return userId;
}

async function userResponse(userId: string) {
  return getPrisma().user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, locale: true, timezone: true }
  });
}

// ---- Lightweight rate limiting (best-effort, not a hard cross-instance guarantee) ----
// Vercel may run multiple concurrent instances of this function, each with its
// own memory, so a burst spread across cold instances won't all share this
// counter. It still meaningfully slows down scripted brute-force/spam/AI-cost
// abuse from a client repeatedly hitting the same warm instance, which is the
// overwhelmingly common case. A hard, cross-instance guarantee would need a
// shared store (Redis/Vercel KV) or a DB-backed counter -- a good follow-up
// once that infrastructure exists.
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  // Opportunistic cleanup so the map doesn't grow unbounded in a long-lived warm instance.
  if (Math.random() < 0.01) {
    for (const [k, bucket] of rateLimitBuckets) {
      if (now > bucket.resetAt) rateLimitBuckets.delete(k);
    }
  }
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= maxAttempts) return false;
  bucket.count += 1;
  return true;
}

function clientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return first?.trim() || req.socket.remoteAddress || 'unknown';
}

function rateLimited(res: express.Response, retryAfterSeconds: number) {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  return res.status(429).json({ error: 'Too many requests -- please try again shortly.' });
}

// Parses an optional numeric request-body field. Previously `Number(x) || 0`
// silently turned typos/garbage input (e.g. "abc") into 0 instead of
// rejecting it -- see audit finding P27. Omitting the field entirely still
// defaults to 0 (unchanged behavior); only an actually-supplied, non-numeric
// value is now rejected.
function parseOptionalNumeric(value: unknown, fieldName: string): number {
  if (value === undefined || value === null || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw Object.assign(new Error(`${fieldName} must be a valid number`), { status: 400 });
  }
  return n;
}

// Same idea as parseOptionalNumeric but for quantity, which defaults to 1
// (not 0) and must be a positive value when supplied.
function parseOptionalQuantity(value: unknown): number {
  if (value === undefined || value === null || value === '') return 1;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw Object.assign(new Error('quantity must be a positive number'), { status: 400 });
  }
  return Math.round(n);
}

// A syntactically valid bcrypt hash of an unknown/unused password, compared
// against when no such user exists so bcrypt.compare always runs (see P24
// fix at POST /api/auth/login below). This value is never a real password
// hash and matches no possible input.
const LOGIN_DUMMY_HASH = '$2b$12$CwTycUXWue0Thq9StjUM0uJ8vSdpS4dQi2AAdxxRs4hpMD9SkVLC.';

const LOGIN_IP_LIMIT = { max: 20, windowMs: 15 * 60 * 1000 };
const LOGIN_EMAIL_LIMIT = { max: 8, windowMs: 15 * 60 * 1000 };
const PUBLIC_ORDER_IP_LIMIT = { max: 10, windowMs: 10 * 60 * 1000 };
const AI_WORKSPACE_LIMIT = { max: 40, windowMs: 60 * 60 * 1000 };

// Hard cap on the unpaginated list endpoints (products/creatives/creative-packs/
// audiences/orders) -- see audit finding P23. No workspace is anywhere near this
// volume yet, so this is a safety ceiling rather than real pagination; add proper
// cursor/offset pagination (and update the frontend to request pages) once a
// workspace's data genuinely outgrows a single response.
const LIST_PAGE_CAP = 200;

app.get('/api/health', (_req, res) => {
  return res.json({
    ok: true,
    api: true,
    databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()),
    jwtConfigured: Boolean(process.env.JWT_SECRET?.trim())
  });
});

// Deliberately permissive (matches most real-world email addresses without
// rejecting valid-but-unusual ones) -- just enough to reject registrations
// like "not-an-email" that a stricter downstream system (Meta OAuth, an
// email-delivery provider) would bounce anyway. See audit finding P25.
const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/auth/register', async (req, res) => {
  try {
    getJwtSecret();
    const db = getPrisma();
    const { email, password, name, businessName } = req.body as Record<string, string>;
    if (!email || !password || !name || !businessName || password.length < 8) {
      return res.status(400).json({ error: 'email, name, businessName and a password of at least 8 characters are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_FORMAT_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    const exists = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const slug = `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'}-${Date.now()}`;
    const user = await db.$transaction(async tx => {
      const created = await tx.user.create({ data: { email: normalizedEmail, passwordHash, name } });
      const workspace = await tx.workspace.create({ data: { name: businessName, slug } });
      await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId: created.id, role: 'OWNER' } });
      return created;
    });
    return res.status(201).json({ user: await userResponse(user.id), token: await tokenFor(db, user.id) });
  } catch (error) {
    console.error('Registration failed:', error);
    const message = error instanceof Error ? error.message : 'Registration failed';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    getJwtSecret();
    const db = getPrisma();
    const { email, password } = req.body as Record<string, string>;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const normalizedEmail = email.trim().toLowerCase();
    // Two independent limits: per-IP (stops one client trying many emails) and
    // per-email (stops distributed attempts against a single account).
    if (
      !checkRateLimit(`login:ip:${clientIp(req)}`, LOGIN_IP_LIMIT.max, LOGIN_IP_LIMIT.windowMs) ||
      !checkRateLimit(`login:email:${normalizedEmail}`, LOGIN_EMAIL_LIMIT.max, LOGIN_EMAIL_LIMIT.windowMs)
    ) {
      return rateLimited(res, 60);
    }
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });
    // Always run bcrypt.compare, even for an email that doesn't exist (against
    // a fixed dummy hash), so response time doesn't leak whether an account
    // exists -- see audit finding P24. bcrypt.compare's own timing is already
    // constant-time for a given hash, so the previous short-circuit (skipping
    // the compare entirely when !user) was the actual side channel.
    const passwordValid = await bcrypt.compare(password, user?.passwordHash ?? LOGIN_DUMMY_HASH);
    if (!user || !passwordValid) return res.status(401).json({ error: 'Invalid email or password' });
    return res.json({ user: await userResponse(user.id), token: await tokenFor(db, user.id) });
  } catch (error) {
    console.error('Login failed:', error);
    const message = error instanceof Error ? error.message : 'Login failed';
    return res.status(500).json({ error: message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const userId = await verifyAccessToken(getPrisma(), req.headers.authorization);
    const user = await userResponse(userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ user });
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

// Revokes the current session server-side (see verifyAccessToken/AuthSession
// above) so a copy of this token elsewhere -- a shared device, a leaked
// token -- stops working immediately instead of staying valid until its
// natural 7-day expiry. See audit finding P26. Deliberately NOT gated behind
// requireAuth and always returns 204: an already-expired/invalid/re-sent
// token still means "this token should not work", which is already true, so
// logout should never itself fail or 401.
app.post('/api/auth/logout', async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      await getPrisma().authSession.updateMany({
        where: { accessTokenHash: hashToken(header.slice(7)), revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }
  } catch (error) {
    console.error('Logout revoke failed (non-fatal):', error);
  }
  return res.status(204).end();
});

// Lets a signed-in user change their own password -- see audit finding P22
// (Settings.tsx had a "Change Password" button with no backend behind it).
// Requires the current password so a stolen/left-open session can't be used
// to lock the real owner out.
app.patch('/api/auth/password', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const { currentPassword, newPassword } = req.body as Record<string, string>;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Current password and a new password of at least 8 characters are required' });
    }
    const user = await db.user.findUnique({ where: { id: (req as any).userId } });
    if (!user) return res.status(404).json({ error: 'Account not found' });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.user.update({ where: { id: user.id }, data: { passwordHash } });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Password change failed:', error);
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

// Shared auth guard for every endpoint below. Verifies the bearer JWT AND its
// AuthSession the same way /api/auth/me already does, and attaches the user
// id to the request.
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    (req as any).userId = await verifyAccessToken(getPrisma(), req.headers.authorization);
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Every user gets exactly one workspace at registration (see /api/auth/register).
// This resolves it so product/campaign/etc. data is scoped per-account.
async function getUserWorkspaceId(db: PrismaClient, userId: string): Promise<string | null> {
  const membership = await db.workspaceMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: { workspaceId: true }
  });
  return membership?.workspaceId ?? null;
}

// Translates the DB's Workspace row into the shape Settings.tsx expects (see
// audit finding P22 -- Settings.tsx used to read from a `business` object
// that was declared but never actually populated from anywhere).
function toApiWorkspace(w: { id: string; name: string; defaultCountryCode: string; defaultCurrency: string; timezone: string }) {
  return { id: w.id, name: w.name, country: w.defaultCountryCode, currency: w.defaultCurrency, timezone: w.timezone };
}

app.get('/api/workspace', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.status(404).json({ error: 'No workspace found for this account' });
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, defaultCountryCode: true, defaultCurrency: true, timezone: true }
    });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    return res.json({ workspace: toApiWorkspace(workspace) });
  } catch (error) {
    console.error('Load workspace failed:', error);
    return res.status(500).json({ error: 'Failed to load workspace' });
  }
});

app.patch('/api/workspace', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.status(404).json({ error: 'No workspace found for this account' });
    const body = req.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (typeof body.country === 'string' && body.country.trim()) data.defaultCountryCode = body.country.trim();
    if (typeof body.currency === 'string' && body.currency.trim()) data.defaultCurrency = body.currency.trim().toUpperCase().slice(0, 3);
    if (typeof body.timezone === 'string' && body.timezone.trim()) data.timezone = body.timezone.trim();
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    const updated = await db.workspace.update({ where: { id: workspaceId }, data: data as any });
    return res.json({ workspace: toApiWorkspace(updated) });
  } catch (error) {
    console.error('Update workspace failed:', error);
    return res.status(500).json({ error: 'Failed to update workspace' });
  }
});

// Translates the DB's Product row into the shape src/types/index.ts already expects
// on the frontend (purchaseCost/sellingPrice/deliveryCost naming, images/videos as
// empty arrays since there's no asset storage yet). This keeps today's patch small:
// the frontend Product type does not need to change to consume real data. See
// COWORK_ADSGENIUS_REALDATA_PLAN.md section 4 for the naming-mismatch background.
function toApiProduct(p: {
  id: string; workspaceId: string; name: string; sku: string | null; category: string | null;
  description: string; baseCost: unknown; salePrice: unknown; stock: number; shippingCost: unknown;
  packagingCost: unknown; expectedCancellationRate: unknown; expectedReturnRate: unknown;
}) {
  return {
    id: p.id,
    businessId: p.workspaceId,
    name: p.name,
    sku: p.sku ?? '',
    category: p.category ?? '',
    description: p.description,
    purchaseCost: Number(p.baseCost),
    sellingPrice: Number(p.salePrice),
    stock: p.stock,
    images: [] as string[],
    videos: [] as string[],
    deliveryCost: Number(p.shippingCost),
    packagingCost: Number(p.packagingCost),
    expectedCancellationRate: Number(p.expectedCancellationRate),
    expectedReturnRate: Number(p.expectedReturnRate)
  };
}

app.get('/api/products', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.json({ products: [] });
    const rows = await db.product.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: LIST_PAGE_CAP });
    return res.json({ products: rows.map(toApiProduct) });
  } catch (error) {
    console.error('List products failed:', error);
    return res.status(500).json({ error: 'Failed to load products' });
  }
});

app.post('/api/products', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for this account' });

    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const sellingPrice = Number(body.sellingPrice);
    if (!name || !Number.isFinite(sellingPrice)) {
      return res.status(400).json({ error: 'name and sellingPrice are required' });
    }

    const created = await db.product.create({
      data: {
        workspaceId,
        name,
        description: typeof body.description === 'string' ? body.description : '',
        sku: typeof body.sku === 'string' && body.sku.trim() ? body.sku.trim() : null,
        category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : null,
        baseCost: parseOptionalNumeric(body.purchaseCost, 'purchaseCost'),
        salePrice: sellingPrice,
        currency: 'DZD',
        stock: parseOptionalNumeric(body.stock, 'stock'),
        shippingCost: parseOptionalNumeric(body.deliveryCost, 'deliveryCost'),
        packagingCost: parseOptionalNumeric(body.packagingCost, 'packagingCost'),
        expectedCancellationRate: parseOptionalNumeric(body.expectedCancellationRate, 'expectedCancellationRate'),
        expectedReturnRate: parseOptionalNumeric(body.expectedReturnRate, 'expectedReturnRate')
      }
    });
    return res.status(201).json({ product: toApiProduct(created) });
  } catch (error: any) {
    console.error('Create product failed:', error);
    if (error?.code === 'P2002') return res.status(409).json({ error: 'A product with this SKU already exists' });
    if (typeof error?.status === 'number') return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: 'Failed to create product' });
  }
});

// Translates the DB's Creative row into the shape src/types/index.ts already
// expects (productId defaulted to '' instead of null/undefined, status
// lowercased -- see toApiProduct() above for the same pattern). Creative
// Studio was 100% fake/demo data before this; aiScore/aiExplanation/metrics
// are left undefined since there is no real AI scoring or ad-spend data yet.
function toApiCreative(c: {
  id: string; workspaceId: string; productId: string | null; name: string; type: string;
  status: string; angle: string | null; hook: string | null; primaryText: string | null;
  headline: string | null; cta: string | null; url: string | null;
}) {
  return {
    id: c.id,
    productId: c.productId ?? '',
    name: c.name,
    type: c.type,
    angle: c.angle ?? '',
    url: c.url ?? undefined,
    hook: c.hook ?? undefined,
    primaryText: c.primaryText ?? undefined,
    headline: c.headline ?? undefined,
    cta: c.cta ?? undefined,
    status: c.status.toLowerCase()
  };
}

const CREATIVE_TYPES = new Set([
  'image_ad', 'story', 'reel', 'carousel', 'facebook_feed', 'instagram_feed', 'instagram_story', 'instagram_reel'
]);
const CREATIVE_STATUSES = new Set(['draft', 'ready', 'approved', 'archived']);

app.get('/api/creatives', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.json({ creatives: [] });
    const rows = await db.creative.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: LIST_PAGE_CAP });
    return res.json({ creatives: rows.map(toApiCreative) });
  } catch (error) {
    console.error('List creatives failed:', error);
    return res.status(500).json({ error: 'Failed to load creatives' });
  }
});
// There is no real AI generation yet, so every creative is entered by hand
// here via the Creative Studio page's "Add Creative" form (mirrors how
// /api/orders works for manual order entry -- see src/pages/Orders.tsx).
app.post('/api/creatives', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for this account' });

    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'name is required' });

    const typeInput = typeof body.type === 'string' ? body.type.trim() : '';
    const type = CREATIVE_TYPES.has(typeInput) ? typeInput : 'image_ad';

    const statusInput = typeof body.status === 'string' ? body.status.trim().toLowerCase() : 'draft';
    const status = (CREATIVE_STATUSES.has(statusInput) ? statusInput : 'draft').toUpperCase();

    const productId = typeof body.productId === 'string' && body.productId.trim() ? body.productId.trim() : null;
    // Same ownership check as /api/orders: a creative can never be attached
    // to another workspace's product.
    if (productId) {
      const product = await db.product.findFirst({ where: { id: productId, workspaceId } });
      if (!product) return res.status(400).json({ error: 'Product not found' });
    }

    const created = await db.creative.create({
      data: {
        workspaceId,
        productId,
        name,
        type,
        status: status as any,
        angle: typeof body.angle === 'string' ? body.angle.trim() : null,
        hook: typeof body.hook === 'string' ? body.hook.trim() : null,
        primaryText: typeof body.primaryText === 'string' ? body.primaryText.trim() : null,
        headline: typeof body.headline === 'string' ? body.headline.trim() : null,
        cta: typeof body.cta === 'string' ? body.cta.trim() : null,
        url: typeof body.url === 'string' && body.url.trim() ? body.url.trim() : null
      }
    });
    return res.status(201).json({ creative: toApiCreative(created) });
  } catch (error) {
    console.error('Create creative failed:', error);
    return res.status(500).json({ error: 'Failed to create creative' });
  }
});

// ---- AI-assisted ad copywriting (Claude) ----
// Optional add-on: only works once ANTHROPIC_API_KEY is set in the environment.
// Generates a *suggested* hook/headline/primaryText/cta from a product (or
// freehand product info) that the user reviews and edits in the Creative
// Studio "Add Creative" form before saving via the existing POST
// /api/creatives -- nothing is written to the database by this endpoint.
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL?.trim() || 'claude-3-5-haiku-latest';

// Every outbound call to Anthropic/OpenAI goes through this so a stalled
// upstream request is aborted well before Vercel's own hard function-timeout
// kills it uncleanly -- see audit finding P17.
const AI_REQUEST_TIMEOUT_MS = 55_000;

async function fetchWithTimeout(url: string, init: Record<string, unknown>, timeoutMs = AI_REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal } as any);
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw Object.assign(new Error('AI request timed out -- please try again'), { status: 504 });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function generateAdCopy(input: {
  productName: string; description?: string; category?: string; price?: number; currency?: string;
  angle?: string; language: 'ar' | 'fr' | 'en';
}): Promise<{ suggestion: { hook: string; headline: string; primaryText: string; cta: string }; usage: { inputTokens: number; outputTokens: number } }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw Object.assign(new Error('AI copywriting is not configured yet (missing ANTHROPIC_API_KEY)'), { status: 501 });
  }

  const languageName = input.language === 'ar' ? 'Arabic' : input.language === 'fr' ? 'French' : 'English';
  const productLines = [
    `Product name: ${input.productName}`,
    input.description ? `Description: ${input.description}` : null,
    input.category ? `Category: ${input.category}` : null,
    input.price ? `Price: ${input.price} ${input.currency ?? 'DZD'}` : null,
    input.angle ? `Requested angle/theme: ${input.angle}` : null
  ].filter(Boolean).join('\n');

  const system = `You are an expert direct-response copywriter for Facebook/Instagram/TikTok ads selling to online shoppers in Algeria who pay cash-on-delivery. Write in ${languageName}. Respond with ONLY raw JSON (no markdown fences, no commentary) matching exactly this shape: {"hook": string, "headline": string, "primaryText": string, "cta": string}. "hook": a scroll-stopping opening line, under 15 words. "headline": a punchy value proposition, under 8 words. "primaryText": 2-4 short benefit-led sentences separated by line breaks, ending with a soft call to action. "cta": a short button label, 2-4 words.`;

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 500,
      system,
      messages: [{ role: 'user', content: productLines }]
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Anthropic API error:', response.status, detail);
    throw Object.assign(new Error(`AI request failed (${response.status})`), { status: 502 });
  }

  const data = (await response.json()) as any;
  const raw = ((data?.content ?? []) as any[]).map(block => (block?.type === 'text' ? block.text : '')).join('').trim();
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw Object.assign(new Error('AI returned an unexpected response'), { status: 502 });
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
  } catch {
    throw Object.assign(new Error('AI returned an unexpected response'), { status: 502 });
  }

  return {
    suggestion: {
      hook: typeof parsed.hook === 'string' ? parsed.hook.trim() : '',
      headline: typeof parsed.headline === 'string' ? parsed.headline.trim() : '',
      primaryText: typeof parsed.primaryText === 'string' ? parsed.primaryText.trim() : '',
      cta: typeof parsed.cta === 'string' ? parsed.cta.trim() : ''
    },
    usage: {
      inputTokens: Number(data?.usage?.input_tokens) || 0,
      outputTokens: Number(data?.usage?.output_tokens) || 0
    }
  };
}

app.post('/api/creatives/generate-copy', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const userId = (req as any).userId as string;
    const workspaceId = await getUserWorkspaceId(db, userId);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for this account' });
    if (!checkRateLimit(`ai:${workspaceId}`, AI_WORKSPACE_LIMIT.max, AI_WORKSPACE_LIMIT.windowMs)) return rateLimited(res, 60);

    const body = req.body as Record<string, unknown>;
    const language = body.language === 'fr' || body.language === 'en' ? body.language : 'ar';
    const angle = typeof body.angle === 'string' && body.angle.trim() ? body.angle.trim() : undefined;

    let productName: string;
    let description: string | undefined;
    let category: string | undefined;
    let price: number | undefined;
    let currency: string | undefined;

    const productId = typeof body.productId === 'string' && body.productId.trim() ? body.productId.trim() : null;
    if (productId) {
      const product = await db.product.findFirst({ where: { id: productId, workspaceId } });
      if (!product) return res.status(400).json({ error: 'Product not found' });
      productName = product.name;
      description = product.description || undefined;
      category = product.category ?? undefined;
      price = Number(product.salePrice);
      currency = product.currency;
    } else {
      productName = typeof body.productName === 'string' ? body.productName.trim() : '';
      if (!productName) return res.status(400).json({ error: 'productId or productName is required' });
      description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : undefined;
    }

    // Logged to the AITask audit trail like every other AI-calling route --
    // this was previously the one gap in that pattern (audit finding P16),
    // and now also persists real token usage to AIUsage (P15).
    let suggestion;
    try {
      const generated = await generateAdCopy({ productName, description, category, price, currency, angle, language: language as 'ar' | 'fr' | 'en' });
      suggestion = generated.suggestion;
      await logAiTask(db, { workspaceId, userId, capability: 'creative_generate_copy', provider: 'ANTHROPIC', model: ANTHROPIC_MODEL, status: 'SUCCEEDED', inputJson: { productName, category, language }, usage: generated.usage });
    } catch (err: any) {
      await logAiTask(db, { workspaceId, userId, capability: 'creative_generate_copy', provider: 'ANTHROPIC', model: ANTHROPIC_MODEL, status: 'FAILED', inputJson: { productName, category, language }, errorMessage: err instanceof Error ? err.message : 'unknown error' });
      throw err;
    }
    return res.json({ suggestion });
  } catch (error: any) {
    console.error('Generate ad copy failed:', error);
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'Failed to generate ad copy' });
  }
});
// ==================================================================================
// ---- AI Creative Pack Engine (product photo + name -> full creative pack) ----
// ==================================================================================
// Phase 1 (text + vision, works today with only ANTHROPIC_API_KEY -- Claude
// reads the product photo directly, no separate vision provider needed):
//   analyze product photo -> marketing strategy/angles -> N distinct ad
//   concepts (hook/copy/visual idea per angle) -> per-concept regeneration.
// Phase 2 (real ad images, needs OPENAI_API_KEY): generateConceptImageWithAI()
// edits the actual product photo via OpenAI's image-edit endpoint so the
// product itself never changes ("Product Lock"), only background/context.
// Phase 3 (video) is NOT implemented -- see the delivery notes: it needs an
// async job architecture (a single request here has no time budget for a
// minutes-long video render) and a chosen video-generation provider.
//
// Storage: product photos and generated images are kept as base64 data URLs
// directly on the CreativePack/CreativePackConcept rows (see storeImage() below) --
// zero new infrastructure/dependency needed today. Swap storeImage() for a
// real object-storage upload (e.g. Vercel Blob) later if volume grows; no
// caller needs to change since they only see a string URL/URI either way.

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const DEFAULT_CONCEPT_COUNT = 5;
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-1';

function aiLanguageName(language: 'ar' | 'fr' | 'en'): string {
  return language === 'ar' ? 'Arabic' : language === 'fr' ? 'French' : 'English';
}

function parseImageDataUrl(dataUrl: string): { mediaType: string; base64Data: string } {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([a-zA-Z0-9+/=]+)$/.exec((dataUrl || '').trim());
  if (!match) {
    throw Object.assign(new Error('Product image must be a JPEG, PNG, WEBP or GIF data URL'), { status: 400 });
  }
  const approxBytes = Math.ceil((match[2].length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error('Product image is too large -- please use a photo under 4MB'), { status: 400 });
  }
  return { mediaType: match[1], base64Data: match[2] };
}

// MVP image storage -- see the header comment above this section.
function storeImage(dataUrl: string): string {
  return dataUrl;
}

async function loadImageBytes(source: string): Promise<{ buffer: Buffer; mediaType: string }> {
  if (source.startsWith('data:')) {
    const { mediaType, base64Data } = parseImageDataUrl(source);
    return { buffer: Buffer.from(base64Data, 'base64'), mediaType };
  }
  const res = await fetch(source);
  if (!res.ok) throw Object.assign(new Error(`Failed to load the product image (${res.status})`), { status: 502 });
  const mediaType = res.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mediaType };
}

// Best-effort usage/audit trail using the AITask table that already exists in
// the schema but was unused until now. Never allowed to break the caller.
async function logAiTask(db: PrismaClient, input: {
  workspaceId: string; userId?: string; capability: string; provider: 'ANTHROPIC' | 'OPENAI';
  model: string; status: 'SUCCEEDED' | 'FAILED'; inputJson: unknown; outputJson?: unknown; errorMessage?: string;
  // Real token counts from the provider's own response, when the caller has
  // them (only on SUCCEEDED calls) -- persisted to AIUsage, which existed in
  // the schema but was never written to before. See audit finding P15.
  usage?: { inputTokens: number; outputTokens: number };
}) {
  try {
    const task = await db.aITask.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        capability: input.capability,
        provider: input.provider as any,
        model: input.model,
        status: input.status as any,
        inputJson: (input.inputJson ?? {}) as any,
        outputJson: (input.outputJson ?? null) as any,
        errorMessage: input.errorMessage,
        startedAt: new Date(),
        completedAt: new Date()
      }
    });
    if (input.usage) {
      await db.aIUsage.create({
        data: { taskId: task.id, inputTokens: input.usage.inputTokens, outputTokens: input.usage.outputTokens }
      });
    }
  } catch (err) {
    console.error('Failed to log AITask (non-fatal):', err);
  }
}

// Shared Claude caller for every JSON-producing prompt below (analysis,
// strategy, concepts, regeneration). Mirrors generateAdCopy()'s parsing
// approach but also accepts multi-part (vision) content and top-level arrays.
async function callClaudeForJSON(system: string, userContent: unknown, maxTokens: number): Promise<{ result: any; usage: { inputTokens: number; outputTokens: number } }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw Object.assign(new Error('AI is not configured yet (missing ANTHROPIC_API_KEY)'), { status: 501 });
  }
  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: userContent }] })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Anthropic API error:', response.status, detail);
    throw Object.assign(new Error(`AI request failed (${response.status})`), { status: 502 });
  }
  const data = (await response.json()) as any;
  const usage = { inputTokens: Number(data?.usage?.input_tokens) || 0, outputTokens: Number(data?.usage?.output_tokens) || 0 };
  const raw = ((data?.content ?? []) as any[]).map(block => (block?.type === 'text' ? block.text : '')).join('').trim();
  const objStart = raw.indexOf('{');
  const objEnd = raw.lastIndexOf('}');
  const arrStart = raw.indexOf('[');
  const arrEnd = raw.lastIndexOf(']');
  let start = -1;
  let end = -1;
  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    start = arrStart; end = arrEnd;
  } else if (objStart !== -1) {
    start = objStart; end = objEnd;
  }
  if (start === -1 || end === -1 || end <= start) {
    throw Object.assign(new Error('AI returned an unexpected response'), { status: 502 });
  }
  try {
    return { result: JSON.parse(raw.slice(start, end + 1)), usage };
  } catch {
    throw Object.assign(new Error('AI returned an unexpected response'), { status: 502 });
  }
}

async function analyzeProductWithAI(input: {
  imageDataUrl: string; productName: string; category?: string; targetAudience?: string;
  country?: string; sellingPrice?: number; currency?: string; mainBenefit?: string; language: 'ar' | 'fr' | 'en';
}): Promise<{ analysis: Record<string, unknown>; strategy: Record<string, unknown>; usage: { inputTokens: number; outputTokens: number } }> {
  const { mediaType, base64Data } = parseImageDataUrl(input.imageDataUrl);
  const languageName = aiLanguageName(input.language);
  const hints = [
    `Product name: ${input.productName}`,
    input.category ? `Category: ${input.category}` : null,
    input.targetAudience ? `User-provided target audience: ${input.targetAudience}` : null,
    input.country ? `Target market/country: ${input.country}` : null,
    input.sellingPrice ? `Selling price: ${input.sellingPrice} ${input.currency ?? ''}`.trim() : null,
    input.mainBenefit ? `User-provided main benefit: ${input.mainBenefit}` : null
  ].filter(Boolean).join('\n') || 'No additional details provided -- rely on the photo.';

  const system = `You are an expert e-commerce visual merchandiser and performance-marketing strategist working on Facebook/Instagram/TikTok ads for online shoppers in Algeria and nearby markets who often pay cash-on-delivery. Look carefully at the product photo. Base every claim on what you can actually see in the image or on information the user explicitly provided -- never invent specifications, materials or claims that are not visible or stated; anything you are not certain about goes under "assumptions" instead of being stated as fact. Write every text value in ${languageName}, except the fixed English enum values in "recommendedAngles". Respond with ONLY raw JSON (no markdown fences, no commentary) matching exactly this shape:
{"analysis":{"productType":string,"keyFeatures":string[],"colors":string[],"design":string,"likelyUse":string,"likelyAudience":string,"valueProposition":string,"benefits":string[],"painPoints":string[],"objections":string[],"assumptions":string[]},"strategy":{"recommendedAngles":string[] (3 to 6 values, each one of: "problem_solution","benefits","emotional","social_proof","premium","price_value","before_after","lifestyle","convenience","urgency" -- pick only what genuinely fits, never all of them),"targetAudience":string,"recommendedPlatform":string,"recommendedObjective":string,"rationale":string}}`;

  const { result, usage } = await callClaudeForJSON(system, [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
    { type: 'text', text: hints }
  ], 1800);

  const analysis = result?.analysis ?? {};
  const strategy = result?.strategy ?? {};
  return {
    analysis: {
      productType: analysis.productType ?? '', keyFeatures: Array.isArray(analysis.keyFeatures) ? analysis.keyFeatures : [],
      colors: Array.isArray(analysis.colors) ? analysis.colors : [], design: analysis.design ?? '',
      likelyUse: analysis.likelyUse ?? '', likelyAudience: analysis.likelyAudience ?? '',
      valueProposition: analysis.valueProposition ?? '', benefits: Array.isArray(analysis.benefits) ? analysis.benefits : [],
      painPoints: Array.isArray(analysis.painPoints) ? analysis.painPoints : [],
      objections: Array.isArray(analysis.objections) ? analysis.objections : [],
      assumptions: Array.isArray(analysis.assumptions) ? analysis.assumptions : []
    },
    strategy: {
      recommendedAngles: Array.isArray(strategy.recommendedAngles) && strategy.recommendedAngles.length ? strategy.recommendedAngles : ['benefits', 'emotional', 'social_proof'],
      targetAudience: strategy.targetAudience ?? '', recommendedPlatform: strategy.recommendedPlatform ?? '',
      recommendedObjective: strategy.recommendedObjective ?? '', rationale: strategy.rationale ?? ''
    },
    usage
  };
}
async function generateConceptsWithAI(input: {
  productName: string; analysis: unknown; angles: string[]; count: number;
  category?: string; mainBenefit?: string; language: 'ar' | 'fr' | 'en';
}): Promise<{ concepts: Array<{ angle: string; hook: string; primaryText: string; headline: string; cta: string; visualConcept: string; targetAudience: string }>; usage: { inputTokens: number; outputTokens: number } }> {
  const languageName = aiLanguageName(input.language);
  const system = `You are an expert direct-response copywriter and art director for Facebook/Instagram/TikTok ads targeting online shoppers in Algeria and nearby markets (cash-on-delivery common). Produce ${input.count} GENUINELY DIFFERENT ad concepts for the SAME product, one per marketing angle given, in the same order. Each concept must differ in real substance -- hook style, emotional tone, framing -- never just a reworded synonym of another concept. Write every text field in ${languageName}. Respond with ONLY raw JSON (no markdown fences, no commentary): a JSON array of exactly ${input.count} objects shaped as:
{"angle":string (one of the given angles, matching order),"hook":string (under 15 words, scroll-stopping),"primaryText":string (2-4 short benefit-led sentences separated by line breaks, ending with a soft call to action),"headline":string (under 8 words),"cta":string (2-4 words),"visualConcept":string (one sentence describing the ad image/scene for this concept -- must keep the real product exactly as photographed, only changing background/setting/lighting/context),"targetAudience":string (one short phrase)}`;

  const userText = [
    `Product: ${input.productName}`,
    input.category ? `Category: ${input.category}` : null,
    input.mainBenefit ? `Main benefit to emphasize: ${input.mainBenefit}` : null,
    `Product analysis: ${JSON.stringify(input.analysis)}`,
    `Angles to use, in order, one concept per angle: ${JSON.stringify(input.angles)}`
  ].filter(Boolean).join('\n');

  const { result, usage } = await callClaudeForJSON(system, userText, 2200);
  const list: any[] = Array.isArray(result) ? result : Array.isArray(result?.concepts) ? result.concepts : [];
  const concepts = input.angles.map((angle, i) => {
    const c = list[i] ?? {};
    return {
      angle: typeof c?.angle === 'string' && c.angle ? c.angle : angle,
      hook: typeof c?.hook === 'string' ? c.hook.trim() : '',
      primaryText: typeof c?.primaryText === 'string' ? c.primaryText.trim() : '',
      headline: typeof c?.headline === 'string' ? c.headline.trim() : '',
      cta: typeof c?.cta === 'string' ? c.cta.trim() : '',
      visualConcept: typeof c?.visualConcept === 'string' ? c.visualConcept.trim() : '',
      targetAudience: typeof c?.targetAudience === 'string' ? c.targetAudience.trim() : ''
    };
  });
  return { concepts, usage };
}

async function regenerateConceptWithAI(input: {
  productName: string; angle: string; field: 'hook' | 'copy' | 'all'; language: 'ar' | 'fr' | 'en'; analysis?: unknown;
}): Promise<{ update: Partial<{ hook: string; primaryText: string; headline: string; cta: string; visualConcept: string }>; usage: { inputTokens: number; outputTokens: number } }> {
  const languageName = aiLanguageName(input.language);
  const scope = input.field === 'hook' ? 'ONLY a new "hook"' : input.field === 'copy' ? 'a new "primaryText", "headline" and "cta"' : 'a new "hook", "primaryText", "headline", "cta" and "visualConcept"';
  const system = `You are an expert direct-response copywriter for Facebook/Instagram ads in Algeria. Generate a fresh alternative for the SAME product and marketing angle -- genuinely different wording and framing than a typical first draft, not a synonym swap. Write in ${languageName}. Respond with ONLY raw JSON (no markdown fences): an object with ${scope} (omit fields not requested).`;
  const userText = [`Product: ${input.productName}`, `Marketing angle: ${input.angle}`, input.analysis ? `Product analysis: ${JSON.stringify(input.analysis)}` : null].filter(Boolean).join('\n');
  const { result, usage } = await callClaudeForJSON(system, userText, 700);
  const update: Partial<{ hook: string; primaryText: string; headline: string; cta: string; visualConcept: string }> = {};
  if (typeof result?.hook === 'string') update.hook = result.hook.trim();
  if (typeof result?.primaryText === 'string') update.primaryText = result.primaryText.trim();
  if (typeof result?.headline === 'string') update.headline = result.headline.trim();
  if (typeof result?.cta === 'string') update.cta = result.cta.trim();
  if (typeof result?.visualConcept === 'string') update.visualConcept = result.visualConcept.trim();
  return { update, usage };
}

// Phase 2: edits the ACTUAL product photo (keeps the product itself locked)
// rather than generating an unrelated image from a text prompt alone.
async function generateConceptImageWithAI(input: { productImageUrl: string; visualConcept: string; productName: string }): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw Object.assign(new Error('AI image generation is not configured yet (missing OPENAI_API_KEY)'), { status: 501 });
  }
  const { buffer, mediaType } = await loadImageBytes(input.productImageUrl);
  const ext = mediaType.includes('png') ? 'png' : mediaType.includes('webp') ? 'webp' : 'jpg';
  const form = new FormData();
  form.append('model', OPENAI_IMAGE_MODEL);
  form.append('image', new Blob([buffer], { type: mediaType }), `product.${ext}`);
  form.append('prompt', `Keep the exact product from the reference photo completely unchanged -- same shape, color, logo, texture and design ("Product Lock"). Only change the background, setting, lighting and surrounding context to match this ad concept: ${input.visualConcept}. Product: ${input.productName}. Professional e-commerce advertising photo, high quality, realistic.`);
  form.append('size', '1024x1024');

  // Image generation legitimately runs longer than text generation, hence the
  // longer timeout than AI_REQUEST_TIMEOUT_MS -- tune this to whatever your
  // actual Vercel function maxDuration is configured to.
  const response = await fetchWithTimeout('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: form as any
  }, 90_000);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('OpenAI image API error:', response.status, detail);
    throw Object.assign(new Error(`AI image request failed (${response.status})`), { status: 502 });
  }
  const data = (await response.json()) as any;
  const b64 = data?.data?.[0]?.b64_json;
  const url = data?.data?.[0]?.url;
  if (typeof b64 === 'string' && b64) return `data:image/png;base64,${b64}`;
  if (typeof url === 'string' && url) return url;
  throw Object.assign(new Error('AI image generation returned an unexpected response'), { status: 502 });
}

function toApiConcept(c: {
  id: string; index: number; angle: string; hook: string | null; primaryText: string | null;
  headline: string | null; cta: string | null; visualConcept: string | null; targetAudience: string | null;
  imageUrl: string | null; imageStatus: string; imageError: string | null;
}) {
  return {
    id: c.id, index: c.index, angle: c.angle, hook: c.hook ?? '', primaryText: c.primaryText ?? '',
    headline: c.headline ?? '', cta: c.cta ?? '', visualConcept: c.visualConcept ?? '',
    targetAudience: c.targetAudience ?? '', imageUrl: c.imageUrl ?? undefined,
    imageStatus: c.imageStatus.toLowerCase(), imageError: c.imageError ?? undefined
  };
}

function toApiCreativePack(c: {
  id: string; productName: string; productImageUrl: string | null; category: string | null;
  targetAudience: string | null; country: string | null; language: string; sellingPrice: unknown;
  currency: string | null; mainBenefit: string | null; websiteUrl: string | null; analysis: unknown;
  strategy: unknown; status: string; createdAt: Date; updatedAt: Date;
}, concepts: ReturnType<typeof toApiConcept>[]) {
  return {
    id: c.id, productName: c.productName, productImageUrl: c.productImageUrl ?? undefined,
    category: c.category ?? undefined, targetAudience: c.targetAudience ?? undefined, country: c.country ?? undefined,
    language: c.language, sellingPrice: c.sellingPrice != null ? Number(c.sellingPrice) : undefined,
    currency: c.currency ?? undefined, mainBenefit: c.mainBenefit ?? undefined, websiteUrl: c.websiteUrl ?? undefined,
    analysis: c.analysis ?? undefined, strategy: c.strategy ?? undefined, status: c.status.toLowerCase(),
    createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(), concepts
  };
}

// Step 1: upload product photo + name (+ optional hints) -> AI vision analysis
// + marketing strategy. Persists a draft CreativePack row immediately.
app.post('/api/creative-packs/analyze', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const userId = (req as any).userId as string;
    const workspaceId = await getUserWorkspaceId(db, userId);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for this account' });
    if (!checkRateLimit(`ai:${workspaceId}`, AI_WORKSPACE_LIMIT.max, AI_WORKSPACE_LIMIT.windowMs)) return rateLimited(res, 60);

    const body = req.body as Record<string, unknown>;
    const productName = typeof body.productName === 'string' ? body.productName.trim() : '';
    const imageDataUrl = typeof body.productImage === 'string' ? body.productImage.trim() : '';
    if (!productName || !imageDataUrl) return res.status(400).json({ error: 'productImage and productName are required' });
    parseImageDataUrl(imageDataUrl);

    const language = body.language === 'fr' || body.language === 'en' ? body.language : 'ar';
    const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : undefined;
    const targetAudience = typeof body.targetAudience === 'string' && body.targetAudience.trim() ? body.targetAudience.trim() : undefined;
    const country = typeof body.country === 'string' && body.country.trim() ? body.country.trim() : undefined;
    const mainBenefit = typeof body.mainBenefit === 'string' && body.mainBenefit.trim() ? body.mainBenefit.trim() : undefined;
    const websiteUrl = typeof body.websiteUrl === 'string' && body.websiteUrl.trim() ? body.websiteUrl.trim() : undefined;
    const sellingPrice = body.sellingPrice !== undefined && body.sellingPrice !== '' && Number.isFinite(Number(body.sellingPrice)) ? Number(body.sellingPrice) : undefined;
    const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : undefined;

    let result: { analysis: Record<string, unknown>; strategy: Record<string, unknown>; usage: { inputTokens: number; outputTokens: number } };
    try {
      result = await analyzeProductWithAI({ imageDataUrl, productName, category, targetAudience, country, sellingPrice, currency, mainBenefit, language: language as any });
      await logAiTask(db, { workspaceId, userId, capability: 'creative_pack_analysis', provider: 'ANTHROPIC', model: ANTHROPIC_MODEL, status: 'SUCCEEDED', inputJson: { productName, category, language }, usage: result.usage });
    } catch (err: any) {
      await logAiTask(db, { workspaceId, userId, capability: 'creative_pack_analysis', provider: 'ANTHROPIC', model: ANTHROPIC_MODEL, status: 'FAILED', inputJson: { productName, category, language }, errorMessage: err instanceof Error ? err.message : 'unknown error' });
      throw err;
    }

    const productImageUrl = storeImage(imageDataUrl);
    const campaign = await db.creativePack.create({
      data: {
        workspaceId, productName, productImageUrl, category, targetAudience, country, language,
        sellingPrice: sellingPrice as any, currency, mainBenefit, websiteUrl,
        analysis: result.analysis as any, strategy: result.strategy as any, status: 'DRAFT' as any
      }
    });
    return res.status(201).json({ creativePack: toApiCreativePack(campaign, []) });
  } catch (error: any) {
    console.error('CreativePack analyze failed:', error);
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'Failed to analyze product' });
  }
});

// Step 2: generate the creative pack (N distinct hook/copy/visual concepts,
// one per recommended marketing angle) for an already-analyzed campaign.
app.post('/api/creative-packs/:id/concepts', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const userId = (req as any).userId as string;
    const workspaceId = await getUserWorkspaceId(db, userId);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for this account' });
    if (!checkRateLimit(`ai:${workspaceId}`, AI_WORKSPACE_LIMIT.max, AI_WORKSPACE_LIMIT.windowMs)) return rateLimited(res, 60);

    const campaign = await db.creativePack.findFirst({ where: { id: req.params.id, workspaceId } });
    if (!campaign) return res.status(404).json({ error: 'CreativePack not found' });

    const body = req.body as Record<string, unknown>;
    const requestedCount = Number(body.count);
    const count = Number.isFinite(requestedCount) && requestedCount > 0 ? Math.min(Math.round(requestedCount), 8) : DEFAULT_CONCEPT_COUNT;

    const strategy = (campaign.strategy as any) ?? {};
    const strategyAngles: string[] = Array.isArray(strategy.recommendedAngles) && strategy.recommendedAngles.length ? strategy.recommendedAngles : ['benefits', 'emotional', 'social_proof', 'problem_solution', 'urgency'];
    const requestedAngles = Array.isArray(body.angles) ? (body.angles as unknown[]).filter((a): a is string => typeof a === 'string') : undefined;
    const pool = requestedAngles?.length ? requestedAngles : strategyAngles;
    const angles: string[] = [];
    for (let i = 0; i < count; i++) angles.push(pool[i % pool.length]);

    let concepts: Awaited<ReturnType<typeof generateConceptsWithAI>>['concepts'];
    try {
      const generated = await generateConceptsWithAI({
        productName: campaign.productName, analysis: campaign.analysis, angles, count,
        category: campaign.category ?? undefined, mainBenefit: campaign.mainBenefit ?? undefined, language: campaign.language as any
      });
      concepts = generated.concepts;
      await logAiTask(db, { workspaceId, userId, capability: 'creative_pack_concepts', provider: 'ANTHROPIC', model: ANTHROPIC_MODEL, status: 'SUCCEEDED', inputJson: { creativePackId: campaign.id, angles }, usage: generated.usage });
    } catch (err: any) {
      await logAiTask(db, { workspaceId, userId, capability: 'creative_pack_concepts', provider: 'ANTHROPIC', model: ANTHROPIC_MODEL, status: 'FAILED', inputJson: { creativePackId: campaign.id, angles }, errorMessage: err instanceof Error ? err.message : 'unknown error' });
      throw err;
    }

    // Replace any previous pack for this campaign (e.g. a retry) so the
    // (creativePackId, index) unique constraint never collides.
    await db.creativePackConcept.deleteMany({ where: { creativePackId: campaign.id } });
    const created = await db.$transaction(
      concepts.map((c, i) => db.creativePackConcept.create({
        data: {
          creativePackId: campaign.id, index: i, angle: c.angle, hook: c.hook, primaryText: c.primaryText,
          headline: c.headline, cta: c.cta, visualConcept: c.visualConcept, targetAudience: c.targetAudience,
          imageStatus: 'PENDING' as any
        }
      }))
    );
    return res.status(201).json({ creativePack: toApiCreativePack(campaign, created.map(toApiConcept)) });
  } catch (error: any) {
    console.error('Generate concepts failed:', error);
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'Failed to generate creative concepts' });
  }
});

// Regenerate just one concept's hook, copy, or everything -- never the whole pack.
app.post('/api/creative-packs/:id/concepts/:conceptId/regenerate', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const userId = (req as any).userId as string;
    const workspaceId = await getUserWorkspaceId(db, userId);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for this account' });
    if (!checkRateLimit(`ai:${workspaceId}`, AI_WORKSPACE_LIMIT.max, AI_WORKSPACE_LIMIT.windowMs)) return rateLimited(res, 60);

    const campaign = await db.creativePack.findFirst({ where: { id: req.params.id, workspaceId } });
    if (!campaign) return res.status(404).json({ error: 'CreativePack not found' });
    const concept = await db.creativePackConcept.findFirst({ where: { id: req.params.conceptId, creativePackId: campaign.id } });
    if (!concept) return res.status(404).json({ error: 'Concept not found' });

    const body = req.body as Record<string, unknown>;
    const field = body.field === 'hook' || body.field === 'copy' ? body.field : 'all';

    let update: Awaited<ReturnType<typeof regenerateConceptWithAI>>['update'];
    try {
      const generated = await regenerateConceptWithAI({ productName: campaign.productName, angle: concept.angle, field, language: campaign.language as any, analysis: campaign.analysis });
      update = generated.update;
      await logAiTask(db, { workspaceId, userId, capability: 'creative_pack_concept_regenerate', provider: 'ANTHROPIC', model: ANTHROPIC_MODEL, status: 'SUCCEEDED', inputJson: { conceptId: concept.id, field }, usage: generated.usage });
    } catch (err: any) {
      await logAiTask(db, { workspaceId, userId, capability: 'creative_pack_concept_regenerate', provider: 'ANTHROPIC', model: ANTHROPIC_MODEL, status: 'FAILED', inputJson: { conceptId: concept.id, field }, errorMessage: err instanceof Error ? err.message : 'unknown error' });
      throw err;
    }

    const updated = await db.creativePackConcept.update({ where: { id: concept.id }, data: update as any });
    return res.json({ concept: toApiConcept(updated) });
  } catch (error: any) {
    console.error('Regenerate concept failed:', error);
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'Failed to regenerate' });
  }
});
// Phase 2: generate (or retry) an AI image for one concept, edited from the
// campaign's real product photo. Requires OPENAI_API_KEY.
app.post('/api/creative-packs/:id/concepts/:conceptId/generate-image', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const userId = (req as any).userId as string;
    const workspaceId = await getUserWorkspaceId(db, userId);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for this account' });
    if (!checkRateLimit(`ai:${workspaceId}`, AI_WORKSPACE_LIMIT.max, AI_WORKSPACE_LIMIT.windowMs)) return rateLimited(res, 60);

    const campaign = await db.creativePack.findFirst({ where: { id: req.params.id, workspaceId } });
    if (!campaign) return res.status(404).json({ error: 'CreativePack not found' });
    const concept = await db.creativePackConcept.findFirst({ where: { id: req.params.conceptId, creativePackId: campaign.id } });
    if (!concept) return res.status(404).json({ error: 'Concept not found' });
    if (!campaign.productImageUrl) return res.status(400).json({ error: 'This campaign has no product image to base a generated image on' });

    await db.creativePackConcept.update({ where: { id: concept.id }, data: { imageStatus: 'GENERATING' as any, imageError: null } });

    let generatedDataUrl: string;
    try {
      generatedDataUrl = await generateConceptImageWithAI({ productImageUrl: campaign.productImageUrl, visualConcept: concept.visualConcept || concept.angle, productName: campaign.productName });
      await logAiTask(db, { workspaceId, userId, capability: 'creative_pack_concept_image', provider: 'OPENAI', model: OPENAI_IMAGE_MODEL, status: 'SUCCEEDED', inputJson: { conceptId: concept.id } });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Failed to generate image';
      await logAiTask(db, { workspaceId, userId, capability: 'creative_pack_concept_image', provider: 'OPENAI', model: OPENAI_IMAGE_MODEL, status: 'FAILED', inputJson: { conceptId: concept.id }, errorMessage: message });
      await db.creativePackConcept.update({ where: { id: concept.id }, data: { imageStatus: 'FAILED' as any, imageError: message } });
      const status = typeof err?.status === 'number' ? err.status : 500;
      return res.status(status).json({ error: message });
    }

    const imageUrl = storeImage(generatedDataUrl);
    const updated = await db.creativePackConcept.update({ where: { id: concept.id }, data: { imageUrl, imageStatus: 'READY' as any, imageError: null } });
    return res.json({ concept: toApiConcept(updated) });
  } catch (error: any) {
    console.error('Generate concept image failed:', error);
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'Failed to generate image' });
  }
});

app.get('/api/creative-packs', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.json({ creativePacks: [] });
    const rows = await db.creativePack.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: LIST_PAGE_CAP });
    return res.json({ creativePacks: rows.map(c => toApiCreativePack(c, [])) });
  } catch (error) {
    console.error('List campaigns failed:', error);
    return res.status(500).json({ error: 'Failed to load campaigns' });
  }
});

app.get('/api/creative-packs/:id', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.status(404).json({ error: 'CreativePack not found' });
    const campaign = await db.creativePack.findFirst({ where: { id: req.params.id, workspaceId } });
    if (!campaign) return res.status(404).json({ error: 'CreativePack not found' });
    const concepts = await db.creativePackConcept.findMany({ where: { creativePackId: campaign.id }, orderBy: { index: 'asc' } });
    return res.json({ creativePack: toApiCreativePack(campaign, concepts.map(toApiConcept)) });
  } catch (error) {
    console.error('Get campaign failed:', error);
    return res.status(500).json({ error: 'Failed to load campaign' });
  }
});

// "Save CreativePack" -- campaigns already persist as soon as they're analyzed,
// so saving just flips status from a work-in-progress draft to a keeper the
// user can find again later (see GET /api/creative-packs).
app.patch('/api/creative-packs/:id', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for this account' });
    const campaign = await db.creativePack.findFirst({ where: { id: req.params.id, workspaceId } });
    if (!campaign) return res.status(404).json({ error: 'CreativePack not found' });

    const body = req.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof body.status === 'string') {
      const statusInput = body.status.trim().toUpperCase();
      if (statusInput !== 'DRAFT' && statusInput !== 'SAVED') return res.status(400).json({ error: 'status must be draft or saved' });
      data.status = statusInput;
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No changes provided' });

    const updated = await db.creativePack.update({ where: { id: campaign.id }, data: data as any });
    const concepts = await db.creativePackConcept.findMany({ where: { creativePackId: campaign.id }, orderBy: { index: 'asc' } });
    return res.json({ creativePack: toApiCreativePack(updated, concepts.map(toApiConcept)) });
  } catch (error) {
    console.error('Update campaign failed:', error);
    return res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// Bridges a chosen concept into the existing manual Creative Studio list
// (reuses the Creative model/toApiCreative() from the section above) so the
// two features stay connected without any duplicate architecture.
app.post('/api/creative-packs/:id/concepts/:conceptId/add-to-creative', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for this account' });
    const campaign = await db.creativePack.findFirst({ where: { id: req.params.id, workspaceId } });
    if (!campaign) return res.status(404).json({ error: 'CreativePack not found' });
    const concept = await db.creativePackConcept.findFirst({ where: { id: req.params.conceptId, creativePackId: campaign.id } });
    if (!concept) return res.status(404).json({ error: 'Concept not found' });

    const created = await db.creative.create({
      data: {
        workspaceId, productId: null, name: `${campaign.productName} - ${concept.angle}`, type: 'image_ad',
        status: 'DRAFT', angle: concept.angle, hook: concept.hook, primaryText: concept.primaryText,
        headline: concept.headline, cta: concept.cta, url: concept.imageUrl ?? null
      }
    });
    return res.status(201).json({ creative: toApiCreative(created) });
  } catch (error) {
    console.error('Add concept to creatives failed:', error);
    return res.status(500).json({ error: 'Failed to add to creatives' });
  }
});
// ==================================================================================
// ---- Audience Lab (targeting profiles: manual entry + AI suggestions) ----
// ==================================================================================
// Audiences are lightweight, reusable targeting profiles (age/gender/location/
// interests) a media buyer keeps around and later copies into Meta Ads Manager
// when building a real campaign -- there is no in-app Campaign builder wired to
// real data yet (Campaign in src/types/index.ts is still a future feature), so
// "using" an audience here means copying its targeting summary from the UI, not
// attaching it to anything else in this app.

const AUDIENCE_GENDERS = new Set(['male', 'female', 'all']);

function toApiAudience(a: {
  id: string; name: string; ageMin: number; ageMax: number; gender: string;
  location: string[]; interests: string[]; explanation: string | null; source: string;
}) {
  return {
    id: a.id, name: a.name, ageMin: a.ageMin, ageMax: a.ageMax, gender: a.gender,
    location: a.location, interests: a.interests, explanation: a.explanation ?? '',
    source: a.source.toLowerCase()
  };
}

app.get('/api/audiences', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.json({ audiences: [] });
    const rows = await db.audience.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: LIST_PAGE_CAP });
    return res.json({ audiences: rows.map(toApiAudience) });
  } catch (error) {
    console.error('List audiences failed:', error);
    return res.status(500).json({ error: 'Failed to load audiences' });
  }
});

// Manual entry, mirrors POST /api/creatives' hand-entry pattern.
app.post('/api/audiences', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for this account' });

    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const ageMin = Number(body.ageMin);
    const ageMax = Number(body.ageMax);
    if (!name || !Number.isFinite(ageMin) || !Number.isFinite(ageMax) || ageMin < 13 || ageMax < ageMin) {
      return res.status(400).json({ error: 'name, ageMin and ageMax (ageMax >= ageMin >= 13) are required' });
    }
    const genderInput = typeof body.gender === 'string' ? body.gender.trim().toLowerCase() : 'all';
    const gender = AUDIENCE_GENDERS.has(genderInput) ? genderInput : 'all';
    const location = Array.isArray(body.location) ? (body.location as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim() !== '').map(v => v.trim()) : [];
    const interests = Array.isArray(body.interests) ? (body.interests as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim() !== '').map(v => v.trim()) : [];
    const explanation = typeof body.explanation === 'string' && body.explanation.trim() ? body.explanation.trim() : null;
    const productId = typeof body.productId === 'string' && body.productId.trim() ? body.productId.trim() : null;
    if (productId) {
      const product = await db.product.findFirst({ where: { id: productId, workspaceId } });
      if (!product) return res.status(400).json({ error: 'Product not found' });
    }

    const created = await db.audience.create({
      data: { workspaceId, productId, name, ageMin: Math.round(ageMin), ageMax: Math.round(ageMax), gender, location, interests, explanation, source: 'MANUAL' as any }
    });
    return res.status(201).json({ audience: toApiAudience(created) });
  } catch (error) {
    console.error('Create audience failed:', error);
    return res.status(500).json({ error: 'Failed to create audience' });
  }
});

app.delete('/api/audiences/:id', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.status(404).json({ error: 'Audience not found' });
    const existing = await db.audience.findFirst({ where: { id: req.params.id, workspaceId } });
    if (!existing) return res.status(404).json({ error: 'Audience not found' });
    await db.audience.delete({ where: { id: existing.id } });
    return res.status(204).end();
  } catch (error) {
    console.error('Delete audience failed:', error);
    return res.status(500).json({ error: 'Failed to delete audience' });
  }
});

// AI-suggested audiences: given a product (by id, or freehand name/description),
// ask Claude for 2-3 genuinely different candidate targeting profiles and
// persist them immediately (source AI) -- same "just works with the existing
// ANTHROPIC_API_KEY" approach as the AI Creative Pack Engine above.
async function generateAudiencesWithAI(input: {
  productName: string; description?: string; category?: string; country?: string; language: 'ar' | 'fr' | 'en';
}): Promise<{ audiences: Array<{ name: string; ageMin: number; ageMax: number; gender: string; location: string[]; interests: string[]; explanation: string }>; usage: { inputTokens: number; outputTokens: number } }> {
  const languageName = aiLanguageName(input.language);
  const system = `You are an expert Meta (Facebook/Instagram) ads media buyer targeting online shoppers in Algeria and nearby markets. Given a product, propose 2 to 3 GENUINELY DIFFERENT candidate audiences to test (different age range, or gender, or interest focus -- not the same audience reworded). Write "name" and "explanation" in ${languageName}; "location" and "interests" as short English/French Meta-interest-style keywords a media buyer would recognize. Respond with ONLY raw JSON (no markdown fences, no commentary): a JSON array of 2 to 3 objects shaped as:
{"name":string (short label, e.g. "Young urban professionals"),"ageMin":number,"ageMax":number,"gender":"male"|"female"|"all","location":string[] (1-3 short location/region names),"interests":string[] (2-5 short interest keywords, or empty array for a deliberately broad/no-interest audience),"explanation":string (1-2 sentences on why this audience is worth testing for this product)}`;

  const userText = [
    `Product: ${input.productName}`,
    input.category ? `Category: ${input.category}` : null,
    input.description ? `Description: ${input.description}` : null,
    input.country ? `Target market/country: ${input.country}` : null
  ].filter(Boolean).join('\n');

  const { result, usage } = await callClaudeForJSON(system, userText, 1200);
  const list: any[] = Array.isArray(result) ? result : Array.isArray(result?.audiences) ? result.audiences : [];
  const audiences = list.slice(0, 3).map(a => ({
    name: typeof a?.name === 'string' && a.name.trim() ? a.name.trim() : 'Suggested audience',
    ageMin: Number.isFinite(Number(a?.ageMin)) ? Math.max(13, Math.round(Number(a.ageMin))) : 18,
    ageMax: Number.isFinite(Number(a?.ageMax)) ? Math.round(Number(a.ageMax)) : 45,
    gender: AUDIENCE_GENDERS.has(String(a?.gender).toLowerCase()) ? String(a.gender).toLowerCase() : 'all',
    location: Array.isArray(a?.location) ? a.location.filter((v: unknown) => typeof v === 'string') : [],
    interests: Array.isArray(a?.interests) ? a.interests.filter((v: unknown) => typeof v === 'string') : [],
    explanation: typeof a?.explanation === 'string' ? a.explanation.trim() : ''
  }));
  return { audiences, usage };
}

app.post('/api/audiences/generate', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const userId = (req as any).userId as string;
    const workspaceId = await getUserWorkspaceId(db, userId);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for this account' });
    if (!checkRateLimit(`ai:${workspaceId}`, AI_WORKSPACE_LIMIT.max, AI_WORKSPACE_LIMIT.windowMs)) return rateLimited(res, 60);

    const body = req.body as Record<string, unknown>;
    const language = body.language === 'fr' || body.language === 'en' ? body.language : 'ar';
    let productId: string | null = null;
    let productName: string;
    let description: string | undefined;
    let category: string | undefined;

    const bodyProductId = typeof body.productId === 'string' && body.productId.trim() ? body.productId.trim() : null;
    if (bodyProductId) {
      const product = await db.product.findFirst({ where: { id: bodyProductId, workspaceId } });
      if (!product) return res.status(400).json({ error: 'Product not found' });
      productId = product.id;
      productName = product.name;
      description = product.description || undefined;
      category = product.category ?? undefined;
    } else {
      productName = typeof body.productName === 'string' ? body.productName.trim() : '';
      if (!productName) return res.status(400).json({ error: 'productId or productName is required' });
      description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : undefined;
      category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : undefined;
    }
    const country = typeof body.country === 'string' && body.country.trim() ? body.country.trim() : undefined;

    let suggestions: Awaited<ReturnType<typeof generateAudiencesWithAI>>['audiences'];
    try {
      const generated = await generateAudiencesWithAI({ productName, description, category, country, language: language as any });
      suggestions = generated.audiences;
      await logAiTask(db, { workspaceId, userId, capability: 'audience_generate', provider: 'ANTHROPIC', model: ANTHROPIC_MODEL, status: 'SUCCEEDED', inputJson: { productName, category, language }, usage: generated.usage });
    } catch (err: any) {
      await logAiTask(db, { workspaceId, userId, capability: 'audience_generate', provider: 'ANTHROPIC', model: ANTHROPIC_MODEL, status: 'FAILED', inputJson: { productName, category, language }, errorMessage: err instanceof Error ? err.message : 'unknown error' });
      throw err;
    }

    const created = await db.$transaction(
      suggestions.map(s => db.audience.create({
        data: { workspaceId, productId, name: s.name, ageMin: s.ageMin, ageMax: s.ageMax, gender: s.gender, location: s.location, interests: s.interests, explanation: s.explanation, source: 'AI' as any }
      }))
    );
    return res.status(201).json({ audiences: created.map(toApiAudience) });
  } catch (error: any) {
    console.error('Generate audiences failed:', error);
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'Failed to generate audiences' });
  }
});

// Translates the DB's Order row into the shape src/types/index.ts already expects
// (businessId naming, orderDate as an ISO string, status lowercased since the
// DB enum is uppercase with the same words -- see toApiProduct() above for the
// same pattern and COWORK_ADSGENIUS_REALDATA_PLAN.md for the background).
function toApiOrder(o: {
  id: string; workspaceId: string; productId: string | null; customerName: string; phone: string;
  wilaya: string; commune: string; address: string; productName: string; quantity: number;
  price: unknown; deliveryFee: unknown; total: unknown; status: string; deliveryCompany: string | null;
  trackingNumber: string | null; createdAt: Date;
}) {
  return {
    id: o.id,
    businessId: o.workspaceId,
    customerName: o.customerName,
    phone: o.phone,
    wilaya: o.wilaya,
    commune: o.commune,
    address: o.address,
    productId: o.productId ?? '',
    productName: o.productName,
    quantity: o.quantity,
    price: Number(o.price),
    deliveryFee: Number(o.deliveryFee),
    total: Number(o.total),
    orderDate: o.createdAt.toISOString(),
    status: o.status.toLowerCase(),
    deliveryCompany: o.deliveryCompany ?? undefined,
    trackingNumber: o.trackingNumber ?? undefined
  };
}
const ORDER_STATUSES = new Set([
  'new', 'pending_confirmation', 'confirmed', 'preparing', 'shipped',
  'out_for_delivery', 'delivered', 'cancelled', 'refused', 'returned'
]);

// Which statuses an order may move to FROM its current status. Previously any
// status could be set from any other (e.g. DELIVERED -> NEW), which made no
// business sense -- see audit finding P14. CANCELLED/RETURNED are terminal.
// Every status is allowed to transition to itself (a no-op re-save).
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ['NEW', 'PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED'],
  PENDING_CONFIRMATION: ['PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CONFIRMED', 'PREPARING', 'CANCELLED'],
  PREPARING: ['PREPARING', 'SHIPPED', 'CANCELLED'],
  SHIPPED: ['SHIPPED', 'OUT_FOR_DELIVERY', 'RETURNED'],
  OUT_FOR_DELIVERY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'REFUSED', 'RETURNED'],
  DELIVERED: ['DELIVERED', 'RETURNED'],
  REFUSED: ['REFUSED', 'RETURNED'],
  CANCELLED: ['CANCELLED'],
  RETURNED: ['RETURNED']
};

app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.json({ orders: [] });
    const rows = await db.order.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: LIST_PAGE_CAP });
    return res.json({ orders: rows.map(toApiOrder) });
  } catch (error) {
    console.error('List orders failed:', error);
    return res.status(500).json({ error: 'Failed to load orders' });
  }
});

// There is no storefront/checkout yet, so every order is created by hand
// here via the Orders page's "Add Order" form (see src/pages/Orders.tsx).
app.post('/api/orders', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for this account' });

    const body = req.body as Record<string, unknown>;
    const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const wilaya = typeof body.wilaya === 'string' ? body.wilaya.trim() : '';
    const productName = typeof body.productName === 'string' ? body.productName.trim() : '';
    const price = Number(body.price);
    if (!customerName || !phone || !wilaya || !productName || !Number.isFinite(price)) {
      return res.status(400).json({ error: 'customerName, phone, wilaya, productName and price are required' });
    }
    const quantity = parseOptionalQuantity(body.quantity);
    const deliveryFee = parseOptionalNumeric(body.deliveryFee, 'deliveryFee');
    const total = Number(body.total);
    const productId = typeof body.productId === 'string' && body.productId.trim() ? body.productId.trim() : null;

    // Verify the referenced product (if any) actually belongs to this workspace,
    // so an order can never be attached to another account's product.
    if (productId) {
      const product = await db.product.findFirst({ where: { id: productId, workspaceId } });
      if (!product) return res.status(400).json({ error: 'Product not found' });
    }

    const statusInput = typeof body.status === 'string' ? body.status.trim().toLowerCase() : 'pending_confirmation';
    const status = ORDER_STATUSES.has(statusInput) ? statusInput.toUpperCase() : 'PENDING_CONFIRMATION';

    const created = await db.order.create({
      data: {
        workspaceId,
        productId,
        customerName,
        phone,
        wilaya,
        commune: typeof body.commune === 'string' ? body.commune.trim() : '',
        address: typeof body.address === 'string' ? body.address.trim() : '',
        productName,
        quantity,
        price,
        deliveryFee,
        total: Number.isFinite(total) ? total : price * quantity + deliveryFee,
        status: status as any
      }
    });
    return res.status(201).json({ order: toApiOrder(created) });
  } catch (error: any) {
    console.error('Create order failed:', error);
    if (typeof error?.status === 'number') return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: 'Failed to create order' });
  }
});

// Full edit -- used both by the confirm/ship/cancel action buttons (status only)
// and by the Orders page's "Edit Order" form (any subset of fields). Every
// field is optional here: only keys actually present in the request body are
// changed, so a status-only PATCH from the action buttons still works exactly
// as before.
app.patch('/api/orders/:id', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for this account' });

    const existing = await db.order.findFirst({ where: { id: req.params.id, workspaceId } });
    if (!existing) return res.status(404).json({ error: 'Order not found' });

    const body = req.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if (typeof body.status === 'string') {
      const statusInput = body.status.trim().toLowerCase();
      if (!ORDER_STATUSES.has(statusInput)) return res.status(400).json({ error: 'A valid status is required' });
      const nextStatus = statusInput.toUpperCase();
      const allowedNext = ORDER_STATUS_TRANSITIONS[existing.status] ?? [];
      if (!allowedNext.includes(nextStatus)) {
        return res.status(400).json({ error: `Cannot move an order from ${existing.status} to ${nextStatus}` });
      }
      data.status = nextStatus;
    }
    if (typeof body.customerName === 'string') data.customerName = body.customerName.trim();
    if (typeof body.phone === 'string') data.phone = body.phone.trim();
    if (typeof body.wilaya === 'string') data.wilaya = body.wilaya.trim();
    if (typeof body.commune === 'string') data.commune = body.commune.trim();
    if (typeof body.address === 'string') data.address = body.address.trim();
    if (typeof body.productName === 'string') data.productName = body.productName.trim();
    if (body.productId !== undefined) {
      const productId = typeof body.productId === 'string' && body.productId.trim() ? body.productId.trim() : null;
      if (productId) {
        // Same ownership check as create: an edited order can never be re-pointed
        // at another workspace's product.
        const product = await db.product.findFirst({ where: { id: productId, workspaceId } });
        if (!product) return res.status(400).json({ error: 'Product not found' });
      }
      data.productId = productId;
    }
    if (body.quantity !== undefined) data.quantity = parseOptionalQuantity(body.quantity);
    if (body.price !== undefined) data.price = parseOptionalNumeric(body.price, 'price');
    if (body.deliveryFee !== undefined) data.deliveryFee = parseOptionalNumeric(body.deliveryFee, 'deliveryFee');
    if (body.total !== undefined) data.total = parseOptionalNumeric(body.total, 'total');

    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No changes provided' });

    const updated = await db.order.update({ where: { id: existing.id }, data: data as any });
    return res.json({ order: toApiOrder(updated) });
  } catch (error: any) {
    console.error('Update order failed:', error);
    if (typeof error?.status === 'number') return res.status(error.status).json({ error: error.message });
    return res.status(500).json({ error: 'Failed to update order' });
  }
});

// ==================================================================================
// ---- Delivery integration: ZR Express (Procolis) ----
// ==================================================================================
// Real courier integration for Algeria. Needs ZR_EXPRESS_TOKEN and
// ZR_EXPRESS_KEY (from the ZR Express / Procolis dashboard) set in the
// environment; without them every call below returns a clear 501 instead of
// silently failing. Field names/endpoints follow ZR's own "Procolis" API as
// best documented publicly -- GET /api/delivery/zr-express/test exists
// specifically so this can be verified against a real account BEFORE shipping
// any real order through it. If a real shipment call ever fails, the raw ZR
// response text is returned (not swallowed) so the exact field/endpoint can be
// corrected quickly against what ZR actually replies.

const ZR_EXPRESS_BASE_URL = 'https://procolis.com/api_v1';

// Algeria's 58 wilayas with their official numeric codes, used to translate the
// free-text wilaya on an order into the numeric IDWilaya ZR's API requires.
// Matching below is diacritic/case-insensitive with a loose prefix fallback.
const ALGERIA_WILAYAS: Array<{ code: number; name: string }> = [
  { code: 1, name: 'Adrar' }, { code: 2, name: 'Chlef' }, { code: 3, name: 'Laghouat' },
  { code: 4, name: 'Oum El Bouaghi' }, { code: 5, name: 'Batna' }, { code: 6, name: 'Bejaia' },
  { code: 7, name: 'Biskra' }, { code: 8, name: 'Bechar' }, { code: 9, name: 'Blida' },
  { code: 10, name: 'Bouira' }, { code: 11, name: 'Tamanrasset' }, { code: 12, name: 'Tebessa' },
  { code: 13, name: 'Tlemcen' }, { code: 14, name: 'Tiaret' }, { code: 15, name: 'Tizi Ouzou' },
  { code: 16, name: 'Alger' }, { code: 17, name: 'Djelfa' }, { code: 18, name: 'Jijel' },
  { code: 19, name: 'Setif' }, { code: 20, name: 'Saida' }, { code: 21, name: 'Skikda' },
  { code: 22, name: 'Sidi Bel Abbes' }, { code: 23, name: 'Annaba' }, { code: 24, name: 'Guelma' },
  { code: 25, name: 'Constantine' }, { code: 26, name: 'Medea' }, { code: 27, name: 'Mostaganem' },
  { code: 28, name: "M'Sila" }, { code: 29, name: 'Mascara' }, { code: 30, name: 'Ouargla' },
  { code: 31, name: 'Oran' }, { code: 32, name: 'El Bayadh' }, { code: 33, name: 'Illizi' },
  { code: 34, name: 'Bordj Bou Arreridj' }, { code: 35, name: 'Boumerdes' }, { code: 36, name: 'El Tarf' },
  { code: 37, name: 'Tindouf' }, { code: 38, name: 'Tissemsilt' }, { code: 39, name: 'El Oued' },
  { code: 40, name: 'Khenchela' }, { code: 41, name: 'Souk Ahras' }, { code: 42, name: 'Tipaza' },
  { code: 43, name: 'Mila' }, { code: 44, name: 'Ain Defla' }, { code: 45, name: 'Naama' },
  { code: 46, name: 'Ain Temouchent' }, { code: 47, name: 'Ghardaia' }, { code: 48, name: 'Relizane' },
  { code: 49, name: 'Timimoun' }, { code: 50, name: 'Bordj Badji Mokhtar' }, { code: 51, name: 'Ouled Djellal' },
  { code: 52, name: 'Beni Abbes' }, { code: 53, name: 'In Salah' }, { code: 54, name: 'In Guezzam' },
  { code: 55, name: 'Touggourt' }, { code: 56, name: 'Djanet' }, { code: 57, name: "El M'Ghair" },
  { code: 58, name: 'El Meniaa' }
];

function normalizeWilayaText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function findWilayaCode(wilaya: string): number | null {
  const needle = normalizeWilayaText(wilaya);
  if (!needle) return null;
  const exact = ALGERIA_WILAYAS.find(w => normalizeWilayaText(w.name) === needle);
  if (exact) return exact.code;
  const prefix = ALGERIA_WILAYAS.find(w => needle.startsWith(normalizeWilayaText(w.name)) || normalizeWilayaText(w.name).startsWith(needle));
  return prefix ? prefix.code : null;
}

function zrExpressCredentials(): { token: string; key: string } {
  const token = process.env.ZR_EXPRESS_TOKEN?.trim();
  const key = process.env.ZR_EXPRESS_KEY?.trim();
  if (!token || !key) {
    throw Object.assign(new Error('ZR Express is not configured yet (missing ZR_EXPRESS_TOKEN / ZR_EXPRESS_KEY)'), { status: 501 });
  }
  return { token, key };
}

async function zrExpressRequest(path: string, method: 'GET' | 'POST', body?: unknown): Promise<any> {
  const { token, key } = zrExpressCredentials();
  const response = await fetch(`${ZR_EXPRESS_BASE_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', token, key },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const raw = await response.text();
  let parsed: any = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { /* ZR sometimes returns plain text -- surfaced as-is below */ }
  if (!response.ok) {
    throw Object.assign(new Error(`ZR Express request failed (${response.status}): ${raw.slice(0, 500)}`), { status: 502 });
  }
  return parsed ?? raw;
}

// Verifies ZR_EXPRESS_TOKEN/ZR_EXPRESS_KEY actually work, with no side effects.
// Meant to be tried from the Orders page before ever shipping a real order.
app.get('/api/delivery/zr-express/test', requireAuth, async (_req, res) => {
  try {
    const result = await zrExpressRequest('/token', 'GET');
    return res.json({ ok: true, result });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({ ok: false, error: error instanceof Error ? error.message : 'ZR Express test failed' });
  }
});

// Creates a real ZR Express shipment for one order and stores the returned
// tracking number. Only allowed once an order has actually been confirmed by
// phone (same reasoning as PRINTABLE_STATUSES in Orders.tsx) so a
// still-unconfirmed lead never turns into a real parcel.
const SHIPPABLE_ORDER_STATUSES = new Set(['CONFIRMED', 'PREPARING']);

app.post('/api/orders/:id/ship', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const userId = (req as any).userId as string;
    const workspaceId = await getUserWorkspaceId(db, userId);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for this account' });

    const order = await db.order.findFirst({ where: { id: req.params.id, workspaceId } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!SHIPPABLE_ORDER_STATUSES.has(order.status)) {
      return res.status(400).json({ error: 'Only confirmed orders can be shipped -- confirm the order first' });
    }
    if (order.trackingNumber) {
      return res.status(400).json({ error: `Already shipped (tracking ${order.trackingNumber})` });
    }

    const wilayaCode = findWilayaCode(order.wilaya);
    if (!wilayaCode) {
      return res.status(400).json({ error: `Could not match wilaya "${order.wilaya}" to a known Algeria wilaya -- please correct it on the order first` });
    }

    const body = req.body as Record<string, unknown>;
    const deliveryType = body.deliveryType === 'stopdesk' ? '1' : '0';

    let zrResult: any;
    try {
      zrResult = await zrExpressRequest('/add_colis', 'POST', {
        Colis: [{
          Tracking: '',
          TypeLivraison: deliveryType,
          TypeColis: '0',
          Confrimee: '',
          Client: order.customerName,
          MobileA: order.phone,
          MobileB: '',
          Adresse: order.address || order.commune || order.wilaya,
          IDWilaya: String(wilayaCode),
          Commune: order.commune || order.wilaya,
          Total: String(Math.round(Number(order.total))),
          Note: '',
          TProduit: order.productName,
          id_Externe: order.id,
          Source: 'AdsGenius'
        }]
      });
    } catch (err: any) {
      await db.auditLog.create({
        data: {
          workspaceId, userId, action: 'order.ship.zr_express_failed', entityType: 'Order', entityId: order.id,
          afterJson: { error: err instanceof Error ? err.message : 'unknown error' } as any
        }
      }).catch(() => {});
      const status = typeof err?.status === 'number' ? err.status : 500;
      return res.status(status).json({ error: err instanceof Error ? err.message : 'Failed to create ZR Express shipment' });
    }

    // ZR's response shape for add_colis isn't perfectly consistent across
    // accounts -- try the couple of shapes seen in the wild before falling
    // back to our own order id so the order is still correctly marked shipped.
    const returnedTracking =
      zrResult?.Colis?.[0]?.Tracking ||
      zrResult?.[0]?.Tracking ||
      zrResult?.Tracking ||
      null;

    const updated = await db.order.update({
      where: { id: order.id },
      data: { deliveryCompany: 'ZR Express', trackingNumber: returnedTracking || order.id, status: 'SHIPPED' as any }
    });
    await db.auditLog.create({
      data: {
        workspaceId, userId, action: 'order.ship.zr_express', entityType: 'Order', entityId: order.id,
        afterJson: { trackingNumber: updated.trackingNumber, raw: zrResult } as any
      }
    }).catch(() => {});

    return res.json({ order: toApiOrder(updated), zrResponse: zrResult });
  } catch (error) {
    console.error('Ship order failed:', error);
    return res.status(500).json({ error: 'Failed to ship order' });
  }
});

// ---- Public (unauthenticated) endpoints for the per-product landing page ----
// PublicOrderPage.tsx (route /order/:productId) is the link you put as the
// "Website URL" on a Facebook/Instagram/TikTok ad. Visitors land there, see
// the product, and submitting creates a real order directly -- no login, no
// workspace header, since the workspace is inferred from the product itself.
// Never expose cost/margin fields here, only what a customer should see.
app.get('/api/public/products/:id', async (req, res) => {
  try {
    const db = getPrisma();
    const product = await db.product.findUnique({ where: { id: req.params.id } });
    if (!product || !product.active) return res.status(404).json({ error: 'Product not found' });
    return res.json({
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.salePrice),
        currency: product.currency
      }
    });
  } catch (error) {
    console.error('Public product lookup failed:', error);
    return res.status(500).json({ error: 'Failed to load product' });
  }
});

const PUBLIC_ORDER_MAX_QUANTITY = 50;

app.post('/api/public/orders', async (req, res) => {
  try {
    if (!checkRateLimit(`public-order:ip:${clientIp(req)}`, PUBLIC_ORDER_IP_LIMIT.max, PUBLIC_ORDER_IP_LIMIT.windowMs)) {
      return rateLimited(res, 60);
    }
    const db = getPrisma();
    const body = req.body as Record<string, unknown>;

    // Honeypot: a hidden field real visitors never see or fill. A simple bot
    // that fills every input on the page trips this, and we silently no-op
    // instead of creating an order or revealing that a check happened.
    if (typeof body.website === 'string' && body.website.trim()) {
      return res.status(201).json({ order: null });
    }

    const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
    const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const wilaya = typeof body.wilaya === 'string' ? body.wilaya.trim() : '';
    if (!productId || !customerName || !phone || !wilaya) {
      return res.status(400).json({ error: 'customerName, phone, wilaya and a valid product are required' });
    }
    const quantity = Math.min(Math.max(Math.round(Number(body.quantity)) || 1, 1), PUBLIC_ORDER_MAX_QUANTITY);

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product || !product.active) return res.status(404).json({ error: 'Product not found' });

    const price = Number(product.salePrice);
    const deliveryFee = Number(product.shippingCost);

    const created = await db.order.create({
      data: {
        workspaceId: product.workspaceId,
        productId: product.id,
        customerName,
        phone,
        wilaya,
        commune: typeof body.commune === 'string' ? body.commune.trim() : '',
        address: typeof body.address === 'string' ? body.address.trim() : '',
        productName: product.name,
        quantity,
        price,
        deliveryFee,
        total: price * quantity + deliveryFee,
        status: 'NEW'
      }
    });
    return res.status(201).json({ order: toApiOrder(created) });
  } catch (error) {
    console.error('Public order creation failed:', error);
    return res.status(500).json({ error: 'Failed to submit order' });
  }
});


if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`AdsGenius API listening on ${port}`));
}

export default app;
