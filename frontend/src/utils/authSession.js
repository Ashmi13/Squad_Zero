import { config } from '@/config/env';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/utils/tokenStorage';

const refreshInFlight = { promise: null };

const buildUrl = (path) => `${config.apiBaseUrl || ''}${path}`;

export const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    return null;
  }

  if (!refreshInFlight.promise) {
    refreshInFlight.promise = fetch(buildUrl(config.endpoints.refreshToken), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) {
          let detail = 'Failed to refresh session';
          try {
            const data = await response.json();
            detail = data?.detail || detail;
          } catch {
            // ignore parsing errors
          }
          throw new Error(detail);
        }

        return response.json();
      })
      .then((payload) => {
        if (payload?.access_token) {
          setTokens(payload.access_token, payload.refresh_token || refreshToken);
          return payload.access_token;
        }

        throw new Error('Refresh response did not include a new access token');
      })
      .catch((error) => {
        clearTokens();
        throw error;
      })
      .finally(() => {
        refreshInFlight.promise = null;
      });
  }

  return refreshInFlight.promise;
};

export const getValidAccessToken = async () => {
  const token = getAccessToken();
  if (token) {
    return token;
  }

  return refreshAccessToken();
};

export const clearAuthAndRedirect = (message = 'Invalid or expired token') => {
  clearTokens();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
  throw new Error(message);
};

export const authFetch = async (path, options = {}) => {
  const request = async (tokenOverride = null) => {
    const headers = {
      ...(options.headers || {}),
    };

    const token = tokenOverride || getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return fetch(buildUrl(path), {
      credentials: 'include',
      ...options,
      headers,
    });
  };

  let response = await request();
  if (response.status !== 401) {
    return response;
  }

  try {
    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) {
      clearAuthAndRedirect();
    }
    response = await request(refreshedToken);
    if (response.status !== 401) {
      return response;
    }
  } catch {
    clearAuthAndRedirect();
  }

  clearAuthAndRedirect();
  return response;
};
