import { Prisma } from '@prisma/client';
import { prisma } from '../infrastructure/database/client.js';
import { AppError } from '../shared/errors.js';
import type { AuthContext } from './auth.js';
import { requireWorkspaceAccess } from './workspaces.js';

type ProductInput = Record<string, unknown>;
const MANAGE_ROLES = new Set(['OWNER', 'ADMIN', 'MEMBER']);

function stringField(value: unknown, field: string, max = 200, required = false): string | undefined {
  if (value === undefined || value === null || value === '') { if (required) throw new AppError('VALIDATION_ERROR', `${field} is required.`, 400); return undefined; }
  if (typeof value !== 'string') throw new AppError('VALIDATION_ERROR', `${field} must be a string.`, 400);
  const result = value.trim();
  if (!result && required) throw new AppError('VALIDATION_ERROR', `${field} is required.`, 400);
  if (result.length > max) throw new AppError('VALIDATION_ERROR', `${field} is too long.`, 400);
  return result || undefined;
}

function money(value: unknown, field: string, required = false): Prisma.Decimal | undefined {
  if (value === undefined || value === null || value === '') { if (required) throw new AppError('VALIDATION_ERROR', `${field} is required.`, 400); return undefined; }
  try { const result = new Prisma.Decimal(String(value)); if (!result.isFinite() || result.isNegative()) throw new Error(); return result; }
  catch { throw new AppError('VALIDATION_ERROR', `${field} must be a non-negative monetary value.`, 400); }
}

function percentage(value: unknown, field: string, fallback = 0): Prisma.Decimal {
  if (value === undefined || value === null || value === '') return new Prisma.Decimal(fallback);
  try { const result = new Prisma.Decimal(String(value)); if (!result.isFinite() || result.isNegative() || result.greaterThan(100)) throw new Error(); return result; }
  catch { throw new AppError('VALIDATION_ERROR', `${field} must be between 0 and 100.`, 400); }
}

function integer(value: unknown, field: string, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  const result = Number(value);
  if (!Number.isInteger(result) || result < 0) throw new AppError('VALIDATION_ERROR', `${field} must be a non-negative integer.`, 400);
  return result;
}

export function calculateProductEconomics(input: {
  baseCost: Prisma.Decimal | string | number;
  salePrice: Prisma.Decimal | string | number;
  shippingCost: Prisma.Decimal | string | number;
  packagingCost: Prisma.Decimal | string | number;
  expectedCancellationRate: Prisma.Decimal | string | number;
  expectedReturnRate: Prisma.Decimal | string | number;
}) {
  const cancel = new Prisma.Decimal(input.expectedCancellationRate).div(100);
  const returns = new Prisma.Decimal(input.expectedReturnRate).div(100);
  const retainedRate = new Prisma.Decimal(1).minus(cancel).minus(returns);
  const fixedCosts = new Prisma.Decimal(input.baseCost).plus(input.shippingCost).plus(input.packagingCost);
  const breakEvenPrice = retainedRate.greaterThan(0) ? fixedCosts.div(retainedRate) : null;
  const expectedNetMargin = new Prisma.Decimal(input.salePrice).times(retainedRate).minus(fixedCosts);
  return { retainedRate, fixedCosts, breakEvenPrice, expectedNetMargin };
}

function productView(product: any) {
  const economics = calculateProductEconomics(product);
  return {
    ...product,
    baseCost: product.baseCost.toString(), salePrice: product.salePrice.toString(), shippingCost: product.shippingCost.toString(),
    packagingCost: product.packagingCost.toString(), expectedCancellationRate: product.expectedCancellationRate.toString(), expectedReturnRate: product.expectedReturnRate.toString(),
    breakEvenPrice: economics.breakEvenPrice?.toString() ?? null, expectedNetMargin: economics.expectedNetMargin.toString(),
    variants: product.variants?.map((variant: any) => ({ ...variant, baseCost: variant.baseCost?.toString() ?? null, salePrice: variant.salePrice?.toString() ?? null })),
  };
}

async function writableWorkspace(auth: AuthContext, workspaceId: string): Promise<void> {
  const access = await requireWorkspaceAccess(auth, workspaceId);
  if (!MANAGE_ROLES.has(access.role)) throw new AppError('FORBIDDEN', 'You do not have permission to modify products.', 403);
}

