import type { DateFilterState, DateRangePreset, Order } from '../types';

export function getDateWindow(filter: DateFilterState, now = new Date()): {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
} {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (filter.preset === 'today') {
    // today 00:00..23:59
  } else if (filter.preset === '7d') {
    start.setDate(start.getDate() - 6);
  } else if (filter.preset === '30d') {
    start.setDate(start.getDate() - 29);
  } else if (filter.preset === '3m') {
    start.setMonth(start.getMonth() - 3);
  } else if (filter.preset === '6m') {
    start.setMonth(start.getMonth() - 6);
  } else if (filter.preset === 'all') {
    start = new Date('2025-01-01T00:00:00Z');
  } else if (filter.preset === 'custom') {
    if (filter.customStart) {
      start = new Date(`${filter.customStart}T00:00:00`);
    } else {
      start.setDate(start.getDate() - 29);
    }
    if (filter.customEnd) {
      end.setTime(new Date(`${filter.customEnd}T23:59:59`).getTime());
    }
  }

  const durationMs = Math.max(86400000, end.getTime() - start.getTime());
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  return { start, end, prevStart, prevEnd };
}

export function filterOrdersByWindow(orders: Order[], start: Date, end: Date): Order[] {
  const s = start.getTime();
  const e = end.getTime();
  return orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= s && t <= e;
  });
}

export function calcGrowthPct(current: number, previous: number): number | null {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export function getPresetOptions(lang: 'ar' | 'en'): { id: DateRangePreset; label: string }[] {
  return [
    { id: 'today', label: lang === 'ar' ? 'اليوم' : 'Today' },
    { id: '7d', label: lang === 'ar' ? 'آخر ٧ أيام' : 'Last 7 Days' },
    { id: '30d', label: lang === 'ar' ? 'آخر ٣٠ يوم' : 'Last 30 Days' },
    { id: '3m', label: lang === 'ar' ? 'آخر ٣ شهور' : 'Last 3 Months' },
    { id: '6m', label: lang === 'ar' ? 'آخر ٦ شهور' : 'Last 6 Months' },
    { id: 'all', label: lang === 'ar' ? 'كل الفترة' : 'All Time' },
    { id: 'custom', label: lang === 'ar' ? 'فترة مخصصة' : 'Custom Range' },
  ];
}

export function buildTimeSeriesFromOrders(
  orders: Order[],
  granularity: 'daily' | 'weekly' | 'monthly',
  lang: 'ar' | 'en'
): { label: string; gmv: number; commission: number; orders: number; deliveryFees: number }[] {
  const bucketMap = new Map<
    string,
    { sortKey: number; label: string; gmv: number; commission: number; orders: number; deliveryFees: number }
  >();

  orders.forEach((o) => {
    const d = new Date(o.createdAt);
    let key = '';
    let label = '';
    let sortKey = 0;

    if (granularity === 'daily') {
      key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      sortKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      label = d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-EG', {
        month: 'short',
        day: 'numeric',
      });
    } else if (granularity === 'weekly') {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      weekStart.setHours(0, 0, 0, 0);
      key = weekStart.toISOString().slice(0, 10);
      sortKey = weekStart.getTime();
      label = weekStart.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-EG', {
        month: 'short',
        day: 'numeric',
      });
    } else {
      key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      sortKey = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      label = d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-EG', {
        month: 'short',
        year: '2-digit',
      });
    }

    const prev = bucketMap.get(key) ?? {
      sortKey,
      label,
      gmv: 0,
      commission: 0,
      orders: 0,
      deliveryFees: 0,
    };

    const isDelivered = o.status === 'delivered';
    bucketMap.set(key, {
      ...prev,
      gmv: prev.gmv + (isDelivered ? o.subtotal : 0),
      commission: prev.commission + (isDelivered ? o.platformCommission : 0),
      deliveryFees: prev.deliveryFees + (isDelivered ? o.deliveryFee : 0),
      orders: prev.orders + 1,
    });
  });

  return Array.from(bucketMap.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ label, gmv, commission, orders: count, deliveryFees }) => ({
      label,
      gmv: Math.round(gmv),
      commission: Number(commission.toFixed(2)),
      orders: count,
      deliveryFees: Math.round(deliveryFees),
    }));
}
