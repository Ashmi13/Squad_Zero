import React from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { ShieldAlert, Mail, Phone, ArrowLeft, Lock } from 'lucide-react';
import { clearTokens } from '@/utils/tokenStorage';

export default function AccountSuspended() {
  const location = useLocation();
  const navigate = useNavigate();

  // Guard: Ensure non-logged-in users cannot access this page unless they triggered suspension state
  const fromSuspension = location.state?.fromSuspension;
  const customMessage = location.state?.message;

  if (!fromSuspension) {
    return <Navigate to="/login" replace />;
  }

  const handleBackToLogin = () => {
    // Clear any credentials/tokens to reset state
    clearTokens();
    localStorage.removeItem('user');
    // Dispatch event if user-profile-updated is listened to
    window.dispatchEvent(new Event('user-profile-updated'));
    // Redirect to login page
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative premium blurs */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-indigo-500/20 blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 h-[400px] w-[400px] rounded-full bg-red-500/10 blur-[100px]" />
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-lg bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 md:p-10 shadow-2xl flex flex-col items-center text-center">
        
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 mb-8">
          <img src="/logo.png" alt="Neura Note" className="h-10 w-10 object-contain" />
          <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            NeuroNote
          </span>
        </div>

        {/* Warning / Lock Icon */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full scale-125" />
          <div className="relative flex items-center justify-center h-20 w-20 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500">
            <ShieldAlert size={44} className="animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-tight">
          Account Temporarily Suspended
        </h2>

        {/* Description */}
        <p className="text-slate-400 text-sm md:text-base leading-relaxed mb-8 max-w-md">
          {customMessage || "Your account has been suspended due to a violation of our terms of service or policy guidelines. If you believe this is a mistake, please reach out to our administration team."}
        </p>

        {/* Contact details box */}
        <div className="w-full bg-slate-950/55 border border-slate-800/50 rounded-2xl p-5 mb-8 text-left space-y-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Contact Support
          </h3>
          
          <div className="space-y-3">
            <a 
              href="mailto:nihaajahamed@gmail.com" 
              className="flex items-center gap-3 text-slate-300 hover:text-indigo-400 transition-colors group"
            >
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-indigo-400 transition-colors">
                <Mail size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500">Support Email</span>
                <span className="text-sm font-medium">support@neuronote.com</span>
              </div>
            </a>

            <a 
              href="tel:+94759896910" 
              className="flex items-center gap-3 text-slate-300 hover:text-indigo-400 transition-colors group"
            >
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-indigo-400 transition-colors">
                <Phone size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500">Support Phone</span>
                <span className="text-sm font-medium">+94 759 896 910</span>
              </div>
            </a>
          </div>
        </div>

        {/* Back to Login Button */}
        <button
          onClick={handleBackToLogin}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-4 border border-slate-700/55 transition-all duration-200 active:scale-95 cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Back to Login</span>
        </button>

      </div>

      {/* Footer Security Note */}
      <p className="mt-8 text-xs text-slate-600 flex items-center gap-1.5 z-10">
        <Lock size={12} /> Secure login portal
      </p>
    </div>
  );
}
