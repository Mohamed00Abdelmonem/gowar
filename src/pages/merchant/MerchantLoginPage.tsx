import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Globe,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Store,
  User,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DEMO_ACCOUNTS } from '../../services/authService';
import { IS_BACKEND_API_ENABLED } from '../../services/apiClient';
import { BrandLogo } from '../../components/common/BrandLogo';
import { StoreMapPicker } from '../../components/location/StoreMapPicker';
import { isStandaloneMode, requestPwaInstallModal } from '../../services/pwaInstall';
import type { StoreType } from '../../types';

export const MerchantLoginPage: React.FC = () => {
  const {
    language,
    toggleLanguage,
    t,
    areas,
    authSession,
    loginPortal,
    registerMerchantPortal,
  } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Merchant application form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [storeNameAr, setStoreNameAr] = useState('');
  const [storeNameEn, setStoreNameEn] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [storeType, setStoreType] = useState<StoreType>('supermarket');
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('30.0566');
  const [lng, setLng] = useState('31.3376');
  const [radiusKm, setRadiusKm] = useState('3');
  const [pendingNotice, setPendingNotice] = useState<{
    email: string;
    storeName: string;
    message: string;
  } | null>(null);

  const effectiveAreaId = selectedAreaId || areas[0]?.id || '';

  if (authSession?.role === 'merchant') {
    return <Navigate to="/merchant" replace />;
  }
  if (authSession?.role === 'delivery') {
    return <Navigate to="/delivery" replace />;
  }
  if (authSession?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  const merchantDemos = DEMO_ACCOUNTS.filter((a) => a.role === 'merchant');
  const rawFrom = (location.state as { from?: string } | null)?.from;
  const redirectTarget = rawFrom && rawFrom.startsWith('/merchant') ? rawFrom : '/merchant';

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await loginPortal(email, password, 'merchant');
      if (!res.ok) {
        setError(res.error);
        return;
      }
      navigate(redirectTarget, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setError(t('يرجى إدخال إحداثيات موقع صحيحة للمحل.', 'Please enter valid store coordinates.'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await registerMerchantPortal({
        email: email.trim(),
        password,
        phone_number: phone.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        business_name: businessName.trim() || storeNameAr.trim(),
        store_name: storeNameAr.trim(),
        store_name_en: storeNameEn.trim() || storeNameAr.trim(),
        store_type: storeType,
        area: effectiveAreaId || null,
        address: address.trim(),
        latitude: parsedLat,
        longitude: parsedLng,
        delivery_radius_km: Number(radiusKm) || 3,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPendingNotice({
        email: email.trim(),
        storeName: storeNameAr.trim(),
        message: res.message,
      });
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoFill = (accEmail: string, accPass: string) => {
    setEmail(accEmail);
    setPassword(accPass);
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col justify-center items-center p-4 sm:p-6">
      <div className={`w-full ${mode === 'register' ? 'max-w-lg' : 'max-w-md'} space-y-5 transition-all`}>
        <div className="flex items-center justify-between gap-2">
          <Link to="/">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-2">
            {!isStandaloneMode() && (
              <button
                type="button"
                onClick={requestPwaInstallModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E6F5EC] hover:bg-[#D5EFE0] border border-[#C2E7D2] text-xs font-bold text-[#1B8E53]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('تثبيت التطبيق', 'Install App')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#EAE6E1] text-xs font-bold text-[#1C1917]"
            >
              <Globe className="w-3.5 h-3.5 text-[#1B8E53]" />
              <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-[#EAE6E1] p-6 sm:p-7 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#E6F5EC] text-[#1B8E53] flex items-center justify-center shrink-0">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#1C1917]">
                {t('بوابة التاجر — جوار', 'Gowar Merchant Portal')}
              </h1>
              <p className="text-xs text-[#6E6A66]">
                {mode === 'login'
                  ? t(
                      'سجّل دخول لإدارة محلك، منتجاتك، وطلبات العملاء',
                      'Sign in to manage your store, products & orders'
                    )
                  : t(
                      'قدّم طلب انضمام متجرك وسيتفعل حسابك فور موافقة الإدارة',
                      'Submit your store application — activates as soon as admin approves'
                    )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 bg-[#FAF9F7] border border-[#EAE6E1] rounded-xl p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                mode === 'login' ? 'bg-[#1B8E53] text-white' : 'text-[#6E6A66]'
              }`}
            >
              {t('تسجيل الدخول', 'Sign In')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setPendingNotice(null);
                setError('');
              }}
              className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                mode === 'register' ? 'bg-[#1B8E53] text-white' : 'text-[#6E6A66]'
              }`}
            >
              {t('إنشاء حساب تاجر', 'Register Store')}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs font-bold text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && pendingNotice ? (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <h2 className="text-base font-extrabold text-[#1C1917]">
                {t('تم إرسال طلبك للإدارة بنجاح', 'Application Sent for Admin Review')}
              </h2>
              <p className="text-xs text-[#6E6A66] leading-relaxed">{pendingNotice.message}</p>
              <div className="p-3 rounded-xl bg-white border border-amber-200 text-xs space-y-1 text-start">
                <div>
                  <strong>{t('المتجر:', 'Store:')}</strong> {pendingNotice.storeName}
                </div>
                <div>
                  <strong>{t('البريد الإلكتروني:', 'Email:')}</strong>{' '}
                  <span dir="ltr">{pendingNotice.email}</span>
                </div>
                <div className="inline-flex items-center gap-1 text-amber-800 font-bold pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {t(
                      'الحالة الحالية: بانتظار موافقة مدير المنصة',
                      'Current status: Pending Admin Approval'
                    )}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmail(pendingNotice.email);
                  setPendingNotice(null);
                  setMode('login');
                  setError('');
                }}
                className="w-full py-2.5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-xs font-extrabold"
              >
                {t('الانتقال لتسجيل الدخول', 'Go to Sign In')}
              </button>
            </div>
          ) : mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#6E6A66] mb-1.5">
                  {t('البريد الإلكتروني', 'Email Address')}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#6E6A66] absolute start-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ahmed@gowar.demo"
                    dir="ltr"
                    className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E6A66] mb-1.5">
                  {t('كلمة المرور', 'Password')}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#6E6A66] absolute start-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53] focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-[#1B8E53] hover:bg-[#147242] disabled:opacity-60 text-white text-sm font-extrabold transition-colors shadow-xs"
              >
                {submitting
                  ? t('جاري تسجيل الدخول...', 'Signing in...')
                  : t('دخول لبوابة التاجر', 'Sign in to Merchant Portal')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                    {t('الاسم الأول', 'First Name')}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#6E6A66] absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full ps-9 pe-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                    {t('اسم العائلة', 'Last Name')}
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                    {t('رقم الموبايل', 'Phone Number')}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#6E6A66] absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="010xxxxxxxx"
                      dir="ltr"
                      className="w-full ps-9 pe-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                    {t('البريد الإلكتروني', 'Email Address')}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#6E6A66] absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@store.com"
                      dir="ltr"
                      className="w-full ps-9 pe-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                  {t('كلمة المرور', 'Password')}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#6E6A66] absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full ps-9 pe-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                  />
                </div>
                <p className="text-[11px] text-[#6E6A66] mt-1">
                  {t(
                    '8 أحرف على الأقل، وتجنب أن تكون أرقاماً فقط أو شائعة.',
                    'At least 8 characters; avoid common or all-numeric passwords.'
                  )}
                </p>
              </div>

              <div className="pt-2 border-t border-[#EAE6E1] space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                      {t('اسم المتجر (بالعربية)', 'Store Name (Arabic)')}
                    </label>
                    <input
                      type="text"
                      required
                      value={storeNameAr}
                      onChange={(e) => setStoreNameAr(e.target.value)}
                      placeholder={t('ماركت الهدى', 'Al-Huda Market')}
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                      {t('اسم المتجر (بالإنجليزية)', 'Store Name (English)')}
                    </label>
                    <input
                      type="text"
                      value={storeNameEn}
                      onChange={(e) => setStoreNameEn(e.target.value)}
                      placeholder="Al-Huda Market"
                      dir="ltr"
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                      {t('نوع المتجر', 'Store Type')}
                    </label>
                    <select
                      value={storeType}
                      onChange={(e) => setStoreType(e.target.value as StoreType)}
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm font-medium"
                    >
                      <option value="supermarket">{t('سوبر ماركت', 'Supermarket')}</option>
                      <option value="mini_market">{t('ميني ماركت', 'Mini Market')}</option>
                      <option value="grocery">{t('بقالة', 'Grocery')}</option>
                      <option value="kiosk">{t('كشك', 'Kiosk')}</option>
                      <option value="convenience">{t('متجر سريع', 'Convenience')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                      {t('اسم النشاط / الشركة', 'Business Legal Name')}
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder={storeNameAr || t('نفس اسم المتجر', 'Same as store name')}
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                      {t('المنطقة / الحي', 'Area / District')}
                    </label>
                    <select
                      value={effectiveAreaId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setSelectedAreaId(nextId);
                        const match = areas.find((a) => a.id === nextId);
                        if (match?.coordinates) {
                          setLat(String(match.coordinates.lat));
                          setLng(String(match.coordinates.lng));
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm font-medium"
                    >
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {language === 'ar' ? a.nameAr : a.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                      {t('نطاق التوصيل (كم)', 'Delivery Radius (KM)')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="25"
                      step="0.5"
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(e.target.value)}
                      dir="ltr"
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                    {t('عنوان المتجر بالتفصيل', 'Store Street Address')}
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-[#6E6A66] absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder={t('مدينة نصر، شارع عباس العقاد...', 'Street name, building...')}
                      className="w-full ps-9 pe-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <StoreMapPicker
                    storeName={storeNameAr || t('متجرك', 'Your Store')}
                    coordinates={{
                      lat: Number(lat) || 30.0566,
                      lng: Number(lng) || 31.3376,
                    }}
                    deliveryRadiusKm={Number(radiusKm) || 3}
                    defaultEditing
                    heightClass="h-52"
                    onChange={(next, resolvedAddress) => {
                      setLat(String(next.lat));
                      setLng(String(next.lng));
                      if (resolvedAddress && !address.trim()) {
                        setAddress(resolvedAddress);
                      }
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-[#1B8E53] hover:bg-[#147242] disabled:opacity-60 text-white text-sm font-extrabold transition-colors shadow-xs"
              >
                {submitting
                  ? t('جاري إرسال الطلب...', 'Submitting application...')
                  : t('إرسال طلب تسجيل التاجر', 'Submit Merchant Application')}
              </button>
            </form>
          )}

          {/* Demo Credential Cards (offline demo mode only) */}
          {!IS_BACKEND_API_ENABLED && mode === 'login' && (
            <div className="pt-4 border-t border-[#EAE6E1] space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#1C1917]">
                <KeyRound className="w-3.5 h-3.5 text-[#1B8E53]" />
                <span>{t('حسابات التجربة الجاهزة', 'Demo Merchant Credentials')}</span>
              </div>

              {merchantDemos.map((acc) => (
                <div
                  key={acc.id}
                  className="p-3 rounded-2xl bg-[#E6F5EC]/70 border border-[#C2E7D2] flex items-center justify-between gap-3"
                >
                  <div className="text-xs space-y-0.5 min-w-0">
                    <div className="font-extrabold text-[#1C1917]">
                      {language === 'ar' ? acc.storeNameAr : acc.storeNameEn}{' '}
                      <span className="text-[10px] font-bold text-[#1B8E53]">({acc.merchantCode})</span>
                    </div>
                    <div className="text-[#6E6A66] truncate" dir="ltr">
                      {acc.email} / {acc.password}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAutoFill(acc.email, acc.password)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-[11px] font-bold shrink-0"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{t('تعبئة تلقائية', 'Auto-Fill')}</span>
                  </button>
                </div>
              ))}

              <p className="text-[11px] text-[#6E6A66] leading-relaxed">
                {t(
                  'ملاحظة: هذه مصادقة تجريبية على الواجهة فقط (localStorage)؛ في البيئة الإنتاجية يتم فرض الصلاحيات عبر الخادم.',
                  'Frontend-only demo auth (localStorage). Production auth must be enforced server-side.'
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
