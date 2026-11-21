const SOUND_PREF_KEY = 'gowar_notif_sound_v1';

let sharedAudioCtx: AudioContext | null = null;
let listenersAttached = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  return sharedAudioCtx;
}

export function initAudioUnlockListeners(): void {
  if (typeof window === 'undefined' || listenersAttached) return;
  listenersAttached = true;
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

export function isNotificationSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SOUND_PREF_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_PREF_KEY, String(enabled));
  } catch {
    // Ignore storage quota errors
  }
}

export function playNotificationSound(
  audience: 'merchant' | 'customer' | 'admin' = 'customer',
  force = false
): void {
  if (!force && !isNotificationSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const notes =
    audience === 'merchant'
      ? [
          { freq: 880, start: 0, dur: 0.12 },
          { freq: 1174.66, start: 0.14, dur: 0.18 },
        ]
      : [
          { freq: 659.25, start: 0, dur: 0.13 },
          { freq: 880, start: 0.13, dur: 0.2 },
        ];

  for (const n of notes) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.start);

      gain.gain.setValueAtTime(0.0001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.02);
    } catch {
      // Ignore Web Audio errors when autoplay is restricted before interaction
    }
  }
}
