import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/auth/Button';
import { InputField } from '@/components/auth/InputField';

/**
 * ForgotPassword Component
 * Allows users to request a password reset email via Supabase
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    try {
      // Supabase resets password for the given email
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      setIsSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        <div className="mb-8">
          <Link to="/login" className="inline-flex items-center text-sm text-slate-500 hover:text-indigo-600 transition-colors gap-1 mb-6">
            <ArrowLeft size={16} />
            Back to Login
          </Link>
          <h2 className="font-display text-3xl text-slate-900 mb-2 font-semibold">Forgot Password?</h2>
          <p className="text-slate-500">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {isSuccess ? (
          <div className="space-y-6">
            <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-start gap-3">
              <CheckCircle className="text-green-600 mt-0.5" size={20} />
              <div>
                <p className="text-green-800 font-medium">Reset link sent!</p>
                <p className="text-green-700 text-sm mt-1">
                  Check your mail address <span className="font-semibold">{email}</span> and click the link to continue.
                </p>
              </div>
            </div>
            <p className="text-center text-sm text-slate-500">
              Didn't receive the email? Check your spam folder or{' '}
              <button 
                onClick={() => setIsSuccess(false)} 
                className="text-indigo-600 font-semibold hover:underline"
              >
                try again
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-800 text-sm">
                <AlertCircle size={18} className="text-red-600" />
                {error}
              </div>
            )}

            <InputField
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail size={16} />}
              required
            />

            <Button
              type="submit"
              fullWidth
              isLoading={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 mt-2"
            >
              Send Reset Link
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
