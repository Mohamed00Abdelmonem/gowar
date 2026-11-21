import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Lock, Mail, Phone, User, UserPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ApiClientError, IS_BACKEND_API_ENABLED } from '../../services/apiClient';
import { authApi } from '../../services/gowarApi';

interface CustomerAuthPageProps {
  initialMode?: 'login' | 'register';
}

export const CustomerAuthPage: React.FC<CustomerAuthPageProps> = ({
  initialMode = 'login',
}) => {
  const { t, showToast, refreshFromBackend } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          phone_number: phone,
        });
        showToast(t('تم إنشاء حسابك وتسجيل الدخول بنجاح', 'Account created and signed in'), 'success');
      } else {
        await authApi.loginRole('customer', email, password);
        showToast(t('تم تسجيل الدخول بنجاح', 'Signed in successfully'), 'success');
      }
      await refreshFromBackend();
      navigate('/', { replace: true });
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
          <div className="w-11 h-11 rounded-2xl bg-[#FFF2EB] text-[#D6450D] flex items-center justify-center shrink-0">
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
              mode === 'login' ? 'bg-[#D6450D] text-white' : 'text-[#6E6A66]'
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
              mode === 'register' ? 'bg-[#D6450D] text-white' : 'text-[#6E6A66]'
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
            <>
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
                    className="w-full ps-9 pe-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
                  />
                </div>
              </div>
            </>
          )}

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
                placeholder="customer@gowar.demo"
                dir="ltr"
                className="w-full ps-9 pe-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
              />
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
                dir="ltr"
                className="w-full ps-9 pe-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-sm"
              />
            </div>
            {mode === 'register' && (
              <p className="text-[11px] text-[#6E6A66] mt-1">
                {t(
                  '8 أحرف على الأقل، وتجنب أن تكون أرقاماً فقط أو شائعة أو مطابقة للبريد الإلكتروني.',
                  'At least 8 characters; avoid all-numeric, common, or email-identical passwords.'
                )}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#D6450D] hover:bg-[#B33808] disabled:opacity-60 text-white text-sm font-extrabold transition-colors"
          >
            {loading
              ? t('جاري التنفيذ...', 'Please wait...')
              : mode === 'login'
                ? t('دخول', 'Sign In')
                : t('إنشاء الحساب', 'Create Account')}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-[#EAE6E1]">
          <Link to="/" className="text-xs font-bold text-[#6E6A66] hover:text-[#D6450D]">
            {t('العودة لتصفح المحلات', 'Continue browsing stores')}
          </Link>
        </div>
      </div>
    </div>
  );
};
