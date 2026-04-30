import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/useAuth.jsx';

// Always loaded — lightweight, needed on every page
import Rail   from '@/components/filemanager/Rail';
import { ThemeProvider } from '@/context/ThemeContext';

// MEMBER 1 (Nihaaj) - Auth
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

// MEMBER 2 (Ashmitha) - File Manager
import FileManagerPage from '@/pages/FileManagerPage';
import FolderPanel from '@/components/filemanager/FolderPanel';

// SHARED DASHBOARD
import Dashboard from '@/pages/Dashboard';

// MEMBER 3 (Sandavi) - Structured Notes
import M3Dashboard from './m3_structurednotes/pages/Dashboard';
import NoteEditor from './m3_structurednotes/pages/NoteEditor';
import ManualNoteEditor from './m3_structurednotes/pages/ManualNoteEditor';

// MEMBER 4 - Quiz
import QuizPage from '@/components/quiz/QuizPage';
import QuizHistory from '@/components/quiz/QuizHistory';

// MEMBER 5 - Tasks
import TaskDashboard from '@/components/tasks/TaskDashboard';
import PomodoroPage from '@/pages/PomodoroPage';
import SecondBrainPage from '@/pages/SecondBrainPage';
import FlashcardsPage from '@/pages/FlashcardsPage';

// DEV NAVIGATION
import DevNav from '@/components/DevNav';
import { pomodoroTimer } from '@/utils/pomodoroTimer';
import { workspaceApi } from '@/services/workspaceApi';
import './index.css';

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

const ACTIVE_WORKSPACE_FOLDER_KEY = 'neuranote_active_workspace_folder';

// Pages that should NOT show the Rail
const noRailPages = ['/', '/login', '/signup', '/oauth/callback'];

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('home');
  const [selectedWorkspaceFolder, setSelectedWorkspaceFolder] = useState(() => {
    try {
      const savedFolder = localStorage.getItem(ACTIVE_WORKSPACE_FOLDER_KEY);
      return savedFolder ? JSON.parse(savedFolder) : null;
    } catch {
      return null;
    }
  });
  const lastSavedCompletionVersionRef = useRef(0);
  const showRail = !noRailPages.includes(location.pathname);
  const showWorkspacePanel = showRail &&
    location.pathname !== '/dashboard' &&
    location.pathname !== '/files' &&
    location.pathname !== '/files/create-note';

  // ✅ useEffect must come BEFORE any conditional return (Rules of Hooks)
  useEffect(() => {
    if (selectedWorkspaceFolder) {
      localStorage.setItem(ACTIVE_WORKSPACE_FOLDER_KEY, JSON.stringify(selectedWorkspaceFolder));
      return;
    }
    localStorage.removeItem(ACTIVE_WORKSPACE_FOLDER_KEY);
  }, [selectedWorkspaceFolder]);

  // Sync activeView with current URL
  useEffect(() => {
    const p = location.pathname;
    if (p.startsWith('/notes'))       setActiveView('notes');
    else if (p === '/tasks')          setActiveView('tasks');
    else if (p.startsWith('/quiz'))   setActiveView('quiz');
    else if (p === '/files')          setActiveView('files');
    else if (p === '/dashboard')      setActiveView('dashboard');
  }, [location.pathname]);

  // Show a spinner while auth initialises — not null (null = blank forever if error)
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
    <div style={{ display: 'flex', height: '100vh' }}>
    if (p === '/dashboard')               setActiveView('home');
    else if (p.startsWith('/notes'))      setActiveView('notes');
    else if (p === '/tasks')              setActiveView('tasks');
    else if (p.startsWith('/quiz'))       setActiveView('quiz');
    else if (p === '/pomodoro')           setActiveView('pomodoro');
    else if (p === '/flashcards')         setActiveView('flashcards');
    else if (p === '/second-brain')       setActiveView('second-brain');
    else if (p.startsWith('/files'))      setActiveView('files');
    else if (p === '/admin')              setActiveView('admin');
  }, [location.pathname]);

  useEffect(() = {
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

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Rail shown on all pages except auth */}
      {showRail && (
        <Rail activeView={activeView} setActiveView={setActiveView} />
      )}

      {/* Page content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Member 1 - Auth */}
            <Route path="/"                  element={<LandingPage />} />
            <Route path="/login"             element={<SignInPage />} />
            <Route path="/signup"            element={<SignUpPage />} />
            <Route path="/verify-email"      element={<VerificationPage />} />
            <Route path="/forgot-password"   element={<ForgotPassword />} />
            <Route path="/reset-password"    element={<ResetPassword />} />
            <Route path="/change-password"   element={<ChangePassword />} />
            <Route path="/account-verified"  element={<AccountVerification />} />
            <Route path="/oauth/callback"    element={<OAuthCallback />} />

            {/* Shared Dashboard */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Member 2 - File Manager */}
            <Route path="/files" element={
              <FileManagerPage activeView={activeView} setActiveView={setActiveView} />
            } />

            {/* Member 3 - Structured Notes */}
            <Route path="/notes"                element={<M3Dashboard />} />
            <Route path="/notes/editor/:noteId" element={<NoteEditor />} />

            {/* Member 4 - Quiz */}
            <Route path="/quiz"         element={<QuizPage userId={user?.id ?? null} noteId={null} />} />
            <Route path="/quiz/history" element={<QuizHistory onBack={() => navigate(-1)} />} />

            {/* Member 5 - Tasks */}
            <Route path="/tasks" element={<TaskDashboard />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>

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

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Routes>
          {/* Member 1 - Auth */}
          <Route path="/"                 element={<LandingPage />} />
          <Route path="/login"            element={<SignInPage />} />
          <Route path="/signup"           element={<SignUpPage />} />
          <Route path="/verify-email"     element={<VerificationPage />} />
          <Route path="/forgot-password"  element={<ForgotPassword />} />
          <Route path="/reset-password"   element={<ResetPassword />} />
          <Route path="/change-password"  element={<ChangePassword />} />
          <Route path="/account-verified" element={<AccountVerification />} />
          <Route path="/oauth/callback"   element={<OAuthCallback />} />
          <Route path="/admin"            element={<AdminDashboard />} />

          {/* Member 2 - File Manager */}
          <Route path="/dashboard" element={<FileManagerPage activeView="home" setActiveView={setActiveView} />} />
          <Route path="/files"     element={<FileManagerPage activeView="files" setActiveView={setActiveView} />} />

          {/* Member 3 - Structured Notes */}
          <Route path="/notes"                element={<M3Dashboard />} />
          <Route path="/files/create-note"    element={<ManualNoteEditor />} />
          <Route path="/notes/create"         element={<Navigate to="/files/create-note" replace />} />
          <Route path="/notes/editor/:noteId" element={<NoteEditor />} />

          {/* Member 4 - Quiz */}
          <Route path="/quiz"         element={<QuizPage />} />
          <Route path="/quiz/history" element={<QuizHistory />} />

          {/* Member 5 - Tasks + shared modules */}
          <Route path="/tasks"        element={<TaskDashboard />} />
          <Route path="/pomodoro"     element={<PomodoroPage />} />
          <Route path="/flashcards"   element={<FlashcardsPage />} />
          <Route path="/second-brain" element={<SecondBrainPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* Dev panel — floats on every page */}
      <DevNav />
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppLayout />
      </Router>
    </ThemeProvider>
  );
}

export default App;
