import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/auth/Button';
import { InputField } from '@/components/auth/InputField';

/**
 * ChangePassword Component
 * For logged-in users to update their password securely.
 * Requires re-authentication with the current password first.
 */
export default function ChangePassword() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    // 1. Basic validation
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      setIsLoading(false);
      return;
    }

    try {
      // 2. Get the current user info from local storage (safe fallback)
      const userData = localStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : null;
      
      if (!user || !user.email) {
        throw new Error('Could not find user session. Please log in again.');
      }

      // 3. Re-authenticate: attempt to sign in with current password
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Current password incorrect. Please try again.');
      }

      // 4. Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setIsSuccess(true);
      
      // Cleanup: Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Optional: redirect after success
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);

    } catch (err) {
      setError(err.message || 'Failed to change password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        <div className="mb-8 text-center">
          <button 
            onClick={() => navigate(-1)} 
            className="inline-flex items-center text-sm text-slate-500 hover:text-indigo-600 transition-colors gap-1 mb-4 flex self-start"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <h2 className="font-display text-3xl text-slate-900 mb-2 font-semibold">Change Password</h2>
          <p className="text-slate-500">
            For your security, please verify your current password.
          </p>
        </div>

        {isSuccess ? (
          <div className="space-y-6">
            <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-start gap-3">
              <CheckCircle className="text-green-600 mt-0.5" size={20} />
              <div>
                <p className="text-green-800 font-medium">Password updated successfully!</p>
                <p className="text-green-700 text-sm mt-1">
                  Your security settings have been updated. Redirecting in 3 seconds...
                </p>
              </div>
            </div>
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
              label="Current Password"
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              icon={<Lock size={16} />}
              required
              showPasswordToggle
            />

            <hr className="border-slate-100 my-4" />

            <InputField
              label="New Password"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              icon={<Lock size={16} />}
              required
              showPasswordToggle
            />

            <InputField
              label="Confirm New Password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={<Lock size={16} />}
              required
              showPasswordToggle
            />

            <Button
              type="submit"
              fullWidth
              isLoading={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 mt-2"
            >
              Update Password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
