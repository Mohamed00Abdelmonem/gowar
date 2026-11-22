import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Edit3, Package, Plus, Search, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SafeImage } from '../../components/common/SafeImage';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { formatEGP } from '../../utils/i18n';
import type { Product } from '../../types';

export const MerchantProductsPage: React.FC = () => {
  const {
    language,
    t,
    activeMerchant,
    products,
    categories,
    updateProduct,
    deleteProduct,
  } = useApp();

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const storeProducts = useMemo(
    () => products.filter((p) => p.merchantId === activeMerchant.id),
    [products, activeMerchant.id]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return storeProducts.filter((p) => {
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.nameAr.toLowerCase().includes(q) ||
        p.nameEn.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      );
    });
  }, [storeProducts, query, categoryFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('إدارة المنتجات', 'Products Catalog')}
          </h1>
          <p className="text-xs text-[#6E6A66]">
            {t(
              'أضف منتجات محلك وحدد الأسعار والمخزون الخاص بك بكل سهولة',
              'Manage your store products, pricing, and availability'
            )}
          </p>
        </div>

        <Link
          to="/merchant/products/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>{t('إضافة منتج جديد', 'Add New Product')}</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-7 relative">
          <Search className="w-4 h-4 text-[#6E6A66] absolute start-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('ابحث باسم المنتج أو كود SKU...', 'Search product name or SKU...')}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53] focus:bg-white"
          />
        </div>
        <div className="sm:col-span-5">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm font-medium focus:outline-none focus:border-[#1B8E53]"
          >
            <option value="all">{t('كل التصنيفات', 'All Categories')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {language === 'ar' ? c.nameAr : c.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('لا توجد منتجات مطابقة', 'No matching products')}
          description={t('أضف منتجات جديدة لبدء البيع لعملاء منطقتك.', 'Add products to start selling to nearby customers.')}
          action={
            <Link
              to="/merchant/products/new"
              className="px-5 py-2.5 rounded-xl bg-[#1B8E53] text-white text-xs font-bold"
            >
              + {t('إضافة منتج', 'Add Product')}
            </Link>
          }
        />
      ) : (
        <>
          {/* Mobile Product Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((product) => {
              const cat = categories.find((c) => c.id === product.categoryId);
              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-[#EAE6E1] p-3.5 space-y-3 shadow-2xs"
                >
                  <div className="flex items-start gap-3">
                    <SafeImage
                      src={product.image}
                      alt={product.nameAr}
                      className="w-14 h-14 rounded-xl object-cover bg-[#FAF9F7] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-[#1C1917] line-clamp-1">
                        {language === 'ar' ? product.nameAr : product.nameEn}
                      </div>
                      <div className="text-[11px] text-[#6E6A66] mt-0.5">
                        {cat ? (language === 'ar' ? cat.nameAr : cat.nameEn) : ''} •{' '}
                        {language === 'ar' ? product.unitAr : product.unitEn}
                      </div>
                      <div className="text-sm font-extrabold text-[#1B8E53] mt-1">
                        {formatEGP(product.price, language)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#EAE6E1]">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          product.stock === 0
                            ? 'bg-rose-50 text-rose-700'
                            : product.stock <= 5
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-[#E6F5EC] text-[#1B8E53]'
                        }`}
                      >
                        {t('المخزون:', 'Stock:')} {product.stock}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateProduct(product.id, { isAvailable: !product.isAvailable })
                        }
                        className={`w-10 h-5 rounded-full transition-colors p-0.5 flex items-center ${
                          product.isAvailable
                            ? 'bg-[#1B8E53] justify-end'
                            : 'bg-slate-300 justify-start'
                        }`}
                        aria-label={t('تبديل الإتاحة', 'Toggle availability')}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/merchant/products/${product.id}/edit`}
                        className="p-2 rounded-lg border border-[#EAE6E1] text-[#1C1917]"
                        title={t('تعديل', 'Edit')}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setProductToDelete(product)}
                        className="p-2 rounded-lg border border-rose-200 text-rose-600"
                        title={t('حذف', 'Delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-[#EAE6E1] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#FAF9F7] text-[#6E6A66]">
                <tr>
                  <th className="py-3 px-4 font-bold text-start">{t('المنتج', 'Product')}</th>
                  <th className="py-3 px-4 font-bold text-start">{t('التصنيف', 'Category')}</th>
                  <th className="py-3 px-4 font-bold text-start">{t('السعر', 'Price')}</th>
                  <th className="py-3 px-4 font-bold text-start">{t('المخزون', 'Stock')}</th>
                  <th className="py-3 px-4 font-bold text-start">{t('متاح للطلب', 'Available')}</th>
                  <th className="py-3 px-4 font-bold text-start">{t('إجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6E1]">
                {filtered.map((product) => {
                  const cat = categories.find((c) => c.id === product.categoryId);
                  return (
                    <tr key={product.id} className="hover:bg-[#FAF9F7]/70">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <SafeImage
                            src={product.image}
                            alt={product.nameAr}
                            className="w-11 h-11 rounded-xl object-cover bg-[#FAF9F7] shrink-0"
                          />
                          <div>
                            <div className="font-bold text-[#1C1917]">
                              {language === 'ar' ? product.nameAr : product.nameEn}
                            </div>
                            <div className="text-[11px] text-[#6E6A66]">
                              {language === 'ar' ? product.unitAr : product.unitEn}
                              {product.sku ? ` • ${product.sku}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#6E6A66]">
                        {cat ? (language === 'ar' ? cat.nameAr : cat.nameEn) : '-'}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-[#1B8E53]">
                        {formatEGP(product.price, language)}
                        {product.oldPrice && (
                          <span className="block text-[10px] text-[#6E6A66] line-through font-normal">
                            {formatEGP(product.oldPrice, language)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            product.stock === 0
                              ? 'bg-rose-50 text-rose-700'
                              : product.stock <= 5
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-[#E6F5EC] text-[#1B8E53]'
                          }`}
                        >
                          {product.stock}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() =>
                            updateProduct(product.id, { isAvailable: !product.isAvailable })
                          }
                          className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                            product.isAvailable ? 'bg-[#1B8E53] justify-end' : 'bg-slate-300 justify-start'
                          }`}
                          aria-label={t('تبديل الإتاحة', 'Toggle availability')}
                        >
                          <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/merchant/products/${product.id}/edit`}
                            className="p-2 rounded-lg border border-[#EAE6E1] text-[#1C1917] hover:border-[#1B8E53] hover:text-[#1B8E53]"
                            title={t('تعديل', 'Edit')}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setProductToDelete(product)}
                            className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                            title={t('حذف', 'Delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      <Modal
        open={Boolean(productToDelete)}
        onClose={() => setProductToDelete(null)}
        title={t('حذف المنتج', 'Delete Product')}
        maxWidthClass="max-w-sm"
      >
        <p className="text-sm text-[#6E6A66] mb-5">
          {t(
            `هل تريد حذف "${productToDelete?.nameAr}" نهائياً من قائمة منتجات محلك؟`,
            `Are you sure you want to delete "${productToDelete?.nameEn}"?`
          )}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setProductToDelete(null)}
            className="flex-1 py-2.5 rounded-xl border border-[#EAE6E1] text-xs font-bold"
          >
            {t('إلغاء', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (productToDelete) {
                deleteProduct(productToDelete.id);
                setProductToDelete(null);
              }
            }}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold"
          >
            {t('تأكيد الحذف', 'Delete')}
          </button>
        </div>
      </Modal>
    </div>
  );
};
