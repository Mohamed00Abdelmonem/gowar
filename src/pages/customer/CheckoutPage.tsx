import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  CreditCard,
  MapPin,
  Phone,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { LocationPickerModal } from '../../components/location/LocationPickerModal';
import { IS_BACKEND_API_ENABLED } from '../../services/apiClient';
import { marketplaceApi } from '../../services/gowarApi';
import {
  calculateDynamicDeliveryFee,
  evaluateStoreAvailability,
  formatDistanceShort,
} from '../../services/locationService';
import { formatEGP } from '../../utils/i18n';
import type { PaymentMethod } from '../../types';

export const CheckoutPage: React.FC = () => {
  const {
    language,
    t,
    cart,
    merchants,
    products,
    activeCustomer,
    areas,
    customerLocation,
    placeOrder,
    showToast,
  } = useApp();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const discount = Number(searchParams.get('discount') || 0);
  const store = merchants.find((m) => m.id === cart.merchantId);

  const [selectedAddressId, setSelectedAddressId] = useState<'confirmed_location' | string>(
    customerLocation.selectedAddressId ?? 'confirmed_location'
  );
  const [customAreaId, setCustomAreaId] = useState(customerLocation.areaId || areas[0]?.id || '');
  const [customStreet, setCustomStreet] = useState('');
  const [addressDetailsNote, setAddressDetailsNote] = useState('');
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  const [editingContact, setEditingContact] = useState(false);
  const [customerName, setCustomerName] = useState(
    language === 'ar' ? activeCustomer.nameAr : activeCustomer.nameEn
  );
  const [customerPhone, setCustomerPhone] = useState(activeCustomer.phone);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const idempotencyRef = useRef<{ signature: string; key: string } | null>(null);
  const [backendQuote, setBackendQuote] = useState<{
    actualDistanceKm: number;
    billableKm: number;
    pricePerKm: number;
    deliveryFee: number;
    deliveryAvailable: boolean;
    freeDeliveryApplied: boolean;
  } | null>(null);

  const chosenAddr =
    selectedAddressId === 'custom' || selectedAddressId === 'confirmed_location'
      ? undefined
      : activeCustomer.addresses.find((a) => a.id === selectedAddressId);

  const chosenArea = areas.find(
    (a) => a.id === (chosenAddr?.areaId ?? (selectedAddressId === 'custom' ? customAreaId : customerLocation.areaId))
  );

  const activeCoords =
    chosenAddr?.coordinates ??
    (selectedAddressId === 'custom' ? chosenArea?.coordinates : undefined) ?? {
      lat: customerLocation.lat,
      lng: customerLocation.lng,
    };

  const detailedItems = cart.items
    .map((ci) => {
      const product = products.find((p) => p.id === ci.productId);
      return product ? { ...ci, product } : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const subtotalValue = detailedItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  useEffect(() => {
    if (!IS_BACKEND_API_ENABLED || !store) return;
    let cancelled = false;
    marketplaceApi
      .fetchDeliveryQuote(store.id, {
        latitude: activeCoords.lat,
        longitude: activeCoords.lng,
        subtotal: subtotalValue,
      })
      .then((q) => {
        if (cancelled) return;
        setBackendQuote({
          actualDistanceKm: Number(q.actual_distance_km),
          billableKm: q.billable_km,
          pricePerKm: Number(q.price_per_km),
          deliveryFee: Number(q.delivery_fee),
          deliveryAvailable: q.delivery_available,
          freeDeliveryApplied: q.free_delivery_applied,
        });
      })
      .catch(() => {
        if (!cancelled) setBackendQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [store, activeCoords.lat, activeCoords.lng, subtotalValue]);

  const BackArrow = language === 'ar' ? ArrowRight : ArrowLeft;

  if (!store || detailedItems.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <EmptyState
          icon={ShoppingBag}
          title={t('سلتك فاضية', 'Your cart is empty')}
          description={t('أضف منتجات من أي محل الأول عشان تقدر تأكد طلبك.', 'Add items to your cart first.')}
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

  const subtotal = subtotalValue;
  const deliveryAvailability = evaluateStoreAvailability(
    store,
    activeCoords,
    customerLocation.searchRadiusKm
  );
  const pricePerKm =
    backendQuote?.pricePerKm ?? store.delivery.deliveryPricePerKm ?? store.delivery.deliveryFee;
  const actualDistanceKm = backendQuote?.actualDistanceKm ?? deliveryAvailability.distanceKm;
  const localDynamic = calculateDynamicDeliveryFee(actualDistanceKm, pricePerKm);
  const billableKm = backendQuote?.billableKm ?? localDynamic.billableKm;
  const qualifiesFree =
    backendQuote?.freeDeliveryApplied ??
    Boolean(store.delivery.freeDeliveryThreshold && subtotal >= store.delivery.freeDeliveryThreshold);
  const deliveryFee =
    !store.delivery.deliveryEnabled || qualifiesFree
      ? 0
      : (backendQuote?.deliveryFee ?? localDynamic.deliveryFee);
  const total = Math.max(0, subtotal + deliveryFee - discount);

  const displayAddress = chosenAddr
    ? `${language === 'ar' ? chosenAddr.streetAr : chosenAddr.streetEn} — ${t('عمارة', 'Bldg')} ${chosenAddr.building}، ${t('دور', 'Fl')} ${chosenAddr.floor}، ${t('شقة', 'Apt')} ${chosenAddr.apartment}`
    : selectedAddressId === 'custom'
      ? `${chosenArea ? (language === 'ar' ? chosenArea.nameAr : chosenArea.nameEn) : ''} — ${customStreet}`
      : `${language === 'ar' ? customerLocation.formattedAddressAr : customerLocation.formattedAddressEn}${addressDetailsNote.trim() ? ` — ${addressDetailsNote.trim()}` : ''}`;

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryAvailability.isDeliverable) {
      showToast(
        t(
          'عذراً، العنوان المختار خارج نطاق توصيل هذا المحل — اختر عنواناً قريباً أولاً',
          'Selected address is outside this merchant’s delivery coverage'
        ),
        'error'
      );
      setMapPickerOpen(true);
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      showToast(t('من فضلك اتأكد من الاسم ورقم الموبايل', 'Please check your name and phone'), 'error');
      setEditingContact(true);
      return;
    }

    if (selectedAddressId === 'custom' && !customStreet.trim()) {
      showToast(t('من فضلك اكتب عنوان التوصيل', 'Please enter your delivery address'), 'error');
      setAddressModalOpen(true);
      return;
    }

    const areaId =
      chosenAddr?.areaId ??
      (selectedAddressId === 'custom' ? customAreaId : customerLocation.areaId);
    const deliveryAddressAr = chosenAddr
      ? `${chosenAddr.streetAr}، عمارة ${chosenAddr.building}، دور ${chosenAddr.floor}، شقة ${chosenAddr.apartment}`
      : selectedAddressId === 'custom'
        ? customStreet
        : `${customerLocation.formattedAddressAr}${addressDetailsNote.trim() ? `، ${addressDetailsNote.trim()}` : ''}`;
    const deliveryAddressEn = chosenAddr
      ? `${chosenAddr.streetEn}, Bldg ${chosenAddr.building}, Floor ${chosenAddr.floor}, Apt ${chosenAddr.apartment}`
      : selectedAddressId === 'custom'
        ? customStreet
        : `${customerLocation.formattedAddressEn}${addressDetailsNote.trim() ? `, ${addressDetailsNote.trim()}` : ''}`;

    if (submitting) return;
    const checkoutSignature = JSON.stringify({
      merchantId: cart.merchantId,
      items: cart.items,
      addressId: chosenAddr?.id ?? null,
      deliveryAddressAr,
      paymentMethod,
      notes: notes.trim(),
    });
    if (!idempotencyRef.current || idempotencyRef.current.signature !== checkoutSignature) {
      const nextKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `ord-${crypto.randomUUID()}`
          : `ord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      idempotencyRef.current = { signature: checkoutSignature, key: nextKey };
    }
    setSubmitting(true);
    try {
      const order = await placeOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        areaId,
        addressId: chosenAddr?.id ?? null,
        latitude: activeCoords.lat,
        longitude: activeCoords.lng,
        deliveryAddressAr,
        deliveryAddressEn,
        paymentMethod,
        notes: notes.trim() || undefined,
        discount,
        idempotencyKey: idempotencyRef.current.key,
      });
      if (order) {
        idempotencyRef.current = null;
        navigate(`/orders/${order.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5 sm:py-6 space-y-5">
      <div>
        <Link
          to="/cart"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6E6A66] hover:text-[#1B8E53] mb-1"
        >
          <BackArrow className="w-3.5 h-3.5" />
          <span>{t('الرجوع للسلة', 'Back to Cart')}</span>
        </Link>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
          {t('تأكيد الطلب', 'Confirm Your Order')}
        </h1>
        <p className="text-xs text-[#6E6A66] mt-0.5">
          {t('الطلب من', 'Ordering from')}{' '}
          <strong className="text-[#1B8E53]">
            {language === 'ar' ? store.nameAr : store.nameEn}
          </strong>
        </p>
      </div>

      <form onSubmit={handleConfirmOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 space-y-4">
          {/* 1. Selected Delivery Address + Map Picker / Change Button */}
          <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#E6F5EC] text-[#1B8E53] flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[#6E6A66] block">
                    {t('عنوان التوصيل المؤكد', 'Confirmed Delivery Address')}
                  </span>
                  <p className="text-sm font-extrabold text-[#1C1917] mt-0.5 leading-snug">
                    {chosenAddr
                      ? language === 'ar'
                        ? chosenAddr.labelAr
                        : chosenAddr.labelEn
                      : selectedAddressId === 'custom'
                        ? t('عنوان مخصص', 'Custom Address')
                        : t('الموقع المحدد على الخريطة', 'Selected Map Location')}
                  </p>
                  <p className="text-xs text-[#6E6A66] mt-0.5">{displayAddress}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setMapPickerOpen(true)}
                  className="px-3 py-2 rounded-xl bg-[#E6F5EC] border border-[#C2E7D2] text-xs font-bold text-[#1B8E53]"
                >
                  {t('تحديد على الخريطة', 'Pick on Map')}
                </button>
                <button
                  type="button"
                  onClick={() => setAddressModalOpen(true)}
                  className="px-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] hover:border-[#1B8E53] text-xs font-bold text-[#1C1917]"
                >
                  {t('عناويني', 'Saved')}
                </button>
              </div>
            </div>

            {selectedAddressId === 'confirmed_location' && (
              <input
                type="text"
                value={addressDetailsNote}
                onChange={(e) => setAddressDetailsNote(e.target.value)}
                placeholder={t(
                  'تفاصيل إضافية: رقم العمارة، الدور، الشقة (اختياري)',
                  'Extra details: Building, floor, apartment (optional)'
                )}
                className="w-full px-3.5 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs focus:outline-none focus:border-[#1B8E53]"
              />
            )}

            {!deliveryAvailability.isDeliverable && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-start justify-between gap-3 text-xs text-rose-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block">
                      {deliveryAvailability.deliveryStatus === 'pickup_only'
                        ? t('هذا المحل للاستلام فقط ولا يدعم التوصيل', 'Pickup-only store')
                        : t(
                            `عنوانك خارج نطاق توصيل المحل (${formatDistanceShort(deliveryAvailability.distanceKm, language)} مقابل حد ${store.delivery.maxDistanceKm} كم)`,
                            `Address is outside merchant delivery radius (${formatDistanceShort(deliveryAvailability.distanceKm, language)} vs ${store.delivery.maxDistanceKm} km limit)`
                          )}
                    </strong>
                    <span>
                      {t(
                        'يرجى اختيار عنوان قريب من المحل لإتمام التوصيل.',
                        'Please choose an address within delivery range to complete checkout.'
                      )}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMapPickerOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold shrink-0"
                >
                  {t('تغيير الموقع', 'Fix Location')}
                </button>
              </div>
            )}
          </div>

          {/* 2. Contact Information (Pre-filled from Profile) */}
          <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E6F5EC] text-[#1B8E53] flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#6E6A66] block">
                    {t('بيانات التواصل', 'Contact Details')}
                  </span>
                  <p className="text-sm font-extrabold text-[#1C1917]">
                    {customerName} • <span dir="ltr">{customerPhone}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingContact((v) => !v)}
                className="px-3 py-1.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs font-bold text-[#1C1917]"
              >
                {editingContact ? t('تم', 'Done') : t('تعديل', 'Edit')}
              </button>
            </div>

            {editingContact && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#EAE6E1]">
                <div>
                  <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                    {t('الاسم', 'Name')}
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                    {t('رقم الموبايل', 'Phone Number')}
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Delivery Info */}
          <div className="bg-[#E6F5EC]/70 border border-[#C2E7D2] rounded-2xl p-4 flex items-center gap-3 text-xs sm:text-sm text-[#1C1917]">
            <Truck className="w-5 h-5 text-[#1B8E53] shrink-0" />
            <div>
              <strong className="block text-[#1B8E53]">
                {t(
                  `التوصيل مباشر من ${store.nameAr}`,
                  `Direct delivery by ${store.nameEn}`
                )}
              </strong>
              <span className="text-xs text-[#6E6A66]">
                {t(
                  `رسوم التوصيل: ${deliveryFee === 0 ? 'مجاني' : formatEGP(deliveryFee, language)} • الوصول خلال ${store.delivery.deliveryTimeMin} دقيقة`,
                  `Delivery fee: ${deliveryFee === 0 ? 'Free' : formatEGP(deliveryFee, language)} • ETA ${store.delivery.deliveryTimeMin} mins`
                )}
              </span>
            </div>
          </div>

          {/* 4. Payment Selection Cards */}
          <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 sm:p-5 space-y-3">
            <h2 className="text-sm sm:text-base font-extrabold text-[#1C1917]">
              {t('هتدفع إزاي؟', 'Payment Method')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-4 rounded-xl border-2 cursor-pointer flex items-center gap-3 transition-colors ${
                  paymentMethod === 'cod'
                    ? 'border-[#1B8E53] bg-[#E6F5EC]/60'
                    : 'border-[#EAE6E1] hover:bg-[#FAF9F7]'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                  className="accent-[#1B8E53] w-4 h-4"
                />
                <Banknote className="w-5 h-5 text-[#1B8E53] shrink-0" />
                <div>
                  <span className="block text-sm font-extrabold text-[#1C1917]">
                    {t('كاش عند الاستلام', 'Cash on Delivery')}
                  </span>
                  <span className="text-[11px] text-[#6E6A66]">
                    {t('ادفع لما الطلب يوصلك', 'Pay when order arrives')}
                  </span>
                </div>
              </label>

              <label
                className={`p-4 rounded-xl border-2 cursor-pointer flex items-center gap-3 transition-colors ${
                  paymentMethod === 'online_demo'
                    ? 'border-[#1B8E53] bg-[#E6F5EC]/60'
                    : 'border-[#EAE6E1] hover:bg-[#FAF9F7]'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'online_demo'}
                  onChange={() => setPaymentMethod('online_demo')}
                  className="accent-[#1B8E53] w-4 h-4"
                />
                <CreditCard className="w-5 h-5 text-[#1B8E53] shrink-0" />
                <div>
                  <span className="block text-sm font-extrabold text-[#1C1917]">
                    {t('دفع إلكتروني', 'Online Payment')}
                  </span>
                  <span className="text-[11px] text-[#6E6A66]">
                    {t('بطاقة بنكية (تجريبي)', 'Card / Wallet (Demo)')}
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Optional Note */}
          <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 sm:p-5 space-y-2">
            <label className="block text-xs font-bold text-[#6E6A66]">
              {t('ملاحظة للمندوب (اختياري)', 'Note for courier (optional)')}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('مثال: كلمني لما توصل عند البوابة', 'e.g. Call when at the gate')}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53]"
            />
          </div>
        </div>

        {/* Right: Order Summary & Confirm */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5 space-y-4 sticky top-24 shadow-2xs">
            <h2 className="text-base font-extrabold text-[#1C1917]">
              {t('ملخص الطلب', 'Order Summary')} ({detailedItems.length})
            </h2>

            <div className="space-y-2.5 max-h-56 overflow-y-auto divide-y divide-[#EAE6E1]">
              {detailedItems.map(({ product, quantity }) => (
                <div key={product.id} className="pt-2.5 first:pt-0 flex justify-between text-xs sm:text-sm">
                  <span className="text-[#1C1917] font-medium">
                    <strong className="text-[#1B8E53]">{quantity}×</strong>{' '}
                    {language === 'ar' ? product.nameAr : product.nameEn}
                  </span>
                  <span className="font-bold shrink-0 ms-2">
                    {formatEGP(product.price * quantity, language)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm border-t border-b border-[#EAE6E1] py-3">
              <div className="flex justify-between text-[#6E6A66]">
                <span>{t('سعر المنتجات', 'Products')}</span>
                <span>{formatEGP(subtotal, language)}</span>
              </div>

              {/* Transparent Dynamic Delivery Fee Breakdown */}
              <div className="rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] p-2.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-[#6E6A66]">
                  <span>{t('اسم المحل', 'Store')}</span>
                  <span className="font-bold text-[#1C1917]">
                    {language === 'ar' ? store.nameAr : store.nameEn}
                  </span>
                </div>
                <div className="flex justify-between text-[#6E6A66]">
                  <span>{t('المسافة الفعلية', 'Actual distance')}</span>
                  <span className="font-semibold text-[#1C1917]">
                    {actualDistanceKm.toFixed(2)} {t('كم', 'km')}
                  </span>
                </div>
                <div className="flex justify-between text-[#6E6A66]">
                  <span>{t('المسافة المحتسبة', 'Billable distance')}</span>
                  <span className="font-semibold text-[#1C1917]">
                    {billableKm} {t('كم', 'km')}
                  </span>
                </div>
                <div className="flex justify-between text-[#6E6A66]">
                  <span>{t('سعر الكيلومتر', 'Price per km')}</span>
                  <span className="font-semibold text-[#1C1917]">
                    {formatEGP(pricePerKm, language)} / {t('كم', 'km')}
                  </span>
                </div>
              </div>

              <div className="flex justify-between text-[#6E6A66]">
                <span>{t('رسوم التوصيل', 'Delivery Fee')}</span>
                <span className="font-bold text-[#1C1917]">
                  {deliveryFee === 0 ? t('مجاني', 'Free') : formatEGP(deliveryFee, language)}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>{t('الخصم', 'Discount')}</span>
                  <span>-{formatEGP(discount, language)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-base font-extrabold">
              <span>{t('المطلوب دفعه', 'Total to Pay')}</span>
              <span className="text-xl text-[#1B8E53]">{formatEGP(total, language)}</span>
            </div>

            <button
              type="submit"
              disabled={submitting || !deliveryAvailability.isDeliverable}
              className="w-full py-4 rounded-xl bg-[#1B8E53] hover:bg-[#147242] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm sm:text-base font-extrabold inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {submitting
                  ? t('بنبعت طلبك للمحل...', 'Sending order...')
                  : t('تأكيد الطلب', 'Confirm Order')}
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* Change Address Modal */}
      <Modal
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        title={t('اختار أو اكتب عنوان التوصيل', 'Choose Delivery Address')}
      >
        <div className="space-y-3">
          {activeCustomer.addresses.map((addr) => (
            <button
              key={addr.id}
              type="button"
              onClick={() => {
                setSelectedAddressId(addr.id);
                setAddressModalOpen(false);
              }}
              className={`w-full text-start p-3.5 rounded-xl border transition-colors ${
                selectedAddressId === addr.id
                  ? 'border-[#1B8E53] bg-[#E6F5EC]/60'
                  : 'border-[#EAE6E1] hover:bg-[#FAF9F7]'
              }`}
            >
              <div className="font-bold text-sm text-[#1C1917]">
                {language === 'ar' ? addr.labelAr : addr.labelEn}
              </div>
              <div className="text-xs text-[#6E6A66] mt-0.5">
                {language === 'ar' ? addr.streetAr : addr.streetEn} — {t('عمارة', 'Bldg')}{' '}
                {addr.building}
              </div>
            </button>
          ))}

          <div className="p-3.5 rounded-xl border border-[#EAE6E1] space-y-2.5">
            <span className="block text-xs font-bold text-[#1C1917]">
              {t('أو اكتب عنوان جديد للطلب ده:', 'Or enter a new address:')}
            </span>
            <select
              value={customAreaId}
              onChange={(e) => setCustomAreaId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-xs"
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {language === 'ar' ? a.nameAr : a.nameEn}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={customStreet}
              onChange={(e) => setCustomStreet(e.target.value)}
              placeholder={t('اسم الشارع والعمارة والشقة...', 'Street, building & apartment...')}
              className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-xs"
            />
            <button
              type="button"
              onClick={() => {
                if (!customStreet.trim()) return;
                setSelectedAddressId('custom');
                setAddressModalOpen(false);
              }}
              className="w-full py-2.5 rounded-xl bg-[#1B8E53] text-white text-xs font-bold"
            >
              {t('استخدم العنوان ده', 'Use this address')}
            </button>
          </div>
        </div>
      </Modal>

      <LocationPickerModal
        open={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        onConfirmed={(loc) => {
          setSelectedAddressId(loc.selectedAddressId ?? 'confirmed_location');
        }}
      />
    </div>
  );
};
