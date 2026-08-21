import React, { createContext, useState, useEffect, useLayoutEffect } from 'react';

export const ThemeContext = createContext();

const FONT_SIZE_VALUES = {
  Small: '14px',
  Medium: '18px',
  Large: '22px',
};

const getStoredFontSize = () => {
  const saved = localStorage.getItem('font-size-mode');
  return Object.prototype.hasOwnProperty.call(FONT_SIZE_VALUES, saved) ? saved : 'Small';
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    // Load theme from localStorage or default to light
    const saved = localStorage.getItem('theme-mode');
    return saved ? JSON.parse(saved) : false;
  });

  const [fontSize, setFontSize] = useState(() => {
    return getStoredFontSize();
  });

  // Save theme preference to localStorage
  useEffect(() => {
    localStorage.setItem('theme-mode', JSON.stringify(isDark));
    // Apply theme via class so CSS variables cascade properly
    if (isDark) {
  document.documentElement.classList.add('dark');
  document.documentElement.style.backgroundColor = '#0f1419';
  document.body.style.backgroundColor = '#0f1419';
} else {
  document.documentElement.classList.remove('dark');
  document.documentElement.style.backgroundColor = '#ffffff';
  document.body.style.backgroundColor = '#ffffff';
}
  }, [isDark]);

  useLayoutEffect(() => {
    localStorage.setItem('font-size-mode', fontSize);
    const nextSize = FONT_SIZE_VALUES[fontSize] || FONT_SIZE_VALUES.Small;
    document.documentElement.style.setProperty('--app-font-size', nextSize);
    document.documentElement.style.fontSize = nextSize;
    if (document.body) {
      document.body.style.fontSize = nextSize;
    }
  }, [fontSize]);

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  const theme = {
    isDark,
    colors: {
      // Background colors - Professional
      bg: {
        primary: isDark ? '#0f1419' : '#ffffff',
        secondary: isDark ? '#1a1f2e' : '#f8fafb',
        tertiary: isDark ? '#252d3d' : '#f0f4f8',
      },
      // Text colors - Professional
      text: {
        primary: isDark ? '#e8eef2' : '#1a202c',
        secondary: isDark ? '#a0aac0' : '#4a5568',
        tertiary: isDark ? '#7a8aa0' : '#718096',
      },
      // UI element colors
      ui: {
        border: isDark ? '#2d3748' : '#e2e8f0',
        input: isDark ? '#1a1f2e' : '#f7fafc',
        hover: isDark ? '#2d3748' : '#edf2f7',
      },
      // Accent colors - Professional gradient
      accent: '#5b4fb8',
      accentLight: '#7c6fd4',
      accentDark: '#4a3fa5',
    }
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, theme, fontSize, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
