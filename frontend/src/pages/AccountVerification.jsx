import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';

/**
 * AccountVerification Component
 * This page is the landing target after email confirmation.
 */
export default function AccountVerification() {
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // Simulate a brief verification check then redirect after success
    const timer = setTimeout(() => {
      setIsVerifying(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-10 text-center transform transition-all hover:scale-[1.01]">
        {/* Web Logo */}
        <div className="flex justify-center flex-col mb-8">
          <img src="/logo.png" alt="Neura Note Logo" className="h-16 w-16 self-center" />
           <h2 className="text-3xl font-bold text-slate-900 font-display tracking-tight">
                 Neura Note
              </h2>

        </div>

        {isVerifying ? (
          <div className="space-y-6">
            <div className="flex justify-center">
              <Loader2 className="text-indigo-600 animate-spin" size={48} />
            </div>
            <h2 className="text-2xl font-semibold text-slate-800 font-display">Finalizing Verification...</h2>
            <p className="text-slate-500">Just a moment while we set up your workspace.</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="flex justify-center">
              <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center border-4 border-green-100">
                <CheckCircle className="text-green-500 drop-shadow-sm" size={56} />
              </div>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-slate-900 font-display tracking-tight">
                Account Successfully Verified by Neura Note
              </h2>
              <p className="text-slate-600 text-lg font-medium">
                Your email is confirmed and your account is now fully active.
              </p>
            
            </div>

            <div className="pt-4 border-t border-slate-100">
              <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                System Secure
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
