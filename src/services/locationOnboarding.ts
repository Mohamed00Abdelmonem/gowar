export const LOCATION_ONBOARDING_DONE_KEY = 'gowar_location_onboarding_done_v1';
export const UI_CUSTOMER_LOCATION_KEY = 'gowar_ui_customer_location_v1';

export interface OnboardingStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getSafeLocalStorage(): OnboardingStorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function hasCompletedLocationOnboarding(
  storage: OnboardingStorageLike | null = getSafeLocalStorage()
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(LOCATION_ONBOARDING_DONE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markLocationOnboardingCompleted(
  storage: OnboardingStorageLike | null = getSafeLocalStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(LOCATION_ONBOARDING_DONE_KEY, 'true');
  } catch {
    // Ignore storage quota errors
  }
}

export function hasSavedCustomerLocation(
  storage: OnboardingStorageLike | null = getSafeLocalStorage(),
  customerAddressCount = 0,
  locationSource?: string
): boolean {
  if (customerAddressCount > 0) return true;
  if (locationSource === 'gps' || locationSource === 'map_pin' || locationSource === 'geocoded') {
    return true;
  }
  if (!storage) return false;
  try {
    const raw = storage.getItem(UI_CUSTOMER_LOCATION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown };
    return typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number';
  } catch {
    return false;
  }
}

export interface LocationOnboardingInput {
  pathname: string;
  userRole?: string | null;
  onboardingDone: boolean;
  hasSavedLocation: boolean;
}

export function shouldShowLocationOnboarding(input: LocationOnboardingInput): boolean {
  const path = input.pathname.trim().toLowerCase();
  if (
    path.startsWith('/merchant') ||
    path.startsWith('/admin') ||
    path === '/login' ||
    path === '/register'
  ) {
    return false;
  }
  if (input.userRole === 'merchant' || input.userRole === 'admin') {
    return false;
  }
  if (input.onboardingDone || input.hasSavedLocation) {
    return false;
  }
  return true;
}

export type GeolocationIssueKind =
  | 'insecure_context'
  | 'unsupported'
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'unknown';

export function classifyGeolocationError(
  errorCode: number | null,
  isSecureContext: boolean,
  hasGeolocationApi: boolean,
  isLocalhost = false
): GeolocationIssueKind {
  if (!isSecureContext && !isLocalhost) return 'insecure_context';
  if (!hasGeolocationApi) return 'unsupported';
  if (errorCode === 1) return 'permission_denied';
  if (errorCode === 2) return 'position_unavailable';
  if (errorCode === 3) return 'timeout';
  return 'unknown';
}
