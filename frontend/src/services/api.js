const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ── Auth token helpers ────────────────────────────────────────────────────────
// IMPORTANT: must read 'access_token' — the key used by tokenStorage.js / setTokens().
// The old key 'auth_token' was never written by M1's login flow, so every request
// sent no Authorization header and got "Missing authentication token" from the backend.
const getAuthToken = () => localStorage.getItem('access_token');

const authHeaders = () => {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Handle 401 responses globally — redirect to login
const handleResponse = async (response) => {
  if (response.status === 401) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
    throw new Error('Unauthorized — redirecting to login');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    const message = Array.isArray(error.detail)
      ? error.detail.map(e => e.msg || e).join(', ')
      : error.detail || 'Request failed';
    throw new Error(message);
  }
  return response.json();
};

// API Service
class APIService {

  // Generate a new quiz
  async generateQuiz(formData) {
    formData.delete('user_id');

    const response = await fetch(`${API_BASE_URL}/api/quizzes/generate`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    return handleResponse(response);
  }

  // Submit quiz answers
  async submitQuiz(quizId, formData) {
    formData.delete('user_id');

    const response = await fetch(`${API_BASE_URL}/api/quizzes/${quizId}/submit`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    return handleResponse(response);
  }

  // Get quiz history for the authenticated user
  async getHistory(limit = 10, offset = 0) {
    const response = await fetch(
      `${API_BASE_URL}/api/quizzes/history/me?limit=${limit}&offset=${offset}`,
      { headers: authHeaders() }
    );
    return handleResponse(response);
  }

  // Get analytics for the authenticated user
  async getAnalytics() {
    const response = await fetch(
      `${API_BASE_URL}/api/quizzes/analytics/me`,
      { headers: authHeaders() }
    );
    return handleResponse(response);
  }

  // Get attempt details
  async getAttemptDetails(attemptId) {
    const response = await fetch(
      `${API_BASE_URL}/api/quizzes/attempt/${attemptId}/details`,
      { headers: authHeaders() }
    );
    return handleResponse(response);
  }

  // Delete a quiz attempt
  async deleteAttempt(attemptId) {
    const response = await fetch(
      `${API_BASE_URL}/api/quizzes/history/${attemptId}`,
      {
        method: 'DELETE',
        headers: authHeaders(),
      }
    );
    return handleResponse(response);
  }

  // Download quiz results as PDF
  async downloadPDF(quizId, attemptId) {
    const response = await fetch(
      `${API_BASE_URL}/api/quizzes/${quizId}/results/${attemptId}/pdf`,
      { headers: authHeaders() }
    );
    if (response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      throw new Error('Failed to download PDF');
    }
    return response.blob();
  }
}

export default new APIService();
