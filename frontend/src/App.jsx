import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';

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

// ===== MEMBER 2 (Ashmitha) - File Manager =====
import FileManagerPage from '@/pages/FileManagerPage';
import Rail from '@/components/filemanager/Rail';
import WorkspaceFolderPanel from '@/components/workspace/WorkspaceFolderPanel';

// ===== MEMBER 3 (Sandavi) - Structured Notes =====
import M3Dashboard from './m3_structurednotes/pages/Dashboard';
import NoteEditor from './m3_structurednotes/pages/NoteEditor';
import ManualNoteEditor from './m3_structurednotes/pages/ManualNoteEditor';

// ===== MEMBER 4 - Quiz =====
import QuizPage from '@/components/quiz/QuizPage';
import QuizHistory from '@/components/quiz/QuizHistory';

// ===== MEMBER 5 - Tasks =====
import TaskDashboard from '@/components/tasks/TaskDashboard';
import PomodoroPage from '@/pages/PomodoroPage';
import SecondBrainPage from '@/pages/SecondBrainPage';
import FlashcardsPage from '@/pages/FlashcardsPage';

// ===== DEV NAVIGATION (auto-hidden in production) =====
import DevNav from '@/components/DevNav';
import { pomodoroTimer } from '@/utils/pomodoroTimer';
import { workspaceApi } from '@/services/workspaceApi';

import './index.css';

// Pages that should NOT show the Rail
const noRailPages = ['/', '/login', '/signup', '/oauth/callback'];

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('home');
  const [selectedWorkspaceFolder, setSelectedWorkspaceFolder] = useState(null);
  const lastSavedCompletionVersionRef = useRef(0);
  const showRail = !noRailPages.includes(location.pathname);
  const showWorkspacePanel = showRail && location.pathname !== '/dashboard' && location.pathname !== '/files' && location.pathname !== '/files/create-note';

  // Sync activeView with current URL
  useEffect(() => {
    if (location.pathname === '/dashboard') {
      setActiveView('home');
    } else if (location.pathname === '/notes') {
      setActiveView('notes');
    } else if (location.pathname.startsWith('/notes')) {
      setActiveView('notes');
    } else if (location.pathname === '/tasks') {
      setActiveView('tasks');
    } else if (location.pathname === '/quiz' || location.pathname === '/quiz/history') {
      setActiveView('quiz');
    } else if (location.pathname === '/pomodoro') {
      setActiveView('pomodoro');
    } else if (location.pathname === '/flashcards') {
      setActiveView('flashcards');
    } else if (location.pathname === '/second-brain') {
      setActiveView('second-brain');
    } else if (location.pathname.startsWith('/files')) {
      setActiveView('files');
    }
  }, [location.pathname]);

  useEffect(() => {
    const unsubscribe = pomodoroTimer.subscribe(async (snapshot) => {
      if (snapshot.completionVersion <= lastSavedCompletionVersionRef.current) {
        return;
      }

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
        // Timer UI must continue even if save fails; dashboard will retry on next refresh.
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

      {showWorkspacePanel && (
        <WorkspaceFolderPanel
          selectedFolderId={selectedWorkspaceFolder?.id}
          onSelectFolder={(folder) => {
            setSelectedWorkspaceFolder(folder);
            if (folder) {
              setActiveView('files');
              navigate('/files', { state: { navigatedFromRecent: true, targetFolder: folder } });
            }
          }}
        />
      )}

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Routes>
          {/* Member 1 - Auth */}
          <Route path="/"               element={<LandingPage />} />
          <Route path="/login"          element={<SignInPage />} />
          <Route path="/signup"         element={<SignUpPage />} />
          <Route path="/verify-email"   element={<VerificationPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/account-verified" element={<AccountVerification />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />

          {/* Member 2 - File Manager */}
          <Route path="/dashboard" element={<FileManagerPage activeView='home' setActiveView={setActiveView} />} />
          <Route path="/files" element={<FileManagerPage activeView='files' setActiveView={setActiveView} />} />

          {/* Member 3 - Structured Notes */}
          <Route path="/notes"                element={<M3Dashboard />} />
          <Route path="/files/create-note"    element={<ManualNoteEditor />} />
          <Route path="/notes/create"         element={<Navigate to="/files/create-note" replace />} />
          <Route path="/notes/editor/:noteId" element={<NoteEditor />} />

          {/* Member 4 - Quiz */}
          <Route path="/quiz"         element={<QuizPage />} />
          <Route path="/quiz/history" element={<QuizHistory />} />

          {/* Member 5 - Tasks */}
          <Route path="/tasks" element={<TaskDashboard />} />

          {/* Shared modules (isolated scaffolds) */}
          <Route path="/pomodoro" element={<PomodoroPage />} />
          <Route path="/flashcards" element={<FlashcardsPage />} />
          <Route path="/second-brain" element={<SecondBrainPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* Dev panel — outside Routes so it floats on every page */}
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