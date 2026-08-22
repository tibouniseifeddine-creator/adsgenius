import React, { useEffect, useState } from 'react';
import { Plus, Phone, MessageCircle, CheckCircle, XCircle, Truck, Pencil, Printer, X, ClipboardList, Loader2, AlertTriangle } from 'lucide-react';
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

// Best-effort local-to-international normalization for wa.me links (wa.me needs
// digits only, no leading 0 or +). Defaults the leading 0 to Algeria's country
// code since every other part of this app (wilaya/commune, DZD currency) is
// Algeria-specific; a number already in international form is left as-is.
function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('213')) return digits;
  if (digits.startsWith('0')) return `213${digits.slice(1)}`;
  return digits;
}

const emptyForm = {
  customerName: '', phone: '', wilaya: '', commune: '', address: '',
  productId: '', productName: '', quantity: '1', price: '', deliveryFee: '',
  status: 'pending_confirmation' as OrderStatus,
};

// Print slips are built as a raw HTML string (see printOrder below), so every
// customer-entered value must be escaped -- orders can arrive from the public
// landing page (PublicOrderPage.tsx), where anyone can type anything into
// customerName/address.
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));
}

// Orders reach "confirmed" and beyond only after a human has actually verified
// them by phone/WhatsApp, so a delivery slip only makes sense from that point
// on -- printing a still-unconfirmed or already-cancelled order would be
// sending bad information to a delivery company.
const PRINTABLE_STATUSES = new Set<OrderStatus>(['confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered']);

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
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

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
    const payload = {
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
    };
    try {
      if (editingOrderId) {
        const { order } = await apiFetch<{ order: Order }>(`/api/orders/${editingOrderId}`, { method: 'PATCH', body: payload });
        setOrders(prev => prev.map(o => (o.id === editingOrderId ? order : o)));
      } else {
        const { order } = await apiFetch<{ order: Order }>('/api/orders', { body: payload });
        setOrders(prev => [order, ...prev]);
      }
      setShowModal(false);
      setForm(emptyForm);
      setEditingOrderId(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const openAddModal = () => {
    setEditingOrderId(null);
    setForm(emptyForm);
    setSaveError(null);
    setShowModal(true);
  };

  const openEditModal = (order: Order) => {
    setEditingOrderId(order.id);
    setForm({
      customerName: order.customerName,
      phone: order.phone,
      wilaya: order.wilaya,
      commune: order.commune || '',
      address: order.address || '',
      productId: order.productId || '',
      productName: order.productName,
      quantity: String(order.quantity),
      price: String(order.price),
      deliveryFee: String(order.deliveryFee),
      status: order.status,
    });
    setSaveError(null);
    setShowModal(true);
  };

  // Builds a printable delivery slip in a fresh window and triggers the
  // browser's print dialog. All values are HTML-escaped since orders can
  // originate from the public landing page (untrusted customer input).
  const printOrder = (order: Order) => {
    const win = window.open('', '_blank', 'width=380,height=600');
    if (!win) return;
    const rows: [string, string][] = [
      ['Order ID', order.id],
      ['Customer', order.customerName],
      ['Phone', order.phone],
      ['Wilaya', order.wilaya],
      ['Commune', order.commune || '-'],
      ['Address', order.address || '-'],
      ['Product', order.productName],
      ['Quantity', String(order.quantity)],
      ['Price', `${order.price.toLocaleString()} DZD`],
      ['Delivery Fee', `${order.deliveryFee.toLocaleString()} DZD`],
      ['Total', `${order.total.toLocaleString()} DZD`],
      ['Status', order.status],
    ];
    const rowsHtml = rows.map(([label, value]) => `
      <tr>
        <td style="padding:6px 8px;font-weight:600;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${escapeHtml(label)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(value)}</td>
      </tr>
    `).join('');
    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>Order ${escapeHtml(order.id.slice(0, 8))}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; padding: 16px; direction: rtl; color: #111827; }
          h1 { font-size: 18px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>Order Slip / وصل الطلبية</h1>
        <table>${rowsHtml}</table>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('orders')}</h1>
        <Button onClick={openAddModal}><Plus className="w-4 h-4 mr-2" />Add Order</Button>
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
                        <Button
                          variant="ghost" size="sm" title={`Call ${order.phone}`}
                          onClick={() => { window.location.href = `tel:${order.phone}`; }}
                        >
                          <Phone className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" title={`WhatsApp ${order.phone}`}
                          onClick={() => window.open(`https://wa.me/${toWhatsAppNumber(order.phone)}`, '_blank', 'noopener,noreferrer')}
                        >
                          <MessageCircle className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Edit order" onClick={() => openEditModal(order)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        {PRINTABLE_STATUSES.has(order.status) && (
                          <Button variant="ghost" size="sm" title="Print delivery slip" onClick={() => printOrder(order)}>
                            <Printer className="w-3 h-3" />
                          </Button>
                        )}
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
                <Button variant="secondary" size="sm" onClick={openAddModal}>Add Order</Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold text-gray-900">{editingOrderId ? 'Edit Order' : 'Add Order'}</h2>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('product')} *</label>
                  {/* Locked to the real product catalog whenever one exists, so orders can't
                      be attached to a freehand product name that doesn't match any stock
                      record. The free-text fallback below only appears for a brand-new
                      workspace that hasn't added any products yet. */}
                  <select
                    value={form.productId}
                    onChange={e => handleProductChange(e.target.value)}
                    required={products.length > 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{products.length ? 'Select a product...' : 'No products yet -- type name below'}</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {products.length === 0 && (
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
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editingOrderId ? 'Save Changes' : t('save')}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
