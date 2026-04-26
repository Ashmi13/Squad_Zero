const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const API = {
  // Quiz generation
  generate:      `${BASE}/api/quizzes/generate`,

  // Quiz submission
  submit:  (id)  => `${BASE}/api/quizzes/${id}/submit`,

  // PDF download
  pdf: (qid, aid) => `${BASE}/api/quizzes/${qid}/results/${aid}/pdf`,

  // History & analytics
  history:        `${BASE}/api/quizzes/history/me`,
  analytics:      `${BASE}/api/quizzes/analytics/me`,
  attemptDetails: (aid) => `${BASE}/api/quizzes/attempt/${aid}/details`,
  deleteAttempt:  (aid) => `${BASE}/api/quizzes/history/${aid}`,
};
