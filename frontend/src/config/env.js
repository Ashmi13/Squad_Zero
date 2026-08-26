// Environment configuration
// Read the backend URL from the VITE_API_BASE_URL env var (set in Vercel).
// Falls back to the Render URL only for convenience so the app still boots
// if the env var is missing. All auth/API calls use this.
const apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || 'https://squad-zero-fcl4.onrender.com';

export const config = {
  apiBaseUrl,
  oauth: {
    googleAuthUrl: '/api/v1/auth/google-login',
    githubAuthUrl: '/api/v1/auth/github',
  },
  endpoints: {
    login: '/api/v1/auth/signin',
    register: '/api/v1/auth/signup',
    forgotPassword: '/api/v1/auth/request-password-reset',
    resetPassword: '/api/v1/auth/confirm-password-reset',
    verificationStatus: '/api/v1/auth/verification-status',
    refreshToken: '/api/v1/auth/refresh-token',
    logout: '/api/v1/auth/logout',
    me: '/api/v1/users/me',
    suspendedInfo: '/api/v1/auth/suspended-info',
  },
};
