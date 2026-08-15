import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlarmClock, BookOpen, Clock3, Flame,
  Play, Pause, RotateCcw, FileText,
  FolderOpen, ArrowRight, RefreshCw, Quote,
} from 'lucide-react';
import { workspaceApi } from '@/services/workspaceApi';
import { pomodoroTimer } from '@/utils/pomodoroTimer';
import { useTheme } from '@/context/ThemeContext';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const DEFAULT_MINUTES = 25;

const INITIAL_DASHBOARD = {
  today_minutes: 0,
  yesterday_minutes: 0,
  week_minutes: 0,
  current_streak_days: 0,
  best_streak_days: 0,
  motivational_message: 'Focus insights will appear after your first completed session.',
};

// ─────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────

// Normalize backend response → dashboard stats object
const normalizeDashboardStats = (payload) => {
  if (payload?.dashboard && typeof payload.dashboard === 'object') return payload.dashboard;
  if (payload && typeof payload === 'object') return payload;
  return {};
};

// Filter recent files — remove auto-generated children (summaries, extracted text)
const normalizeRecentFiles = (payload) => {
  const rows = Array.isArray(payload)
    ? payload
    : payload?.files ?? [];

  const topLevel = rows.filter((file) => {
    const name = String(file?.original_filename || file?.name || '').toLowerCase();
    const isChild = Boolean(file?.parent_file_id || file?.parentFileId);
    const isGenerated = /extract(ed)? text|summary/.test(name);
    return !isChild && !isGenerated;
  });

  const previewable = topLevel.filter((f) => f?.preview_available !== false);
  return previewable.length > 0 ? previewable : topLevel;
};

// 90 → "1h 30m" | 60 → "1h" | 25 → "25m"
const formatMinutes = (minutes) => {
  const total = Math.max(0, Number(minutes) || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

// 1500 seconds → "25:00"
const formatClock = (totalSeconds) => {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

// ISO date → "Apr 30, 08:45 PM"
const formatLastAccessed = (value) => {
  if (!value) return 'Unknown';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// File path display
const buildFilePath = (file) =>
  file?.folder_path || file?.folder_name || 'No folder path available';

// File type label from metadata or filename extension
const getFileTypeLabel = (file) => {
  const raw = String(file?.file_type || file?.type || '').toUpperCase();
  if (raw) return raw;
  const name = String(file?.original_filename || file?.name || '').toLowerCase();
  if (name.endsWith('.pdf'))  return 'PDF';
  if (name.endsWith('.docx')) return 'DOCX';
  if (name.endsWith('.txt'))  return 'TXT';
  if (name.endsWith('.md'))   return 'MD';
  return 'FILE';
};

// ─────────────────────────────────────────────
// ALARM SOUND (Browser Audio API)
// ─────────────────────────────────────────────
const createAlarm = () => {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;

  const ctx = new Ctor();

  // Play a single beep tone
  const playTone = (freq, start, dur) => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.5, start + 0.05);
    gain.gain.setValueAtTime(0.5, start + dur - 0.05);
    gain.gain.linearRampToValueAtTime(0, start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.1);
  };

  // 3 groups × 3 rapid beeps = classic alarm pattern
  const play = async () => {
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      const now = ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const offset = now + i * 0.8;
        playTone(880, offset,        0.15);
        playTone(880, offset + 0.25, 0.15);
        playTone(880, offset + 0.5,  0.15);
      }
    } catch (e) {
      console.warn('Alarm failed:', e);
    }
  };

  return { play, audioContext: ctx };
};

