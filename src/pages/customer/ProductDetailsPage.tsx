import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Minus,
  Package,
  Plus,
  Store,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SafeImage } from '../../components/common/SafeImage';
import { EmptyState } from '../../components/common/EmptyState';
import { formatEGP } from '../../utils/i18n';

export const ProductDetailsPage: React.FC = () => {
  const { productId } = useParams();
  const {
    language,
    t,
    products,
    merchants,
    categories,
    addToCart,
    updateCartQuantity,
    getCartItemQty,
    cart,
  } = useApp();
  const [qty, setQty] = useState(1);

  const product = products.find((p) => p.id === productId);
  const store = product ? merchants.find((m) => m.id === product.merchantId) : undefined;
  const category = product ? categories.find((c) => c.id === product.categoryId) : undefined;
  const BackArrow = language === 'ar' ? ArrowRight : ArrowLeft;

  if (!product || !store) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <EmptyState
          icon={Package}
          title={t('المنتج مش موجود', 'Product not found')}
          description={t('ممكن يكون المنتج اتشال من المحل. شوف منتجات تانية قريبة منك.', 'This product may have been removed.')}
          action={
            <Link
              to="/stores"
              className="px-5 py-2.5 rounded-xl bg-[#1B8E53] text-white text-xs font-bold"
            >
              {t('تصفح المحلات', 'Browse Stores')}
            </Link>
          }
        />
      </div>
    );
  }

  const outOfStock = !product.isAvailable || product.stock <= 0;
  const qtyInCart = cart.merchantId === product.merchantId ? getCartItemQty(product.id) : 0;

  const similarFromOtherStores = products
    .filter(
      (p) =>
        p.id !== product.id &&
        p.merchantId !== product.merchantId &&
        p.categoryId === product.categoryId &&
        p.isAvailable
    )
    .slice(0, 3);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5 space-y-6">
      <Link
        to={`/stores/${store.id}`}
        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#6E6A66] hover:text-[#1B8E53]"
      >
        <BackArrow className="w-4 h-4" />
        <span>
          {t('رجوع لـ', 'Back to')} {language === 'ar' ? store.nameAr : store.nameEn}
        </span>
      </Link>

      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 sm:p-7 shadow-2xs grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-5">
          <div className="aspect-square rounded-2xl overflow-hidden bg-[#FAF9F7] border border-[#EAE6E1]">
            <SafeImage
              src={product.image}
              alt={product.nameAr}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="md:col-span-7 flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {category && (
                <span className="px-3 py-1 rounded-full bg-[#FAF9F7] border border-[#EAE6E1] text-xs font-semibold text-[#6E6A66]">
                  {language === 'ar' ? category.nameAr : category.nameEn}
                </span>
              )}
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  outOfStock
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {outOfStock ? t('غير متوفر دلوقتي', 'Unavailable') : t('متوفر في المحل', 'Available')}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
              {language === 'ar' ? product.nameAr : product.nameEn}
            </h1>

            <p className="text-xs text-[#6E6A66]">
              {t('الحجم / العبوة:', 'Size:')} {language === 'ar' ? product.unitAr : product.unitEn}
            </p>

            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#1B8E53]">
                {formatEGP(product.price, language)}
              </span>
              {product.oldPrice && product.oldPrice > product.price && (
                <span className="text-base text-[#6E6A66] line-through">
                  {formatEGP(product.oldPrice, language)}
                </span>
              )}
            </div>

            <p className="text-sm text-[#6E6A66] leading-relaxed">
              {language === 'ar' ? product.descriptionAr : product.descriptionEn}
            </p>

            <Link
              to={`/stores/${store.id}`}
              className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] hover:border-[#1B8E53] transition-colors"
            >
              <div className="flex items-center gap-3">
                <SafeImage
                  src={store.logo}
                  alt={store.nameAr}
                  className="w-10 h-10 rounded-xl border border-[#EAE6E1] object-cover bg-white"
                />
                <div>
                  <span className="text-[11px] text-[#6E6A66] block">
                    {t('متوفر في محل', 'Sold by')}
                  </span>
                  <span className="text-sm font-bold text-[#1C1917] inline-flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-[#1B8E53]" />
                    {language === 'ar' ? store.nameAr : store.nameEn}
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-[#1B8E53]">
                {t('توصيل', 'Delivery')} {formatEGP(store.delivery.deliveryFee, language)}
              </span>
            </Link>
          </div>

          <div className="pt-4 border-t border-[#EAE6E1]">
            {qtyInCart > 0 ? (
              <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-2">
                <span className="text-xs sm:text-sm font-bold text-emerald-900 px-2">
                  {t('موجود في السلة دلوقتي:', 'In your cart:')}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateCartQuantity(product.id, qtyInCart - 1)}
                    className="w-10 h-10 rounded-lg bg-white text-emerald-700 flex items-center justify-center hover:bg-emerald-600 hover:text-white"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-extrabold text-base">{qtyInCart}</span>
                  <button
                    type="button"
                    disabled={qtyInCart >= product.stock}
                    onClick={() => updateCartQuantity(product.id, qtyInCart + 1)}
                    className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center justify-between sm:justify-start border border-[#EAE6E1] rounded-xl px-2 py-1.5 bg-[#FAF9F7]">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-lg bg-white flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center font-extrabold text-base">{qty}</span>
                  <button
                    type="button"
                    disabled={qty >= product.stock}
                    onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                    className="w-9 h-9 rounded-lg bg-white flex items-center justify-center disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => addToCart(product.id, qty)}
                  className="flex-1 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {outOfStock
                      ? t('غير متوفر', 'Out of stock')
                      : `${t('أضف للسلة', 'Add to Cart')} — ${formatEGP(product.price * qty, language)}`}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {similarFromOtherStores.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-extrabold text-[#1C1917] inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#1B8E53]" />
            <span>{t('نفس القسم في محلات تانية قريبة', 'Same Category in Other Nearby Stores')}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {similarFromOtherStores.map((sp) => {
              const spStore = merchants.find((m) => m.id === sp.merchantId);
              return (
                <Link
                  key={sp.id}
                  to={`/product/${sp.id}`}
                  className="bg-white rounded-2xl border border-[#EAE6E1] p-3 flex items-center gap-3 hover:border-[#1B8E53] transition-colors"
                >
                  <SafeImage
                    src={sp.image}
                    alt={sp.nameAr}
                    className="w-14 h-14 rounded-xl object-cover shrink-0 bg-[#FAF9F7]"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold text-[#1B8E53] block truncate">
                      {spStore ? (language === 'ar' ? spStore.nameAr : spStore.nameEn) : ''}
                    </span>
                    <span className="text-sm font-bold text-[#1C1917] block truncate">
                      {language === 'ar' ? sp.nameAr : sp.nameEn}
                    </span>
                    <span className="text-sm font-extrabold text-[#1C1917]">
                      {formatEGP(sp.price, language)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
