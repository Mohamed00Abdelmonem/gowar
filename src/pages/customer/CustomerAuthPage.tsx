import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Lock, Mail, Phone, User, UserPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ApiClientError, IS_BACKEND_API_ENABLED } from '../../services/apiClient';
import { authApi, marketplaceApi } from '../../services/gowarApi';
import { normalizeEgyptPhone } from '../../utils/phone';

interface CustomerAuthPageProps {
  initialMode?: 'login' | 'register';
}

export const CustomerAuthPage: React.FC<CustomerAuthPageProps> = ({
  initialMode = 'login',
}) => {
  const { t, cart, showToast, refreshFromBackend } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const rawFrom =
    (location.state as { from?: string } | null)?.from || searchParams.get('next') || '/';
  const returnTo = rawFrom.startsWith('/') && !rawFrom.startsWith('//') ? rawFrom : '/';

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalized = normalizeEgyptPhone(phone);
    if (!normalized.ok) {
      setError(t(normalized.errorAr, normalized.errorEn));
      return;
    }

    if (!IS_BACKEND_API_ENABLED) {
      showToast(
        t(
          'أنت تعمل حالياً بوضع البيانات التجريبية المحلي بدون خادم. يمكنك المتابعة مباشرة من الصفحة الرئيسية.',
          'Running in local prototype mode without backend API. You can browse directly.'
        ),
        'info'
      );
      navigate('/profile');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await authApi.registerCustomer({
          phone_number: normalized.value,
          password,
          first_name: firstName,
          last_name: lastName,
          ...(email.trim() ? { email: email.trim() } : {}),
        });
        showToast(t('تم إنشاء حسابك وتسجيل الدخول بنجاح', 'Account created and signed in'), 'success');
      } else {
        await authApi.loginRole('customer', normalized.value, password);
        showToast(t('تم تسجيل الدخول بنجاح', 'Signed in successfully'), 'success');
      }
      if (cart.items.length > 0) {
        try {
          for (let i = 0; i < cart.items.length; i += 1) {
            const item = cart.items[i];
            await marketplaceApi.addCartItem(item.productId, item.quantity, i === 0);
          }
        } catch {
          // Best-effort sync; backend state will be refreshed below
        }
      }

      const pendingFavId =
        (location.state as { pendingFavoriteStoreId?: string } | null)?.pendingFavoriteStoreId ||
        (() => {
          try {
            return sessionStorage.getItem('gowar_pending_favorite_v1');
          } catch {
            return null;
          }
        })();
      if (pendingFavId) {
        try {
          await marketplaceApi.addFavoriteStore(pendingFavId);
          sessionStorage.removeItem('gowar_pending_favorite_v1');
        } catch {
          // Best-effort favorite continuation
        }
      }

      await refreshFromBackend();
      navigate(returnTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(t('حدث خطأ غير متوقع أثناء المصادقة.', 'Authentication error.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="bg-white rounded-3xl border border-[#EAE6E1] p-6 sm:p-7 shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#E6F5EC] text-[#1B8E53] flex items-center justify-center shrink-0">
            {mode === 'login' ? <User className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[#1C1917]">
              {mode === 'login'
                ? t('تسجيل دخول المتسوق', 'Customer Sign In')
                : t('إنشاء حساب جديد في جوار', 'Create Gowar Account')}
            </h1>
            <p className="text-xs text-[#6E6A66]">
              {t('احفظ عناوينك وتابع طلباتك من محلات الحي', 'Save addresses & track neighborhood orders')}
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
              setError('');
            }}
            className={`py-2 rounded-lg text-xs font-bold transition-colors ${
              mode === 'register' ? 'bg-[#1B8E53] text-white' : 'text-[#6E6A66]'
            }`}
          >
            {t('حساب جديد', 'Register')}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs font-bold text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                  {t('الاسم الأول', 'First Name')}
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                  {t('اسم العائلة', 'Last Name')}
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('رقم الموبايل', 'Mobile Number')}
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[#6E6A66] absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
                dir="ltr"
                className="w-full ps-9 pe-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-[#6E6A66] mb-1">
                {t('البريد الإلكتروني (اختياري)', 'Email Address (Optional)')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6E6A66] absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  dir="ltr"
                  className="w-full ps-9 pe-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#6E6A66] mb-1">
              {t('كلمة المرور', 'Password')}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#6E6A66] absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="w-full ps-9 pe-10 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? t('إخفاء كلمة المرور', 'Hide password') : t('إظهار كلمة المرور', 'Show password')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-[#6E6A66] hover:text-[#1C1917]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {mode === 'register' && (
              <p className="text-[11px] text-[#6E6A66] mt-1">
                {t(
                  '8 أحرف على الأقل، وتجنب أن تكون أرقاماً فقط أو شائعة أو مطابقة لرقم الموبايل.',
                  'At least 8 characters; avoid all-numeric, common, or phone-identical passwords.'
                )}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#1B8E53] hover:bg-[#147242] disabled:opacity-60 text-white text-sm font-extrabold transition-colors"
          >
            {loading
              ? t('جاري التنفيذ...', 'Please wait...')
              : mode === 'login'
                ? t('دخول', 'Sign In')
                : t('إنشاء الحساب', 'Create Account')}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-[#EAE6E1]">
          <Link to="/" className="text-xs font-bold text-[#6E6A66] hover:text-[#1B8E53]">
            {t('العودة لتصفح المحلات', 'Continue browsing stores')}
          </Link>
        </div>
      </div>
    </div>
  );
};
