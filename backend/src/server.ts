import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

export const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.PORT ?? 4000);
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) throw new Error('JWT_SECRET is required');

app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') ?? true, credentials: true }));
app.use(express.json());

function tokenFor(userId: string) {
  return jwt.sign({ sub: userId }, jwtSecret!, { expiresIn: '7d' });
}

async function userResponse(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, locale: true, timezone: true }
  });
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, businessName } = req.body as Record<string, string>;
    if (!email || !password || !name || !businessName || password.length < 8) {
      return res.status(400).json({ error: 'email, name, businessName and a password of at least 8 characters are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const slug = `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'}-${Date.now()}`;
    const user = await prisma.$transaction(async tx => {
      const created = await tx.user.create({ data: { email: normalizedEmail, passwordHash, name } });
      const workspace = await tx.workspace.create({ data: { name: businessName, slug } });
      await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId: created.id, role: 'OWNER' } });
      return created;
    });
    return res.status(201).json({ user: await userResponse(user.id), token: tokenFor(user.id) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body as Record<string, string>;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' });
    return res.json({ user: await userResponse(user.id), token: tokenFor(user.id) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const payload = jwt.verify(header.slice(7), jwtSecret!) as jwt.JwtPayload;
    const user = await userResponse(String(payload.sub));
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ user });
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`AdsGenius API listening on ${port}`));
}
