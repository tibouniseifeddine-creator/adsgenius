import React, { useState } from 'react';
import { Plus, Search, Eye, Wand2, X, Package } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { useDemo } from '../contexts/DemoContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';

export function Products() {
  const { t } = useLanguage();
  const { products, addProduct } = useDemo();
  const { business } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: '',
    description: '',
    purchaseCost: '',
    sellingPrice: '',
    stock: '',
    deliveryCost: '',
    packagingCost: '',
    expectedCancellationRate: '15',
    expectedReturnRate: '5',
  });

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newProduct: Product = {
      id: `prod_${Date.now()}`,
      businessId: business?.id || 'demo',
      name: form.name,
      sku: form.sku || `SKU-${Date.now().toString(36).toUpperCase()}`,
      category: form.category || 'General',
      description: form.description,
      purchaseCost: Number(form.purchaseCost) || 0,
      sellingPrice: Number(form.sellingPrice) || 0,
      stock: Number(form.stock) || 0,
      images: [],
      videos: [],
      deliveryCost: Number(form.deliveryCost) || 0,
      packagingCost: Number(form.packagingCost) || 0,
      expectedCancellationRate: Number(form.expectedCancellationRate) || 15,
      expectedReturnRate: Number(form.expectedReturnRate) || 5,
    };
    addProduct(newProduct);
    setShowModal(false);
    setForm({
      name: '', sku: '', category: '', description: '', purchaseCost: '', sellingPrice: '',
      stock: '', deliveryCost: '', packagingCost: '', expectedCancellationRate: '15', expectedReturnRate: '5',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('products')}</h1>
        <Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-2" />{t('addProduct')}</Button>
      </div>
      <Card>
        <div className="mb-4">
          <Input placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">{t('productName')}</th>
                <th className="px-4 py-3 text-left">{t('sku')}</th>
                <th className="px-4 py-3 text-left">{t('category')}</th>
                <th className="px-4 py-3 text-left">{t('price')}</th>
                <th className="px-4 py-3 text-left">{t('stock')}</th>
                <th className="px-4 py-3 text-left">{t('status')}</th>
                <th className="px-4 py-3 text-left">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(product => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.images[0] && <img src={product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.description.slice(0, 50)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{product.sku}</td>
                  <td className="px-4 py-3 text-gray-500">{product.category}</td>
                  <td className="px-4 py-3 font-medium">{product.sellingPrice.toLocaleString()} DZD</td>
                  <td className="px-4 py-3">{product.stock}</td>
                  <td className="px-4 py-3">
                    <Badge variant={product.stock > 0 ? 'success' : 'danger'}>{product.stock > 0 ? 'Active' : 'Out of Stock'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/products/${product.id}`)}><Eye className="w-4 h-4" /></Button>
                      {product.aiAnalysis ? <Badge variant="success" className="text-xs">AI Analyzed</Badge> : <Button variant="secondary" size="sm"><Wand2 className="w-4 h-4 mr-1" /> Analyze</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-2">{t('noData')}</p>
              <Button variant="secondary" size="sm" onClick={() => setShowModal(true)}>{t('addFirstProduct')}</Button>
            </div>
          )}
        </div>
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold text-gray-900">{t('addProduct')}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('productName')} *</label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('sku')}</label>
                  <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="Auto-generated if empty" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('category')}</label>
                  <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('stock')} *</label>
                  <Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('purchaseCost')} (DZD)</label>
                  <Input type="number" value={form.purchaseCost} onChange={e => setForm({ ...form, purchaseCost: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('sellingPrice')} (DZD) *</label>
                  <Input type="number" value={form.sellingPrice} onChange={e => setForm({ ...form, sellingPrice: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('deliveryCost')} (DZD)</label>
                  <Input type="number" value={form.deliveryCost} onChange={e => setForm({ ...form, deliveryCost: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('packagingCost')} (DZD)</label>
                  <Input type="number" value={form.packagingCost} onChange={e => setForm({ ...form, packagingCost: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('expectedCancellation')} (%)</label>
                  <Input type="number" value={form.expectedCancellationRate} onChange={e => setForm({ ...form, expectedCancellationRate: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('expectedReturn')} (%)</label>
                  <Input type="number" value={form.expectedReturnRate} onChange={e => setForm({ ...form, expectedReturnRate: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('description')}</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Product description..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>{t('cancel')}</Button>
                <Button type="submit">{t('save')}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
