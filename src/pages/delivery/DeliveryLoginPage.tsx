import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Download, Eye, EyeOff, Globe, Loader2, Lock, Phone, Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../../components/common/BrandLogo';
import { isStandaloneMode, requestPwaInstallModal } from '../../services/pwaInstall';
import { normalizeEgyptPhone } from '../../utils/phone';

export const DeliveryLoginPage: React.FC = () => {
  const { language, setLanguage, t, authSession, loginPortal } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (authSession?.role === 'delivery') {
    return <Navigate to="/delivery" replace />;
  }
  if (authSession?.role === 'merchant') {
    return <Navigate to="/merchant" replace />;
  }
  if (authSession?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  const rawFrom = (location.state as { from?: string } | null)?.from;
  const redirectTarget = rawFrom && rawFrom.startsWith('/delivery') ? rawFrom : '/delivery';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalized = normalizeEgyptPhone(phone);
    if (!normalized.ok) {
      setError(language === 'ar' ? normalized.errorAr : normalized.errorEn);
      return;
    }
    setSubmitting(true);
    const res = await loginPortal(normalized.value, password, 'delivery');
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    navigate(redirectTarget, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col justify-center px-4 py-10">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="flex items-center justify-between gap-2">
          <Link to="/">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-2">
            {!isStandaloneMode() && (
              <button
                type="button"
                onClick={requestPwaInstallModal}
                className="h-9 px-3 rounded-xl border border-[#C2E7D2] bg-[#E6F5EC] hover:bg-[#D5EFE0] text-xs font-bold text-[#1B8E53] inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('تثبيت التطبيق', 'Install App')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="h-9 px-3 rounded-xl border border-[#EAE6E1] bg-white text-xs font-bold text-[#1C1917] inline-flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5 text-[#1B8E53]" />
              <span>{language === 'ar' ? 'English' : 'العربية'}</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-[#EAE6E1] shadow-sm p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#E6F5EC] text-[#1B8E53] flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-[#1C1917]">
                {t('بوابة مناديب التوصيل', 'Delivery Personnel Portal')}
              </h1>
              <p className="text-xs text-[#6E6A66]">
                {t(
                  'سجّل دخولك لمتابعة الطلبات المسندة إليك وتوصيلها للعملاء',
                  'Sign in to manage and deliver your assigned Gowar orders'
                )}
              </p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 flex items-start gap-2.5 text-xs text-rose-800"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#6E6A66] mb-1.5">
                {t('رقم الموبايل', 'Mobile Number')}
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#6E6A66] absolute start-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  dir="ltr"
                  className="w-full ps-10 pe-3.5 py-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53]"
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
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className="w-full ps-10 pe-10 py-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('إخفاء كلمة المرور', 'Hide password') : t('إظهار كلمة المرور', 'Show password')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-[#6E6A66] hover:text-[#1C1917]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{t('تسجيل الدخول', 'Sign In')}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
