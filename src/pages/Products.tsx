import React, { useEffect, useState } from 'react';
import { Plus, Search, Eye, Wand2, X, Package, Trash2 } from 'lucide-react';
import { ApiClient, ApiClientError } from '@adsgenius/api-client';
import type { Product } from '@adsgenius/shared-types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const api = new ApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '' });

type FormState = {
  name: string;
  sku: string;
  category: string;
  description: string;
  baseCost: string;
  salePrice: string;
  stock: string;
  shippingCost: string;
  packagingCost: string;
  expectedCancellationRate: string;
  expectedReturnRate: string;
};

const emptyForm: FormState = {
  name: '', sku: '', category: '', description: '', baseCost: '', salePrice: '', stock: '',
  shippingCost: '', packagingCost: '', expectedCancellationRate: '15', expectedReturnRate: '5',
};

export function Products() {
  const { t } = useLanguage();
  const { workspaceId, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = async () => {
    if (!workspaceId) return;
    setLoading(true); setError(null);
    try { setProducts(await api.listProducts(workspaceId, search)); }
    catch (cause) { setError(cause instanceof ApiClientError ? cause.message : 'Unable to load products.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (!authLoading && isAuthenticated && workspaceId) void loadProducts(); }, [workspaceId, isAuthenticated, authLoading, search]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspaceId) return;
    setSaving(true); setError(null);
    try {
      await api.createProduct(workspaceId, {
        name: form.name,
        sku: form.sku || undefined,
        category: form.category || undefined,
        description: form.description || undefined,
        baseCost: form.baseCost,
        salePrice: form.salePrice,
        stock: Number(form.stock) || 0,
        shippingCost: form.shippingCost || undefined,
        packagingCost: form.packagingCost || undefined,
        expectedCancellationRate: form.expectedCancellationRate,
        expectedReturnRate: form.expectedReturnRate,
      });
      setShowModal(false); setForm(emptyForm); await loadProducts();
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Unable to save the product.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (productId: string) => {
    if (!workspaceId || !window.confirm('Delete this product?')) return;
    try { await api.deleteProduct(workspaceId, productId); await loadProducts(); }
    catch (cause) { setError(cause instanceof ApiClientError ? cause.message : 'Unable to delete the product.'); }
  };

  if (authLoading || loading) return <div className="p-8 text-center text-gray-500">Loading products...</div>;
  if (!isAuthenticated || !workspaceId) return <div className="p-8 text-center text-gray-500">Please sign in to manage products.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('products')}</h1>
        <Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-2" />{t('addProduct')}</Button>
      </div>
      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      <Card>
        <div className="mb-4"><Input placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" /></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600"><tr>
              <th className="px-4 py-3 text-left">{t('productName')}</th><th className="px-4 py-3 text-left">{t('sku')}</th>
              <th className="px-4 py-3 text-left">{t('category')}</th><th className="px-4 py-3 text-left">Price</th>
              <th className="px-4 py-3 text-left">Margin</th><th className="px-4 py-3 text-left">Break-even</th>
              <th className="px-4 py-3 text-left">{t('stock')}</th><th className="px-4 py-3 text-left">{t('actions')}</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {products.map(product => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium text-gray-900">{product.name}</p><p className="text-xs text-gray-500">{product.description.slice(0, 50)}</p></td>
                  <td className="px-4 py-3 text-gray-500">{product.sku ?? '—'}</td><td className="px-4 py-3 text-gray-500">{product.category ?? '—'}</td>
                  <td className="px-4 py-3 font-medium">{Number(product.salePrice).toLocaleString()} {product.currency}</td>
                  <td className="px-4 py-3"><Badge variant={Number(product.expectedNetMargin) >= 0 ? 'success' : 'danger'}>{Number(product.expectedNetMargin).toLocaleString()} {product.currency}</Badge></td>
                  <td className="px-4 py-3">{product.breakEvenPrice ? `${Number(product.breakEvenPrice).toLocaleString()} ${product.currency}` : '—'}</td>
                  <td className="px-4 py-3">{product.stock}</td>
                  <td className="px-4 py-3"><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => navigate(`/products/${product.id}`)}><Eye className="w-4 h-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)}><Trash2 className="w-4 h-4" /></Button><Button variant="secondary" size="sm"><Wand2 className="w-4 h-4 mr-1" /> Analyze</Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <div className="text-center py-12"><Package className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 mb-2">{t('noData')}</p><Button variant="secondary" size="sm" onClick={() => setShowModal(true)}>{t('addFirstProduct')}</Button></div>}
        </div>
      </Card>

      {showModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold text-gray-900">{t('addProduct')}</h2><button onClick={() => setShowModal(false)} className="text-gray-400"><X className="w-5 h-5" /></button></div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input placeholder={t('productName')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <Input placeholder={t('sku')} value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
          <Input placeholder={t('category')} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          <Input type="number" placeholder={t('stock')} value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Base cost" value={form.baseCost} onChange={e => setForm({ ...form, baseCost: e.target.value })} required />
          <Input type="number" step="0.01" placeholder="Sale price" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: e.target.value })} required />
          <Input type="number" step="0.01" placeholder="Shipping cost" value={form.shippingCost} onChange={e => setForm({ ...form, shippingCost: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Packaging cost" value={form.packagingCost} onChange={e => setForm({ ...form, packagingCost: e.target.value })} />
          <Input type="number" min="0" max="100" placeholder="Expected cancellation %" value={form.expectedCancellationRate} onChange={e => setForm({ ...form, expectedCancellationRate: e.target.value })} />
          <Input type="number" min="0" max="100" placeholder="Expected return %" value={form.expectedReturnRate} onChange={e => setForm({ ...form, expectedReturnRate: e.target.value })} />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder={t('description')} className="md:col-span-2 w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div><div className="flex justify-end gap-3 pt-4 border-t"><Button type="button" variant="secondary" onClick={() => setShowModal(false)}>{t('cancel')}</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : t('save')}</Button></div></form>
      </div></div>}
    </div>
  );
}
