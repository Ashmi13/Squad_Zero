import React from 'react';
import { Link } from 'react-router-dom';
import { SignupForm } from '@/components/auth/SignupForm';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-screen-2xl px-6 py-10 lg:flex lg:min-h-screen lg:items-stretch lg:gap-12">
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-10 text-white relative overflow-hidden">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Neura Note" className="h-10 w-10" />
            <span className="text-lg font-semibold">Neura Note</span>
          </div>
          <div>
            <h1 className="font-display text-5xl font-semibold leading-tight">
              Create Your
              <br />
              SecondBrain
              <br />
              Today
            </h1>
          </div>

          <div className="absolute inset-0 flex items-center justify-center opacity-50 pointer-events-none">
            <img
              src="/logo.png"
              alt="Neura Note Logo"
              className="w-[520px] object-contain"
              onError={(e) => {
                e.currentTarget.src = '/logo.png';
              }}
            />
          </div>
        </div>
        <div className="flex w-full items-center justify-center lg:w-1/2">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
            <SignupForm />

            <div className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
