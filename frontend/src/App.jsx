import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

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

// ===== SHARED DASHBOARD =====
import Dashboard from '@/pages/Dashboard';

// ===== MEMBER 3 (Sandavi) - Structured Notes =====
// Temporarily restoring M3 dashboard route for testing material upload
import M3Dashboard from './m3_structurednotes/pages/Dashboard';
import NoteEditor from './m3_structurednotes/pages/NoteEditor';

// ===== MEMBER 4 - Quiz =====
import QuizPage from '@/components/quiz/QuizPage';
import QuizHistory from '@/components/quiz/QuizHistory';

// ===== MEMBER 5 - Tasks =====
import TaskDashboard from '@/components/tasks/TaskDashboard';

// ===== DEV NAVIGATION (auto-hidden in production) =====
import DevNav from '@/components/DevNav';

import './index.css';

// Pages that should NOT show the Rail
const noRailPages = ['/', '/login', '/signup', '/oauth/callback'];

const AppLayout = () => {
  const location = useLocation();
  const [activeView, setActiveView] = useState('home');
  const showRail = !noRailPages.includes(location.pathname);

  // Sync activeView with current URL
  useEffect(() => {
    if (location.pathname === '/notes') {
      setActiveView('notes');
    } else if (location.pathname.startsWith('/notes')) {
      setActiveView('notes');
    } else if (location.pathname === '/tasks') {
      setActiveView('tasks');
    } else if (location.pathname === '/quiz' || location.pathname === '/quiz/history') {
      setActiveView('quiz');
    } else if (location.pathname === '/dashboard') {
      setActiveView('dashboard');
    }
  }, [location.pathname]);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Rail shown on all pages except auth */}
      {showRail && (
        <Rail activeView={activeView} setActiveView={setActiveView} />
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
          <Route path="/files" element={<FileManagerPage activeView={activeView} setActiveView={setActiveView} />} />

          {/* Shared Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Member 3 - Structured Notes */}
          <Route path="/notes"                element={<M3Dashboard />} />
          <Route path="/notes/editor/:noteId" element={<NoteEditor />} />

          {/* Member 4 - Quiz */}
          <Route path="/quiz"         element={<QuizPage />} />
          <Route path="/quiz/history" element={<QuizHistory />} />

          {/* Member 5 - Tasks */}
          <Route path="/tasks" element={<TaskDashboard />} />

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
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;