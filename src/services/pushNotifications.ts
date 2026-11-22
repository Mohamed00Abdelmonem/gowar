import { getAccessToken, IS_BACKEND_API_ENABLED } from './apiClient';
import { marketplaceApi } from './gowarApi';
import {
  getBrowserNotificationPermission,
  getWebPushSupportStatus,
  recordPushPromptDismissal,
  urlBase64ToUint8Array,
} from './pushUtils';

export {
  PUSH_PROMPT_COOLDOWN_MS,
  PUSH_PROMPT_DISMISSED_AT_KEY,
  getBrowserNotificationPermission,
  getWebPushSupportStatus,
  isIosDevice,
  isPushPromptDismissedRecently,
  recordPushPromptDismissal,
  urlBase64ToUint8Array,
  type PushSupportStatus,
} from './pushUtils';

function serializePushSubscription(sub: PushSubscription): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} | null {
  const json = sub.toJSON();
  const endpoint = json.endpoint || sub.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, keys: { p256dh, auth } };
}

export type EnablePushResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'denied' | 'unsupported' | 'requires_https' | 'requires_ios_install' | 'not_configured' | 'failed';
    };

export async function enableWebPushNotifications(language: 'ar' | 'en'): Promise<EnablePushResult> {
  const support = getWebPushSupportStatus();
  if (support !== 'supported') {
    return { ok: false, reason: support };
  }

  if (!IS_BACKEND_API_ENABLED || !getAccessToken()) {
    return { ok: false, reason: 'failed' };
  }

  let config: { enabled: boolean; vapid_public_key: string };
  try {
    config = await marketplaceApi.fetchPushConfig();
  } catch {
    return { ok: false, reason: 'failed' };
  }

  if (!config.enabled || !config.vapid_public_key) {
    return { ok: false, reason: 'not_configured' };
  }

  const permission = await window.Notification.requestPermission();
  if (permission !== 'granted') {
    if (permission === 'denied') {
      recordPushPromptDismissal();
    }
    return { ok: false, reason: 'denied' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key),
      });
    }

    const serialized = serializePushSubscription(subscription);
    if (!serialized) {
      return { ok: false, reason: 'failed' };
    }

    await marketplaceApi.registerPushSubscription({
      ...serialized,
      language,
    });
    await marketplaceApi.updatePushPreferences({ push_enabled: true });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export async function disableWebPushNotifications(): Promise<void> {
  try {
    if (IS_BACKEND_API_ENABLED && getAccessToken()) {
      await marketplaceApi.updatePushPreferences({ push_enabled: false }).catch(() => undefined);
    }
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) {
        if (IS_BACKEND_API_ENABLED && getAccessToken()) {
          await marketplaceApi
            .unregisterPushSubscription(subscription.endpoint)
            .catch(() => undefined);
        }
        await subscription.unsubscribe().catch(() => undefined);
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

export async function cleanupPushSubscriptionOnLogout(): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return;

    if (IS_BACKEND_API_ENABLED && getAccessToken()) {
      await marketplaceApi
        .unregisterPushSubscription(subscription.endpoint)
        .catch(() => undefined);
    }
  } catch {
    // Never block logout
  }
}

export async function syncExistingPushSubscription(language: 'ar' | 'en'): Promise<boolean> {
  try {
    if (!IS_BACKEND_API_ENABLED || !getAccessToken()) return false;
    if (getWebPushSupportStatus() !== 'supported') return false;
    if (getBrowserNotificationPermission() !== 'granted') return false;

    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return false;

    const serialized = serializePushSubscription(subscription);
    if (!serialized) return false;

    await marketplaceApi.registerPushSubscription({
      ...serialized,
      language,
    });
    return true;
  } catch {
    return false;
  }
}
