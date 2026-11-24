import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Globe, KeyRound, Lock, Phone, ShieldCheck, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DEMO_ACCOUNTS } from '../../services/authService';
import { IS_BACKEND_API_ENABLED } from '../../services/apiClient';
import { BrandLogo } from '../../components/common/BrandLogo';
import { normalizeEgyptPhone } from '../../utils/phone';

export const AdminLoginPage: React.FC = () => {
  const { language, toggleLanguage, t, authSession, loginPortal } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (authSession?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  if (authSession?.role === 'merchant') {
    return <Navigate to="/merchant" replace />;
  }

  const adminDemo = DEMO_ACCOUNTS.find((a) => a.role === 'admin')!;
  const redirectTarget = (location.state as { from?: string } | null)?.from || '/admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalized = normalizeEgyptPhone(phone);
    if (!normalized.ok) {
      setError(language === 'ar' ? normalized.errorAr : normalized.errorEn);
      return;
    }
    setSubmitting(true);
    try {
      const res = await loginPortal(normalized.value, password, 'admin');
      if (!res.ok) {
        setError(res.error);
        return;
      }
      navigate(redirectTarget, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1C1917] flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <Link to="/">
            <BrandLogo variant="light" />
          </Link>
          <button
            type="button"
            onClick={toggleLanguage}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-white"
          >
            <Globe className="w-3.5 h-3.5 text-orange-300" />
            <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-[#EAE6E1] p-6 sm:p-7 shadow-xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#1C1917] text-orange-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#1C1917]">
                {t('إدارة منصة جوار — Super Admin', 'Gowar Super Admin Portal')}
              </h1>
              <p className="text-xs text-[#6E6A66]">
                {t('متابعة كل التجار، العمولات، الإيرادات والطلبات', 'Platform operations, GMV, commissions & merchant oversight')}
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs font-bold text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#6E6A66] mb-1.5">
                {t('رقم الموبايل للإدارة', 'Admin Mobile Number')}
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
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className="w-full ps-10 pe-10 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53] focus:bg-white"
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
              className="w-full py-3 rounded-xl bg-[#1C1917] hover:bg-black disabled:opacity-60 text-white text-sm font-extrabold transition-colors"
            >
              {submitting
                ? t('جاري تسجيل الدخول...', 'Signing in...')
                : t('دخول للوحة الإدارة', 'Sign in to Super Admin')}
            </button>
          </form>

          {/* Demo Admin Credential Card (Offline prototype mode only) */}
          {!IS_BACKEND_API_ENABLED && (
            <div className="pt-4 border-t border-[#EAE6E1] space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#1C1917]">
                <KeyRound className="w-3.5 h-3.5 text-[#1B8E53]" />
                <span>{t('بيانات دخول الإدارة التجريبية', 'Super Admin Demo Credentials')}</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#FAF9F7] border border-[#EAE6E1] flex items-center justify-between gap-3">
                <div className="text-xs space-y-0.5 min-w-0">
                  <div className="font-extrabold text-[#1C1917]">
                    Super Admin <span className="text-[#1B8E53]">({adminDemo.nameAr})</span>
                  </div>
                  <div className="text-[#6E6A66] truncate" dir="ltr">
                    {adminDemo.phone} / {adminDemo.password}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPhone(adminDemo.phone);
                    setPassword(adminDemo.password);
                    setError('');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1B8E53] hover:bg-[#147242] text-white text-[11px] font-bold shrink-0"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{t('تعبئة تلقائية', 'Auto-Fill')}</span>
                </button>
              </div>

              <p className="text-[11px] text-[#6E6A66] leading-relaxed">
                {t(
                  'مصادقة تجريبية على الواجهة فقط — في الإنتاج يتم التحقق من الصلاحيات عبر الخادم.',
                  'Frontend-only demo auth. Production role checks must be enforced server-side.'
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
