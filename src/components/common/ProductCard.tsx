import React from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Store } from 'lucide-react';
import type { Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatEGP } from '../../utils/i18n';
import { SafeImage } from './SafeImage';

interface ProductCardProps {
  product: Product;
  showStoreBadge?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  showStoreBadge = false,
}) => {
  const {
    language,
    t,
    merchants,
    addToCart,
    updateCartQuantity,
    getCartItemQty,
    cart,
  } = useApp();

  const store = merchants.find((m) => m.id === product.merchantId);
  const qtyInCart = cart.merchantId === product.merchantId ? getCartItemQty(product.id) : 0;
  const outOfStock = !product.isAvailable || product.stock <= 0;
  const productName = language === 'ar' ? product.nameAr : product.nameEn;
  const discountPct =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : 0;

  return (
    <div
      className={`bg-white rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${qtyInCart > 0
          ? 'border-emerald-500 ring-1 ring-emerald-500/20 shadow-xs'
          : 'border-[#EAE6E1] hover:border-[#D5CEC6]'
        }`}
    >
      <div>
        <Link
          to={`/product/${product.id}`}
          className="relative aspect-[4/3] bg-[#FAF9F7] overflow-hidden block"
        >
          <SafeImage
            src={product.image}
            alt={productName}
            className="w-full h-full object-cover"
          />

          {discountPct > 0 && !outOfStock && (
            <span className="absolute top-2 start-2 px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold">
              {t(`وفر ${discountPct}%`, `-${discountPct}%`)}
            </span>
          )}

          {outOfStock && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <span className="px-3 py-1 rounded-full bg-slate-800 text-white text-xs font-bold">
                {t('غير متوفر', 'Out of Stock')}
              </span>
            </div>
          )}
        </Link>

        <div className="p-3 pb-2 space-y-1">
          {showStoreBadge && store && (
            <Link
              to={`/stores/${store.id}`}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1B8E53] bg-[#E6F5EC] px-2 py-0.5 rounded-md max-w-full hover:bg-[#D5EFE0]"
            >
              <Store className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {language === 'ar' ? store.nameAr : store.nameEn}
              </span>
            </Link>
          )}

          <Link
            to={`/product/${product.id}`}
            className="block text-sm font-bold text-[#1C1917] hover:text-[#1B8E53] transition-colors line-clamp-2 min-h-[2.5rem] leading-snug"
          >
            {productName}
          </Link>

          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-[#6E6A66]">
              {language === 'ar' ? product.unitAr : product.unitEn}
            </span>
            <span
              className={`font-semibold ${outOfStock ? 'text-rose-600' : 'text-emerald-700'
                }`}
            >
              {outOfStock ? t('غير متوفر', 'Unavailable') : t('متوفر', 'Available')}
            </span>
          </div>
        </div>
      </div>

      <div className="px-3 pb-3 pt-1 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm sm:text-base font-extrabold text-[#1C1917]">
            {formatEGP(product.price, language)}
          </div>
          {product.oldPrice && product.oldPrice > product.price && (
            <div className="text-[11px] text-[#6E6A66] line-through">
              {formatEGP(product.oldPrice, language)}
            </div>
          )}
        </div>

        {qtyInCart > 0 ? (
          <div
            className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-xl p-1 shrink-0"
            aria-label={t('تعديل الكمية', 'Quantity controls')}
          >
            <button
              type="button"
              onClick={() => updateCartQuantity(product.id, qtyInCart - 1)}
              className="w-8 h-8 rounded-lg bg-white text-emerald-700 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-colors shadow-2xs"
              aria-label={t('تقليل الكمية', 'Decrease quantity')}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="min-w-[22px] text-center text-sm font-extrabold text-[#1C1917]">
              {qtyInCart}
            </span>
            <button
              type="button"
              disabled={qtyInCart >= product.stock}
              onClick={() => updateCartQuantity(product.id, qtyInCart + 1)}
              className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-40 transition-colors"
              aria-label={t('زيادة الكمية', 'Increase quantity')}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={outOfStock}
            onClick={() => addToCart(product.id, 1)}
            className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center transition-colors shadow-2xs shrink-0"
            aria-label={t(`أضف ${productName}`, `Add ${productName}`)}
            title={t('إضافة للسلة', 'Add to cart')}
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        )}
      </div>
    </div>
  );
};

