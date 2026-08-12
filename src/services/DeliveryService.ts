export class DeliveryService {
  static async createShipment(orderId: string, provider: string): Promise<{ trackingNumber: string }> {
    return { trackingNumber: `TRK-${Date.now()}` };
  }
  static async trackShipment(trackingNumber: string): Promise<{ status: string; location: string }> {
    return { status: 'in_transit', location: 'Alger Centre' };
  }
}
