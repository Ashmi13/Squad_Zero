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
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleGoogleSignIn = () => {
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
      <p className="text-slate-500 mb-6">Sign in to your account</p>

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
          placeholder="Enter your email"
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
        Continue with Google
      </button>
    </div>
  );
}