import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// ===== MEMBER 1 (Nihaaj) - Auth =====
import LandingPage from '@/pages/LandingPage';
import SignInPage from '@/pages/SignInPage';
import SignUpPage from '@/pages/SignUpPage';
import OAuthCallback from '@/pages/OAuthCallback';

// ===== SHARED DASHBOARD =====
import Dashboard from '@/pages/Dashboard';

// ===== MEMBER 3 (Sandavi) - Structured Notes =====
// Dashboard is mem 2's part, removing M3 dashboard route
// import M3Dashboard from './m3_structurednotes/pages/Dashboard';
import NoteEditor from './m3_structurednotes/pages/NoteEditor';

// ===== MEMBER 4 - Quiz =====
import QuizPage from '@/components/quiz/QuizPage';
import QuizHistory from '@/components/quiz/QuizHistory';

// ===== MEMBER 5 - Tasks =====
import TaskDashboard from '@/components/tasks/TaskDashboard';

// ===== DEV NAVIGATION (auto-hidden in production) =====
import DevNav from '@/components/DevNav';

import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Member 1 - Auth */}
        <Route path="/"               element={<LandingPage />} />
        <Route path="/login"          element={<SignInPage />} />
        <Route path="/signup"         element={<SignUpPage />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />

        {/* Shared Dashboard */}
        <Route path="/dashboard"      element={<Dashboard />} />

        {/* Member 3 - Structured Notes */}
        {/* <Route path="/notes"                element={<M3Dashboard />} /> */}
        <Route path="/notes/editor/:noteId" element={<NoteEditor />} />

        {/* Member 4 - Quiz */}
        <Route path="/quiz"         element={<QuizPage />} />
        <Route path="/quiz/history" element={<QuizHistory />} />

        {/* Member 5 - Tasks */}
        <Route path="/tasks" element={<TaskDashboard />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* 🛠 Dev panel — outside Routes so it floats on every page */}
      <DevNav />
    </Router>
  );
}

export default App;