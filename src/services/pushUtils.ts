export const PUSH_PROMPT_DISMISSED_AT_KEY = 'gowar_push_prompt_dismissed_at_v1';
export const PUSH_PROMPT_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

export type PushSupportStatus =
  | 'supported'
  | 'requires_https'
  | 'requires_ios_install'
  | 'unsupported';

export interface PushStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getLocalStorage(): PushStorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function isIosDevice(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0
): boolean {
  if (!userAgent) return false;
  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  );
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) return true;
    if (typeof document !== 'undefined' && document.referrer.startsWith('android-app://')) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function getWebPushSupportStatus(): PushSupportStatus {
  if (typeof window === 'undefined') return 'unsupported';

  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!window.isSecureContext && !isLocalhost) {
    return 'requires_https';
  }

  // iOS Safari 16.4+ only supports Web Push when installed to Home Screen (standalone)
  if (isIosDevice() && !isStandaloneDisplayMode()) {
    return 'requires_ios_install';
  }

  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return 'unsupported';
  }

  return 'supported';
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission;
}

export function isPushPromptDismissedRecently(
  nowMs = Date.now(),
  storage: PushStorageLike | null = getLocalStorage()
): boolean {
  if (!storage) return false;
  try {
    const raw = storage.getItem(PUSH_PROMPT_DISMISSED_AT_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts) || ts <= 0) return false;
    return nowMs - ts < PUSH_PROMPT_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function recordPushPromptDismissal(
  nowMs = Date.now(),
  storage: PushStorageLike | null = getLocalStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(PUSH_PROMPT_DISMISSED_AT_KEY, String(nowMs));
  } catch {
    // Ignore storage errors
  }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
