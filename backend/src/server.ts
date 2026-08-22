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

if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`AdsGenius API listening on ${port}`));
}

export default app;
