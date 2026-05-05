import React, { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    // Load theme from localStorage or default to light
    const saved = localStorage.getItem('theme-mode');
    return saved ? JSON.parse(saved) : false;
  });

  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('font-size-mode');
    return saved || 'Medium';
  });

  // Save theme preference to localStorage
  useEffect(() => {
    localStorage.setItem('theme-mode', JSON.stringify(isDark));
    // Apply theme via class so CSS variables cascade properly
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('font-size-mode', fontSize);
    const map = {
      Small: '14px',
      Medium: '16px',
      Large: '18px',
    };
    const nextSize = map[fontSize] || map.Medium;
    document.documentElement.style.setProperty('--app-font-size', nextSize);
    document.documentElement.style.fontSize = nextSize;
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
