import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

// Vercel serverless entrypoint.
// Keep the production handler self-contained so @vercel/node bundles the TypeScript
// implementation instead of loading backend/src/server.ts as raw CommonJS.
const app = express();
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
    const rows = await db.creative.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } });
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

async function generateAdCopy(input: {
  productName: string; description?: string; category?: string; price?: number; currency?: string;
  angle?: string; language: 'ar' | 'fr' | 'en';
}): Promise<{ hook: string; headline: string; primaryText: string; cta: string }> {
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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
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
    hook: typeof parsed.hook === 'string' ? parsed.hook.trim() : '',
    headline: typeof parsed.headline === 'string' ? parsed.headline.trim() : '',
    primaryText: typeof parsed.primaryText === 'string' ? parsed.primaryText.trim() : '',
    cta: typeof parsed.cta === 'string' ? parsed.cta.trim() : ''
  };
}

app.post('/api/creatives/generate-copy', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for this account' });

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

    const suggestion = await generateAdCopy({ productName, description, category, price, currency, angle, language: language as 'ar' | 'fr' | 'en' });
    return res.json({ suggestion });
  } catch (error: any) {
    console.error('Generate ad copy failed:', error);
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : 'Failed to generate ad copy' });
  }
});
