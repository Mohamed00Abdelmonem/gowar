import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  ShoppingCart,
  Store,
  Tag,
  Trash2,
  Truck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SafeImage } from '../../components/common/SafeImage';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { formatEGP } from '../../utils/i18n';

export const CartPage: React.FC = () => {
  const {
    language,
    t,
    cart,
    merchants,
    products,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    showToast,
  } = useApp();

  const [showPromo, setShowPromo] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const navigate = useNavigate();

  const store = merchants.find((m) => m.id === cart.merchantId);
  const detailedItems = cart.items
    .map((ci) => {
      const product = products.find((p) => p.id === ci.productId);
      return product ? { ...ci, product } : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const BackArrow = language === 'ar' ? ArrowRight : ArrowLeft;

  if (!store || detailedItems.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <EmptyState
          icon={ShoppingCart}
          title={t('سلتك فاضية دلوقتي', 'Your cart is empty')}
          description={t(
            'اختار المحل القريب منك وأضف احتياجات البيت. كل طلب بيكون من محل واحد.',
            'Pick a nearby store and add your items. Each order is from one store.'
          )}
          action={
            <Link
              to="/stores"
              className="px-6 py-3 rounded-xl bg-[#D6450D] hover:bg-[#B33808] text-white text-sm font-bold transition-colors"
            >
              {t('شوف المحلات القريبة', 'Browse Nearby Stores')}
            </Link>
          }
        />
      </div>
    );
  }

  const subtotal = detailedItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const freeThreshold = store.delivery.freeDeliveryThreshold;
  const qualifiesFree = Boolean(freeThreshold && subtotal >= freeThreshold);
  const deliveryFee =
    !store.delivery.deliveryEnabled || qualifiesFree ? 0 : store.delivery.deliveryFee;
  const total = Math.max(0, subtotal + deliveryFee - appliedDiscount);
  const belowMinOrder = subtotal < store.delivery.minOrder;

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = promoCode.trim().toUpperCase();
    if (clean === 'GOWAR10') {
      const disc = Math.round(subtotal * 0.1);
      setAppliedDiscount(disc);
      showToast(t(`تم خصم ${formatEGP(disc, language)}`, `Applied ${disc} EGP discount`), 'success');
    } else {
      showToast(
        t('الكود مش صحيح — جرب كود GOWAR10 لخصم ١٠٪', 'Invalid code — try GOWAR10 for 10% off'),
        'warning'
      );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5 sm:py-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            to={`/stores/${store.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6E6A66] hover:text-[#D6450D] mb-1"
          >
            <BackArrow className="w-3.5 h-3.5" />
            <span>{t('رجوع للمحل', 'Back to Store')}</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('سلة الطلب', 'Your Cart')}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setClearModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t('تفريغ السلة', 'Clear Cart')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Selected Store & Products */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <SafeImage
                src={store.logo}
                alt={store.nameAr}
                className="w-12 h-12 rounded-xl border border-[#EAE6E1] object-cover shrink-0"
              />
              <div className="min-w-0">
                <span className="text-[11px] text-[#6E6A66] block">
                  {t('المحل المختار', 'Selected Store')}
                </span>
                <div className="flex items-center gap-1.5 text-sm font-extrabold text-[#1C1917] truncate">
                  <Store className="w-4 h-4 text-[#D6450D] shrink-0" />
                  <span className="truncate">
                    {language === 'ar' ? store.nameAr : store.nameEn}
                  </span>
                </div>
                <p className="text-xs text-[#6E6A66]">
                  {t('توصيل المحل خلال', 'Store delivery in')} {store.delivery.deliveryTimeMin}{' '}
                  {t('دقيقة', 'min')}
                </p>
              </div>
            </div>
            <Link
              to={`/stores/${store.id}`}
              className="px-3 py-2 rounded-xl bg-[#FFF2EB] text-[#D6450D] text-xs font-bold shrink-0 hover:bg-[#FDE2D2]"
            >
              + {t('أضف أصناف تانية', 'Add items')}
            </Link>
          </div>

          {freeThreshold && !qualifiesFree && (
            <div className="bg-[#FFF2EB] border border-[#FBD8C5] rounded-2xl p-3.5 flex items-center gap-2.5 text-xs font-bold text-[#D6450D]">
              <Truck className="w-4 h-4 shrink-0" />
              <span>
                {t(
                  `أضف منتجات بـ ${formatEGP(freeThreshold - subtotal, language)} كمان عشان التوصيل يبقى مجاني`,
                  `Add ${formatEGP(freeThreshold - subtotal, language)} more for free delivery`
                )}
              </span>
            </div>
          )}

          {/* Products List with Large Touch Quantity Controls */}
          <div className="bg-white rounded-2xl border border-[#EAE6E1] divide-y divide-[#EAE6E1]">
            {detailedItems.map(({ product, quantity }) => (
              <div key={product.id} className="p-4 flex items-start sm:items-center gap-3.5">
                <SafeImage
                  src={product.image}
                  alt={product.nameAr}
                  className="w-18 h-18 rounded-xl object-cover bg-[#FAF9F7] shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/product/${product.id}`}
                      className="text-sm font-bold text-[#1C1917] hover:text-[#D6450D] line-clamp-2"
                    >
                      {language === 'ar' ? product.nameAr : product.nameEn}
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeFromCart(product.id)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 shrink-0"
                      aria-label={t('حذف المنتج', 'Remove item')}
                      title={t('حذف', 'Remove')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs text-[#6E6A66]">
                      {formatEGP(product.price, language)} /{' '}
                      {language === 'ar' ? product.unitAr : product.unitEn}
                    </span>

                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center border border-emerald-200 rounded-xl bg-emerald-50 p-1">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(product.id, quantity - 1)}
                          className="w-9 h-9 rounded-lg bg-white text-emerald-700 flex items-center justify-center hover:bg-emerald-600 hover:text-white shadow-2xs"
                          aria-label={t('نقص الكمية', 'Decrease')}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-9 text-center text-sm font-extrabold text-[#1C1917]">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          disabled={quantity >= product.stock}
                          onClick={() => updateCartQuantity(product.id, quantity + 1)}
                          className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-40"
                          aria-label={t('زود الكمية', 'Increase')}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-end font-extrabold text-sm sm:text-base text-[#1C1917] min-w-[70px]">
                        {formatEGP(product.price * quantity, language)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Simple Cost Summary + Prominent Checkout CTA */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#EAE6E1] p-5 space-y-4 shadow-2xs sticky top-24">
          <h2 className="text-base font-extrabold text-[#1C1917]">
            {t('حساب الطلب', 'Order Summary')}
          </h2>

          <div className="space-y-2.5 text-sm border-b border-[#EAE6E1] pb-3.5">
            <div className="flex justify-between text-[#6E6A66]">
              <span>{t('سعر المنتجات', 'Products Subtotal')}</span>
              <span className="font-bold text-[#1C1917]">{formatEGP(subtotal, language)}</span>
            </div>
            <div className="flex justify-between text-[#6E6A66]">
              <span>{t('رسوم التوصيل', 'Delivery Fee')}</span>
              <span className="font-bold text-[#1C1917]">
                {deliveryFee === 0 ? t('مجاني', 'Free') : formatEGP(deliveryFee, language)}
              </span>
            </div>
            {appliedDiscount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>{t('الخصم', 'Discount')}</span>
                <span>-{formatEGP(appliedDiscount, language)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center text-base font-extrabold text-[#1C1917]">
            <span>{t('الإجمالي', 'Total')}</span>
            <span className="text-xl text-[#D6450D]">{formatEGP(total, language)}</span>
          </div>

          {/* Optional Promo Code (Tucked away cleanly) */}
          {!showPromo ? (
            <button
              type="button"
              onClick={() => setShowPromo(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6E6A66] hover:text-[#D6450D]"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>{t('عندك كود خصم؟', 'Have a promo code?')}</span>
            </button>
          ) : (
            <form onSubmit={handleApplyPromo} className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder={t('اكتب الكود (GOWAR10)', 'Enter code (GOWAR10)')}
                className="flex-1 px-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs focus:outline-none focus:border-[#D6450D]"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#FFF2EB] text-[#D6450D] text-xs font-bold"
              >
                {t('تطبيق', 'Apply')}
              </button>
            </form>
          )}

          {belowMinOrder && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                {t(
                  `أقل طلب من ${store.nameAr} هو ${formatEGP(store.delivery.minOrder, language)}. محتاج تزود ${formatEGP(store.delivery.minOrder - subtotal, language)}.`,
                  `Minimum order for ${store.nameEn} is ${formatEGP(store.delivery.minOrder, language)}. Add ${formatEGP(store.delivery.minOrder - subtotal, language)} more.`
                )}
              </span>
            </div>
          )}

          <button
            type="button"
            disabled={belowMinOrder}
            onClick={() => navigate(`/checkout?discount=${appliedDiscount}`)}
            className="w-full py-4 px-5 rounded-xl bg-[#D6450D] hover:bg-[#B33808] disabled:bg-slate-300 text-white text-sm sm:text-base font-extrabold transition-colors shadow-sm"
          >
            {t(
              `كمّل الطلب — ${formatEGP(total, language)}`,
              `Proceed to Order — ${formatEGP(total, language)}`
            )}
          </button>
        </div>
      </div>

      <Modal
        open={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        title={t('تفريغ السلة؟', 'Clear Cart?')}
        maxWidthClass="max-w-sm"
      >
        <p className="text-sm text-[#6E6A66] mb-5">
          {t('متأكد إنك عايز تشيل كل المنتجات من السلة؟', 'Remove all items from your cart?')}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setClearModalOpen(false)}
            className="flex-1 py-2.5 rounded-xl border border-[#EAE6E1] text-xs font-bold"
          >
            {t('لأ، خليك زي ما أنت', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              clearCart();
              setClearModalOpen(false);
            }}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold"
          >
            {t('أيوة، فرّغ السلة', 'Clear All')}
          </button>
        </div>
      </Modal>
    </div>
  );
};