export async function listProducts(auth: AuthContext, workspaceId: string, search?: string) {
  await requireWorkspaceAccess(auth, workspaceId);
  const products = await prisma.product.findMany({ where: { workspaceId, ...(search?.trim() ? { OR: [
    { name: { contains: search.trim(), mode: 'insensitive' } }, { sku: { contains: search.trim(), mode: 'insensitive' } }, { category: { contains: search.trim(), mode: 'insensitive' } },
  ] } : {}) }, include: { variants: true }, orderBy: { createdAt: 'desc' } });
  return products.map(productView);
}

export async function getProduct(auth: AuthContext, workspaceId: string, productId: string) {
  await requireWorkspaceAccess(auth, workspaceId);
  const product = await prisma.product.findFirst({ where: { id: productId, workspaceId }, include: { variants: true } });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found.', 404);
  return productView(product);
}

function parseProductInput(input: ProductInput, defaults?: { currency: string }) {
  const name = stringField(input.name, 'Product name', 160, true)!;
  const description = stringField(input.description, 'Description', 5000) ?? '';
  const sku = stringField(input.sku, 'SKU', 80); const category = stringField(input.category, 'Category', 120);
  const baseCost = money(input.baseCost, 'Base cost', true)!; const salePrice = money(input.salePrice, 'Sale price', true)!;
  const currency = (stringField(input.currency, 'Currency', 3) ?? defaults?.currency ?? 'DZD').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new AppError('VALIDATION_ERROR', 'Currency must be a 3-letter ISO-style code.', 400);
  const stock = integer(input.stock, 'Stock'); const shippingCost = money(input.shippingCost, 'Shipping cost') ?? new Prisma.Decimal(0); const packagingCost = money(input.packagingCost, 'Packaging cost') ?? new Prisma.Decimal(0);
  const expectedCancellationRate = percentage(input.expectedCancellationRate, 'Expected cancellation rate'); const expectedReturnRate = percentage(input.expectedReturnRate, 'Expected return rate');
  if (expectedCancellationRate.plus(expectedReturnRate).greaterThanOrEqualTo(100)) throw new AppError('VALIDATION_ERROR', 'Expected cancellation and return rates must total less than 100%.', 400);
  return { name, description, sku, category, baseCost, salePrice, currency, stock, shippingCost, packagingCost, expectedCancellationRate, expectedReturnRate, active: input.active === undefined ? true : Boolean(input.active) };
}

export async function createProduct(auth: AuthContext, workspaceId: string, input: ProductInput, requestId: string) {
  await writableWorkspace(auth, workspaceId); const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }); const data = parseProductInput(input, { currency: workspace.defaultCurrency });
  try { const product = await prisma.$transaction(async (tx) => { const created = await tx.product.create({ data: { workspaceId, ...data }, include: { variants: true } }); await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'product.create', entityType: 'Product', entityId: created.id, afterJson: { name: created.name, sku: created.sku }, requestReference: requestId } }); return created; }); return productView(product); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError('CONFLICT', 'A product with this SKU already exists in the workspace.', 409); throw error; }
}

export async function updateProduct(auth: AuthContext, workspaceId: string, productId: string, input: ProductInput, requestId: string) {
  await writableWorkspace(auth, workspaceId); const before = await prisma.product.findFirst({ where: { id: productId, workspaceId } }); if (!before) throw new AppError('NOT_FOUND', 'Product not found.', 404);
  const merged = parseProductInput({ name: input.name ?? before.name, description: input.description ?? before.description, sku: input.sku ?? before.sku, category: input.category ?? before.category, baseCost: input.baseCost ?? before.baseCost.toString(), salePrice: input.salePrice ?? before.salePrice.toString(), currency: input.currency ?? before.currency, stock: input.stock ?? before.stock, shippingCost: input.shippingCost ?? before.shippingCost.toString(), packagingCost: input.packagingCost ?? before.packagingCost.toString(), expectedCancellationRate: input.expectedCancellationRate ?? before.expectedCancellationRate.toString(), expectedReturnRate: input.expectedReturnRate ?? before.expectedReturnRate.toString(), active: input.active ?? before.active });
  try { const product = await prisma.$transaction(async (tx) => { const updated = await tx.product.update({ where: { id: productId }, data: merged, include: { variants: true } }); await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'product.update', entityType: 'Product', entityId: productId, beforeJson: before, afterJson: updated, requestReference: requestId } }); return updated; }); return productView(product); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError('CONFLICT', 'A product with this SKU already exists in the workspace.', 409); throw error; }
}

