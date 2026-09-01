import React, { useState } from 'react';
import { Download, Info } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useDemo } from '../contexts/DemoContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';

// See audit finding P09 -- ad-performance metrics (spend, ROAS, CTR, per-creative
// AI score) have no real source yet: they depend on a connected ad account
// (Meta) which doesn't exist in this app today (tracked separately). Rather
// than silently present sample numbers as if they were the workspace's real
// results, the page now says plainly that this is sample data. The Export
// button used to do nothing; it now really exports what's on screen as CSV.
export function Analytics() {
  const { t } = useLanguage();
  const { metrics, creatives } = useDemo();
  const [period, setPeriod] = useState('7d');

  const totalSpend = metrics.reduce((s, m) => s + m.spend, 0);
  const totalRevenue = metrics.reduce((s, m) => s + m.revenue, 0);
  const totalOrders = metrics.reduce((s, m) => s + m.orders, 0);
  const totalDelivered = metrics.reduce((s, m) => s + m.deliveredOrders, 0);

  const chartData = metrics.map(m => ({
    date: m.date.slice(5), spend: m.spend, revenue: m.revenue, profit: m.profit,
    ctr: m.ctr, cpc: m.cpc, roas: m.roas, orders: m.orders, delivered: m.deliveredOrders
  }));

  const creativeData = creatives.filter(c => c.metrics).map(c => ({
    name: c.name, score: c.aiScore || 0, ctr: c.metrics?.ctr || 0,
    spend: c.metrics?.spend || 0, delivered: c.metrics?.deliveredOrders || 0,
    cpd: c.metrics?.costPerDeliveredOrder || 0
  }));

  const statusData = [
    { name: 'Delivered', value: totalDelivered, color: '#10b981' },
    { name: 'Cancelled', value: metrics.reduce((s, m) => s + m.cancelledOrders, 0), color: '#ef4444' },
    { name: 'Returned', value: metrics.reduce((s, m) => s + m.returnedOrders, 0), color: '#f59e0b' },
  ];

  const exportCsv = () => {
    const rows = [
      ['date', 'spend', 'revenue', 'profit', 'ctr', 'cpc', 'roas', 'orders', 'delivered'],
      ...chartData.map(d => [d.date, d.spend, d.revenue, d.profit, d.ctr, d.cpc, d.roas, d.orders, d.delivered]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adsgenius-analytics-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('analytics')}</h1>
        <div className="flex gap-2">
          <select value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="7d">{t('last7Days')}</option>
            <option value="30d">{t('last30Days')}</option>
            <option value="today">{t('today')}</option>
          </select>
          <Button variant="secondary" onClick={exportCsv}><Download className="w-4 h-4 mr-2" />{t('export')}</Button>
        </div>
      </div>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 text-blue-800 text-sm rounded-lg p-3">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Sample data -- ad performance (spend, ROAS, CTR, AI creative scores) will reflect your real results once an ad account is connected.</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title={t('spend')} subtitle="Total"><p className="text-2xl font-bold">{totalSpend.toLocaleString()} DZD</p></Card>
        <Card title={t('revenue')} subtitle="Total"><p className="text-2xl font-bold text-emerald-600">{totalRevenue.toLocaleString()} DZD</p></Card>
        <Card title={t('orders')} subtitle="Total"><p className="text-2xl font-bold">{totalOrders}</p></Card>
        <Card title={t('deliveredOrders')} subtitle="Total"><p className="text-2xl font-bold text-blue-600">{totalDelivered}</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="ROAS Trend" subtitle="Return on Ad Spend">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="roas" stroke="#3b82f6" strokeWidth={2} name="ROAS" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Order Status Distribution">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {statusData.map(s => (
              <div key={s.name} className="flex items-center gap-1 text-sm">
                <span className="w-3 h-3 rounded-full" style={{ background: s.color }}></span>
                <span>{s.name}: {s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title={t('creativePerformance')} subtitle="AI Scored Creatives">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={creativeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="score" fill="#3b82f6" name="AI Score" />
              <Bar dataKey="ctr" fill="#10b981" name="CTR %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Cost Per Delivered Order" subtitle="By Creative">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={creativeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="cpd" fill="#f59e0b" name="CPD (DZD)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
