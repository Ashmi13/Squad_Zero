import { useState, useEffect, useCallback } from 'react';
import { getAccessToken, clearTokens, decodeToken } from '@/utils/tokenStorage';

/**
 * Custom Authentication Hook
 * Provides authentication state and methods throughout the application
 */
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Initialize authentication state from stored token
   */
  useEffect(() => {
    const initAuth = () => {
      const token = getAccessToken();

      if (token) {
        const decoded = decodeToken(token);

        if (decoded) {
          // Check if token is expired
          const currentTime = Date.now() / 1000;
          if (decoded.exp && decoded.exp > currentTime) {
            setUser({
              id: decoded.sub,
              email: decoded.email,
              fullName: decoded.full_name,
            });
            setIsAuthenticated(true);
          } else {
            // Token expired, clear storage
            clearTokens();
          }
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  /**
   * Logout function
   */
  const logout = useCallback(() => {
    clearTokens();
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = 'http://localhost:5173/';
  }, []);

  /**
   * Check if user is authenticated
   */
  const checkAuth = useCallback(() => {
    return !!getAccessToken();
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
    checkAuth,
  };
};
