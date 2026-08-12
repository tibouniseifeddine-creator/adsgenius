import React from 'react';
import {
  DollarSign, ShoppingBag, CheckCircle, Truck,
  XCircle, RotateCcw, TrendingUp, Target
} from 'lucide-react';
import { KPICard } from '../components/dashboard/KPICard';
import { AISummary } from '../components/dashboard/AISummary';
import { Card } from '../components/ui/Card';
import { useDemo } from '../contexts/DemoContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

export function Dashboard() {
  const { t } = useLanguage();
  const { metrics, orders } = useDemo();

  const totalSpend = metrics.reduce((s, m) => s + m.spend, 0);
  const totalOrders = orders.length;
  const confirmedOrders = orders.filter(o => ['confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered'].includes(o.status)).length;
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
  const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
  const returnedOrders = orders.filter(o => o.status === 'returned').length;
  const revenue = deliveredOrders * 6490;
  const productCost = deliveredOrders * 3400;
  const deliveryCost = deliveredOrders * 400;
  const packagingCost = deliveredOrders * 150;
  const grossProfit = revenue - productCost - deliveryCost - packagingCost;
  const netProfit = grossProfit - totalSpend;
  const deliveredRoas = totalSpend > 0 ? ((deliveredOrders * 6490) / totalSpend).toFixed(2) : '0';
  const deliveryRate = confirmedOrders > 0 ? ((deliveredOrders / confirmedOrders) * 100).toFixed(1) : '0';
  const cancellationRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : '0';

  const chartData = metrics.map(m => ({
    date: m.date.slice(5), spend: m.spend, revenue: m.revenue, profit: m.profit, orders: m.orders, delivered: m.deliveredOrders
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard')}</h1>
      </div>
      <AISummary />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title={t('totalSpend')} value={`${totalSpend.toLocaleString()} DZD`} icon={<DollarSign className="w-6 h-6" />} color="blue" />
        <KPICard title={t('totalOrders')} value={String(totalOrders)} icon={<ShoppingBag className="w-6 h-6" />} color="purple" />
        <KPICard title={t('confirmedOrders')} value={String(confirmedOrders)} icon={<CheckCircle className="w-6 h-6" />} color="green" />
        <KPICard title={t('deliveredOrders')} value={String(deliveredOrders)} icon={<Truck className="w-6 h-6" />} color="cyan" />
        <KPICard title={t('cancelledOrders')} value={String(cancelledOrders)} icon={<XCircle className="w-6 h-6" />} color="red" />
        <KPICard title={t('returnedOrders')} value={String(returnedOrders)} icon={<RotateCcw className="w-6 h-6" />} color="amber" />
        <KPICard title={t('revenue')} value={`${revenue.toLocaleString()} DZD`} icon={<TrendingUp className="w-6 h-6" />} color="green" />
        <KPICard title={t('netProfit')} value={`${netProfit.toLocaleString()} DZD`} icon={<Target className="w-6 h-6" />} color="blue" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title="Spend vs Revenue" subtitle="Last 4 days">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="spend" stackId="1" stroke="#ef4444" fill="#fecaca" name="Spend" />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="#10b981" fill="#bbf7d0" name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={t('profitCalculator')} subtitle="Real business metrics">
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">{t('trueCac')}</span>
              <span className="font-semibold">{deliveredOrders > 0 ? (totalSpend / deliveredOrders).toFixed(0) : 0} DZD</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">{t('trueCpa')}</span>
              <span className="font-semibold">{confirmedOrders > 0 ? (totalSpend / confirmedOrders).toFixed(0) : 0} DZD</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">{t('realRoas')}</span>
              <span className="font-semibold text-emerald-600">{deliveredRoas}x</span>
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
              <span className="font-semibold">{deliveredOrders > 0 ? (totalSpend / deliveredOrders).toFixed(0) : 0} DZD</span>
            </div>
          </div>
        </Card>
      </div>
      <Card title="Orders Funnel" subtitle="From impressions to delivered">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
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
