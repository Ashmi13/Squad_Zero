// frontend/src/services/api.js

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class APIService {
  /**
   * Generate a new quiz
   */
  async generateQuiz(formData) {
    const response = await fetch(`${API_BASE_URL}/api/quizzes/generate`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to generate quiz');
    }
    
    return response.json();
  }

  /**
   * Submit quiz answers
   */
  async submitQuiz(quizId, formData) {
    const response = await fetch(`${API_BASE_URL}/api/quizzes/${quizId}/submit`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to submit quiz');
    }
    
    return response.json();
  }

  /**
   * Get quiz history
   */
  async getHistory(userId, limit = 10, offset = 0) {
    const response = await fetch(
      `${API_BASE_URL}/api/quizzes/history/${userId}?limit=${limit}&offset=${offset}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch history');
    }
    
    return response.json();
  }

  /**
   * Get analytics
   */
  async getAnalytics(userId) {
    const response = await fetch(`${API_BASE_URL}/api/quizzes/analytics/${userId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch analytics');
    }
    
    return response.json();
  }

  /**
   * Get attempt details
   */
  async getAttemptDetails(attemptId, userId) {
    const response = await fetch(
      `${API_BASE_URL}/api/quizzes/attempt/${attemptId}/details?user_id=${userId}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch attempt details');
    }
    
    return response.json();
  }

  /**
   * Delete quiz attempt
   */
  async deleteAttempt(attemptId, userId) {
    const response = await fetch(
      `${API_BASE_URL}/api/quizzes/history/${attemptId}?user_id=${userId}`,
      { method: 'DELETE' }
    );
    
    if (!response.ok) {
      throw new Error('Failed to delete attempt');
    }
    
    return response.json();
  }

  /**
   * Download quiz results as PDF
   */
  async downloadPDF(quizId, attemptId) {
    const response = await fetch(
      `${API_BASE_URL}/api/quizzes/${quizId}/results/${attemptId}/pdf`
    );
    
    if (!response.ok) {
      throw new Error('Failed to download PDF');
    }
    
    return response.blob();
  }
}

export default new APIService();
