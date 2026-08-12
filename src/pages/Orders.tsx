import React, { useState } from 'react';
import { Search, Phone, CheckCircle, XCircle, Truck } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useDemo } from '../contexts/DemoContext';
import { useLanguage } from '../contexts/LanguageContext';
import { OrderStatus } from '../types';

const statusColors: Record<OrderStatus, any> = {
  new: 'default', pending_confirmation: 'warning', confirmed: 'info',
  preparing: 'info', shipped: 'info', out_for_delivery: 'info',
  delivered: 'success', cancelled: 'danger', refused: 'danger', returned: 'danger'
};

export function Orders() {
  const { t } = useLanguage();
  const { orders, updateOrderStatus } = useDemo();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = orders.filter(o => {
    const matchesSearch = o.customerName.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('orders')}</h1>
      </div>
      <Card>
        <div className="flex gap-4 mb-4">
          <Input placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
            <option value="all">{t('all')}</option>
            {['new', 'pending_confirmation', 'confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refused', 'returned'].map(s => (
              <option key={s} value={s}>{t(s as any)}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">{t('orderId')}</th>
                <th className="px-4 py-3 text-left">{t('customer')}</th>
                <th className="px-4 py-3 text-left">{t('wilaya')}</th>
                <th className="px-4 py-3 text-left">{t('product')}</th>
                <th className="px-4 py-3 text-left">{t('total')}</th>
                <th className="px-4 py-3 text-left">{t('status')}</th>
                <th className="px-4 py-3 text-left">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{order.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{order.customerName}</p>
                    <p className="text-xs text-gray-500">{order.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{order.wilaya}</td>
                  <td className="px-4 py-3 text-gray-500">{order.productName}</td>
                  <td className="px-4 py-3 font-medium">{order.total.toLocaleString()} DZD</td>
                  <td className="px-4 py-3"><Badge variant={statusColors[order.status]}>{t(order.status as any)}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {order.status === 'pending_confirmation' && (
                        <>
                          <Button variant="success" size="sm" onClick={() => updateOrderStatus(order.id, 'confirmed')}><CheckCircle className="w-3 h-3" /></Button>
                          <Button variant="danger" size="sm" onClick={() => updateOrderStatus(order.id, 'cancelled')}><XCircle className="w-3 h-3" /></Button>
                        </>
                      )}
                      {order.status === 'confirmed' && (
                        <Button variant="secondary" size="sm" onClick={() => updateOrderStatus(order.id, 'shipped')}><Truck className="w-3 h-3" /></Button>
                      )}
                      <Button variant="ghost" size="sm"><Phone className="w-3 h-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
