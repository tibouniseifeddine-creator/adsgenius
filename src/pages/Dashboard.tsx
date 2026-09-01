import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign, ShoppingBag, CheckCircle, Truck,
  XCircle, RotateCcw, TrendingUp, Target, Info
} from 'lucide-react';
import { KPICard } from '../components/dashboard/KPICard';
import { AISummary } from '../components/dashboard/AISummary';
import { Card } from '../components/ui/Card';
import { useLanguage } from '../contexts/LanguageContext';
import { apiFetch } from '../lib/api';
import { Order, Product } from '../types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

const CONFIRMED_LIKE = ['confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered'];

// See audit finding P09 -- every number on this page used to come from
// DemoContext's fake orders/metrics, even for real signed-in users with real
// orders. Order-derived numbers (counts, revenue, delivery/cancellation
// rates) now come from the real GET /api/orders + /api/products endpoints
// (same ones Orders.tsx and Products.tsx already use). Ad-spend metrics
// (spend, ROAS, CAC, CPA) have no real source yet -- that needs a connected
// ad account (tracked separately) -- so they're shown as "--" with a note
// instead of fabricated numbers.
export function Dashboard() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ orders: Order[] }>('/api/orders')
      .then(data => setOrders(data.orders))
      .catch(() => {})
      .finally(() => setLoading(false));
    apiFetch<{ products: Product[] }>('/api/products').then(data => setProducts(data.products)).catch(() => {});
  }, []);

  const productById = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  const totalOrders = orders.length;
  const confirmedOrders = orders.filter(o => CONFIRMED_LIKE.includes(o.status)).length;
  const deliveredOrders = orders.filter(o => o.status === 'delivered');
  const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
  const returnedOrders = orders.filter(o => o.status === 'returned').length;

  // Revenue and cost are computed from each order's own real price/delivery
  // fee, plus the product's own purchase/packaging cost -- no assumed prices.
  const revenue = deliveredOrders.reduce((s, o) => s + (o.total || 0), 0);
  const cost = deliveredOrders.reduce((s, o) => {
    const product = productById.get(o.productId);
    return s + (product?.purchaseCost || 0) + (o.deliveryFee || 0) + (product?.packagingCost || 0);
  }, 0);
  const netProfit = revenue - cost;
  const deliveryRate = confirmedOrders > 0 ? ((deliveredOrders.length / confirmedOrders) * 100).toFixed(1) : '0';
  const cancellationRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : '0';
  const costPerDelivered = deliveredOrders.length > 0 ? (cost / deliveredOrders.length).toFixed(0) : '0';

  // Grouped by real order date -- this replaces the old fake daily
  // spend/revenue series, since there's no real spend series to show yet.
  const byDay = useMemo(() => {
    const map = new Map<string, { date: string; orders: number; delivered: number; revenue: number }>();
    for (const o of orders) {
      const day = (o.orderDate || '').slice(0, 10);
      if (!day) continue;
      const entry = map.get(day) || { date: day.slice(5), orders: 0, delivered: 0, revenue: 0 };
      entry.orders += 1;
      if (o.status === 'delivered') { entry.delivered += 1; entry.revenue += o.total || 0; }
      map.set(day, entry);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard')}</h1>
      </div>
      <AISummary />

      {!loading && orders.length === 0 && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 text-blue-800 text-sm rounded-lg p-3">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>No orders yet -- these numbers will fill in as real orders come through Orders.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title={t('totalOrders')} value={String(totalOrders)} icon={<ShoppingBag className="w-6 h-6" />} color="purple" />
        <KPICard title={t('confirmedOrders')} value={String(confirmedOrders)} icon={<CheckCircle className="w-6 h-6" />} color="green" />
        <KPICard title={t('deliveredOrders')} value={String(deliveredOrders.length)} icon={<Truck className="w-6 h-6" />} color="cyan" />
        <KPICard title={t('cancelledOrders')} value={String(cancelledOrders)} icon={<XCircle className="w-6 h-6" />} color="red" />
        <KPICard title={t('returnedOrders')} value={String(returnedOrders)} icon={<RotateCcw className="w-6 h-6" />} color="amber" />
        <KPICard title={t('revenue')} value={`${revenue.toLocaleString()} DZD`} icon={<TrendingUp className="w-6 h-6" />} color="green" />
        <KPICard title={t('netProfit')} value={`${netProfit.toLocaleString()} DZD`} icon={<Target className="w-6 h-6" />} color="blue" />
        <KPICard title={t('totalSpend')} value="--" icon={<DollarSign className="w-6 h-6" />} color="blue" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title="Orders & Revenue" subtitle="By day, from your real orders">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={byDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="orders" stackId="1" stroke="#3b82f6" fill="#bfdbfe" name="Orders" />
                <Area type="monotone" dataKey="revenue" stackId="2" stroke="#10b981" fill="#bbf7d0" name="Revenue (DZD)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={t('profitCalculator')} subtitle="Real business metrics">
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">{t('trueCac')}</span>
              <span className="font-semibold text-gray-400">--</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">{t('trueCpa')}</span>
              <span className="font-semibold text-gray-400">--</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">{t('realRoas')}</span>
              <span className="font-semibold text-gray-400">--</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">{t('deliveryRate')}</span>
              <span className="font-semibold text-blue-600">{deliveryRate}%</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">{t('cancellationRate')}</span>
              <span className="font-semibold text-red-600">{cancellationRate}%</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">{t('costPerDelivered')}</span>
              <span className="font-semibold">{costPerDelivered} DZD</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-400">Ad spend metrics (CAC, CPA, ROAS) need a connected ad account -- coming soon.</p>
        </Card>
      </div>
      <Card title="Orders Funnel" subtitle="From placed to delivered, by day">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="orders" fill="#3b82f6" name="Orders" />
              <Bar dataKey="delivered" fill="#10b981" name="Delivered" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
