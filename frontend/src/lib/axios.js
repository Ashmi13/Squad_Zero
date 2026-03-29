import axios from 'axios';
import { config } from '@/config/env';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '@/utils/tokenStorage';

/**
 * Axios instance configured for FastAPI backend communication
 */
export const axiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken();

        if (!refreshToken) {
          clearTokens();
          window.location.href = '/login';
          return Promise.reject(error);
        }

        const refreshResponse = await axiosInstance.post(
          '/refresh-token',
          { refresh_token: refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        setTokens(refreshResponse.data.access_token, refreshResponse.data.refresh_token);
        originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.access_token}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
