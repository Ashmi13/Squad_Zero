import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { z } from 'zod';

import { InputField } from './InputField';
import { Button } from './Button';
import axiosInstance from '@/lib/axios';
import { config } from '@/config/env';
import { setTokens } from '@/utils/tokenStorage';

// Validation schema for signup
const signupSchema = z
  .object({
    email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
    full_name: z.string().min(2, 'Name must be at least 2 characters'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export function SignupForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
  });

  const navigate = useNavigate();

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
      const response = await axiosInstance.post(config.endpoints.register, {
        email: data.email,
        full_name: data.full_name,
        password: data.password,
      });

      setTokens(response.data.access_token, response.data.refresh_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      setIsSuccess(true);
      setTimeout(() => {
        navigate('/verify-email', { state: { email: data.email } });
      }, 1000);
    } catch (error) {
      setIsError(true);
      setErrorMessage(
        error.response?.data?.detail || 'Failed to create account. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="font-display text-3xl text-slate-900 mb-2">Create Account</h2>
      <p className="text-slate-500 mb-8">Join Neura Note today</p>

      {isSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="text-green-600" size={20} />
          <p className="text-green-800 text-sm">Account created successfully! Redirecting...</p>
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
          label="Full Name"
          type="text"
          placeholder="John Doe"
          {...register('full_name')}
          icon={<User size={16} />}
          error={errors.full_name?.message}
        />

        <InputField
          label="Email"
          type="email"
          placeholder="you@example.com"
          {...register('email')}
          icon={<Mail size={16} />}
          error={errors.email?.message}
        />

        <InputField
          label="Password"
          type="password"
          placeholder="••••••••"
          {...register('password')}
          icon={<Lock size={16} />}
          showPasswordToggle
          error={errors.password?.message}
        />

        <InputField
          label="Confirm Password"
          type="password"
          placeholder="••••••••"
          {...register('confirmPassword')}
          icon={<Lock size={16} />}
          showPasswordToggle
          error={errors.confirmPassword?.message}
        />

        <Button
          type="submit"
          isLoading={isLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-700"
        >
          Create Account
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
        className="w-full flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>
    </div>
  );
}
