import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { Toaster } from '@/lib/simpleToast';
import { getAccessToken } from '@/utils/tokenStorage';
import axiosInstance from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';
import AccountSuspendedPage from '@/pages/AccountSuspendedPage';

// ===== MEMBER 1 (Nihaaj) - Auth =====
import LandingPage from '@/pages/LandingPage';
import SignInPage from '@/pages/SignInPage';
import SignUpPage from '@/pages/SignUpPage';
import VerificationPage from '@/pages/VerificationPage';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import ChangePassword from '@/pages/ChangePassword';
import AccountVerification from '@/pages/AccountVerification';
import OAuthCallback from '@/pages/OAuthCallback';
import AdminDashboard from '@/pages/AdminDashboard';

// ===== MEMBER 2 (Ashmitha) - File Manager =====
import FileManagerPage from '@/pages/FileManagerPage';
import Rail from '@/components/filemanager/Rail';
import FolderPanel from '@/components/filemanager/FolderPanel';

// ===== SHARED DASHBOARD =====
import Dashboard from '@/pages/Dashboard';

// ===== MEMBER 3 (Sandavi) - Structured Notes (LAZY LOADED) =====
const M3Dashboard = lazy(() => import('./m3_structurednotes/pages/Dashboard'));
const NoteEditor = lazy(() => import('./m3_structurednotes/pages/NoteEditor'));
const ManualNoteEditor = lazy(() => import('./m3_structurednotes/pages/ManualNoteEditor'));

// MEMBER 4 - Quiz - LAZY LOADED
const QuizPage = lazy(() => import('@/components/quiz/QuizPage'));
const QuizHistory = lazy(() => import('@/components/quiz/QuizHistory'));

// MEMBER 5 - Tasks - LAZY LOADED
const TaskDashboard = lazy(() => import('@/components/tasks/TaskDashboard'));
const PomodoroPage = lazy(() => import('@/pages/PomodoroPage'));
const SecondBrainPage = lazy(() => import('@/pages/SecondBrainPage'));
const FlashcardsPage = lazy(() => import('@/pages/FlashcardsPage'));

// DEV NAVIGATION
import DevNav from '@/components/DevNav';
import { pomodoroTimer } from '@/utils/pomodoroTimer';
import { workspaceApi } from '@/services/workspaceApi';
import { getScopedStorageKey, useSupabaseUser } from '@/hooks/useSupabaseUser';
import './index.css';

const MindMapPage = React.lazy(() => import('@/pages/MindMapPage'));
const ACTIVE_WORKSPACE_FOLDER_KEY = 'neuranote_active_workspace_folder';

