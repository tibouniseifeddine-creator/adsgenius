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
}) {
  try {
    await db.aITask.create({
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
  } catch (err) {
    console.error('Failed to log AITask (non-fatal):', err);
  }
}

// Shared Claude caller for every JSON-producing prompt below (analysis,
// strategy, concepts, regeneration). Mirrors generateAdCopy()'s parsing
// approach but also accepts multi-part (vision) content and top-level arrays.
async function callClaudeForJSON(system: string, userContent: unknown, maxTokens: number): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw Object.assign(new Error('AI is not configured yet (missing ANTHROPIC_API_KEY)'), { status: 501 });
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
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
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw Object.assign(new Error('AI returned an unexpected response'), { status: 502 });
  }
}

async function analyzeProductWithAI(input: {
  imageDataUrl: string; productName: string; category?: string; targetAudience?: string;
  country?: string; sellingPrice?: number; currency?: string; mainBenefit?: string; language: 'ar' | 'fr' | 'en';
}): Promise<{ analysis: Record<string, unknown>; strategy: Record<string, unknown> }> {
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

  const result = await callClaudeForJSON(system, [
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
    }
  };
}

async function generateConceptsWithAI(input: {
  productName: string; analysis: unknown; angles: string[]; count: number;
  category?: string; mainBenefit?: string; language: 'ar' | 'fr' | 'en';
}): Promise<Array<{ angle: string; hook: string; primaryText: string; headline: string; cta: string; visualConcept: string; targetAudience: string }>> {
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

  const result = await callClaudeForJSON(system, userText, 2200);
  const list: any[] = Array.isArray(result) ? result : Array.isArray(result?.concepts) ? result.concepts : [];
  return input.angles.map((angle, i) => {
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
}

async function regenerateConceptWithAI(input: {
  productName: string; angle: string; field: 'hook' | 'copy' | 'all'; language: 'ar' | 'fr' | 'en'; analysis?: unknown;
}): Promise<Partial<{ hook: string; primaryText: string; headline: string; cta: string; visualConcept: string }>> {
  const languageName = aiLanguageName(input.language);
  const scope = input.field === 'hook' ? 'ONLY a new "hook"' : input.field === 'copy' ? 'a new "primaryText", "headline" and "cta"' : 'a new "hook", "primaryText", "headline", "cta" and "visualConcept"';
  const system = `You are an expert direct-response copywriter for Facebook/Instagram ads in Algeria. Generate a fresh alternative for the SAME product and marketing angle -- genuinely different wording and framing than a typical first draft, not a synonym swap. Write in ${languageName}. Respond with ONLY raw JSON (no markdown fences): an object with ${scope} (omit fields not requested).`;
  const userText = [`Product: ${input.productName}`, `Marketing angle: ${input.angle}`, input.analysis ? `Product analysis: ${JSON.stringify(input.analysis)}` : null].filter(Boolean).join('\n');
  const result = await callClaudeForJSON(system, userText, 700);
  const out: Partial<{ hook: string; primaryText: string; headline: string; cta: string; visualConcept: string }> = {};
  if (typeof result?.hook === 'string') out.hook = result.hook.trim();
  if (typeof result?.primaryText === 'string') out.primaryText = result.primaryText.trim();
  if (typeof result?.headline === 'string') out.headline = result.headline.trim();
  if (typeof result?.cta === 'string') out.cta = result.cta.trim();
  if (typeof result?.visualConcept === 'string') out.visualConcept = result.visualConcept.trim();
  return out;
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

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: form as any
  });
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

    let result: { analysis: Record<string, unknown>; strategy: Record<string, unknown> };
    try {
      result = await analyzeProductWithAI({ imageDataUrl, productName, category, targetAudience, country, sellingPrice, currency, mainBenefit, language: language as any });
      await logAiTask(db, { workspaceId, userId, capability: 'creative_pack_analysis', provider: 'ANTHROPIC', model: ANTHROPIC_MODEL, status: 'SUCCEEDED', inputJson: { productName, category, language } });
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

    let concepts;
    try {
      concepts = await generateConceptsWithAI({
        productName: campaign.productName, analysis: campaign.analysis, angles, count,
        category: campaign.category ?? undefined, mainBenefit: campaign.mainBenefit ?? undefined, language: campaign.language as any
      });
      await logAiTask(db, { workspaceId, userId, capability: 'creative_pack_concepts', provider: 'ANTHROPIC', model: ANTHROPIC_MODEL, status: 'SUCCEEDED', inputJson: { creativePackId: campaign.id, angles } });
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

    const campaign = await db.creativePack.findFirst({ where: { id: req.params.id, workspaceId } });
    if (!campaign) return res.status(404).json({ error: 'CreativePack not found' });
    const concept = await db.creativePackConcept.findFirst({ where: { id: req.params.conceptId, creativePackId: campaign.id } });
    if (!concept) return res.status(404).json({ error: 'Concept not found' });

    const body = req.body as Record<string, unknown>;
    const field = body.field === 'hook' || body.field === 'copy' ? body.field : 'all';

    let update;
    try {
      update = await regenerateConceptWithAI({ productName: campaign.productName, angle: concept.angle, field, language: campaign.language as any, analysis: campaign.analysis });
      await logAiTask(db, { workspaceId, userId, capability: 'creative_pack_concept_regenerate', provider: 'ANTHROPIC', model: ANTHROPIC_MODEL, status: 'SUCCEEDED', inputJson: { conceptId: concept.id, field } });
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
    const rows = await db.creativePack.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } });
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

app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const db = getPrisma();
    const workspaceId = await getUserWorkspaceId(db, (req as any).userId);
    if (!workspaceId) return res.json({ orders: [] });
    const rows = await db.order.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } });
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
    const quantity = Number(body.quantity) > 0 ? Math.round(Number(body.quantity)) : 1;
    const deliveryFee = Number(body.deliveryFee) || 0;
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
  } catch (error) {
    console.error('Create order failed:', error);
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
      data.status = statusInput.toUpperCase();
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
    if (body.quantity !== undefined) data.quantity = Number(body.quantity) > 0 ? Math.round(Number(body.quantity)) : 1;
    if (body.price !== undefined) data.price = Number(body.price) || 0;
    if (body.deliveryFee !== undefined) data.deliveryFee = Number(body.deliveryFee) || 0;
    if (body.total !== undefined) data.total = Number(body.total) || 0;

    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No changes provided' });

    const updated = await db.order.update({ where: { id: existing.id }, data: data as any });
    return res.json({ order: toApiOrder(updated) });
  } catch (error) {
    console.error('Update order failed:', error);
    return res.status(500).json({ error: 'Failed to update order' });
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

export default app;