export async function deleteProduct(auth: AuthContext, workspaceId: string, productId: string, requestId: string) {
  await writableWorkspace(auth, workspaceId); const before = await prisma.product.findFirst({ where: { id: productId, workspaceId } }); if (!before) throw new AppError('NOT_FOUND', 'Product not found.', 404);
  await prisma.$transaction(async (tx) => { await tx.product.delete({ where: { id: productId } }); await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'product.delete', entityType: 'Product', entityId: productId, beforeJson: before, requestReference: requestId } }); });
}

function parseVariantInput(input: ProductInput) {
  const name = stringField(input.name, 'Variant name', 160, true)!; const sku = stringField(input.sku, 'SKU', 80); const baseCost = money(input.baseCost, 'Base cost'); const salePrice = money(input.salePrice, 'Sale price'); const stock = integer(input.stock, 'Stock');
  const attributes = input.attributes && typeof input.attributes === 'object' && !Array.isArray(input.attributes) ? input.attributes : {};
  const status = input.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  return { name, sku, baseCost, salePrice, stock, attributes, status } as const;
}

export async function createVariant(auth: AuthContext, workspaceId: string, productId: string, input: ProductInput, requestId: string) {
  await writableWorkspace(auth, workspaceId); const product = await prisma.product.findFirst({ where: { id: productId, workspaceId } }); if (!product) throw new AppError('NOT_FOUND', 'Product not found.', 404); const data = parseVariantInput(input);
  try { const variant = await prisma.productVariant.create({ data: { productId, ...data } }); await prisma.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'product.variant.create', entityType: 'ProductVariant', entityId: variant.id, afterJson: { productId, name: variant.name, sku: variant.sku }, requestReference: requestId } }); return { ...variant, baseCost: variant.baseCost?.toString() ?? null, salePrice: variant.salePrice?.toString() ?? null }; }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError('CONFLICT', 'A variant with this SKU already exists for the product.', 409); throw error; }
}

export async function updateVariant(auth: AuthContext, workspaceId: string, productId: string, variantId: string, input: ProductInput, requestId: string) {
  await writableWorkspace(auth, workspaceId); const before = await prisma.productVariant.findFirst({ where: { id: variantId, productId, product: { workspaceId } } }); if (!before) throw new AppError('NOT_FOUND', 'Product variant not found.', 404);
  const data = parseVariantInput({ name: input.name ?? before.name, sku: input.sku ?? before.sku, baseCost: input.baseCost ?? before.baseCost?.toString(), salePrice: input.salePrice ?? before.salePrice?.toString(), stock: input.stock ?? before.stock, attributes: input.attributes ?? before.attributes, status: input.status ?? before.status });
  try { const variant = await prisma.$transaction(async (tx) => { const updated = await tx.productVariant.update({ where: { id: variantId }, data }); await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'product.variant.update', entityType: 'ProductVariant', entityId: variantId, beforeJson: before, afterJson: updated, requestReference: requestId } }); return updated; }); return { ...variant, baseCost: variant.baseCost?.toString() ?? null, salePrice: variant.salePrice?.toString() ?? null }; }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError('CONFLICT', 'A variant with this SKU already exists for the product.', 409); throw error; }
}

export async function deleteVariant(auth: AuthContext, workspaceId: string, productId: string, variantId: string, requestId: string) {
  await writableWorkspace(auth, workspaceId); const before = await prisma.productVariant.findFirst({ where: { id: variantId, productId, product: { workspaceId } } }); if (!before) throw new AppError('NOT_FOUND', 'Product variant not found.', 404);
  await prisma.$transaction(async (tx) => { await tx.productVariant.delete({ where: { id: variantId } }); await tx.auditLog.create({ data: { workspaceId, userId: auth.userId, action: 'product.variant.delete', entityType: 'ProductVariant', entityId: variantId, beforeJson: before, requestReference: requestId } }); });
}
