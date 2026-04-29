import React, { useState, useEffect } from 'react';
import { Clock, Calendar, TrendingUp, Award, BarChart3, Eye, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import './styles/QuizHistory.css';

import { API } from '@/config/api';
import { getAuthHeaders } from '@/utils/tokenStorage';
import { useAuth } from '@/hooks/useAuth.jsx';

const QuizHistory = ({ onBack }) => {

  // Get user from auth context
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('history'); // 'history' or 'analytics'
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [pagination, setPagination] = useState({ limit: 10, offset: 0 });
  const [totalCount, setTotalCount] = useState(0);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    } else {
      fetchAnalytics();
    }
  }, [activeTab, pagination.offset]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${API.history}?limit=${pagination.limit}&offset=${pagination.offset}`,
        { headers: getAuthHeaders() }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }
      
      const data = await response.json();
      setHistory(data.history);
      setTotalCount(data.total_count);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        API.analytics,
        { headers: getAuthHeaders() }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      
      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (attemptId) => {
    try {
      const response = await fetch(
        API.attemptDetails(attemptId),
        { headers: getAuthHeaders() }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch attempt details');
      }
      
      const data = await response.json();
      setSelectedAttempt(data);
    } catch (err) {
      setError('Failed to load attempt details: ' + err.message);
    }
  };

  const handleDeleteAttempt = (attemptId) => {
    setPendingDeleteId(attemptId);
  };

  const confirmDelete = async () => {
    const attemptId = pendingDeleteId;
    setPendingDeleteId(null);
    
    try {
      const response = await fetch(
        API.deleteAttempt(attemptId),
        { method: 'DELETE', headers: getAuthHeaders() }
      );
      
      if (!response.ok) {
        throw new Error('Failed to delete attempt');
      }
      
      fetchHistory();
    } catch (err) {
      setError('Failed to delete attempt: ' + err.message);
    }
  };

  const handleNextPage = () => {
    setPagination(prev => ({
      ...prev,
      offset: prev.offset + prev.limit
    }));
  };

  const handlePrevPage = () => {
    setPagination(prev => ({
      ...prev,
      offset: Math.max(0, prev.offset - prev.limit)
    }));
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      'easy': '#10b981',
      'medium': '#f59e0b',
      'hard': '#ef4444'
    };
    return colors[difficulty?.toLowerCase()] || '#6b7280';
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 70) return '#3b82f6';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  // Render History Tab
  const renderHistory = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading quiz history...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-state">
          <p>❌ {error}</p>
          <button onClick={fetchHistory}>Retry</button>
        </div>
      );
    }

    if (history.length === 0) {
      return (
        <div className="empty-state">
          <Award size={64} color="#d1d5db" />
          <h3>No Quiz History Yet</h3>
          <p>Start taking quizzes to see your history here!</p>
        </div>
      );
    }

    return (
      <div className="history-container">
        <div className="history-stats">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <span className="stat-value">{totalCount}</span>
              <span className="stat-label">Total Attempts</span>
            </div>
          </div>
        </div>

        <div className="history-list">
          {history.map((attempt) => (
            <div key={attempt.attempt_id} className="history-item">
              <div className="history-header">
                <div>
                  <h3>{attempt.quiz_title}</h3>
                  <p className="quiz-description">{attempt.quiz_description}</p>
                </div>
                <div className="history-score" style={{ color: getScoreColor(attempt.score_percentage) }}>
                  {Math.round(attempt.score_percentage)}%
                </div>
              </div>

              <div className="history-meta">
                <div className="meta-item">
                  <Award size={16} style={{ color: getDifficultyColor(attempt.difficulty) }} />
                  <span>{attempt.difficulty}</span>
                </div>
                <div className="meta-item">
                  <BarChart3 size={16} />
                  <span>{attempt.correct_answers}/{attempt.total_questions} correct</span>
                </div>
                <div className="meta-item">
                  <Clock size={16} />
                  <span>{formatTime(attempt.time_taken)}</span>
                </div>
                <div className="meta-item">
                  <Calendar size={16} />
                  <span>{formatDate(attempt.attempt_date)}</span>
                </div>
                {attempt.passed && (
                  <div className="passed-badge">✓ Passed</div>
                )}
              </div>

              <div className="history-actions">
                <button 
                  className="action-btn view"
                  onClick={() => handleViewDetails(attempt.attempt_id)}
                >
                  <Eye size={16} />
                  View Details
                </button>
                <button 
                  className="action-btn delete"
                  onClick={() => handleDeleteAttempt(attempt.attempt_id)}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalCount > pagination.limit && (
          <div className="pagination">
            <button 
              onClick={handlePrevPage}
              disabled={pagination.offset === 0}
              className="page-btn"
            >
              <ChevronLeft size={20} />
              Previous
            </button>
            <span className="page-info">
              Showing {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, totalCount)} of {totalCount}
            </span>
            <button 
              onClick={handleNextPage}
              disabled={pagination.offset + pagination.limit >= totalCount}
              className="page-btn"
            >
              Next
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    );
  };

  // Render Analytics Tab
  const renderAnalytics = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-state">
          <p>❌ {error}</p>
          <button onClick={fetchAnalytics}>Retry</button>
        </div>
      );
    }

    if (!analytics || analytics.total_attempts === 0) {
      return (
        <div className="empty-state">
          <BarChart3 size={64} color="#d1d5db" />
          <h3>No Analytics Data</h3>
          <p>Complete some quizzes to see your analytics!</p>
        </div>
      );
    }

    return (
      <div className="analytics-container">
        {/* Overall Stats */}
        <div className="analytics-section">
          <h2>Overall Performance</h2>
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-icon">📈</div>
              <div className="stat-content">
                <span className="stat-value">{Math.round(analytics.overall_stats.average_score)}%</span>
                <span className="stat-label">Average Score</span>
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-icon">🏆</div>
              <div className="stat-content">
                <span className="stat-value">{Math.round(analytics.overall_stats.best_score)}%</span>
                <span className="stat-label">Best Score</span>
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <span className="stat-value">{analytics.total_attempts}</span>
                <span className="stat-label">Total Attempts</span>
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-icon">✓</div>
              <div className="stat-content">
                <span className="stat-value">{Math.round(analytics.overall_stats.pass_rate)}%</span>
                <span className="stat-label">Pass Rate</span>
              </div>
            </div>
          </div>
        </div>

        {/* Performance by Difficulty */}
        <div className="analytics-section">
          <h2>Performance by Difficulty</h2>
          <div className="difficulty-stats">
            {Object.entries(analytics.by_difficulty).map(([difficulty, stats]) => (
              <div key={difficulty} className="difficulty-card">
                <div className="difficulty-header" style={{ borderColor: getDifficultyColor(difficulty) }}>
                  <h3>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</h3>
                  <div className="difficulty-score" style={{ color: getDifficultyColor(difficulty) }}>
                    {Math.round(stats.average_score)}%
                  </div>
                </div>
                <div className="difficulty-details">
                  <div className="detail-row">
                    <span>Attempts:</span>
                    <strong>{stats.attempts}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Best Score:</span>
                    <strong>{Math.round(stats.best_score)}%</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Trend */}
        {analytics.recent_trend.length > 0 && (
          <div className="analytics-section">
            <h2>Recent Performance Trend</h2>
            <div className="trend-chart">
              {analytics.recent_trend.map((point, index) => (
                <div key={index} className="trend-bar">
                  <div 
                    className="bar-fill"
                    style={{ 
                      height: `${point.score}%`,
                      background: getDifficultyColor(point.difficulty)
                    }}
                  >
                    <span className="bar-label">{Math.round(point.score)}%</span>
                  </div>
                  <span className="bar-date">
                    {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Best Attempts */}
        {analytics.best_attempts.length > 0 && (
          <div className="analytics-section">
            <h2>🏆 Top 5 Performances</h2>
            <div className="best-attempts-list">
              {analytics.best_attempts.map((attempt, index) => (
                <div key={index} className="best-attempt-item">
                  <div className="rank">#{index + 1}</div>
                  <div className="attempt-info">
                    <h4>{attempt.quiz_title}</h4>
                    <div className="attempt-meta">
                      <span className="difficulty-badge" style={{ background: getDifficultyColor(attempt.difficulty) }}>
                        {attempt.difficulty}
                      </span>
                      <span>{formatDate(attempt.date)}</span>
                    </div>
                  </div>
                  <div className="attempt-score" style={{ color: getScoreColor(attempt.score) }}>
                    {Math.round(attempt.score)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Time Statistics */}
        <div className="analytics-section">
          <h2>⏱️ Time Statistics</h2>
          <div className="time-stats-grid">
            <div className="time-stat">
              <span className="time-label">Average Time</span>
              <span className="time-value">{formatTime(analytics.time_stats.average_time)}</span>
            </div>
            <div className="time-stat">
              <span className="time-label">Fastest Time</span>
              <span className="time-value">{formatTime(analytics.time_stats.fastest_time)}</span>
            </div>
            <div className="time-stat">
              <span className="time-label">Slowest Time</span>
              <span className="time-value">{formatTime(analytics.time_stats.slowest_time)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Attempt Details Modal
  const renderAttemptDetails = () => {
    if (!selectedAttempt) return null;

    return (
      <div className="modal-overlay" onClick={() => setSelectedAttempt(null)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Quiz Attempt Details</h2>
            <button className="close-btn" onClick={() => setSelectedAttempt(null)}>×</button>
          </div>

          <div className="modal-body">
            <div className="attempt-summary">
              <h3>{selectedAttempt.quiz_title}</h3>
              <p>{selectedAttempt.quiz_description}</p>
              <div className="summary-stats">
                <div className="summary-item">
                  <span className="label">Score:</span>
                  <span className="value" style={{ color: getScoreColor(selectedAttempt.score_percentage) }}>
                    {Math.round(selectedAttempt.score_percentage)}%
                  </span>
                </div>
                <div className="summary-item">
                  <span className="label">Difficulty:</span>
                  <span className="value" style={{ color: getDifficultyColor(selectedAttempt.difficulty) }}>
                    {selectedAttempt.difficulty}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="label">Time Taken:</span>
                  <span className="value">{formatTime(selectedAttempt.time_taken)}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Date:</span>
                  <span className="value">{formatDate(selectedAttempt.attempt_date)}</span>
                </div>
              </div>
            </div>

            {selectedAttempt.detailed_results && selectedAttempt.detailed_results.length > 0 && (
              <div className="questions-review">
                <h4>Question Review</h4>
                {selectedAttempt.detailed_results.map((item, index) => (
                  <div 
                    key={index} 
                    className={`review-item ${item.is_correct === true ? 'correct' : item.is_correct === false ? 'incorrect' : 'needs-review'}`}
                  >
                    <div className="review-header">
                      <span className="question-number">Q{index + 1}</span>
                      <span className={`review-badge ${item.is_correct === true ? 'correct' : item.is_correct === false ? 'incorrect' : 'needs-review'}`}>
                        {item.is_correct === true ? '✓ Correct' : item.is_correct === false ? '✗ Incorrect' : '? Review'}
                      </span>
                    </div>
                    <p className="question-text">{item.question_text}</p>
                    <div className="answer-comparison">
                      <div className="your-answer">
                        <strong>Your Answer:</strong>
                        <p>{item.user_answer_text}</p>
                      </div>
                      {item.is_correct === false && (
                        <div className="correct-answer">
                          <strong>Correct Answer:</strong>
                          <p>{item.correct_answer_text}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="quiz-history-page">
      <div className="history-header">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={20} />
          Back to Quiz
        </button>
        <h1>Quiz History & Analytics</h1>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Calendar size={20} />
          History
        </button>
        <button 
          className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <TrendingUp size={20} />
          Analytics
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'history' ? renderHistory() : renderAnalytics()}
      </div>

      {renderAttemptDetails()}

      {/* Inline delete confirmation */}
      {pendingDeleteId && (
        <div className="confirm-overlay" onClick={() => setPendingDeleteId(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <p className="confirm-message">Delete this quiz attempt? This cannot be undone.</p>
            <div className="confirm-actions">
              <button className="confirm-cancel-btn" onClick={() => setPendingDeleteId(null)}>
                Cancel
              </button>
              <button
                className="confirm-ok-btn"
                style={{ background: '#ef4444' }}
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizHistory;
