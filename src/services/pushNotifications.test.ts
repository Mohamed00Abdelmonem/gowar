import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PUSH_PROMPT_COOLDOWN_MS,
  isIosDevice,
  isPushPromptDismissedRecently,
  recordPushPromptDismissal,
  urlBase64ToUint8Array,
  type PushStorageLike,
} from './pushUtils.ts';

function createMemoryStorage(): PushStorageLike {
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

test('urlBase64ToUint8Array decodes VAPID public key cleanly', () => {
  const arr = urlBase64ToUint8Array('AQIDBA');
  assert.deepEqual(Array.from(arr), [1, 2, 3, 4]);
});

test('isPushPromptDismissedRecently enforces 14-day cooldown', () => {
  const storage = createMemoryStorage();
  const t0 = 1_700_000_000_000;

  assert.equal(isPushPromptDismissedRecently(t0, storage), false);
  recordPushPromptDismissal(t0, storage);
  assert.equal(isPushPromptDismissedRecently(t0 + 5000, storage), true);
  assert.equal(isPushPromptDismissedRecently(t0 + PUSH_PROMPT_COOLDOWN_MS - 1, storage), true);
  assert.equal(isPushPromptDismissedRecently(t0 + PUSH_PROMPT_COOLDOWN_MS, storage), false);
});

test('isIosDevice identifies iPhone and iPadOS touch devices', () => {
  assert.equal(
    isIosDevice(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      5
    ),
    true
  );
  assert.equal(
    isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5),
    true
  );
  assert.equal(
    isIosDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0', 0),
    false
  );
});
