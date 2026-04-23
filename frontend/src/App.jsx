import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/useAuth';

// ── Always loaded — lightweight, needed on every page ─────────────────────────
import Rail   from '@/components/filemanager/Rail';
import DevNav from '@/components/DevNav';
import './index.css';

// ===== MEMBER 1 (Nihaaj) - Auth — static (lightweight, always needed) =========
import LandingPage         from '@/pages/LandingPage';
import SignInPage          from '@/pages/SignInPage';
import SignUpPage          from '@/pages/SignUpPage';
import VerificationPage    from '@/pages/VerificationPage';
import ForgotPassword      from '@/pages/ForgotPassword';
import ResetPassword       from '@/pages/ResetPassword';
import ChangePassword      from '@/pages/ChangePassword';
import AccountVerification from '@/pages/AccountVerification';
import OAuthCallback       from '@/pages/OAuthCallback';
import Dashboard           from '@/pages/Dashboard';

// ===== MEMBER 2 (Ashmitha) - File Manager — lazy ==============================
const FileManagerPage = lazy(() => import('@/pages/FileManagerPage'));

// ===== MEMBER 3 (Sandavi) - Structured Notes — lazy ==========================
// remark-gfm, rehype-raw, mermaid are only resolved when /notes is visited
const M3Dashboard = lazy(() => import('./m3_structurednotes/pages/Dashboard'));
const NoteEditor  = lazy(() => import('./m3_structurednotes/pages/NoteEditor'));

// ===== MEMBER 4 (Naviru) - Quiz — lazy =======================================
const QuizPage    = lazy(() => import('@/components/quiz/QuizPage'));
const QuizHistory = lazy(() => import('@/components/quiz/QuizHistory'));

// ===== MEMBER 5 - Tasks — lazy ===============================================
const TaskDashboard = lazy(() => import('@/components/tasks/TaskDashboard'));

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

// Pages that should NOT show the Rail
const noRailPages = ['/', '/login', '/signup', '/oauth/callback'];

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [activeView, setActiveView] = useState('home');
  const showRail = !noRailPages.includes(location.pathname);

  // ✅ useEffect must come BEFORE any conditional return (Rules of Hooks)
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
      </div>

      {/* Dev panel — floats on every page */}
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
