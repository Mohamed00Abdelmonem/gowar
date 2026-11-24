import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle2, Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  PWA_OPEN_EVENT,
  PWA_SHOW_DELAY_MS,
  getPwaPortalForPath,
  isAppMarkedInstalled,
  isInstallDismissedRecently,
  isIosSafari,
  isStandaloneMode,
  markAppInstalled,
  markShownInSession,
  recordInstallDismissal,
  recordInstalledPortal,
  shouldShowInstallModal,
  wasShownInSession,
  type BeforeInstallPromptEvent,
} from '../../services/pwaInstall';

type InstallState = 'prompt' | 'installing' | 'installed';

export const PwaInstallModal: React.FC = () => {
  const { pathname } = useLocation();
  const { language, t } = useApp();

  const [open, setOpen] = useState(false);
  const [installState, setInstallState] = useState<InstallState>('prompt');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosSafariMode] = useState(() => isIosSafari());

  const modalRef = useRef<HTMLDivElement | null>(null);
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Register global beforeinstallprompt & appinstalled listeners once at app root
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      const activePortal = getPwaPortalForPath(window.location.pathname);
      markAppInstalled(undefined, activePortal);
      recordInstalledPortal(activePortal);
      setDeferredPrompt(null);
      setInstallState('installed');
      window.setTimeout(() => {
        setOpen(false);
      }, 1600);
    };

    const handleManualOpen = () => {
      if (isStandaloneMode()) return;
      setInstallState('prompt');
      setOpen(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener(PWA_OPEN_EVENT, handleManualOpen);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener(PWA_OPEN_EVENT, handleManualOpen);
    };
  }, []);

  // Schedule delayed modal display when all eligibility conditions are satisfied
  useEffect(() => {
    if (open) return;

    const portal = getPwaPortalForPath(pathname);
    const eligible = shouldShowInstallModal({
      pathname,
      standalone: isStandaloneMode(),
      installed: isAppMarkedInstalled(undefined, portal),
      dismissedRecently: isInstallDismissedRecently(undefined, undefined, portal),
      shownThisSession: wasShownInSession(undefined, portal),
      hasNativePrompt: deferredPrompt !== null,
      iosSafari: iosSafariMode,
    });

    if (!eligible) return;

    const timerId = window.setTimeout(() => {
      const currentPortal = getPwaPortalForPath(pathname);
      const stillEligible = shouldShowInstallModal({
        pathname,
        standalone: isStandaloneMode(),
        installed: isAppMarkedInstalled(undefined, currentPortal),
        dismissedRecently: isInstallDismissedRecently(undefined, undefined, currentPortal),
        shownThisSession: wasShownInSession(undefined, currentPortal),
        hasNativePrompt: deferredPrompt !== null,
        iosSafari: iosSafariMode,
      });
      if (!stillEligible) return;

      markShownInSession(undefined, currentPortal);
      setInstallState('prompt');
      setOpen(true);
    }, PWA_SHOW_DELAY_MS);

    return () => window.clearTimeout(timerId);
  }, [pathname, deferredPrompt, iosSafariMode, open]);

  const handleDismiss = useCallback(() => {
    recordInstallDismissal(undefined, undefined, getPwaPortalForPath(pathname));
    setOpen(false);
  }, [pathname]);

  const handleInstallClick = async () => {
    if (!deferredPrompt || installState !== 'prompt') return;

    const portal = getPwaPortalForPath(pathname);
    setInstallState('installing');
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);

      if (outcome === 'dismissed') {
        recordInstallDismissal(undefined, undefined, portal);
        setInstallState('prompt');
        setOpen(false);
      }
      // When outcome === 'accepted', wait for confirmed `appinstalled` event.
      // If browser doesn't fire `appinstalled` within 4s, close cleanly without falsely claiming installed.
      if (outcome === 'accepted') {
        recordInstalledPortal(portal);
        window.setTimeout(() => {
          setOpen((currentlyOpen) => {
            if (currentlyOpen && !isAppMarkedInstalled(undefined, portal)) {
              return false;
            }
            return currentlyOpen;
          });
        }, 4000);
      }
    } catch {
      setDeferredPrompt(null);
      setInstallState('prompt');
      setOpen(false);
    }
  };

  // Focus management, Escape key, and Tab focus trap
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTimer = window.setTimeout(() => {
      primaryActionRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, handleDismiss]);

  if (!open) return null;

  const isRtl = language === 'ar';
  const portal = getPwaPortalForPath(pathname);
  const showIosInstructions = !deferredPrompt && iosSafariMode;
  const showManualBrowserInstructions = !deferredPrompt && !iosSafariMode;

  const badgeText =
    portal === 'merchant'
      ? t('تطبيق جوار للتاجر', 'Gowar Merchant App')
      : portal === 'delivery'
        ? t('تطبيق جوار للتوصيل', 'Gowar Delivery App')
        : t('تطبيق جوار السريع', 'Gowar Mobile App');

  const titleText =
    portal === 'merchant'
      ? t('لوحة التاجر دايماً معاك!', 'Merchant Dashboard Always With You!')
      : portal === 'delivery'
        ? t('بوابة التوصيل دايماً في إيدك!', 'Delivery Portal Always in Reach!')
        : t('جوار دايماً في متناول إيدك!', 'Gowar is Always Within Reach!');

  const descText =
    portal === 'merchant'
      ? t(
          'ثبّت تطبيق التاجر على جهازك لمتابعة الطلبات وتحديث المنتجات والفتح مباشرة على لوحة التحكم.',
          'Install the Merchant app to manage orders and products and launch directly into your dashboard.'
        )
      : portal === 'delivery'
        ? t(
            'ثبّت تطبيق المندوب على موبايلك لاستلام الطلبات وتحديث حالة التوصيل بسرعة وفي أي وقت.',
            'Install the Delivery app on your phone to receive assigned orders and update deliveries fast.'
          )
        : t(
            'ثبّت تطبيق جوار على موبايلك واطلب كل احتياجاتك اليومية من المحلات القريبة بسهولة وفي أي وقت.',
            'Install Gowar on your phone and easily order everyday essentials from nearby stores, anytime.'
          );

  return (
    <div
      className="pwa-overlay-animate fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1C1917]/65 backdrop-blur-sm"
      onClick={handleDismiss}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-title"
        aria-describedby="pwa-install-desc"
        dir={isRtl ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
        className="pwa-modal-animate relative w-full max-w-[420px] rounded-3xl bg-white border border-[#EAE6E1] shadow-[0_24px_60px_-12px_rgba(28,25,23,0.38)] overflow-hidden"
      >
        {/* Warm top decorative header band */}
        <div className="relative px-6 pt-8 pb-5 bg-gradient-to-b from-[#E6F5EC] via-[#FFF9F5] to-white text-center">
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t('إغلاق نافذة التثبيت', 'Close installation modal')}
            className={`absolute top-4 ${
              isRtl ? 'left-4' : 'right-4'
            } w-9 h-9 rounded-full flex items-center justify-center text-[#6E6A66] bg-white/85 hover:bg-white hover:text-[#1C1917] border border-[#EAE6E1]/80 shadow-xs transition-all duration-150 active:scale-95`}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Floating Gowar app icon */}
          <div className="relative mx-auto w-20 h-20 mb-4 flex items-center justify-center">
            <div className="absolute inset-1 rounded-3xl bg-[#1B8E53]/20 blur-xl" />
            <div className="pwa-icon-float relative w-20 h-20 rounded-[22px] bg-white p-1.5 shadow-[0_12px_28px_-6px_rgba(214,69,13,0.35)] border border-[#EAE6E1]">
              <img
                src="/pwa-192x192.png"
                alt="Gowar"
                className="w-full h-full rounded-[16px] object-cover"
              />
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-[#E6F5EC] text-[#1B8E53] border border-[#1B8E53]/15 mb-3">
            <Smartphone className="w-3.5 h-3.5" />
            {badgeText}
          </span>

          <h2
            id="pwa-install-title"
            className="text-xl sm:text-2xl font-extrabold text-[#1C1917] leading-snug"
          >
            {titleText}
          </h2>

          <p
            id="pwa-install-desc"
            className="mt-2.5 text-sm text-[#6E6A66] leading-relaxed max-w-sm mx-auto"
          >
            {descText}
          </p>
        </div>

        {/* Body & Actions */}
        <div className="px-6 pb-6 pt-1">
          {installState === 'installed' ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="text-base font-bold text-[#1C1917]">
                {t('تم تثبيت جوار بنجاح!', 'Gowar Installed Successfully!')}
              </p>
              <p className="text-xs text-[#6E6A66] mt-1">
                {t('يمكنك الآن فتحه من الشاشة الرئيسية.', 'You can now launch it from your home screen.')}
              </p>
            </div>
          ) : showIosInstructions ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-[#FAF9F7] border border-[#EAE6E1] p-4 space-y-3 text-start">
                <p className="text-xs font-bold text-[#1C1917]">
                  {t('خطوات التثبيت على آيفون وآيباد (Safari):', 'How to install on iPhone & iPad (Safari):')}
                </p>

                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-[#E6F5EC] text-[#1B8E53] text-xs font-extrabold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm text-[#1C1917] font-medium">
                    <span>{t('اضغط على زر المشاركة', 'Tap the Share button')}</span>
                    <Share className="w-4 h-4 text-[#1B8E53] shrink-0" />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-[#E6F5EC] text-[#1B8E53] text-xs font-extrabold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm text-[#1C1917] font-medium">
                    <span>{t('اختر "إضافة إلى الشاشة الرئيسية"', 'Select "Add to Home Screen"')}</span>
                    <PlusSquare className="w-4 h-4 text-[#1B8E53] shrink-0" />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-[#E6F5EC] text-[#1B8E53] text-xs font-extrabold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span className="text-xs sm:text-sm text-[#1C1917] font-medium">
                    {t('اضغط "إضافة" في أعلى الشاشة', 'Tap "Add"')}
                  </span>
                </div>
              </div>

              <button
                ref={primaryActionRef}
                type="button"
                onClick={handleDismiss}
                className="w-full py-3 px-4 rounded-2xl text-sm font-bold text-[#1C1917] bg-[#FAF9F7] hover:bg-[#F2EFEA] border border-[#EAE6E1] transition-all duration-150 active:scale-[0.98]"
              >
                {t('ربما لاحقاً', 'Maybe Later')}
              </button>
            </div>
          ) : showManualBrowserInstructions ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-[#FAF9F7] border border-[#EAE6E1] p-4 space-y-2 text-start">
                <p className="text-xs font-bold text-[#1C1917]">
                  {t('خطوات التثبيت من المتصفح:', 'How to install from your browser:')}
                </p>
                <p className="text-xs text-[#6E6A66] leading-relaxed">
                  {t(
                    'افتح قائمة المتصفح (⋮) أو أيقونة التثبيت في شريط العنوان ثم اختر "تثبيت التطبيق" أو "الإضافة إلى الشاشة الرئيسية".',
                    'Open your browser menu (⋮) or click the install icon in the address bar, then select "Install app" or "Add to Home screen".'
                  )}
                </p>
              </div>
              <button
                ref={primaryActionRef}
                type="button"
                onClick={() => {
                  recordInstalledPortal(portal);
                  handleDismiss();
                }}
                className="w-full py-3 px-4 rounded-2xl text-sm font-bold text-[#1C1917] bg-[#FAF9F7] hover:bg-[#F2EFEA] border border-[#EAE6E1] transition-all duration-150 active:scale-[0.98]"
              >
                {t('حسناً، فهمت', 'Got it')}
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <button
                ref={primaryActionRef}
                type="button"
                disabled={installState === 'installing'}
                onClick={handleInstallClick}
                className="pwa-cta-attention w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#1B8E53] to-[#22A863] hover:from-[#147242] hover:to-[#1B8E53] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-70"
              >
                <Download className="w-5 h-5 shrink-0" />
                <span>
                  {installState === 'installing'
                    ? t('جاري التثبيت...', 'Installing...')
                    : t('ثبّت جوار الآن', 'Install Gowar Now')}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="w-full py-2.5 px-4 rounded-2xl text-sm font-semibold text-[#6E6A66] hover:text-[#1C1917] hover:bg-[#FAF9F7] transition-colors duration-150 active:scale-[0.99]"
              >
                {t('ربما لاحقاً', 'Maybe Later')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
