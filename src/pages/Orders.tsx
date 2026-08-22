import React, { useEffect, useState } from 'react';
import { Plus, Phone, CheckCircle, XCircle, Truck, X, ClipboardList, Loader2, AlertTriangle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../contexts/LanguageContext';
import { Order, OrderStatus, Product } from '../types';
import { apiFetch } from '../lib/api';

const statusColors: Record<OrderStatus, any> = {
  new: 'default', pending_confirmation: 'warning', confirmed: 'info',
  preparing: 'info', shipped: 'info', out_for_delivery: 'info',
  delivered: 'success', cancelled: 'danger', refused: 'danger', returned: 'danger'
};

const ALL_STATUSES: OrderStatus[] = [
  'new', 'pending_confirmation', 'confirmed', 'preparing', 'shipped',
  'out_for_delivery', 'delivered', 'cancelled', 'refused', 'returned'
];

const emptyForm = {
  customerName: '', phone: '', wilaya: '', commune: '', address: '',
  productId: '', productName: '', quantity: '1', price: '', deliveryFee: '',
  status: 'pending_confirmation' as OrderStatus,
};

// This page is connected to the real backend (GET/POST/PATCH /api/orders) instead
// of DemoContext's fake data -- see COWORK_ADSGENIUS_REALDATA_PLAN.md. There is no
// storefront/checkout yet, so orders are entered manually via the "Add Order" form
// below rather than arriving automatically.
export function Orders() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadOrders = () => {
    setLoading(true);
    setLoadError(null);
    apiFetch<{ orders: Order[] }>('/api/orders')
      .then(data => setOrders(data.orders))
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Failed to load orders'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
    // Products power the "Add Order" dropdown (auto-fills price/delivery fee).
    // A failure here shouldn't block viewing existing orders, so it's silent.
    apiFetch<{ products: Product[] }>('/api/products').then(data => setProducts(data.products)).catch(() => {});
  }, []);

  const filtered = orders.filter(o => {
    const matchesSearch = o.customerName.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      const { order } = await apiFetch<{ order: Order }>(`/api/orders/${orderId}`, { method: 'PATCH', body: { status } });
      setOrders(prev => prev.map(o => (o.id === orderId ? order : o)));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to update order status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    setForm(prev => ({
      ...prev,
      productId,
      productName: product ? product.name : prev.productName,
      price: product ? String(product.sellingPrice) : prev.price,
      deliveryFee: product ? String(product.deliveryCost) : prev.deliveryFee,
    }));
  };

  const quantityNum = Number(form.quantity) || 0;
  const priceNum = Number(form.price) || 0;
  const deliveryFeeNum = Number(form.deliveryFee) || 0;
  const computedTotal = quantityNum * priceNum + deliveryFeeNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const { order } = await apiFetch<{ order: Order }>('/api/orders', {
        body: {
          customerName: form.customerName,
          phone: form.phone,
          wilaya: form.wilaya,
          commune: form.commune,
          address: form.address,
          productId: form.productId || undefined,
          productName: form.productName || 'Unknown product',
          quantity: quantityNum || 1,
          price: priceNum,
          deliveryFee: deliveryFeeNum,
          total: computedTotal,
          status: form.status,
        }
      });
      setOrders(prev => [order, ...prev]);
      setShowModal(false);
      setForm(emptyForm);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('orders')}</h1>
        <Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-2" />Add Order</Button>
      </div>
      <Card>
        <div className="flex gap-4 mb-4">
          <Input placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
            <option value="all">{t('all')}</option>
            {ALL_STATUSES.map(s => (
              <option key={s} value={s}>{t(s as any)}</option>
            ))}
          </select>
        </div>
        {loading && (
          <div className="text-center py-12 text-gray-500 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p>Loading your orders...</p>
          </div>
        )}
        {!loading && loadError && (
          <div className="text-center py-12">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-600 mb-3">{loadError}</p>
            <Button variant="secondary" size="sm" onClick={loadOrders}>Retry</Button>
          </div>
        )}
        {!loading && !loadError && (
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
                    <td className="px-4 py-3 font-medium">{order.id.slice(0, 8)}</td>
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
                            <Button variant="success" size="sm" disabled={updatingId === order.id} onClick={() => updateOrderStatus(order.id, 'confirmed')}><CheckCircle className="w-3 h-3" /></Button>
                            <Button variant="danger" size="sm" disabled={updatingId === order.id} onClick={() => updateOrderStatus(order.id, 'cancelled')}><XCircle className="w-3 h-3" /></Button>
                          </>
                        )}
                        {order.status === 'confirmed' && (
                          <Button variant="secondary" size="sm" disabled={updatingId === order.id} onClick={() => updateOrderStatus(order.id, 'shipped')}><Truck className="w-3 h-3" /></Button>
                        )}
                        <Button variant="ghost" size="sm"><Phone className="w-3 h-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-2">{t('noData')}</p>
                <Button variant="secondary" size="sm" onClick={() => setShowModal(true)}>Add Order</Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Add Order</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('customer')} *</label>
                  <Input value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('phone')} *</label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('wilaya')} *</label>
                  <Input value={form.wilaya} onChange={e => setForm({ ...form, wilaya: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('commune')}</label>
                  <Input value={form.commune} onChange={e => setForm({ ...form, commune: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('address')}</label>
                  <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('product')}</label>
                  <select
                    value={form.productId}
                    onChange={e => handleProductChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{products.length ? 'Select a product...' : 'No products yet -- type name below'}</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {!form.productId && (
                    <Input
                      className="mt-2"
                      placeholder="Product name"
                      value={form.productName}
                      onChange={e => setForm({ ...form, productName: e.target.value })}
                      required
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('quantity')} *</label>
                  <Input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('price')} (DZD) *</label>
                  <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('deliveryCost')} (DZD)</label>
                  <Input type="number" value={form.deliveryFee} onChange={e => setForm({ ...form, deliveryFee: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('status')}</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as OrderStatus })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ALL_STATUSES.map(s => <option key={s} value={s}>{t(s as any)}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2 bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">{t('total')}</span>
                  <span className="text-lg font-bold text-gray-900">{computedTotal.toLocaleString()} DZD</span>
                </div>
              </div>
              {saveError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {saveError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>{t('cancel')}</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : t('save')}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
