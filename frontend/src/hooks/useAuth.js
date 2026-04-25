import { useState, useEffect, useCallback } from 'react';
import { getAccessToken, clearTokens, decodeToken } from '@/utils/tokenStorage';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = () => {
      try {
        const token = getAccessToken();
        if (token) {
          const decoded = decodeToken(token);
          if (decoded) {
            const currentTime = Date.now() / 1000;
            if (decoded.exp && decoded.exp > currentTime) {
              setUser({
                id: decoded.sub,
                email: decoded.email,
                fullName: decoded.full_name,
                role: decoded.role || 'user',
              });
              setIsAuthenticated(true);
            } else {
              clearTokens();
            }
          }
        }
      } catch (err) {
        console.warn('Auth init error (non-fatal):', err);
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  }, []);

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