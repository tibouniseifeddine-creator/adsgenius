import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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

app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') ?? true, credentials: true }));
app.use(express.json());

function tokenFor(userId: string) {
  return jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: '7d' });
}

async function userResponse(userId: string) {
  return getPrisma().user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, locale: true, timezone: true }
  });
}

app.get('/api/health', (_req, res) => {
  return res.json({
    ok: true,
    api: true,
    databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()),
    jwtConfigured: Boolean(process.env.JWT_SECRET?.trim())
  });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    getJwtSecret();
    const db = getPrisma();
    const { email, password, name, businessName } = req.body as Record<string, string>;
    if (!email || !password || !name || !businessName || password.length < 8) {
      return res.status(400).json({ error: 'email, name, businessName and a password of at least 8 characters are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
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
    return res.status(201).json({ user: await userResponse(user.id), token: tokenFor(user.id) });
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
    const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' });
    return res.json({ user: await userResponse(user.id), token: tokenFor(user.id) });
  } catch (error) {
    console.error('Login failed:', error);
    const message = error instanceof Error ? error.message : 'Login failed';
    return res.status(500).json({ error: message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const payload = jwt.verify(header.slice(7), getJwtSecret()) as jwt.JwtPayload;
    const user = await userResponse(String(payload.sub));
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ user });
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

// Shared auth guard for every endpoint below. Verifies the bearer JWT the same
// way /api/auth/me already does, and attaches the user id to the request.
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const payload = jwt.verify(header.slice(7), getJwtSecret()) as jwt.JwtPayload;
    (req as any).userId = String(payload.sub);
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
    const rows = await db.product.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } });
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
        baseCost: Number(body.purchaseCost) || 0,
        salePrice: sellingPrice,
        currency: 'DZD',
        stock: Number(body.stock) || 0,
        shippingCost: Number(body.deliveryCost) || 0,
        packagingCost: Number(body.packagingCost) || 0,
        expectedCancellationRate: Number(body.expectedCancellationRate) || 0,
        expectedReturnRate: Number(body.expectedReturnRate) || 0
      }
    });
    return res.status(201).json({ product: toApiProduct(created) });
  } catch (error: any) {
    console.error('Create product failed:', error);
    if (error?.code === 'P2002') return res.status(409).json({ error: 'A product with this SKU already exists' });
    return res.status(500).json({ error: 'Failed to create product' });
  }
});

if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`AdsGenius API listening on ${port}`));
}

export default app;
