import axios from 'axios';
import { config } from '@/config/env';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/utils/tokenStorage';

/**
 * Axios instance configured for FastAPI backend communication
 */
export const axiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 10000,
  withCredentials: true, // Enable sending/receiving HttpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Prevent multiple concurrent refresh token requests
let refreshPromise = null;

/**
 * Request interceptor to attach JWT token to requests
 */
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getAccessToken();

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor to handle token refresh and errors
 */
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - Token expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Prevent multiple concurrent refresh attempts
      if (refreshPromise) {
        try {
          const newTokens = await refreshPromise;
          originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          return axiosInstance(originalRequest);
        } catch (err) {
          return Promise.reject(err);
        }
      }

      originalRequest._retry = true;

      refreshPromise = (async () => {
        try {
          const refreshToken = getRefreshToken();

          if (!refreshToken) {
            clearTokens();
            window.location.href = '/login';
            throw new Error('No refresh token available');
          }

          const refreshResponse = await axios.post(
            `${config.apiBaseUrl}/api/v1/auth/refresh-token`,
            { refresh_token: refreshToken },
            {
              headers: { 'Content-Type': 'application/json' },
              withCredentials: true,
            }
          );

          const { access_token, refresh_token } = refreshResponse.data;
          setTokens(access_token, refresh_token);
          
          return { accessToken: access_token, refreshToken: refresh_token };
        } catch (refreshError) {
          // Clear tokens and redirect to login on refresh failure
          clearTokens();
          window.location.href = '/login';
          throw refreshError;
        } finally {
          refreshPromise = null;
        }
      })();

      try {
        const newTokens = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        return axiosInstance(originalRequest);
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
