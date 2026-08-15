export type ShippingNormalizedStatus = 'PENDING' | 'LABEL_CREATED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED' | 'CANCELLED' | 'FAILED';

export interface CreateShipmentInput { orderId: string; customerName: string; phone: string; address?: string; city?: string; countryCode: string; codAmount: number; }
export interface ShipmentResult { provider: string; providerShipmentId?: string; trackingNumber?: string; status: ShippingNormalizedStatus; shippingCost?: number; raw?: unknown; }

export interface ShippingAdapter { readonly provider: string; createShipment(input: CreateShipmentInput): Promise<ShipmentResult>; normalizeStatus(providerStatus: string): ShippingNormalizedStatus; }

/** Manual adapter is deliberately non-networked. Real provider adapters are added only after API/contract verification. */
export const manualShippingAdapter: ShippingAdapter = {
  provider: 'MANUAL',
  async createShipment(input) { return { provider: 'MANUAL', status: 'PENDING', shippingCost: 0, raw: { orderId: input.orderId } }; },
  normalizeStatus(status) { const normalized = status.trim().toUpperCase(); if (['DELIVERED','RETURNED','CANCELLED','FAILED','IN_TRANSIT','PICKED_UP','LABEL_CREATED'].includes(normalized)) return normalized as ShippingNormalizedStatus; return 'PENDING'; }
};