// ─────────────────────────────────────────────
// STAT CARD COMPONENT
// ─────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, accent, hint, theme, isDark }) => (
  <div style={{
    background   : isDark ? theme.colors.bg.secondary : 'linear-gradient(180deg,#fff 0%,#f8faff 100%)',
    border       : `1px solid ${theme.colors.ui.border}`,
    borderRadius : 18,
    padding      : 18,
    minHeight    : 130,
    boxShadow    : isDark ? '0 10px 30px rgba(0,0,0,0.35)' : '0 10px 30px rgba(15,23,42,0.05)',
  }}>

    {/* Label row */}
    <div style={{ display:'flex', alignItems:'center', gap:10, color:theme.colors.text.secondary, fontWeight:700, fontSize:13, marginBottom:14 }}>
      <span style={{ width:34, height:34, borderRadius:12, display:'inline-flex', alignItems:'center', justifyContent:'center', background:accent, color:'#fff' }}>
        <Icon size={16} />
      </span>
      {label}
    </div>

    {/* Big value */}
    <div style={{ fontSize:30, fontWeight:800, color:theme.colors.text.primary, lineHeight:1.1 }}>
      {value}
    </div>

    {/* Hint */}
    {hint && (
      <div style={{ marginTop:8, color:theme.colors.text.tertiary, fontSize:13, lineHeight:1.5 }}>
        {hint}
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
const ProductivityDashboard = () => {
  const navigate = useNavigate();
  const { theme, isDark } = useTheme();
  const { userScope, loading: userLoading } = useSupabaseUser();

  // Refs (don't trigger re-render)
  const alarmRef             = useRef(null);
  const completionVersionRef = useRef(0);

  // ── States ──────────────────────────────────
  const [dashboard,      setDashboard]      = useState(INITIAL_DASHBOARD);
  const [recentFiles,    setRecentFiles]    = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [focusMinutes,   setFocusMinutes]   = useState(DEFAULT_MINUTES);
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_MINUTES * 60);
  const [isRunning,      setIsRunning]      = useState(false);
  const [isPaused,       setIsPaused]       = useState(false);
  const [sessionBanner,  setSessionBanner]  = useState('');
  const [sessionStatus,  setSessionStatus]  = useState('');
  const [savingSession,  setSavingSession]  = useState(false);

  // ── Sync timer snapshot → React states ──────
  const syncTimerState = (snap) => {
    setFocusMinutes(snap.focusMinutes);
    setRemainingSeconds(snap.remainingSeconds);
    setIsRunning(snap.isRunning);
    setIsPaused(snap.isPaused);
  };

  // ── Fetch dashboard + recent files ──────────
  const refreshDashboard = useCallback(async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) setLoading(true);
      const [stats, files] = await Promise.all([
        workspaceApi.getProductivityDashboard(),
        workspaceApi.getRecentFiles(20),
      ]);
      setDashboard(normalizeDashboardStats(stats));
      setRecentFiles(normalizeRecentFiles(files).slice(0, 5));
    } catch (err) {
      setError(err.message || 'Failed to refresh dashboard');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  // ── Effect 1: Initial load + auto-refresh ───
  useEffect(() => {
    if (userLoading) {
      return;
    }

    let mounted = true;

    setDashboard(INITIAL_DASHBOARD);
    setRecentFiles([]);

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [stats, files] = await Promise.all([
          workspaceApi.getProductivityDashboard(),
          workspaceApi.getRecentFiles(20),
        ]);
        if (!mounted) return;
        setDashboard(normalizeDashboardStats(stats));
        setRecentFiles(normalizeRecentFiles(files).slice(0, 5));
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    // Silent refresh every 20 seconds
    const timer = window.setInterval(() => refreshDashboard({ showLoader: false }), 20000);

    // Event-based refresh triggers
    const silentRefresh = () => refreshDashboard({ showLoader: false });
    const onVisibility  = () => { if (document.visibilityState === 'visible') silentRefresh(); };

    window.addEventListener('neuranote:files-updated', silentRefresh);
    window.addEventListener('neuranote:focus-updated', silentRefresh);
    window.addEventListener('focus', silentRefresh);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener('neuranote:files-updated', silentRefresh);
      window.removeEventListener('neuranote:focus-updated', silentRefresh);
      window.removeEventListener('focus', silentRefresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshDashboard, userLoading, userScope]);

  // ── Effect 2: Pomodoro timer subscription ───
  useEffect(() => {
    completionVersionRef.current = pomodoroTimer.getSnapshot().completionVersion || 0;

    const unsubscribe = pomodoroTimer.subscribe((snap) => {
      syncTimerState(snap);

      // Check if timer just completed
      const justFinished =
        snap.completionVersion > completionVersionRef.current &&
        !snap.isRunning && !snap.isPaused && snap.remainingSeconds === 0;

      if (justFinished) {
        completionVersionRef.current = snap.completionVersion;
        setSessionBanner('Focus Session Completed');
        setSessionStatus('Nice work. Your completed session has been saved.');
        setSavingSession(false);
        if (!alarmRef.current) alarmRef.current = createAlarm();
        alarmRef.current?.play?.().catch(() => {});
      }
    });

    syncTimerState(pomodoroTimer.getSnapshot());
    return unsubscribe;
  }, []);

  // ── Timer controls ───────────────────────────
  const startTimer = async () => {
    if (isRunning) return;
    if (!alarmRef.current) alarmRef.current = createAlarm();
    try {
      if (alarmRef.current?.audioContext?.state === 'suspended') {
        await alarmRef.current.audioContext.resume();
      }
    } catch {}
    pomodoroTimer.setFocusMinutes(Number(focusMinutes) || DEFAULT_MINUTES);
    setSessionBanner('');
    setSessionStatus('');
    pomodoroTimer.start();
  };

  const pauseTimer  = () => { if (isRunning)  pomodoroTimer.pause(); };
  const resumeTimer = () => { if (isPaused)   pomodoroTimer.resume(); };
  const resetTimer  = () => {
    pomodoroTimer.reset();
    setSessionBanner('');
    setSessionStatus('');
  };

  const handleQuickPreset = (min) => {
    pomodoroTimer.setFocusMinutes(min);
    setFocusMinutes(min);
  };

  // ── Computed values ──────────────────────────
  const currentMessage = useMemo(
    () => dashboard.motivational_message || INITIAL_DASHBOARD.motivational_message,
    [dashboard]
  );

  // Live today minutes = saved + active session
  const activeSessionSeconds = (isRunning || isPaused)
    ? Math.max(0, (focusMinutes * 60) - remainingSeconds)
    : 0;
  const liveTodayMinutes = dashboard.today_minutes + Math.floor(activeSessionSeconds / 60);

  // ── Open recent file → /files page ──────────
  const handleOpenRecentFile = (file) => {
    if (!file) return;
    navigate('/files', {
      state: {
        navigatedFromRecent : true,
        targetFolder        : file.folder_id
          ? { id: file.folder_id, name: file.folder_name || 'Folder', parent_folder_id: file.parent_folder_id || null }
          : null,
        targetFile: {
          id              : file.id,
          name            : file.name || file.original_filename || 'Untitled file',
          originalFilename: file.original_filename || file.name || null,
          type            : file.file_type || 'FILE',
          folderId        : file.folder_id,
          folderName      : file.folder_name || null,
          parentFileId    : file.parent_file_id || null,
          fileUrl         : null,   // FileViewer fetches fresh URL
          content         : file.file_content || null,
          mimeType        : file.mime_type || null,
          isParentPDF     : String(file.file_type || '').toUpperCase() === 'PDF',
          storagePath     : file.storage_path || null,
          backendFile     : true,
          recentAccessedAt: file.recent_timestamp || null,
          folderPath      : file.folder_path || null,
        },
      },
    });
  };

  // ── Shared styles ────────────────────────────
  const card = {
    background  : isDark ? theme.colors.bg.secondary : 'linear-gradient(180deg,#fff 0%,#f8faff 100%)',
    border      : `1px solid ${theme.colors.ui.border}`,
    borderRadius: 24,
    padding     : 22,
    boxShadow   : isDark ? '0 18px 40px rgba(0,0,0,0.4)' : '0 18px 40px rgba(15,23,42,0.06)',
  };

  const btn = (bg, color, border = 'none') => ({
    display    : 'inline-flex',
    alignItems : 'center',
    gap        : 8,
    background : bg,
    color,
    border,
    borderRadius: 12,
    padding    : '12px 16px',
    fontWeight : 800,
    cursor     : 'pointer',
  });

  // ── Render ───────────────────────────────────
  return (
    <div style={{
      display      : 'flex',
      flexDirection: 'column',
      gap          : 20,
      padding      : '18px 20px 24px',
      overflowY    : 'auto',
      height       : '100%',
      width        : '100%',
      boxSizing    : 'border-box',
      background   : isDark
        ? 'radial-gradient(circle at top left,rgba(99,102,241,0.2),transparent 34%),linear-gradient(180deg,#0f1419 0%,#121826 100%)'
        : 'radial-gradient(circle at top left,rgba(99,102,241,0.08),transparent 34%),linear-gradient(180deg,#f8fbff 0%,#f4f7ff 100%)',
    }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', gap:16, alignItems:'flex-start', flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:12, textTransform:'uppercase', letterSpacing:'0.18em', color:theme.colors.text.tertiary, fontWeight:800 }}>
            Productivity Dashboard
          </div>
          <h1 style={{ margin:'8px 0', fontSize:36, fontFamily: 'Poppins ', lineHeight:1.1, color:theme.colors.text.primary, letterSpacing:'-0.04em' }}>
            Stay focused. Track your habit. Keep your files moving....
          </h1>
          <p style={{ margin:0, color:theme.colors.text.secondary, fontSize:15,   fontFamily: 'sans-serif',
maxWidth:980, lineHeight:1.7 }}>
            A student-friendly workspace with Pomodoro control, focus tracking, streak motivation, and the latest files you opened most recently.
          </p>
        </div>
        <button onClick={refreshDashboard} style={btn(theme.colors.bg.secondary, theme.colors.text.primary, `1px solid ${theme.colors.ui.border}`)}>
          <RefreshCw size={15} /> Refresh Dashboard
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{ padding:14, borderRadius:14, background:'#fff1f2', color:'#b91c1c', border:'1px solid #fecdd3' }}>
          {error}
        </div>
      )}

      {/* ── Main grid: Timer (left) + Recent Files (right) ── */}
      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1.3fr) minmax(300px,0.7fr)', gap:20, alignItems:'start' }}>

        {/* ── LEFT: Pomodoro Timer ── */}
        <div style={card}>

          {/* Timer header + countdown */}
          <div style={{ display:'flex', justifyContent:'space-between', gap:16, flexWrap:'wrap', alignItems:'center', marginBottom:18 }}>
            <div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:999, background:'#eef2ff', color:'#4338ca', fontWeight:800, fontSize:12 }}>
                <AlarmClock size={14} /> Pomodoro Focus Timer
              </div>
              <h2 style={{ margin:'12px 0 6px', fontSize:24, color:theme.colors.text.primary }}>
                Build a focused study block
              </h2>
            </div>
            <div style={{ minWidth:160, textAlign:'right' }}>
              <div style={{ fontSize:12, color:theme.colors.text.tertiary, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em' }}>
                Countdown
              </div>
              <div style={{ fontSize:48, fontWeight:900, letterSpacing:'-0.04em', color: remainingSeconds <= 30 ? '#dc2626' : theme.colors.text.primary }}>
                {formatClock(remainingSeconds)}
              </div>
            </div>
          </div>

          {/* Quick preset buttons: 25 / 45 / 60 min */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
            {[25, 45, 60].map((min) => (
              <button
                key={min}
                onClick={() => handleQuickPreset(min)}
                disabled={isRunning || isPaused}
                style={{
                  padding     : '12px 14px',
                  borderRadius: 14,
                  border      : focusMinutes === min ? '1px solid #4f46e5' : `1px solid ${theme.colors.ui.border}`,
                  background  : focusMinutes === min ? '#eef2ff' : theme.colors.bg.primary,
                  color       : theme.colors.text.primary,
                  fontWeight  : 700,
                  cursor      : isRunning || isPaused ? 'not-allowed' : 'pointer',
                  opacity     : isRunning || isPaused ? 0.7 : 1,
                }}
              >
                {min} min
              </button>
            ))}
          </div>

          {/* Custom time input + action buttons */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <label style={{ display:'flex', flexDirection:'column', gap:8, color:theme.colors.text.secondary, fontSize:13, fontWeight:700 }}>
              Custom focus time (minutes)
              <input
                type="number" min="1" max="180"
                value={focusMinutes}
                disabled={isRunning || isPaused}
                onChange={(e) => {
                  const val = Math.max(1, Number(e.target.value) || DEFAULT_MINUTES);
                  setFocusMinutes(val);
                  pomodoroTimer.setFocusMinutes(val);
                }}
                style={{
                  border      : `1px solid ${theme.colors.ui.border}`,
                  borderRadius: 12,
                  padding     : '12px 14px',
                  fontSize    : 15,
                  outline     : 'none',
                  background  : isRunning || isPaused ? theme.colors.ui.input : theme.colors.bg.primary,
                  color       : theme.colors.text.primary,
                  opacity     : isRunning || isPaused ? 0.7 : 1,
                }}
              />
            </label>

            <div style={{ display:'flex', alignItems:'end', gap:10, flexWrap:'wrap' }}>
              {!isRunning && !isPaused && (
                <button onClick={startTimer} style={btn('#4f46e5', '#fff')}>
                  <Play size={16} /> Start
                </button>
              )}
              {isRunning && (
                <button onClick={pauseTimer} style={btn(theme.colors.bg.primary, theme.colors.text.primary, `1px solid ${theme.colors.ui.border}`)}>
                  <Pause size={16} /> Pause
                </button>
              )}
              {isPaused && (
                <button onClick={resumeTimer} style={btn('#10b981', '#fff')}>
                  <Play size={16} /> Resume
                </button>
              )}
              <button onClick={resetTimer} style={btn(theme.colors.bg.primary, theme.colors.text.primary, `1px solid ${theme.colors.ui.border}`)}>
                <RotateCcw size={16} /> Reset
              </button>
            </div>
          </div>

          {/* Session complete banner */}
          {sessionBanner && (
            <div style={{ marginTop:10, padding:14, borderRadius:16, background:'#ecfeff', border:'1px solid #a5f3fc', color:'#155e75', fontWeight:800 }}>
              {sessionBanner}
              <div style={{ marginTop:6, fontWeight:600, color:'#0f766e' }}>
                {savingSession ? 'Saving your completed session...' : sessionStatus}
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div style={{ marginTop:18, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
            <StatCard icon={Clock3}    label="Today Total Focus Time"    value={formatMinutes(liveTodayMinutes)}              accent="linear-gradient(135deg,#6366f1,#8b5cf6)" hint="Includes live minutes from the current active Pomodoro."       theme={theme} isDark={isDark} />
            <StatCard icon={FileText}  label="Yesterday Focus Time"      value={formatMinutes(dashboard.yesterday_minutes)}   accent="linear-gradient(135deg,#0ea5e9,#14b8a6)" hint="Completed focus time from the previous day."                 theme={theme} isDark={isDark} />
            <StatCard icon={BookOpen}  label="This Week Total Focus Time" value={formatMinutes(dashboard.week_minutes)}        accent="linear-gradient(135deg,#f59e0b,#f97316)" hint="Weekly focus minutes saved in the database."                 theme={theme} isDark={isDark} />
            <StatCard icon={Flame}     label="Current Study Streak"       value={`${dashboard.current_streak_days || 0} Days`} accent="linear-gradient(135deg,#ef4444,#f59e0b)" hint="At least one completed focus session today keeps the streak." theme={theme} isDark={isDark} />
            <StatCard icon={Flame}     label="Best Streak"                value={`${dashboard.best_streak_days || 0} Days`}    accent="linear-gradient(135deg,#7c3aed,#6366f1)" hint="Your longest continuous streak so far."                      theme={theme} isDark={isDark} />
          </div>

          {/* Motivational message */}
          <div style={{ marginTop:16, padding:16, borderRadius:18, background:theme.colors.bg.primary, border:`1px solid ${theme.colors.ui.border}`, boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.35)' : '0 10px 30px rgba(15,23,42,0.05)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, color:theme.colors.text.primary, fontWeight:800 }}>
              <Quote size={16} color="#4f46e5" /> Motivational Message
            </div>
            <div style={{ color:theme.colors.text.secondary, fontSize:15, lineHeight:1.7 }}>
              {currentMessage}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Smart Recent Files ── */}
        <div style={{ ...card, padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:800, color:theme.colors.text.primary, marginBottom:6 }}>
            <FolderOpen size={16} color="#4f46e5" /> Smart Recent Files
          </div>
          <div style={{ color:theme.colors.text.tertiary, fontSize:13, marginBottom:14 }}>
            Latest 5 files you opened, sorted by last access.
          </div>

          {/* Loading / empty / list */}
          {loading ? (
            <div style={{ color:theme.colors.text.tertiary }}>Loading dashboard...</div>
          ) : recentFiles.length === 0 ? (
            <div style={{ color:theme.colors.text.tertiary, fontSize:14 }}>
              No recent files yet. Open a file to start tracking access history.
            </div>
          ) : (
            <div style={{ display:'grid', gap:12 }}>
              {recentFiles.map((file) => (
                <div key={file.id} style={{
                  border      : `1px solid ${theme.colors.ui.border}`,
                  borderRadius: 18,
                  padding     : 14,
                  background  : theme.colors.bg.primary,
                  boxShadow   : isDark ? '0 10px 26px rgba(0,0,0,0.3)' : '0 10px 26px rgba(15,23,42,0.04)',
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' }}>

                    {/* File info */}
                    <div style={{ minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <FileText size={16} color="#4f46e5" />
                        <div style={{ fontWeight:800, color:theme.colors.text.primary, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}
                          title={file.name || file.original_filename}>
                          {file.name || file.original_filename || 'Untitled file'}
                        </div>
                      </div>
                      <div style={{ color:theme.colors.text.tertiary, fontSize:13, lineHeight:1.6 }}>
                        <div><strong style={{ color:theme.colors.text.secondary }}>Folder:</strong> {buildFilePath(file)}</div>
                        {file.parent_folder_path && (
                          <div><strong style={{ color:theme.colors.text.secondary }}>Parent:</strong> {file.parent_folder_path}</div>
                        )}
                        <div><strong style={{ color:theme.colors.text.secondary }}>Last Accessed:</strong> {formatLastAccessed(file.recent_timestamp)}</div>
                        <div><strong style={{ color:theme.colors.text.secondary }}>Type:</strong> {getFileTypeLabel(file)}</div>
                      </div>
                    </div>

                    {/* Quick Open button */}
                    <button onClick={() => handleOpenRecentFile(file)}
                      style={{ display:'inline-flex', alignItems:'center', gap:8, border:'none', background:'#eef2ff', color:'#4338ca', borderRadius:12, padding:'10px 12px', fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }}>
                      Quick Open <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ProductivityDashboard;