import test from 'node:test';
import assert from 'node:assert/strict';
import { PWA_LAUNCH_SHOWN_KEY, shouldPlayPwaLaunchSplash } from './pwaLaunch.ts';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };
}

test('does not play launch splash in normal browser tabs', () => {
  const storage = createMemoryStorage();
  const result = shouldPlayPwaLaunchSplash({
    standalone: false,
    prefersReducedMotion: false,
    storage,
  });
  assert.equal(result, false);
  assert.equal(storage.getItem(PWA_LAUNCH_SHOWN_KEY), null);
});

test('plays once on fresh standalone PWA launch and skips on refresh/re-mount', () => {
  const storage = createMemoryStorage();
  const firstLaunch = shouldPlayPwaLaunchSplash({
    standalone: true,
    prefersReducedMotion: false,
    storage,
  });
  const refreshOrRemount = shouldPlayPwaLaunchSplash({
    standalone: true,
    prefersReducedMotion: false,
    storage,
  });
  assert.equal(firstLaunch, true);
  assert.equal(refreshOrRemount, false);
  assert.equal(storage.getItem(PWA_LAUNCH_SHOWN_KEY), '1');
});

test('replays after closing and reopening PWA (fresh sessionStorage)', () => {
  const firstSession = createMemoryStorage();
  const secondSession = createMemoryStorage();

  assert.equal(
    shouldPlayPwaLaunchSplash({
      standalone: true,
      prefersReducedMotion: false,
      storage: firstSession,
    }),
    true
  );
  assert.equal(
    shouldPlayPwaLaunchSplash({
      standalone: true,
      prefersReducedMotion: false,
      storage: secondSession,
    }),
    true
  );
});

test('respects prefers-reduced-motion by skipping motion splash', () => {
  const storage = createMemoryStorage();
  const result = shouldPlayPwaLaunchSplash({
    standalone: true,
    prefersReducedMotion: true,
    storage,
  });
  assert.equal(result, false);
});
