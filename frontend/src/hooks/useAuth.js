import { useState, useEffect, useCallback } from 'react';
import { getAccessToken, clearTokens, decodeToken } from '@/utils/tokenStorage';

//Provide authentication state and methods

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  //Initialize authentication state from stored token
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
      } catch (err) {
        // Error reading/decoding the token — treat as logged out
        console.warn('Auth init error (non-fatal):', err);
        clearTokens();
      } finally {
        // always unblock UI
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  //Logout function
  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  }, []);

  //Check if user is authenticated
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
