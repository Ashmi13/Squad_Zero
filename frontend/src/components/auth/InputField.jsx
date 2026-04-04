import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Input Field Component
 * Reusable input with label, error state, and password toggle
 * Styled according to Figma design specifications
 */
export const InputField = forwardRef(
  (
    { label, error, type = 'text', icon, showPasswordToggle = false, className = '', ...props },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const inputType = showPasswordToggle && showPassword ? 'text' : type;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-neutral-700 mb-2">{label}</label>
        )}

        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>
          )}
          <input
            ref={ref}
            type={inputType}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={`
              w-full px-4 py-3 
              bg-white border rounded-lg
              text-neutral-900 text-sm
              placeholder:text-neutral-400
              transition-all duration-200
              focus:outline-none focus:ring-2
              disabled:bg-neutral-50 disabled:cursor-not-allowed
              ${
                error
                  ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  : isFocused
                    ? 'border-primary-500 focus:ring-primary-500 focus:border-primary-500'
                    : 'border-neutral-300 hover:border-neutral-400'
              }
              ${icon ? 'pl-10' : ''}
              ${showPasswordToggle ? 'pr-12' : ''}
              ${className}
            `}
            {...props}
          />

          {showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          )}
        </div>

        {error && (
          <p className="mt-1.5 text-sm text-red-500 flex items-start gap-1">
            <span className="inline-block mt-0.5">⚠</span>
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);

InputField.displayName = 'InputField';
