import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';

/**
 * Auth Layout Component
 * Split layout: Left side shows signup design, right side shows form
 */
export default function AuthLayout() {
  const [isSignup, setIsSignup] = useState(false);

  // Design images for signup steps
  const designImages = [
    '/Sign up 1.png',
    '/Sign up 2.png',
    '/Sign up 3.png',
    '/Sign up 4.png',
    '/Sign up 5.png',
    '/Sign up 6.png',
    '/Sign up 9.png',
  ];

  // Get a random design image for variety
  const randomDesign = designImages[Math.floor(Math.random() * designImages.length)];

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Side - Design Showcase */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-blue-600 font-bold text-xl">SZ</span>
            </div>
            <span className="text-white font-bold text-lg">SquadZero</span>
          </div>

          {/* Design showcase */}
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-sm">
              <img
                src={randomDesign}
                alt="Authentication Design"
                className="w-full rounded-xl shadow-2xl object-cover"
                onError={(e) => {
                  e.target.src = '/Sign up 1.png';
                }}
              />
            </div>
          </div>

          {/* Footer text */}
          <div className="text-white">
            <h2 className="text-3xl font-bold mb-4">
              {isSignup ? 'Join our community' : 'Welcome back'}
            </h2>
            <p className="text-blue-100 text-lg leading-relaxed">
              {isSignup
                ? 'Create your account and start your journey with SquadZero'
                : 'Access your secure authentication dashboard with ease'}
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Logo for mobile */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">SZ</span>
            </div>
            <span className="text-blue-600 font-bold text-lg">SquadZero</span>
          </div>

          {/* Form */}
          {isSignup ? (
            <>
              <SignupForm />
              <p className="mt-6 text-center text-gray-600">
                Already have an account?{' '}
                <button
                  onClick={() => setIsSignup(false)}
                  className="text-blue-600 font-semibold hover:text-blue-700 transition"
                >
                  Sign in
                </button>
              </p>
            </>
          ) : (
            <>
              <LoginForm />
              <p className="mt-6 text-center text-gray-600">
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => setIsSignup(true)}
                  className="text-blue-600 font-semibold hover:text-blue-700 transition"
                >
                  Sign up
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
