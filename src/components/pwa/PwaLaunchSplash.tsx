import React, { useEffect, useState } from 'react';
import gowarIcon from '../../assets/gowar-icon.png';
import { isStandaloneMode } from '../../services/pwaInstall';
import {
  getLaunchSessionStorage,
  PWA_SPLASH_FADE_MS,
  PWA_SPLASH_FAILSAFE_MS,
  PWA_SPLASH_HOLD_MS,
  prefersReducedMotion,
  shouldPlayPwaLaunchSplash,
} from '../../services/pwaLaunch';

export const PwaLaunchSplash: React.FC = () => {
  const [visible, setVisible] = useState<boolean>(() =>
    shouldPlayPwaLaunchSplash({
      standalone: isStandaloneMode(),
      prefersReducedMotion: prefersReducedMotion(),
      storage: getLaunchSessionStorage(),
    })
  );
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;

    const fadeTimer = window.setTimeout(() => {
      setFadingOut(true);
    }, PWA_SPLASH_HOLD_MS);

    const unmountTimer = window.setTimeout(() => {
      setVisible(false);
    }, PWA_SPLASH_HOLD_MS + PWA_SPLASH_FADE_MS);

    const failsafeTimer = window.setTimeout(() => {
      setVisible(false);
    }, PWA_SPLASH_FAILSAFE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(unmountTimer);
      window.clearTimeout(failsafeTimer);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#FAF9F7] select-none transition-opacity duration-300 ease-out ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Subtle brand ambient glow matching Gowar primary light token */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-80"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(27, 142, 83, 0.10), transparent 75%)',
        }}
      />

      {/* Upper-center balanced logo container */}
      <div className="relative -translate-y-6 flex flex-col items-center gap-3.5">
        <div className="gowar-splash-logo-drop w-20 h-20 sm:w-22 sm:h-22 rounded-[22px] bg-white border border-[#EAE6E1] shadow-md p-2.5 flex items-center justify-center">
          <img
            src={gowarIcon}
            alt="Gowar"
            className="w-full h-full object-contain"
            decoding="sync"
          />
        </div>

        <div className="gowar-splash-wordmark text-center leading-tight">
          <span className="text-xl font-extrabold tracking-tight text-[#1C1917]">جوار</span>
          <span className="mx-1.5 text-sm font-semibold text-[#EAE6E1]">|</span>
          <span className="text-base font-bold tracking-tight text-[#1B8E53]">Gowar</span>
        </div>
      </div>
    </div>
  );
};
