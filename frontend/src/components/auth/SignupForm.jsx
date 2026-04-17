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
    </div>
  );
}
