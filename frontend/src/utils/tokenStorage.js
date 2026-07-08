//Token  and guest-session storage

const ACCESS_TOKEN_KEY  = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const GUEST_SESSION_KEY = 'nn_guest_session_id';

// Stale-token guard
// Clear any non-JWT string that may have been left by old mock-auth code.
(function clearStaleTokens() {
  try {
    const t = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (t && t.split('.').length !== 3) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem('user');
      console.warn('Cleared invalid (non-JWT) token from localStorage');
    }
  } catch (_) {}
})();

// Signed-in token helpers
export const setTokens = (accessToken, refreshToken) => {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch (e) {
    console.error('Error storing tokens:', e);
  }
};

export const getAccessToken = () => {
  try { return localStorage.getItem(ACCESS_TOKEN_KEY); }
  catch (e) { console.error('Error retrieving access token:', e); return null; }
};

export const getRefreshToken = () => {
  try { return localStorage.getItem(REFRESH_TOKEN_KEY); }
  catch (e) { return null; }
};

export const clearTokens = () => {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (e) {
    console.error('Error clearing tokens:', e);
  }
};

export const isAuthenticated = () => !!getAccessToken();

export const decodeToken = (token) => {
  try {
    if (!token || typeof token !== 'string') return null;
    const base64Url = token.split('.')[1];
    const base64    = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    ));
  } catch { return null; }
};

// Guest session helpers
export const getGuestSessionId = () => {
  try {
    let id = sessionStorage.getItem(GUEST_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(GUEST_SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
};

export const clearGuestSession = () => {
  try { sessionStorage.removeItem(GUEST_SESSION_KEY); } catch (_) {}
};

/**
 * auth headers for fetch() calls.
 *  - Signed-in user → { Authorization: 'Bearer <jwt>' }
 *  - Guest           → { 'X-Guest-Session-ID': '<uuid>' }
 *  - Neither         → {}  (should not normally happen)
 */
export const getAuthHeaders = () => {
  const token = getAccessToken();
  if (token) return { Authorization: `Bearer ${token}` };

  const guestId = getGuestSessionId();
  if (guestId) return { 'X-Guest-Session-ID': guestId };

  return {};
};
