import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { z } from 'zod';

import { InputField } from './InputField';
import { Button } from './Button';
import axiosInstance from '@/lib/axios';
import { config } from '@/config/env';
import { setTokens } from '@/utils/tokenStorage';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    // Pre-filling test credentials as per sprint planning
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleGoogleSignIn = () => {
    // We rely on the Vite proxy for /api, so we must go to current origin + proxy path
    // Force the browser to treat this as a fresh external navigation
    const url = `${window.location.origin}${config.oauth.googleAuthUrl}`;
    console.log('Redirecting to Google login through proxy:', url);
    window.location.assign(url);
  };

  const onSubmit = async (data) => {
    setIsLoading(true);
    setIsError(false);
    setIsSuccess(false);

    try {
      // Standard API Call
      const response = await axiosInstance.post(config.endpoints.login, {
        email: data.email,
        password: data.password,
      });

      setTokens(response.data.access_token, response.data.refresh_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      setIsSuccess(true);
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch (error) {
      setIsError(true);
      setErrorMessage(
        error.response?.data?.detail || 'Invalid email or password. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="font-display text-3xl text-slate-900 mb-2">Welcome Back</h2>
      <p className="text-slate-500 mb-4">Sign in to your account</p>
      
      {/* Admin / Test Credentials Notice */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
        <AlertCircle className="text-blue-600" size={20} />
        <p className="text-blue-800 text-sm"></p>
      </div>

      {isSuccess && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="text-emerald-600" size={20} />
          <p className="text-emerald-800 text-sm">Login successful! Redirecting...</p>
        </div>
      )}

      {isError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="text-red-600" size={20} />
          <p className="text-red-800 text-sm">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <InputField
          label="Email"
          type="email"
          placeholder="domat@example.com"
          {...register('email')}
          icon={<Mail size={16} />}
          error={errors.email?.message}
        />

        <InputField
          label="Password"
          type="password"
          placeholder="Enter your password"
          {...register('password')}
          icon={<Lock size={16} />}
          showPasswordToggle
          error={errors.password?.message}
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-500">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
            Remember me
          </label>
          <Link to="/forgot-password" title="Forgot Password" className="text-indigo-600 hover:text-indigo-700">
            Forgot Password
          </Link>
        </div>

        <Button
          type="submit"
          isLoading={isLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-700"
        >
          Sign in
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px w-full bg-slate-200" />
        <span className="text-xs uppercase text-slate-400">or</span>
        <div className="h-px w-full bg-slate-200" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <span className="inline-flex items-center gap-3">
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </span>
      </button>
    </div>
  );
}
