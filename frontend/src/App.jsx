import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import SignInPage from '@/pages/SignInPage';
import SignUpPage from '@/pages/SignUpPage';
import OAuthCallback from '@/pages/OAuthCallback';
import Dashboard from '@/pages/Dashboard';

/**
 * Main App Component
 * Renders routing for auth and dashboard pages
 */
function App() {
  return (
    <Router>
      <Routes>
        {/* Landing and auth pages */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />

        {/* Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
