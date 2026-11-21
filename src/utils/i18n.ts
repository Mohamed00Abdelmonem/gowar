import type { Language, MerchantStatus, OrderStatus, StoreType } from '../types';

export function pickLang(lang: Language, ar: string, en: string): string {
  return lang === 'ar' ? ar : en;
}

export function formatEGP(amount: number, lang: Language): string {
  const formatted = amount.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-EG', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return lang === 'ar' ? `${formatted} جنيه` : `${formatted} EGP`;
}

export function formatNumber(value: number, lang: Language): string {
  return value.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-EG');
}

export function formatDateTime(iso: string, lang: Language): string {
  const date = new Date(iso);
  return date.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-EG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateOnly(iso: string, lang: Language): string {
  const date = new Date(iso);
  return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getStoreTypeLabel(type: StoreType, lang: Language): string {
  const map: Record<StoreType, { ar: string; en: string }> = {
    supermarket: { ar: 'سوبر ماركت', en: 'Supermarket' },
    grocery: { ar: 'بقالة', en: 'Grocery Store' },
    kiosk: { ar: 'كشك', en: 'Kiosk' },
    mini_market: { ar: 'ميني ماركت', en: 'Mini Market' },
    convenience: { ar: 'متجر سريع', en: 'Convenience Store' },
  };
  return pickLang(lang, map[type].ar, map[type].en);
}

export function getOrderStatusMeta(
  status: OrderStatus,
  lang: Language
): { label: string; badgeClass: string; dotClass: string } {
  const map: Record<
    OrderStatus,
    { ar: string; en: string; badgeClass: string; dotClass: string }
  > = {
    pending: {
      ar: 'قيد المراجعة',
      en: 'Pending',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      dotClass: 'bg-amber-500',
    },
    accepted: {
      ar: 'تم القبول',
      en: 'Accepted',
      badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
      dotClass: 'bg-sky-500',
    },
    preparing: {
      ar: 'جاري التجهيز',
      en: 'Preparing',
      badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      dotClass: 'bg-indigo-500',
    },
    out_for_delivery: {
      ar: 'الطلب خرج للتوصيل',
      en: 'Out for Delivery',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dotClass: 'bg-emerald-500',
    },
    delivered: {
      ar: 'تم التوصيل',
      en: 'Delivered',
      badgeClass: 'bg-[#FFF2EB] text-[#D6450D] border-[#FBD8C5]',
      dotClass: 'bg-[#D6450D]',
    },
    cancelled: {
      ar: 'ملغي',
      en: 'Cancelled',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      dotClass: 'bg-rose-500',
    },
  };
  const item = map[status];
  return {
    label: pickLang(lang, item.ar, item.en),
    badgeClass: item.badgeClass,
    dotClass: item.dotClass,
  };
}

export function getMerchantStatusMeta(
  status: MerchantStatus,
  lang: Language
): { label: string; badgeClass: string } {
  const map: Record<MerchantStatus, { ar: string; en: string; badgeClass: string }> = {
    approved: {
      ar: 'معتمد ونشط',
      en: 'Approved',
      badgeClass: 'bg-[#FFF2EB] text-[#D6450D] border-[#FBD8C5]',
    },
    pending: {
      ar: 'بانتظار الموافقة',
      en: 'Pending Approval',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    },
    suspended: {
      ar: 'موقوف مؤقتاً',
      en: 'Suspended',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    },
    rejected: {
      ar: 'مرفوض',
      en: 'Rejected',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    },
  };
  return {
    label: pickLang(lang, map[status].ar, map[status].en),
    badgeClass: map[status].badgeClass,
  };
}
