import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PWA_COOLDOWN_MS,
  isAppMarkedInstalled,
  isExcludedPwaRoute,
  isInstallDismissedRecently,
  isIosSafari,
  markAppInstalled,
  recordInstallDismissal,
  shouldShowInstallModal,
  type StorageLike,
} from './pwaInstall.ts';

function createMemoryStorage(): StorageLike {
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

test('isExcludedPwaRoute excludes admin and merchant portals but allows customer routes', () => {
  assert.equal(isExcludedPwaRoute('/admin'), true);
  assert.equal(isExcludedPwaRoute('/admin/orders'), true);
  assert.equal(isExcludedPwaRoute('/merchant'), true);
  assert.equal(isExcludedPwaRoute('/merchant/login'), true);

  assert.equal(isExcludedPwaRoute('/'), false);
  assert.equal(isExcludedPwaRoute('/stores'), false);
  assert.equal(isExcludedPwaRoute('/stores/abc'), false);
  assert.equal(isExcludedPwaRoute('/cart'), false);
  assert.equal(isExcludedPwaRoute('/orders/123'), false);
});

test('7-day dismissal cooldown blocks prompt within 7 days and allows after 7 days', () => {
  const storage = createMemoryStorage();
  const t0 = 1_700_000_000_000;

  assert.equal(isInstallDismissedRecently(t0, storage), false);

  recordInstallDismissal(t0, storage);
  assert.equal(isInstallDismissedRecently(t0 + 1000, storage), true);
  assert.equal(isInstallDismissedRecently(t0 + PWA_COOLDOWN_MS - 1, storage), true);
  assert.equal(isInstallDismissedRecently(t0 + PWA_COOLDOWN_MS, storage), false);
});

test('isIosSafari detects iPhone/iPad Safari and excludes Chrome/Edge/Firefox on iOS and Android', () => {
  const iphoneSafari =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const iphoneChrome =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1';
  const androidChrome =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
  const ipadDesktopUa =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

  assert.equal(isIosSafari(iphoneSafari, 5), true);
  assert.equal(isIosSafari(ipadDesktopUa, 5), true);
  assert.equal(isIosSafari(iphoneChrome, 5), false);
  assert.equal(isIosSafari(androidChrome, 5), false);
  assert.equal(isIosSafari(ipadDesktopUa, 0), false);
});

test('shouldShowInstallModal enforces standalone, installed, cooldown, session, route, and capability checks', () => {
  const storage = createMemoryStorage();
  assert.equal(isAppMarkedInstalled(storage), false);

  const base = {
    pathname: '/',
    standalone: false,
    installed: false,
    dismissedRecently: false,
    shownThisSession: false,
    hasNativePrompt: true,
    iosSafari: false,
  };

  assert.equal(shouldShowInstallModal(base), true);
  assert.equal(shouldShowInstallModal({ ...base, hasNativePrompt: false, iosSafari: true }), true);
  assert.equal(shouldShowInstallModal({ ...base, hasNativePrompt: false, iosSafari: false }), false);
  assert.equal(shouldShowInstallModal({ ...base, standalone: true }), false);
  assert.equal(shouldShowInstallModal({ ...base, installed: true }), false);
  assert.equal(shouldShowInstallModal({ ...base, dismissedRecently: true }), false);
  assert.equal(shouldShowInstallModal({ ...base, shownThisSession: true }), false);
  assert.equal(shouldShowInstallModal({ ...base, pathname: '/admin/merchants' }), false);

  markAppInstalled(storage);
  assert.equal(isAppMarkedInstalled(storage), true);
});
