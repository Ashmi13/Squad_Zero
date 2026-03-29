import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// ===== DEVELOP BRANCH PAGES (Auth - Member 1) =====
import LandingPage from '@/pages/LandingPage';
import SignInPage from '@/pages/SignInPage';
import SignUpPage from '@/pages/SignUpPage';
import OAuthCallback from '@/pages/OAuthCallback';

// ===== MEMBER 3 (Sandavi) - Structured Notes =====
import M3Dashboard from './m3_structurednotes/pages/Dashboard';
import NoteEditor from './m3_structurednotes/pages/NoteEditor';

// ===== SHARED DASHBOARD =====
import Dashboard from '@/pages/Dashboard';

import './index.css';

/**
 * Main App Component
 * Renders routing for auth, dashboard, and notes pages
 */
function App() {
  return (
    <Router>
      <Routes>
        {/* Landing and auth pages (Member 1) */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />

        {/* Shared Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Member 3 - Structured Notes */}
        <Route path="/notes" element={<M3Dashboard />} />
        <Route path="/notes/editor/:noteId" element={<NoteEditor />} />

        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;