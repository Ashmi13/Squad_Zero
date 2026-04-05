// Environment configuration
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
  oauth: {
    googleAuthUrl: '/api/v1/auth/google-login',
    githubAuthUrl: '/api/v1/auth/github',
  },
  endpoints: {
    login: '/api/v1/auth/signin',
    register: '/api/v1/auth/signup',
    forgotPassword: '/api/v1/auth/request-password-reset',
    resetPassword: '/api/v1/auth/confirm-password-reset',
    refreshToken: '/api/v1/auth/refresh-token',
    logout: '/api/v1/auth/logout',
    me: '/api/v1/users/me',
  },
};
