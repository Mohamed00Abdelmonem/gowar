import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Volume2, VolumeX } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDateTime } from '../../utils/i18n';
import { getAccessToken, IS_BACKEND_API_ENABLED } from '../../services/apiClient';
import {
  isNotificationSoundEnabled,
  playNotificationSound,
  setNotificationSoundEnabled,
} from '../../utils/notificationSound';

interface NotificationBellProps {
  audience: 'customer' | 'merchant';
  merchantId?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ audience, merchantId }) => {
  const { language, t, notifications, markNotificationsRead } = useApp();
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => isNotificationSoundEnabled());

  const scopedNotifs = notifications.filter((n) => {
    if (n.audience !== audience) return false;
    if (audience === 'merchant' && merchantId && n.merchantId && n.merchantId !== merchantId) {
      return false;
    }
    return true;
  });

  const unreadCount = scopedNotifs.filter((n) => !n.read).length;
  const requiresCustomerLogin =
    audience === 'customer' && IS_BACKEND_API_ENABLED && !getAccessToken();

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setNotificationSoundEnabled(next);
    if (next) {
      playNotificationSound(audience, true);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen && unreadCount > 0) {
            markNotificationsRead(audience, merchantId);
          }
        }}
        className={`relative flex items-center justify-center border border-[#EAE6E1] text-[#1C1917] hover:bg-[#FAF9F7] transition-colors ${
          audience === 'customer' ? 'w-10 h-10 rounded-xl' : 'w-9 h-9 rounded-xl'
        }`}
        aria-label={t('الإشعارات', 'Notifications')}
      >
        <Bell className="w-4 h-4 text-[#D6450D]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed sm:absolute top-16 sm:top-auto inset-x-3 sm:inset-x-auto sm:end-0 sm:mt-2 sm:w-84 bg-white rounded-2xl border border-[#EAE6E1] shadow-xl p-3 z-50">
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#EAE6E1]">
              <span className="text-xs font-extrabold text-[#1C1917]">
                {audience === 'merchant'
                  ? t('إشعارات المحل', 'Store Alerts')
                  : t('إشعارات طلباتي', 'Order Alerts')}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleSound}
                  title={
                    soundEnabled
                      ? t('كتم صوت الإشعارات', 'Mute notification sound')
                      : t('تشغيل صوت الإشعارات', 'Enable notification sound')
                  }
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                    soundEnabled
                      ? 'bg-[#FFF2EB] text-[#D6450D] border-[#FBD8C5]'
                      : 'bg-[#FAF9F7] text-[#6E6A66] border-[#EAE6E1]'
                  }`}
                >
                  {soundEnabled ? (
                    <Volume2 className="w-3 h-3" />
                  ) : (
                    <VolumeX className="w-3 h-3" />
                  )}
                  <span>{soundEnabled ? t('الصوت مفعل', 'Sound On') : t('صامت', 'Muted')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[11px] font-bold text-[#6E6A66] hover:text-[#1C1917] px-1.5"
                >
                  {t('إغلاق', 'Close')}
                </button>
              </div>
            </div>

            {requiresCustomerLogin ? (
              <div className="py-4 px-2 text-center space-y-2.5">
                <p className="text-xs text-[#6E6A66]">
                  {t(
                    'سجّل دخولك لتصلك إشعارات حالة طلباتك لحظة بلحظة بالصوت.',
                    'Sign in to receive live order status alerts with sound.'
                  )}
                </p>
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="inline-block px-4 py-1.5 rounded-xl bg-[#D6450D] text-white text-xs font-bold"
                >
                  {t('تسجيل الدخول', 'Sign In')}
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {scopedNotifs.length === 0 ? (
                  <p className="text-xs text-[#6E6A66] py-6 text-center">
                    {t('لا توجد إشعارات بعد', 'No notifications yet')}
                  </p>
                ) : (
                  scopedNotifs.slice(0, 12).map((n) => (
                    <Link
                      key={n.id}
                      to={n.link || (audience === 'merchant' ? '/merchant/orders' : '/orders')}
                      onClick={() => setOpen(false)}
                      className={`block p-2.5 rounded-xl transition-colors border ${
                        n.read
                          ? 'bg-[#FAF9F7] border-transparent hover:bg-[#FFF2EB]'
                          : 'bg-[#FFF2EB]/70 border-[#FBD8C5] hover:bg-[#FFF2EB]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-extrabold text-[#1C1917]">
                          {language === 'ar' ? n.titleAr : n.titleEn}
                        </p>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-[#D6450D] shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#6E6A66] mt-0.5">
                        {language === 'ar' ? n.bodyAr : n.bodyEn}
                      </p>
                      <span className="block text-[10px] text-[#6E6A66]/80 mt-1">
                        {formatDateTime(n.createdAt, language)}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
