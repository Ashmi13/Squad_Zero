import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { z } from 'zod';

import { InputField } from './InputField';
import { Button } from './Button';
import { OAuthButton } from './OAuthButton';
import axiosInstance from '@/lib/axios';
import { config } from '@/config/env';
import { setTokens } from '@/utils/tokenStorage';

// Validation schema
const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters long'),
});

/**
 * Login Card Component
 * Production-ready authentication component with:
 * - Email/Password form validation using React Hook Form + Zod
 * - OAuth2 integration (Google/GitHub)
 * - Loading, error, and success state management
 * - Responsive design with Tailwind CSS
 * - Security best practices
 */
export const LoginCard = () => {
  // Form state management with React Hook Form + Zod validation
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  // Component state
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  /**
   * Handle form submission - Email/Password login
   */
  const onSubmit = async (data) => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage('');
    setIsSuccess(false);

    try {
      // POST request to FastAPI backend
      const response = await axiosInstance.post(config.endpoints.login, {
        email: data.email,
        password: data.password,
      });

      // Store JWT tokens securely
      setTokens(response.data.access_token, response.data.refresh_token);
      // Persist user record and notify UI listeners so profile appears immediately
      localStorage.setItem('user', JSON.stringify(response.data.user));
      window.dispatchEvent(new Event('user-profile-updated'));

      // Success state
      setIsSuccess(true);

      // Redirect to files dashboard
      setTimeout(() => {
        window.location.href = '/files';
      }, 1000);
    } catch (error) {
      // Error handling
      setIsError(true);

      if (error.response?.data?.detail) {
        setErrorMessage(error.response.data.detail);
      } else {
        setErrorMessage('Invalid email or password. Please try again.');
      }

      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle forgot password
   */
  const handleForgotPassword = () => {
    window.location.href = '/forgot-password';
  };

  /**
   * Handle sign up navigation
   */
  const handleSignUp = () => {
    window.location.href = '/signup';
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8">
      {/* Login Card Container */}
      <div className="bg-white rounded-2xl shadow-card p-8 sm:p-10 space-y-6">
        {/* Logo Section */}
        <div className="flex justify-center mb-6">
          <img src="/Logo.png" alt="SquadZero Logo" className="h-12 w-auto" />
        </div>

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Welcome Back</h1>
          <p className="text-sm text-neutral-600">Sign in to your account to continue</p>
        </div>

        {/* Error Alert */}
        {isError && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Login Failed</h3>
              <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {isSuccess && (
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-green-800">Success!</h3>
              <p className="text-sm text-green-700 mt-1">Logging you in...</p>
            </div>
          </div>
        )}

        {/* OAuth Buttons Section */}
        <div className="space-y-3">
          <OAuthButton provider="google" disabled={isLoading} />
          <OAuthButton provider="github" disabled={isLoading} />
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-neutral-500 font-medium">
              Or continue with email
            </span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email Input */}
          <div className="relative">
            <InputField
              {...register('email')}
              type="email"
              label="Email Address"
              placeholder="Enter your email"
              error={errors.email?.message}
              disabled={isLoading}
              autoComplete="email"
            />
            <Mail className="absolute right-3 top-[42px] w-5 h-5 text-neutral-400 pointer-events-none" />
          </div>

          {/* Password Input */}
          <div className="relative">
            <InputField
              {...register('password')}
              type="password"
              label="Password"
              placeholder="Enter your password"
              error={errors.password?.message}
              showPasswordToggle
              disabled={isLoading}
              autoComplete="current-password"
            />
            <Lock className="absolute right-12 top-[42px] w-5 h-5 text-neutral-400 pointer-events-none" />
          </div>

          {/* Forgot Password Link */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isLoading}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors disabled:opacity-50"
            >
              Forgot Password?
            </button>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isLoading || isSubmitting}
            disabled={isLoading || isSubmitting}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        {/* Sign Up Link */}
        <div className="text-center pt-4 border-t border-neutral-200">
          <p className="text-sm text-neutral-600">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={handleSignUp}
              disabled={isLoading}
              className="font-medium text-primary-600 hover:text-primary-700 transition-colors disabled:opacity-50"
            >
              Sign Up
            </button>
          </p>
        </div>
      </div>

      {/* Additional Security Notice */}
      <div className="mt-6 text-center">
        <p className="text-xs text-neutral-500">Protected by industry-standard encryption</p>
      </div>
    </div>
  );
};
