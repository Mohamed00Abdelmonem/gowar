export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWA_DISMISSED_AT_KEY = 'gowar_pwa_dismissed_at_v1';
export const PWA_INSTALLED_KEY = 'gowar_pwa_installed_v1';
export const PWA_SESSION_SHOWN_KEY = 'gowar_pwa_session_shown_v1';
export const PWA_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const PWA_SHOW_DELAY_MS = 2500;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getSafeStorage(kind: 'local' | 'session'): StorageLike | null {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) {
      return true;
    }
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) {
      return true;
    }
    if (typeof document !== 'undefined' && document.referrer.startsWith('android-app://')) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function isIosSafari(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0
): boolean {
  if (!userAgent) return false;
  const isIosDevice =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  if (!isIosDevice) return false;

  const isSafariEngine = /Safari/i.test(userAgent);
  const isOtherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser/i.test(userAgent);
  return isSafariEngine && !isOtherIosBrowser;
}

export function isExcludedPwaRoute(pathname: string): boolean {
  const normalized = pathname.trim().toLowerCase();
  return (
    normalized === '/admin' ||
    normalized.startsWith('/admin/') ||
    normalized === '/merchant' ||
    normalized.startsWith('/merchant/')
  );
}

export function isInstallDismissedRecently(
  nowMs = Date.now(),
  storage: StorageLike | null = getSafeStorage('local')
): boolean {
  if (!storage) return false;
  try {
    const raw = storage.getItem(PWA_DISMISSED_AT_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) return false;
    return nowMs - dismissedAt < PWA_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function recordInstallDismissal(
  nowMs = Date.now(),
  storage: StorageLike | null = getSafeStorage('local')
): void {
  if (!storage) return;
  try {
    storage.setItem(PWA_DISMISSED_AT_KEY, String(nowMs));
  } catch {
    // Ignore storage quota errors
  }
}

export function isAppMarkedInstalled(
  storage: StorageLike | null = getSafeStorage('local')
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(PWA_INSTALLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markAppInstalled(
  storage: StorageLike | null = getSafeStorage('local')
): void {
  if (!storage) return;
  try {
    storage.setItem(PWA_INSTALLED_KEY, 'true');
  } catch {
    // Ignore storage quota errors
  }
}

export function wasShownInSession(
  storage: StorageLike | null = getSafeStorage('session')
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(PWA_SESSION_SHOWN_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markShownInSession(
  storage: StorageLike | null = getSafeStorage('session')
): void {
  if (!storage) return;
  try {
    storage.setItem(PWA_SESSION_SHOWN_KEY, 'true');
  } catch {
    // Ignore
  }
}

export interface InstallEligibilityInput {
  pathname: string;
  standalone: boolean;
  installed: boolean;
  dismissedRecently: boolean;
  shownThisSession: boolean;
  hasNativePrompt: boolean;
  iosSafari: boolean;
}

export function shouldShowInstallModal(input: InstallEligibilityInput): boolean {
  if (input.standalone || input.installed) return false;
  if (input.dismissedRecently || input.shownThisSession) return false;
  if (isExcludedPwaRoute(input.pathname)) return false;
  return input.hasNativePrompt || input.iosSafari;
}

let swRegistrationStarted = false;

export function registerPwaServiceWorker(): void {
  if (swRegistrationStarted) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!window.isSecureContext && !isLocalhost) return;

  swRegistrationStarted = true;
  const register = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Service worker registration failed; app continues normally without offline cache
    });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}
