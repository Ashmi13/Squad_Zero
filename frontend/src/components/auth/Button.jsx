import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * Button Component
 * Reusable button with multiple variants and loading state
 */
export const Button = ({
  children,
  variant = 'primary',
  isLoading = false,
  fullWidth = false,
  disabled = false,
  className = '',
  ...props
}) => {
  const baseClasses = `
    inline-flex items-center justify-center gap-2
    px-6 py-3 rounded-lg
    font-medium text-sm
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    ${fullWidth ? 'w-full' : ''}
  `;

  const variantClasses = {
    primary: `
      bg-primary-600 text-white
      hover:bg-primary-700
      focus:ring-primary-500
      shadow-sm hover:shadow
      disabled:hover:bg-primary-600
    `,
    secondary: `
      bg-neutral-100 text-neutral-900
      hover:bg-neutral-200
      focus:ring-neutral-500
      disabled:hover:bg-neutral-100
    `,
    outline: `
      bg-transparent border-2 border-neutral-300 text-neutral-700
      hover:bg-neutral-50 hover:border-neutral-400
      focus:ring-neutral-500
      disabled:hover:bg-transparent
    `,
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  );
};
