import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Edit3,
  Eye,
  KeyRound,
  Loader2,
  Phone,
  Plus,
  Power,
  Search,
  Truck,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { merchantDeliveryApi, type BackendOrderPayload } from '../../../services/gowarApi';
import type { DriverVehicleType, MerchantDeliveryDriver } from '../../../types';
import { Modal } from '../../../components/common/Modal';
import {
  DriverOperationalBadge,
  formatRelativeTime,
  formatVehicleLabel,
} from '../../../components/merchant/DriverStatusBadges';
import { formatDateTime } from '../../../utils/i18n';

export const MerchantDeliveryPersonnelPage: React.FC = () => {
  const { t, language, showToast } = useApp();

  const [drivers, setDrivers] = useState<MerchantDeliveryDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Create / Edit Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<MerchantDeliveryDriver | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleType, setVehicleType] = useState<DriverVehicleType>('motorcycle');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset Password Modal
  const [resetTarget, setResetTarget] = useState<MerchantDeliveryDriver | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Detail Modal
  const [detailTarget, setDetailTarget] = useState<MerchantDeliveryDriver | null>(null);
  const [detailOrders, setDetailOrders] = useState<BackendOrderPayload[]>([]);
  const [detailShifts, setDetailShifts] = useState<
    Array<{ id: string; started_at: string; ended_at: string | null; is_active: boolean; duration_minutes: number }>
  >([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await merchantDeliveryApi.listDrivers({
        search: search.trim() || undefined,
        include_archived: includeArchived,
      });
      setDrivers(list);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('تعذر تحميل قائمة مناديب التوصيل', 'Failed to load delivery personnel')
      );
    } finally {
      setLoading(false);
    }
  }, [search, includeArchived, t]);

  useEffect(() => {
    void loadDrivers();
  }, [loadDrivers]);

  const openCreateModal = () => {
    setEditingDriver(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setVehicleType('motorcycle');
    setVehiclePlate('');
    setNotes('');
    setFormOpen(true);
  };

  const openEditModal = (d: MerchantDeliveryDriver) => {
    setEditingDriver(d);
    setFirstName(d.first_name);
    setLastName(d.last_name);
    setEmail(d.email);
    setPhone(d.phone_number);
    setPassword('');
    setVehicleType(d.vehicle_type);
    setVehiclePlate(d.vehicle_plate);
    setNotes(d.notes);
    setFormOpen(true);
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingDriver) {
        await merchantDeliveryApi.updateDriver(editingDriver.id, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone_number: phone.trim(),
          vehicle_type: vehicleType,
          vehicle_plate: vehiclePlate.trim(),
          notes: notes.trim(),
        });
        showToast(t('تم تحديث بيانات المندوب بنجاح', 'Driver updated successfully'), 'success');
      } else {
        await merchantDeliveryApi.createDriver({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone_number: phone.trim(),
          password,
          vehicle_type: vehicleType,
          vehicle_plate: vehiclePlate.trim(),
          notes: notes.trim(),
        });
        showToast(t('تم إنشاء حساب المندوب بنجاح', 'Driver account created'), 'success');
      }
      setFormOpen(false);
      await loadDrivers();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t('تعذر حفظ البيانات', 'Failed to save driver'),
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (d: MerchantDeliveryDriver, archive = false) => {
    setSubmitting(true);
    try {
      await merchantDeliveryApi.toggleDriverActive(d.id, !d.is_active, archive);
      showToast(
        d.is_active
          ? t('تم تعطيل حساب المندوب', 'Driver account deactivated')
          : t('تم تفعيل حساب المندوب', 'Driver account activated'),
        'success'
      );
      await loadDrivers();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t('تعذر تغيير حالة الحساب', 'Action failed'),
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setSubmitting(true);
    try {
      await merchantDeliveryApi.resetDriverPassword(resetTarget.id, newPassword);
      showToast(t('تم تحديث كلمة المرور بنجاح', 'Driver password reset'), 'success');
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t('تعذر إعادة تعيين كلمة المرور', 'Reset failed'),
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openDetailModal = async (d: MerchantDeliveryDriver) => {
    setDetailTarget(d);
    setDetailLoading(true);
    try {
      const res = await merchantDeliveryApi.getDriverDetail(d.id);
      setDetailOrders(res.recent_orders);
      setDetailShifts(res.recent_shifts);
    } catch {
      setDetailOrders([]);
      setDetailShifts([]);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('مناديب التوصيل', 'Delivery Personnel')}
          </h1>
          <p className="text-xs sm:text-sm text-[#6E6A66]">
            {t(
              'أضف مناديب متجرك، عدّل بياناتهم، وأدر صلاحية الدخول وكلمات المرور',
              'Create, edit, activate/deactivate, and manage credentials for your delivery team'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-extrabold self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('إضافة مندوب جديد', 'Add Delivery Person')}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#6E6A66] absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('ابحث بالاسم أو الهاتف أو البريد...', 'Search by name, phone, or email...')}
              className="w-full ps-10 pe-3.5 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53]"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-bold text-[#6E6A66] cursor-pointer">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded border-[#EAE6E1] text-[#1B8E53]"
            />
            <span>{t('إظهار المؤرشفين', 'Show archived')}</span>
          </label>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-sm text-[#6E6A66]">
            <Loader2 className="w-5 h-5 animate-spin text-[#1B8E53]" />
            <span>{t('جاري التحميل...', 'Loading...')}</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : drivers.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Truck className="w-10 h-10 text-[#6E6A66]/40 mx-auto" />
            <div className="text-sm font-bold text-[#1C1917]">
              {t('لم تقم بإضافة مناديب توصيل بعد', 'No delivery personnel added yet')}
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B8E53] text-white text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>{t('إضافة أول مندوب', 'Add First Driver')}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drivers.map((d) => (
              <div
                key={d.id}
                className="rounded-2xl border border-[#EAE6E1] p-4 bg-[#FAF9F7]/50 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-extrabold text-[#1C1917]">{d.full_name}</div>
                    <div className="text-xs text-[#6E6A66]">{d.email}</div>
                  </div>
                  <DriverOperationalBadge status={d.operational_status} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-[#1C1917]" dir="ltr">
                    <Phone className="w-3.5 h-3.5 text-[#1B8E53]" />
                    <span>{d.phone_number}</span>
                  </div>
                  <div className="text-[#6E6A66]">
                    {formatVehicleLabel(d.vehicle_type, t)}
                    {d.vehicle_plate ? ` • ${d.vehicle_plate}` : ''}
                  </div>
                  <div className="text-[#6E6A66]">
                    {t('طلبات نشطة:', 'Active orders:')}{' '}
                    <span className="font-bold text-[#1C1917]">{d.active_orders_count}</span>
                  </div>
                  <div className="text-[#6E6A66]">
                    {t('آخر ظهور:', 'Last seen:')}{' '}
                    <span className="font-semibold">{formatRelativeTime(d.last_seen_at, t)}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#EAE6E1] flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void openDetailModal(d)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#EAE6E1] text-xs font-bold text-[#1C1917] hover:bg-[#FAF9F7]"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{t('التفاصيل', 'Details')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(d)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#EAE6E1] text-xs font-bold text-[#1C1917] hover:bg-[#FAF9F7]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{t('تعديل', 'Edit')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResetTarget(d);
                      setNewPassword('');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#EAE6E1] text-xs font-bold text-[#1C1917] hover:bg-[#FAF9F7]"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{t('كلمة المرور', 'Password')}</span>
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleToggleActive(d, d.is_active)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                      d.is_active
                        ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{d.is_active ? t('تعطيل', 'Deactivate') : t('تفعيل', 'Activate')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          editingDriver
            ? t('تعديل بيانات المندوب', 'Edit Delivery Person')
            : t('إضافة مندوب توصيل جديد', 'Create Delivery Account')
        }
      >
        <form onSubmit={handleSaveDriver} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t('الاسم الأول *', 'First Name *')}
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t('اسم العائلة', 'Last Name')}
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t('البريد الإلكتروني *', 'Email *')}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t('رقم الموبايل *', 'Phone Number *')}
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
                dir="ltr"
              />
            </div>
          </div>

          {!editingDriver && (
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t('كلمة المرور الأولية (8 أحرف على الأقل) *', 'Initial Password (min 8 chars) *')}
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
                dir="ltr"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t('وسيلة التوصيل', 'Vehicle Type')}
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as DriverVehicleType)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm bg-white"
              >
                <option value="motorcycle">{t('موتوسيكل', 'Motorcycle')}</option>
                <option value="bicycle">{t('دراجة', 'Bicycle')}</option>
                <option value="car">{t('سيارة', 'Car')}</option>
                <option value="on_foot">{t('سير على الأقدام', 'On Foot')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {t('رقم اللوحة (اختياري)', 'Plate Number (Optional)')}
              </label>
              <input
                type="text"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1C1917] mb-1">
              {t('ملاحظات', 'Notes')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#EAE6E1] text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#EAE6E1] text-xs font-bold text-[#1C1917]"
            >
              {t('إلغاء', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-[#1B8E53] text-white text-xs font-extrabold disabled:opacity-60"
            >
              {submitting ? t('جاري الحفظ...', 'Saving...') : t('حفظ', 'Save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={t('إعادة تعيين كلمة مرور المندوب', 'Reset Driver Password')}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-xs text-[#6E6A66]">
            {t(
              `سيتم تعيين كلمة مرور جديدة لحساب ${resetTarget?.full_name ?? ''}.`,
              `Set a new password for ${resetTarget?.full_name ?? ''}.`
            )}
          </p>
          <div>
            <label className="block text-xs font-bold text-[#1C1917] mb-1">
              {t('كلمة المرور الجديدة (8 أحرف على الأقل)', 'New Password (min 8 chars)')}
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#EAE6E1] text-sm"
              dir="ltr"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setResetTarget(null)}
              className="px-4 py-2 rounded-xl border border-[#EAE6E1] text-xs font-bold"
            >
              {t('إلغاء', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-[#1B8E53] text-white text-xs font-extrabold"
            >
              {t('تحديث كلمة المرور', 'Update Password')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Driver Details Modal */}
      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title={detailTarget?.full_name ?? t('تفاصيل المندوب', 'Driver Details')}
        maxWidthClass="max-w-2xl"
      >
        {detailLoading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-sm text-[#6E6A66]">
            <Loader2 className="w-5 h-5 animate-spin text-[#1B8E53]" />
            <span>{t('جاري تحميل السجل...', 'Loading history...')}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]">
                <div className="text-[#6E6A66]">{t('توصيلات اليوم', 'Delivered Today')}</div>
                <div className="text-lg font-extrabold text-[#1C1917]">
                  {detailTarget?.delivered_today ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]">
                <div className="text-[#6E6A66]">{t('هذا الأسبوع', 'This Week')}</div>
                <div className="text-lg font-extrabold text-[#1C1917]">
                  {detailTarget?.delivered_this_week ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]">
                <div className="text-[#6E6A66]">{t('هذا الشهر', 'This Month')}</div>
                <div className="text-lg font-extrabold text-[#1C1917]">
                  {detailTarget?.delivered_this_month ?? 0}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]">
                <div className="text-[#6E6A66]">{t('ساعات اليوم', 'Hours Today')}</div>
                <div className="text-lg font-extrabold text-[#1C1917]">
                  {detailTarget?.working_hours_today ?? 0}h
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-extrabold text-[#1C1917] mb-2">
                {t('أحدث الطلبات المسندة', 'Recent Assigned Orders')}
              </h3>
              {detailOrders.length === 0 ? (
                <p className="text-xs text-[#6E6A66]">{t('لا توجد طلبات مسجلة بعد', 'No orders yet')}</p>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {detailOrders.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]"
                    >
                      <span className="font-bold text-[#1C1917]">#{o.order_number}</span>
                      <span className="text-[#6E6A66]">{o.order_status}</span>
                      <span className="text-[#6E6A66]">{formatDateTime(o.created_at, language)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-extrabold text-[#1C1917] mb-2">
                {t('سجل المناوبات', 'Recent Shifts')}
              </h3>
              {detailShifts.length === 0 ? (
                <p className="text-xs text-[#6E6A66]">{t('لا توجد مناوبات مسجلة بعد', 'No shifts recorded yet')}</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {detailShifts.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1]"
                    >
                      <span>{formatDateTime(s.started_at, language)}</span>
                      <span className="font-bold">
                        {s.is_active
                          ? t('مناوبة نشطة', 'Active')
                          : `${s.duration_minutes} ${t('دقيقة', 'min')}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
