import React, { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, ShoppingBag } from 'lucide-react';
import { apiFetch } from '../lib/api';

// Public, UNAUTHENTICATED landing page for a single product -- this is the
// page ad traffic from Facebook/Instagram/TikTok links to (e.g.
// https://<your-domain>/order/<productId>, copied from the Products page).
// Anyone with the link can view it and submit an order, no login required.
// It talks only to the public backend endpoints (GET /api/public/products/:id,
// POST /api/public/orders) added alongside the authenticated /api/orders ones.
interface PublicProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
}

const emptyForm = {
  customerName: '', phone: '', wilaya: '', commune: '', address: '', quantity: '1',
  // Honeypot: real visitors never see or fill this field. Bots that
  // auto-fill every input will, and get silently dropped server-side.
  website: '',
};

export function PublicOrderPage() {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setLoadError(null);
    apiFetch<{ product: PublicProduct }>(`/api/public/products/${productId}`)
      .then(data => setProduct(data.product))
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Product not found'))
      .finally(() => setLoading(false));
  }, [productId]);

  const quantityNum = Math.max(1, Math.round(Number(form.quantity)) || 1);
  const total = product ? product.price * quantityNum : 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!productId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiFetch('/api/public/orders', {
        body: {
          productId,
          customerName: form.customerName,
          phone: form.phone,
          wilaya: form.wilaya,
          commune: form.commune,
          address: form.address,
          quantity: quantityNum,
          website: form.website,
        }
      });
      setDone(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'تعذر إرسال الطلب، حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </main>
    );
  }

  if (loadError || !product) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <section className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600">هذا المنتج غير متوفر حالياً.</p>
        </section>
      </main>
    );
  }

  if (done) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <section className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">تم استلام طلبك بنجاح!</h1>
          <p className="text-sm text-gray-500">سيتم التواصل معك هاتفياً لتأكيد الطلبية في أقرب وقت.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <section className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
          {product.description && <p className="mt-1 text-sm text-gray-500">{product.description}</p>}
          <p className="mt-2 text-lg font-bold text-blue-600">{product.price.toLocaleString()} {product.currency}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Honeypot field: hidden from real visitors via CSS, not `type="hidden"`,
              since some bots skip inputs they detect as hidden-type. */}
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website" name="website" tabIndex={-1} autoComplete="off"
              value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل *</label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف *</label>
            <input
              type="tel"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الولاية *</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.wilaya} onChange={e => setForm({ ...form, wilaya: e.target.value })} required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">البلدية</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.commune} onChange={e => setForm({ ...form, commune: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الكمية *</label>
            <input
              type="number" min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">الإجمالي</span>
            <span className="text-lg font-bold text-gray-900">{total.toLocaleString()} {product.currency}</span>
          </div>

          {submitError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {submitError}
            </div>
          )}

          <button
            type="submit" disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? 'جارٍ الإرسال...' : 'تأكيد الطلب'}
          </button>
        </form>
      </section>
    </main>
  );
}
