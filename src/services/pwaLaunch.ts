export const PWA_LAUNCH_SHOWN_KEY = 'gowar_pwa_launch_shown_v1';
export const PWA_SPLASH_HOLD_MS = 740;
export const PWA_SPLASH_FADE_MS = 320;
export const PWA_SPLASH_FAILSAFE_MS = 1400;

export interface LaunchStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PwaLaunchCheckInput {
  standalone: boolean;
  prefersReducedMotion: boolean;
  storage: LaunchStorageLike | null;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function getLaunchSessionStorage(): LaunchStorageLike | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Determines whether the in-app PWA launch animation should play.
 * - Only runs in installed standalone PWA mode (not normal browser tabs).
 * - Runs at most once per PWA launch session (sessionStorage prevents replay on refresh/re-renders).
 * - Respects `prefers-reduced-motion: reduce`.
 */
export function shouldPlayPwaLaunchSplash(input: PwaLaunchCheckInput): boolean {
  if (!input.standalone) return false;
  if (input.prefersReducedMotion) return false;
  if (!input.storage) return true;

  try {
    if (input.storage.getItem(PWA_LAUNCH_SHOWN_KEY) === '1') {
      return false;
    }
    input.storage.setItem(PWA_LAUNCH_SHOWN_KEY, '1');
    return true;
  } catch {
    return true;
  }
}
