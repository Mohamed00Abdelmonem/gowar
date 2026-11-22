import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Globe, Loader2, Lock, Mail, Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../../components/common/BrandLogo';

export const DeliveryLoginPage: React.FC = () => {
  const { language, setLanguage, t, loginPortal } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await loginPortal(email, password, 'delivery');
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    navigate('/delivery', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col justify-center px-4 py-10">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <BrandLogo />
          <button
            type="button"
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="h-9 px-3 rounded-xl border border-[#EAE6E1] bg-white text-xs font-bold text-[#1C1917] inline-flex items-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5 text-[#1B8E53]" />
            <span>{language === 'ar' ? 'English' : 'العربية'}</span>
          </button>
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
                {t('البريد الإلكتروني', 'Email Address')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6E6A66] absolute start-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="driver@gowar.com"
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
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full ps-10 pe-3.5 py-3 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm focus:outline-none focus:border-[#1B8E53]"
                />
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
