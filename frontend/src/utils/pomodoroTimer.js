const DEFAULT_MINUTES = 25;

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

  notify();
};

const tick = () => {
  if (!state.isRunning) return;

  const next = Math.max(0, Number(state.remainingSeconds) - 1);
  state.remainingSeconds = next;

  if (next === 0) {
    completeSession();
    return;
  }

  notify();
};

const ensureInterval = () => {
  if (timerId || !state.isRunning) return;
  timerId = setInterval(tick, 1000);
};

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
    ensureInterval();
    notify();
  },

  pause() {
    if (!state.isRunning) return;
    stopInterval();
    state.isRunning = false;
    state.isPaused = true;
    notify();
  },

  resume() {
    if (!state.isPaused) return;
    state.isRunning = true;
    state.isPaused = false;
    ensureInterval();
    notify();
  },

  reset() {
    stopInterval();
    const minutes = Math.max(1, Number(state.focusMinutes) || DEFAULT_MINUTES);
    state.sessionDurationMinutes = minutes;
    state.remainingSeconds = minutes * 60;
    state.isRunning = false;
    state.isPaused = false;
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
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    pomodoroTimer.stopForWebsiteExit();
  });
}
