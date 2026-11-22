import assert from 'node:assert/strict';
import test from 'node:test';
import {
  UI_CUSTOMER_LOCATION_KEY,
  classifyGeolocationError,
  hasCompletedLocationOnboarding,
  hasSavedCustomerLocation,
  markLocationOnboardingCompleted,
  shouldShowLocationOnboarding,
  type OnboardingStorageLike,
} from './locationOnboarding.ts';

function createMemoryStorage(): OnboardingStorageLike {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

test('first-time customer visit shows onboarding; returning or dismissed customer does not', () => {
  const storage = createMemoryStorage();

  assert.equal(hasCompletedLocationOnboarding(storage), false);
  assert.equal(hasSavedCustomerLocation(storage, 0, 'saved'), false);

  assert.equal(
    shouldShowLocationOnboarding({
      pathname: '/',
      userRole: 'customer',
      onboardingDone: hasCompletedLocationOnboarding(storage),
      hasSavedLocation: hasSavedCustomerLocation(storage, 0, 'saved'),
    }),
    true
  );

  // Dismiss / complete onboarding
  markLocationOnboardingCompleted(storage);
  assert.equal(hasCompletedLocationOnboarding(storage), true);
  assert.equal(
    shouldShowLocationOnboarding({
      pathname: '/',
      userRole: 'customer',
      onboardingDone: hasCompletedLocationOnboarding(storage),
      hasSavedLocation: false,
    }),
    false
  );

  // Returning customer with saved location
  const storage2 = createMemoryStorage();
  storage2.setItem(UI_CUSTOMER_LOCATION_KEY, JSON.stringify({ lat: 30.05, lng: 31.33 }));
  assert.equal(hasSavedCustomerLocation(storage2, 0, 'saved'), true);
  assert.equal(
    shouldShowLocationOnboarding({
      pathname: '/stores',
      userRole: null,
      onboardingDone: false,
      hasSavedLocation: hasSavedCustomerLocation(storage2, 0, 'saved'),
    }),
    false
  );
});

test('merchants, admins, and auth/portal routes never see location onboarding', () => {
  assert.equal(
    shouldShowLocationOnboarding({
      pathname: '/merchant/orders',
      userRole: 'merchant',
      onboardingDone: false,
      hasSavedLocation: false,
    }),
    false
  );
  assert.equal(
    shouldShowLocationOnboarding({
      pathname: '/admin',
      userRole: 'admin',
      onboardingDone: false,
      hasSavedLocation: false,
    }),
    false
  );
  assert.equal(
    shouldShowLocationOnboarding({
      pathname: '/',
      userRole: 'merchant',
      onboardingDone: false,
      hasSavedLocation: false,
    }),
    false
  );
  assert.equal(
    shouldShowLocationOnboarding({
      pathname: '/login',
      userRole: null,
      onboardingDone: false,
      hasSavedLocation: false,
    }),
    false
  );
});

test('classifyGeolocationError handles denied, unavailable, timeout, unsupported, and insecure HTTP', () => {
  assert.equal(classifyGeolocationError(null, false, true, false), 'insecure_context');
  assert.equal(classifyGeolocationError(null, true, false, false), 'unsupported');
  assert.equal(classifyGeolocationError(1, true, true, false), 'permission_denied');
  assert.equal(classifyGeolocationError(2, true, true, false), 'position_unavailable');
  assert.equal(classifyGeolocationError(3, true, true, false), 'timeout');
  assert.equal(classifyGeolocationError(null, false, true, true), 'unknown');
});