// Spinner shown while a lazy chunk is loading
const PageLoader = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', background: '#fafafa',
  }}>
    <div style={{
      width: 32, height: 32,
      border: '3px solid #e5e7eb',
      borderTop: '3px solid #9333ea',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// Pages that should NOT show the Rail/FolderPanel (auth + landing flows)
const noRailPages = [
  '/',
  '/login',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/change-password',
  '/account-verified',
  '/oauth/callback',
  '/account-suspended',
];

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { userScope, loading: userLoading } = useSupabaseUser();
  const [activeView, setActiveView] = useState('home');
  const [quizStep, setQuizStep] = useState('upload');
  const [selectedWorkspaceFolder, setSelectedWorkspaceFolder] = useState(null);
  const lastSavedCompletionVersionRef = useRef(0);

  const publicPaths = new Set([
    '/',
    '/login',
    '/signup',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
    '/change-password',
    '/account-verified',
    '/oauth/callback',
    '/account-suspended'
  ]);

  const showRail = !noRailPages.includes(location.pathname);
  const showWorkspacePanel = showRail &&
    location.pathname !== '/dashboard' &&
    location.pathname !== '/files' &&
    location.pathname !== '/files/create-note' &&
    !location.pathname.includes('/admin') &&
    !(location.pathname.startsWith('/quiz') && quizStep !== 'upload');

  // Load user-scoped workspace folder
  useEffect(() => {
    if (userLoading) return;

    try {
      const savedFolder = localStorage.getItem(getScopedStorageKey(ACTIVE_WORKSPACE_FOLDER_KEY, userScope));
      setSelectedWorkspaceFolder(savedFolder ? JSON.parse(savedFolder) : null);
    } catch {
      setSelectedWorkspaceFolder(null);
    }
  }, [userLoading, userScope]);

  useEffect(() => {
    if (userLoading) return;

    if (selectedWorkspaceFolder) {
      localStorage.setItem(getScopedStorageKey(ACTIVE_WORKSPACE_FOLDER_KEY, userScope), JSON.stringify(selectedWorkspaceFolder));
      return;
    }
    localStorage.removeItem(getScopedStorageKey(ACTIVE_WORKSPACE_FOLDER_KEY, userScope));
  }, [selectedWorkspaceFolder, userLoading, userScope]);

  // Sync activeView with current URL
  useEffect(() => {
    const p = location.pathname;
    if (p === '/dashboard') setActiveView('home');
    else if (p.startsWith('/notes')) setActiveView('notes');
    else if (p === '/tasks') setActiveView('tasks');
    else if (p.startsWith('/quiz')) setActiveView('quiz');
    else if (p === '/pomodoro') setActiveView('pomodoro');
    else if (p === '/flashcards') setActiveView('flashcards');
    else if (p === '/second-brain') setActiveView('second-brain');
    else if (p.startsWith('/files')) setActiveView('files');
    else if (p.startsWith('/mindmap')) setActiveView('mindmap');
    else if (p === '/admin') setActiveView('admin');
  }, [location.pathname]);

  // Save completed pomodoro sessions to backend
  useEffect(() => {
    const unsubscribe = pomodoroTimer.subscribe(async (snapshot) => {
      if (snapshot.completionVersion <= lastSavedCompletionVersionRef.current) return;

      const pending = pomodoroTimer.takeCompletedSessions();
      if (!pending.length) {
        lastSavedCompletionVersionRef.current = snapshot.completionVersion;
        return;
      }

      try {
        for (const payload of pending) {
          await workspaceApi.recordFocusSession(payload);
        }
        window.dispatchEvent(new Event('neuranote:focus-updated'));
      } catch {
        // Timer UI must continue even if save fails
      } finally {
        lastSavedCompletionVersionRef.current = snapshot.completionVersion;
      }
    });

    return unsubscribe;
  }, []);

  // Security Guard: Check token authentication and account suspension status
  useEffect(() => {
    const token = getAccessToken();
    const isPublicPath = publicPaths.has(location.pathname);

    if (!token && !isPublicPath) {
      navigate('/login', { replace: true });
      return;
    }

    if (!token || isPublicPath || location.pathname === '/account-suspended') {
      return;
    }

    let isMounted = true;

    axiosInstance.get('/api/v1/users/me')
      .then(({ data }) => {
        const suspended = Boolean(data?.profile?.is_suspended || data?.user?.is_suspended || data?.is_suspended);
        if (isMounted && suspended) {
          navigate('/account-suspended', { replace: true });
        }
      })
      .catch((error) => {
        if (!isMounted) return;

        const detail = String(error.response?.data?.detail || '').toLowerCase();
        if (error.response?.status === 403 || detail.includes('suspend')) {
          navigate('/account-suspended', { replace: true });
          return;
        }

        if (error.response?.status === 401) {
          navigate('/login', { replace: true });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [location.pathname, navigate]);

  // Show spinner while auth initialises
  if (isLoading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#fafafa',
    }}>
      <div style={{
        width: 36, height: 36,
        border: '3px solid #e5e7eb',
        borderTop: '3px solid #9333ea',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Rail shown on all pages except auth */}
      {showRail && (
        <Rail activeView={activeView} setActiveView={setActiveView} />
      )}

      {/* Workspace folder panel */}
      {showWorkspacePanel && (
        <FolderPanel
          selectedFolder={selectedWorkspaceFolder}
          onSelectFolder={setSelectedWorkspaceFolder}
          onSelectFile={(file) => {
            if (!file || !selectedWorkspaceFolder) return;
            setActiveView('files');
            navigate('/files', {
              state: {
                navigatedFromRecent: true,
                targetFolder: selectedWorkspaceFolder,
                targetFile: file,
              },
            });
          }}
          onFolderDelete={(folderName) => {
            if (selectedWorkspaceFolder?.name === folderName) {
              setSelectedWorkspaceFolder(null);
            }
          }}
        />
      )}

      {/* Page content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Member 1 - Auth */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<SignInPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/verify-email" element={<VerificationPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/account-verified" element={<AccountVerification />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route path="/account-suspended" element={<AccountSuspendedPage />} />
            <Route path="/admin" element={<AdminDashboard />} />

            {/* Member 2 - File Manager */}
            <Route path="/dashboard" element={
              <FileManagerPage activeView={activeView} setActiveView={setActiveView} />
            } />
            <Route path="/files" element={
              <FileManagerPage activeView={activeView} setActiveView={setActiveView} />
            } />

            {/* Member 3 - Structured Notes */}
            <Route path="/notes" element={<M3Dashboard />} />
            <Route path="/files/create-note" element={<ManualNoteEditor />} />
            <Route path="/notes/create" element={<Navigate to="/files/create-note" replace />} />
            <Route path="/notes/editor/:noteId" element={<NoteEditor />} />

            {/* Member 4 - Quiz */}
            <Route path="/quiz" element={<QuizPage userId={user?.id ?? null} noteId={null} onStepChange={setQuizStep} />} />
            <Route path="/quiz/history" element={<QuizHistory onBack={() => navigate(-1)} />} />

            {/* Member 5 - Tasks + shared modules */}
            <Route path="/tasks" element={<TaskDashboard />} />
            <Route path="/pomodoro" element={<PomodoroPage />} />
            <Route path="/flashcards" element={<FlashcardsPage />} />
            <Route path="/second-brain" element={<SecondBrainPage />} />
            <Route path="/mindmap"      element={<MindMapPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>

      {/* Dev panel — floats on every page */}
      {import.meta.env.DEV && import.meta.env.VITE_SHOW_DEVNAV === 'true' ? <DevNav /> : null}
    </div>
  );
};

const App = () => (
  <ThemeProvider>
    <Router>
      <AppLayout />
      <Toaster />
    </Router>
  </ThemeProvider>
);

export default App;