import React from 'react';
import { Clock, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';

const QuizTaking = ({
  quiz,
  currentQuestion,
  answers,
  timeRemaining,
  isSubmitting,
  onAnswerSelect,
  onShortAnswerChange,
  onNext,
  onPrevious,
  onQuestionNavigate,
  onSubmitQuiz,
  onCancelQuiz,
}) => {
  if (!quiz) return <div>Loading quiz…</div>;

  const question = quiz.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;
  const answeredCount = Object.values(answers).filter(
    v => v !== null && v !== undefined && String(v).trim() !== ''
  ).length;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDifficultyColor = (d) =>
    ({ easy: '#10b981', medium: '#f59e0b', hard: '#ef4444' })[d?.toLowerCase()] || '#6b7280';

  const getDifficultyIcon = (d) =>
    ({ easy: '⭐', medium: '⭐⭐', hard: '⭐⭐⭐' })[d?.toLowerCase()] || '⭐';

  return (
    <div className="quiz-layout">
      {/* ── Main Column ── */}
      <div className="quiz-main">
        {/* Header */}
        <div className="quiz-header">
          <div>
            <h1>{quiz.title}</h1>
            <p>{quiz.description}</p>
            <div className="difficulty-indicator" style={{ color: getDifficultyColor(quiz.difficulty) }}>
              {getDifficultyIcon(quiz.difficulty)} {quiz.difficulty?.toUpperCase()} Level
            </div>
          </div>
          <div className="quiz-header-actions">
            <div className="quiz-timer">
              <Clock size={20} />
              <span className={timeRemaining < 60 ? 'timer-warning' : ''}>
                {formatTime(timeRemaining)}
              </span>
            </div>
            <button className="cancel-quiz-btn" onClick={onCancelQuiz}>
              <XCircle size={20} />
              <span>Cancel Quiz</span>
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="progress-section">
          <div className="progress-header">
            <span>Progress</span>
            <span>Question {currentQuestion + 1} of {quiz.questions.length}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-percentage">{Math.round(progress)}%</span>
        </div>

        {/* Question Card */}
        <div className="question-card">
          <div className="question-meta">
            <span className="question-number">Question {currentQuestion + 1}</span>
            {question.question_type === 'short_answer' && (
              <span className="question-type-badge">Short Answer</span>
            )}
          </div>
          <h2 className="question-text">{question.question_text}</h2>

          {question.question_type === 'multiple_choice' ? (
            <div className="options-list">
              {question.options?.map((opt) => (
                <button
                  key={opt.option_letter}
                  className={`option-btn ${answers[currentQuestion] === opt.option_letter ? 'selected' : ''}`}
                  onClick={() => onAnswerSelect(opt.option_letter)}
                >
                  <span className="option-key">{opt.option_letter}</span>
                  <span className="option-value">{opt.option_text}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="short-answer-section">
              <p className="short-answer-hint">💡 Write a concise answer based on your study materials</p>
              <textarea
                className="short-answer-input"
                placeholder="Type your answer here…"
                value={answers[currentQuestion] || ''}
                onChange={onShortAnswerChange}
                rows={4}
              />
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="quiz-navigation">
          <button className="nav-btn" onClick={onPrevious} disabled={currentQuestion === 0}>
            <ChevronLeft size={20} /> Previous
          </button>
          {currentQuestion < quiz.questions.length - 1 && (
            <button className="nav-btn next" onClick={onNext}>
              Next <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>

      {/* ── Sidebar ── */}
      <div className="quiz-sidebar">
        <h3>Questions</h3>
        <div className="question-grid">
          {quiz.questions.map((_, index) => (
            <button
              key={index}
              className={`question-dot
                ${index === currentQuestion ? 'current' : ''}
                ${answers[index] !== undefined && String(answers[index]).trim() !== '' ? 'answered' : ''}
              `}
              onClick={() => onQuestionNavigate(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <div className="sidebar-stats">
          <div className="stat">
            <span className="stat-value">{answeredCount}</span>
            <span className="stat-label">Answered</span>
          </div>
          <div className="stat">
            <span className="stat-value">{quiz.questions.length - answeredCount}</span>
            <span className="stat-label">Remaining</span>
          </div>
        </div>
        <button className="submit-btn sidebar-submit-btn" onClick={() => onSubmitQuiz()} disabled={isSubmitting}>
          {isSubmitting
            ? <><div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.35)', borderTopColor: 'white' }}></div> Submitting…</>
            : <>Submit ({answeredCount}/{quiz.questions.length})</>}
        </button>
      </div>
    </div>
  );
};

export default QuizTaking;
