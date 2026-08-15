const STORAGE_KEY = "fade-signal:timerSettings";

export interface TimerSettings {
  enabled: boolean;
  durationSeconds: number;
  soundEnabled: boolean;
}

const DEFAULT: TimerSettings = { enabled: false, durationSeconds: 90, soundEnabled: true };

export function loadTimerSettings(): TimerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function saveTimerSettings(settings: TimerSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
