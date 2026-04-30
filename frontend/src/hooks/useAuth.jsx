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
<<<<<<< HEAD:frontend/src/hooks/useAuth.jsx

=======
>>>>>>> d36a44c8d6a533e5db7b65f80dbea0c9fa5f689f:frontend/src/hooks/useAuth.js
          if (decoded) {
            const currentTime = Date.now() / 1000;
            if (decoded.exp && decoded.exp > currentTime) {
              setUser({
                id: decoded.sub,
                email: decoded.email,
                fullName: decoded.full_name,
<<<<<<< HEAD:frontend/src/hooks/useAuth.jsx
              });
              setIsAuthenticated(true);
            } else {
              // Token expired — clear and fall to unauthenticated state
=======
                role: decoded.role || 'user',
              });
              setIsAuthenticated(true);
            } else {
>>>>>>> d36a44c8d6a533e5db7b65f80dbea0c9fa5f689f:frontend/src/hooks/useAuth.js
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
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = 'http://localhost:5173/';
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