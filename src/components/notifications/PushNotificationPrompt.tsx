import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BellRing, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getAccessToken, IS_BACKEND_API_ENABLED } from '../../services/apiClient';
import { marketplaceApi } from '../../services/gowarApi';
import { isStandaloneMode } from '../../services/pwaInstall';
import {
  enableWebPushNotifications,
  getBrowserNotificationPermission,
  getWebPushSupportStatus,
  isPushPromptDismissedRecently,
  recordPushPromptDismissal,
  syncExistingPushSubscription,
} from '../../services/pushNotifications';

export const PushNotificationPrompt: React.FC = () => {
  const { pathname } = useLocation();
  const { language, t, showToast } = useApp();
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const hasToken = IS_BACKEND_API_ENABLED && Boolean(getAccessToken());

  // Automatically sync existing granted browser subscription when authenticated or language changes
  useEffect(() => {
    if (!hasToken) return;
    void syncExistingPushSubscription(language);
  }, [hasToken, language]);

  // Show soft permission prompt only after authentication + meaningful context (PWA or order/merchant pages)
  useEffect(() => {
    if (!hasToken) return;

    if (getWebPushSupportStatus() !== 'supported') return;
    if (getBrowserNotificationPermission() !== 'default') return;
    if (isPushPromptDismissedRecently()) return;

    const meaningfulContext =
      isStandaloneMode() ||
      pathname.startsWith('/orders') ||
      pathname.startsWith('/merchant');

    if (!meaningfulContext) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const cfg = await marketplaceApi.fetchPushConfig();
        if (!cancelled && cfg.enabled && cfg.vapid_public_key) {
          setVisible(true);
        }
      } catch {
        // Ignore config check errors
      }
    }, 1800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hasToken, pathname]);

  if (!visible || !hasToken) return null;

  const handleDismiss = () => {
    recordPushPromptDismissal();
    setVisible(false);
  };

  const handleEnable = async () => {
    setSubmitting(true);
    const res = await enableWebPushNotifications(language);
    setSubmitting(false);
    setVisible(false);

    if (res.ok) {
      showToast(
        t('تم تفعيل إشعارات الطلبات الفورية بنجاح!', 'Instant order notifications enabled!'),
        'success'
      );
    } else if (res.reason === 'denied') {
      showToast(
        t(
          'تم حظر الإشعارات من المتصفح. يمكنك تفعيلها لاحقاً من إعدادات المتصفح.',
          'Notifications were blocked by the browser. You can enable them later in browser settings.'
        ),
        'info'
      );
    }
  };

  return (
    <div className="fixed bottom-20 sm:bottom-5 inset-x-3 sm:inset-x-auto sm:end-5 sm:max-w-sm z-40 pwa-modal-animate">
      <div className="bg-white rounded-2xl border border-[#EAE6E1] shadow-[0_18px_42px_-12px_rgba(28,25,23,0.28)] p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFF2EB] text-[#D6450D] flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-extrabold text-[#1C1917]">
                {t('فعّل إشعارات الطلبات الفورية', 'Enable Instant Order Alerts')}
              </p>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label={t('إغلاق', 'Close')}
                className="text-[#6E6A66] hover:text-[#1C1917] p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#6E6A66] mt-1 leading-relaxed">
              {t(
                'استقبل تنبيهات فورية عند قبول طلبك أو خروجه للتوصيل حتى عندما يكون التطبيق مغلقاً.',
                'Get real-time alerts when your order is accepted or out for delivery, even when Gowar is closed.'
              )}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                disabled={submitting}
                onClick={handleEnable}
                className="px-3.5 py-2 rounded-xl bg-[#D6450D] hover:bg-[#B33808] text-white text-xs font-bold transition-colors disabled:opacity-60"
              >
                {submitting ? t('جاري التفعيل...', 'Enabling...') : t('تفعيل الإشعارات', 'Enable Alerts')}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-[#6E6A66] hover:bg-[#FAF9F7]"
              >
                {t('لاحقاً', 'Later')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
