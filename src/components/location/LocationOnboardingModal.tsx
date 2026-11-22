import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertCircle, Loader2, MapPin, Navigation, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getStoredApiUser } from '../../services/apiClient';
import { inferNearestArea, reverseGeocodeCoordinates } from '../../services/locationService';
import {
  classifyGeolocationError,
  hasCompletedLocationOnboarding,
  hasSavedCustomerLocation,
  markLocationOnboardingCompleted,
  shouldShowLocationOnboarding,
  type GeolocationIssueKind,
} from '../../services/locationOnboarding';

interface LocationOnboardingModalProps {
  onOpenManualPicker: () => void;
}

export const LocationOnboardingModal: React.FC<LocationOnboardingModalProps> = ({
  onOpenManualPicker,
}) => {
  const { pathname } = useLocation();
  const {
    language,
    t,
    areas,
    activeCustomer,
    authSession,
    customerLocation,
    confirmCustomerLocation,
    showToast,
  } = useApp();

  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [issue, setIssue] = useState<GeolocationIssueKind | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);

  const userRole = authSession?.role ?? getStoredApiUser()?.role ?? null;

  // Show after initial page has rendered (never during initial load) when eligible
  useEffect(() => {
    if (open) return;

    const eligible = shouldShowLocationOnboarding({
      pathname,
      userRole,
      onboardingDone: hasCompletedLocationOnboarding(),
      hasSavedLocation: hasSavedCustomerLocation(
        undefined,
        activeCustomer?.addresses?.length ?? 0,
        customerLocation.source
      ),
    });

    if (!eligible) return;

    const timer = window.setTimeout(() => {
      const stillEligible = shouldShowLocationOnboarding({
        pathname,
        userRole,
        onboardingDone: hasCompletedLocationOnboarding(),
        hasSavedLocation: hasSavedCustomerLocation(
          undefined,
          activeCustomer?.addresses?.length ?? 0,
          customerLocation.source
        ),
      });
      if (stillEligible) {
        setOpen(true);
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [pathname, userRole, activeCustomer?.addresses?.length, customerLocation.source, open]);

  const handleDismiss = useCallback(() => {
    markLocationOnboardingCompleted();
    setOpen(false);
  }, []);

  const handleChooseManually = useCallback(() => {
    markLocationOnboardingCompleted();
    setOpen(false);
    onOpenManualPicker();
  }, [onOpenManualPicker]);

  useEffect(() => {
    if (!open) return;
    const tId = window.setTimeout(() => primaryBtnRef.current?.focus(), 60);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(tId);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, handleDismiss]);

  const requestCurrentLocation = async () => {
    setIssue(null);

    const isLocalhost =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const hasGeo = typeof navigator !== 'undefined' && 'geolocation' in navigator;

    if (!window.isSecureContext && !isLocalhost) {
      setIssue('insecure_context');
      return;
    }

    if (!hasGeo) {
      setIssue('unsupported');
      return;
    }

    // Do not repeatedly trigger native prompt if permission was already denied
    if (navigator.permissions?.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state === 'denied') {
          setIssue('permission_denied');
          return;
        }
      } catch {
        // Ignore Permissions API errors on unsupported browsers
      }
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        const nearestArea = inferNearestArea({ lat, lng }, areas);
        const fallbackAr = nearestArea
          ? `${nearestArea.nameAr} (${lat.toFixed(4)}, ${lng.toFixed(4)})`
          : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        const fallbackEn = nearestArea
          ? `${nearestArea.nameEn} (${lat.toFixed(4)}, ${lng.toFixed(4)})`
          : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

        const rev = await reverseGeocodeCoordinates({ lat, lng }, language);
        const labelAr = rev.ok ? rev.label : fallbackAr;
        const labelEn = rev.ok ? rev.label : fallbackEn;

        await confirmCustomerLocation({
          lat,
          lng,
          formattedAddressAr: labelAr,
          formattedAddressEn: labelEn,
          areaId: nearestArea?.id,
          selectedAddressId: null,
          source: 'gps',
        });

        markLocationOnboardingCompleted();
        setLocating(false);
        setOpen(false);
        showToast(
          t('تم تحديد موقعك وعرض المحلات القريبة منك!', 'Location saved! Showing nearby stores.'),
          'success'
        );
      },
      (err) => {
        setLocating(false);
        setIssue(
          classifyGeolocationError(err.code, window.isSecureContext, hasGeo, isLocalhost)
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  if (!open) return null;

  const isRtl = language === 'ar';

  const getIssueMessage = (kind: GeolocationIssueKind): string => {
    switch (kind) {
      case 'permission_denied':
        return t(
          'تم رفض إذن الوصول للموقع. يمكنك تفعيله من إعدادات المتصفح (أيقونة القفل بجانب الرابط) أو تحديد موقعك يدوياً على الخريطة.',
          'Location permission was denied. Enable it in your browser site settings or pick your location manually on the map.'
        );
      case 'position_unavailable':
        return t(
          'تعذر تحديد موقعك بدقة حالياً. يمكنك المحاولة مرة أخرى أو اختيار موقعك يدوياً على الخريطة.',
          'Your location is currently unavailable. Please retry or select your spot manually on the map.'
        );
      case 'timeout':
        return t(
          'انتهت مهلة تحديد الموقع. تأكد من تفعيل GPS وحاول مرة أخرى أو اختر موقعك يدوياً.',
          'Location request timed out. Please try again or select your location manually.'
        );
      case 'insecure_context':
        return t(
          'تحديد الموقع التلقائي يتطلب اتصال HTTPS آمن. يمكنك تحديد موقعك بسهولة على الخريطة الآن.',
          'Automatic GPS requires HTTPS. You can easily pick your location manually on the map.'
        );
      case 'unsupported':
      default:
        return t(
          'متصفحك لا يدعم تحديد الموقع التلقائي. يمكنك تحديد موقعك يدوياً على الخريطة بسهولة.',
          'Your browser does not support automatic geolocation. Please select your location manually on the map.'
        );
    }
  };

  const canRetry = issue === 'position_unavailable' || issue === 'timeout' || issue === 'unknown';

  return (
    <div
      className="pwa-overlay-animate fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1C1917]/60 backdrop-blur-sm"
      onClick={handleDismiss}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="loc-onboarding-title"
        aria-describedby="loc-onboarding-desc"
        dir={isRtl ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
        className="pwa-modal-animate relative w-full max-w-[430px] rounded-3xl bg-white border border-[#EAE6E1] shadow-[0_24px_60px_-12px_rgba(28,25,23,0.35)] overflow-hidden"
      >
        <div className="relative px-6 pt-8 pb-5 bg-gradient-to-b from-[#FFF2EB] via-[#FFF9F5] to-white text-center">
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t('إغلاق', 'Close')}
            className={`absolute top-4 ${
              isRtl ? 'left-4' : 'right-4'
            } w-9 h-9 rounded-full flex items-center justify-center text-[#6E6A66] bg-white/85 hover:bg-white hover:text-[#1C1917] border border-[#EAE6E1]/80 shadow-xs transition-all`}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Animated Map Pin Illustration */}
          <div className="relative mx-auto w-24 h-24 mb-4 flex items-center justify-center">
            <div className="absolute inset-2 rounded-full bg-[#D6450D]/15 animate-ping" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#FFF2EB] to-[#FFE4D4] border border-[#FBD8C5]" />
            <div className="pwa-icon-float relative w-14 h-14 rounded-2xl bg-gradient-to-br from-[#D6450D] to-[#F47B20] text-white shadow-[0_12px_24px_-6px_rgba(214,69,13,0.45)] flex items-center justify-center">
              <MapPin className="w-7 h-7" />
            </div>
          </div>

          <h2
            id="loc-onboarding-title"
            className="text-xl sm:text-2xl font-extrabold text-[#1C1917] leading-snug"
          >
            {t('خلّي المحلات القريبة منك توصلك!', 'Let Nearby Stores Come to You!')}
          </h2>

          <p
            id="loc-onboarding-desc"
            className="mt-2.5 text-sm text-[#6E6A66] leading-relaxed max-w-sm mx-auto"
          >
            {t(
              'اسمح لـ Gowar بالوصول لموقعك عشان نعرضلك المحلات والسوبر ماركت الأقرب ليك، وتطلب احتياجاتك بسهولة.',
              'Allow Gowar to access your location so we can show you the closest grocery stores and supermarkets around you.'
            )}
          </p>
        </div>

        <div className="px-6 pb-6 pt-1 space-y-3">
          {issue && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-start flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 leading-relaxed">{getIssueMessage(issue)}</p>
            </div>
          )}

          {canRetry ? (
            <button
              ref={primaryBtnRef}
              type="button"
              disabled={locating}
              onClick={requestCurrentLocation}
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#D6450D] to-[#F47B20] hover:from-[#B33808] hover:to-[#D6450D] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {locating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>{t('إعادة المحاولة', 'Try Again')}</span>
            </button>
          ) : issue === null ? (
            <button
              ref={primaryBtnRef}
              type="button"
              disabled={locating}
              onClick={requestCurrentLocation}
              className="pwa-cta-attention w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#D6450D] to-[#F47B20] hover:from-[#B33808] hover:to-[#D6450D] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-70"
            >
              {locating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
              <span>
                {locating
                  ? t('جاري تحديد موقعك...', 'Detecting your location...')
                  : t('السماح بالوصول للموقع', 'Allow Location Access')}
              </span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleChooseManually}
            className={`w-full py-3 px-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
              issue && !canRetry
                ? 'bg-[#D6450D] hover:bg-[#B33808] text-white shadow-sm'
                : 'bg-[#FAF9F7] hover:bg-[#F2EFEA] text-[#1C1917] border border-[#EAE6E1]'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>{t('هحدد موقعي بنفسي', "I'll Choose Manually")}</span>
          </button>

          <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-[#6E6A66]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              {t(
                'موقعك بنستخدمه عشان نحدد المحلات القريبة منك، وتقدر تغيّره في أي وقت.',
                'We only use your location to find nearby stores, and you can change it anytime.'
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
