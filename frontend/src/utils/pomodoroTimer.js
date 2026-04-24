const DEFAULT_MINUTES = 25;
const STORAGE_KEY = 'neuranote_pomodoro_state_v1';

let timerId = null;
let completionVersion = 0;
let completedSessions = [];

const subscribers = new Set();

const state = {
  focusMinutes: DEFAULT_MINUTES,
  remainingSeconds: DEFAULT_MINUTES * 60,
  isRunning: false,
  isPaused: false,
  sessionDurationMinutes: DEFAULT_MINUTES,
  endAtMs: null,
  completionVersion,
};

const snapshot = () => ({ ...state });

const notify = () => {
  const value = snapshot();
  subscribers.forEach((listener) => {
    try {
      listener(value);
    } catch {
      // Ignore individual subscriber errors.
    }
  });
};

const persist = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      focusMinutes: state.focusMinutes,
      remainingSeconds: state.remainingSeconds,
      isRunning: state.isRunning,
      isPaused: state.isPaused,
      sessionDurationMinutes: state.sessionDurationMinutes,
      endAtMs: state.endAtMs,
      completionVersion: state.completionVersion,
    }));
  } catch {
    // Ignore persistence errors.
  }
};

const restore = () => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);

    const focusMinutes = Math.max(1, Number(parsed?.focusMinutes) || DEFAULT_MINUTES);
    const sessionDurationMinutes = Math.max(1, Number(parsed?.sessionDurationMinutes) || focusMinutes);
    const endAtMs = Number(parsed?.endAtMs) || null;
    const wasRunning = Boolean(parsed?.isRunning) && !!endAtMs;
    const now = Date.now();

    state.focusMinutes = focusMinutes;
    state.sessionDurationMinutes = sessionDurationMinutes;
    state.completionVersion = Number(parsed?.completionVersion) || completionVersion;
    completionVersion = state.completionVersion;

    if (wasRunning) {
      const remaining = Math.max(0, Math.ceil((endAtMs - now) / 1000));
      if (remaining > 0) {
        state.isRunning = true;
        state.isPaused = false;
        state.endAtMs = endAtMs;
        state.remainingSeconds = remaining;
      } else {
        state.isRunning = false;
        state.isPaused = false;
        state.endAtMs = null;
        state.remainingSeconds = focusMinutes * 60;
      }
    } else {
      state.isRunning = false;
      state.isPaused = Boolean(parsed?.isPaused);
      state.endAtMs = null;
      state.remainingSeconds = Math.max(0, Number(parsed?.remainingSeconds) || focusMinutes * 60);
    }
  } catch {
    // Ignore restore errors and keep defaults.
  }
};

const stopInterval = () => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
};

const completeSession = () => {
  stopInterval();
  state.isRunning = false;
  state.isPaused = false;
  state.endAtMs = null;
  state.remainingSeconds = 0;
  completionVersion += 1;
  state.completionVersion = completionVersion;

  const duration = Number(state.sessionDurationMinutes) || DEFAULT_MINUTES;
  const now = new Date();
  completedSessions.push({
    focus_duration: duration,
    completed_at: now.toISOString(),
    date: now.toISOString().slice(0, 10),
  });

  persist();
  notify();
};

const tick = () => {
  if (!state.isRunning) return;

  const now = Date.now();
  const next = state.endAtMs
    ? Math.max(0, Math.ceil((state.endAtMs - now) / 1000))
    : Math.max(0, Number(state.remainingSeconds) - 1);
  state.remainingSeconds = next;

  if (next === 0) {
    completeSession();
    return;
  }

  persist();
  notify();
};

const ensureInterval = () => {
  if (timerId || !state.isRunning) return;
  timerId = setInterval(tick, 250);
};

restore();
if (state.isRunning) {
  ensureInterval();
}

export const pomodoroTimer = {
  getSnapshot() {
    return snapshot();
  },

  subscribe(listener) {
    subscribers.add(listener);
    listener(snapshot());
    return () => {
      subscribers.delete(listener);
    };
  },

  setFocusMinutes(minutes) {
    const value = Math.max(1, Number(minutes) || DEFAULT_MINUTES);
    state.focusMinutes = value;
    if (!state.isRunning && !state.isPaused) {
      state.sessionDurationMinutes = value;
      state.remainingSeconds = value * 60;
    }
    persist();
    notify();
  },

  start() {
    if (state.isRunning) return;

    const minutes = Math.max(1, Number(state.focusMinutes) || DEFAULT_MINUTES);
    if (!state.remainingSeconds || state.remainingSeconds === 0) {
      state.remainingSeconds = minutes * 60;
    }
    state.sessionDurationMinutes = minutes;
    state.isRunning = true;
    state.isPaused = false;
    state.endAtMs = Date.now() + (state.remainingSeconds * 1000);
    ensureInterval();
    persist();
    notify();
  },

  pause() {
    if (!state.isRunning) return;
    if (state.endAtMs) {
      state.remainingSeconds = Math.max(0, Math.ceil((state.endAtMs - Date.now()) / 1000));
    }
    stopInterval();
    state.isRunning = false;
    state.isPaused = true;
    state.endAtMs = null;
    persist();
    notify();
  },

  resume() {
    if (!state.isPaused) return;
    state.isRunning = true;
    state.isPaused = false;
    state.endAtMs = Date.now() + (Math.max(0, Number(state.remainingSeconds) || 0) * 1000);
    ensureInterval();
    persist();
    notify();
  },

  reset() {
    stopInterval();
    const minutes = Math.max(1, Number(state.focusMinutes) || DEFAULT_MINUTES);
    state.sessionDurationMinutes = minutes;
    state.remainingSeconds = minutes * 60;
    state.isRunning = false;
    state.isPaused = false;
    state.endAtMs = null;
    persist();
    notify();
  },

  takeCompletedSessions() {
    const pending = [...completedSessions];
    completedSessions = [];
    return pending;
  },

  stopForWebsiteExit() {
    stopInterval();
    state.isRunning = false;
    state.isPaused = false;
    state.endAtMs = null;
    persist();
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    pomodoroTimer.stopForWebsiteExit();
  });
}
