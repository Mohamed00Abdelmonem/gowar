import React from 'react';
import { Download } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { formatEGP } from '../../utils/i18n';

export const AdminReportsPage: React.FC = () => {
  const { language, t, orders, merchants, customers, showToast } = useApp();

  const completed = orders.filter((o) => o.status === 'delivered').length;
  const cancelled = orders.filter((o) => o.status === 'cancelled').length;
  const completionRate =
    orders.length > 0 ? Math.round((completed / orders.length) * 100) : 0;

  const validOrders = orders.filter((o) => o.status !== 'cancelled');
  const totalGmv = validOrders.reduce((s, o) => s + o.total, 0);
  const totalRevenue = validOrders.reduce((s, o) => s + o.platformCommission, 0);

  const merchantPerf = merchants
    .filter((m) => m.status === 'approved')
    .map((m) => {
      const mOrders = validOrders.filter((o) => o.merchantId === m.id);
      return {
        name: (language === 'ar' ? m.nameAr : m.nameEn).slice(0, 16),
        sales: mOrders.reduce((s, o) => s + o.total, 0),
        orders: mOrders.length,
      };
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('تقارير أداء المنصة', 'Platform Reports')}
          </h1>
          <p className="text-xs text-[#6E6A66]">
            {t('تقارير المبيعات، أداء التجار، نشاط العملاء، ونسب إتمام الطلبات', 'Sales, merchant performance, customer activity & completion rates')}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            showToast(
              t('تم تجهيز ملف التقرير (عرض تجريبي)', 'CSV Report exported (demo action)'),
              'success'
            )
          }
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D6450D] text-white text-xs font-bold"
        >
          <Download className="w-4 h-4" />
          <span>{t('تصدير تقرير CSV', 'Export CSV Report')}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4">
          <span className="text-xs text-[#6E6A66]">{t('إجمالي حجم المبيعات', 'Total GMV')}</span>
          <div className="text-xl font-extrabold text-[#1C1917] mt-1">
            {formatEGP(totalGmv, language)}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4">
          <span className="text-xs text-[#6E6A66]">{t('صافي إيرادات المنصة', 'Platform Revenue')}</span>
          <div className="text-xl font-extrabold text-[#D6450D] mt-1">
            {formatEGP(totalRevenue, language)}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4">
          <span className="text-xs text-[#6E6A66]">{t('معدل إتمام الطلبات', 'Order Completion Rate')}</span>
          <div className="text-xl font-extrabold text-[#1C1917] mt-1">
            {completionRate}% <span className="text-xs font-normal text-[#6E6A66]">({cancelled} {t('ملغي', 'cancelled')})</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4">
          <span className="text-xs text-[#6E6A66]">{t('العملاء النشطين', 'Active Customers')}</span>
          <div className="text-xl font-extrabold text-[#1C1917] mt-1">
            {customers.filter((c) => c.status === 'active').length} / {customers.length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-5">
        <h2 className="text-sm font-extrabold text-[#1C1917] mb-4">
          {t('مقارنة مبيعات التجار (ج.م)', 'Merchant Sales Comparison (EGP)')}
        </h2>
        <div className="h-72" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={merchantPerf}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAE6E1" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6E6A66' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6E6A66' }} />
              <Tooltip />
              <Bar dataKey="sales" name={t('المبيعات', 'Sales')} fill="#D6450D" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
