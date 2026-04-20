import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/auth/Button';
import { InputField } from '@/components/auth/InputField';

/**
 * ResetPassword Component
 * Allows users to set a new password after arriving from the reset link
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // When the user clicks the link, Supabase sends them to /reset-password#access_token=...
    // The supabase client automatically picks this up, so we just check if the user is authenticated
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          setError('The password reset link is invalid or has expired.');
        }
      } catch (err) {
        setError('Failed to validate reset link.');
      } finally {
        setIsValidating(false);
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Form Validation 
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Supabase updates the user's password using the current session
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setIsSuccess(true);
      // Success display for 3 seconds before navigation
      setTimeout(() => {
        navigate('/login');
      }, 4000);
    } catch (err) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-10 border border-slate-100 transform transition-all">
        
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Neura Note Logo" className="h-14 w-auto mb-4" />
            <h2 className="text-3xl font-bold text-slate-900 font-display tracking-tight">
                 Neura Note
              </h2>
        </div>

        {isValidating ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <Loader2 className="text-indigo-600 animate-spin" size={40} />
            <p className="text-slate-600 font-medium font-display underline decoration-indigo-200 decoration-2 underline-offset-4">
              Reset Link Validated - Secured by Neuro Note
            </p>
          </div>
        ) : error && (error.includes('expired') || error.includes('invalid')) ? (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-8 border-4 border-red-100">
              <AlertCircle className="text-red-500" size={56} strokeWidth={1.5} />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 font-display mb-4 tracking-tight">
              Link Expired. Try Again...
            </h2>
            <p className="text-slate-500 text-lg max-w-[280px] leading-relaxed mb-10">
              Please request a new reset link from the login page.
            </p>
           
          </div>
        ) : isSuccess ? (
          <div className="space-y-8 animate-in fade-in zoom-in duration-500 text-center">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center border-4 border-green-100">
                <CheckCircle className="text-green-500" size={40} />
              </div>
            </div>
            
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900 font-display">Successfully Updated!</h2>
              <p className="text-slate-600">
                Your password has been changed successfully.
              </p>
              <div className="pt-4 flex justify-center">
                <span className="inline-flex items-center px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-widest border border-indigo-100 italic">
                  Protected by Neua Note
                </span>
              </div>
            </div>
            
            <div className="flex justify-center items-center gap-2 text-slate-400 text-sm animate-pulse">
              <Loader2 size={14} className="animate-spin" />
              Redirecting to login...
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="font-display text-2xl text-slate-900 mb-2 font-bold tracking-tight">Set New Password</h2>
              <p className="text-slate-500 text-sm">
                Create a strong, new password for your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-700 text-sm font-medium animate-shake">
                  <AlertCircle size={18} className="text-red-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-5">
                <InputField
                  label="New Password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  icon={<Lock size={18} className="text-slate-400" />}
                  required
                  showPasswordToggle
                  className="rounded-2xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
                />

                <InputField
                  label="Confirm New Password"
                  type="password"
                  placeholder="Must match new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  icon={<Lock size={18} className="text-slate-400" />}
                  required
                  showPasswordToggle
                  className="rounded-2xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
                />
              </div>

              <Button
                type="submit"
                fullWidth
                isLoading={isLoading}
                loadingText="Processing..."
                className="bg-indigo-600 hover:bg-indigo-700 h-14 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] group flex items-center justify-center gap-2"
              >
                {!isLoading && <ShieldCheck size={20} className="group-hover:rotate-12 transition-transform" />}
                {isLoading ? 'Processing...' : 'Update Password'}
              </Button>
              
              <button 
                type="button"
                onClick={() => navigate('/login')}
                className="w-full text-slate-400 text-sm font-medium flex items-center justify-center gap-2 hover:text-slate-600 transition-colors"
              >
                <ArrowLeft size={16} />
                Back to Login
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
