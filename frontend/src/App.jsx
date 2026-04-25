import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

import Rail   from '@/components/filemanager/Rail';
import DevNav from '@/components/DevNav';
import './index.css';

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
import AdminDashboard      from '@/pages/AdminDashboard';

const FileManagerPage = lazy(() => import('@/pages/FileManagerPage'));
const M3Dashboard     = lazy(() => import('./m3_structurednotes/pages/Dashboard'));
const NoteEditor      = lazy(() => import('./m3_structurednotes/pages/NoteEditor'));
const QuizPage        = lazy(() => import('@/components/quiz/QuizPage'));
const QuizHistory     = lazy(() => import('@/components/quiz/QuizHistory'));
const TaskDashboard   = lazy(() => import('@/components/tasks/TaskDashboard'));
const SecondBrainPage = lazy(() => import('@/pages/SecondBrainPage'));

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#fafafa' }}>
    <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTop: '3px solid #9333ea', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const noRailPages = ['/', '/login', '/signup', '/oauth/callback'];

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [activeView, setActiveView] = useState('home');
  const showRail = !noRailPages.includes(location.pathname);

  useEffect(() => {
    const p = location.pathname;
    if (p.startsWith('/notes'))     setActiveView('notes');
    else if (p === '/tasks')        setActiveView('tasks');
    else if (p.startsWith('/quiz')) setActiveView('quiz');
    else if (p === '/files')        setActiveView('files');
    else if (p === '/dashboard')    setActiveView('dashboard');
    else if (p === '/second-brain') setActiveView('second-brain');
    else if (p === '/admin')        setActiveView('admin');
  }, [location.pathname]);

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fafafa' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTop: '3px solid #9333ea', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {showRail && <Rail activeView={activeView} setActiveView={setActiveView} />}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"                 element={<LandingPage />} />
            <Route path="/login"            element={<SignInPage />} />
            <Route path="/signup"           element={<SignUpPage />} />
            <Route path="/verify-email"     element={<VerificationPage />} />
            <Route path="/forgot-password"  element={<ForgotPassword />} />
            <Route path="/reset-password"   element={<ResetPassword />} />
            <Route path="/change-password"  element={<ChangePassword />} />
            <Route path="/account-verified" element={<AccountVerification />} />
            <Route path="/oauth/callback"   element={<OAuthCallback />} />
            <Route path="/dashboard"        element={<Dashboard />} />
            <Route path="/files"            element={<FileManagerPage activeView={activeView} setActiveView={setActiveView} />} />
            <Route path="/notes"                element={<M3Dashboard />} />
            <Route path="/notes/editor/:noteId" element={<NoteEditor />} />
            <Route path="/quiz"         element={<QuizPage userId={user?.id ?? null} noteId={null} />} />
            <Route path="/quiz/history" element={<QuizHistory onBack={() => navigate(-1)} />} />
            <Route path="/tasks"        element={<TaskDashboard />} />
            <Route path="/second-brain" element={<SecondBrainPage />} />
            <Route path="/admin"        element={<AdminDashboard />} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
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