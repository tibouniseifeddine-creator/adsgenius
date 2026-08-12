import { Order } from '../types';

export class OrderService {
  static async getOrders(): Promise<Order[]> { return []; }
  static async updateStatus(orderId: string, status: string): Promise<boolean> { return true; }
  static async createOrder(order: Partial<Order>): Promise<Order> {
    return { ...order, id: `ORD-${Date.now()}` } as Order;
  }
}
