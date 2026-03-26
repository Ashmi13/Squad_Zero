// Environment configuration
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  oauth: {
    googleAuthUrl: '/auth/google',
    githubAuthUrl: '/auth/github',
  },
  endpoints: {
    login: '/login',
    register: '/register',
    forgotPassword: '/forgot-password',
    refreshToken: '/refresh-token',
  },
};
