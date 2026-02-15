import React, { useState, useEffect } from 'react';
import { Upload, X, Sparkles, Clock, ChevronLeft, ChevronRight, BarChart3, FileText, Download } from 'lucide-react';
import './QuizPage.css';

const QuizPage = ({ noteId, userId }) => {
  // State management
  const [step, setStep] = useState('upload'); // upload, taking, results
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [quizStartTime, setQuizStartTime] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [results, setResults] = useState(null);
  const [showReview, setShowReview] = useState(false);

  // Configuration
  const [config, setConfig] = useState({
    numQuestions: 10,
    difficulty: 'medium',
    timeLimit: 30 // minutes
  });

  // Timer countdown
  useEffect(() => {
    if (step === 'taking' && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, timeRemaining]);

  // File upload handler
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = files.map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: (file.size / 1024).toFixed(2) + ' KB',
      type: file.type,
      file: file
    }));
    setUploadedFiles([...uploadedFiles, ...newFiles]);
  };

  const removeFile = (id) => {
    setUploadedFiles(uploadedFiles.filter(f => f.id !== id));
  };

  // Generate quiz from uploaded materials
  const handleGenerateQuiz = async () => {
    if (uploadedFiles.length === 0) {
      alert('Please upload at least one file');
      return;
    }

    setIsGenerating(true);

    try {
      const formData = new FormData();
      uploadedFiles.forEach(fileObj => {
        formData.append('files', fileObj.file);
      });
      formData.append('num_questions', config.numQuestions);
      formData.append('difficulty', config.difficulty);
      formData.append('time_limit', config.timeLimit);
      formData.append('user_id', userId);
      if (noteId) formData.append('note_id', noteId);

      const response = await fetch('/api/quizzes/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Quiz generation failed');

      const data = await response.json();
      setQuiz(data);
      setTimeRemaining(data.time_limit); // in seconds
      setQuizStartTime(Date.now());
      setStep('taking');
    } catch (error) {
      console.error('Error generating quiz:', error);
      alert('Failed to generate quiz. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Answer selection
  const handleAnswerSelect = (optionId) => {
    setAnswers({
      ...answers,
      [currentQuestion]: optionId
    });
  };

  // Navigation
  const handleNext = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleQuestionNavigate = (index) => {
    setCurrentQuestion(index);
  };

  // Submit quiz
  const handleSubmitQuiz = async () => {
    if (Object.keys(answers).length < quiz.questions.length) {
      if (!window.confirm('You have unanswered questions. Submit anyway?')) {
        return;
      }
    }

    try {
      const timeTaken = Math.floor((Date.now() - quizStartTime) / 1000);

      const response = await fetch(`/api/quizzes/${quiz.quiz_id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          user_id: userId,
          answers: answers,
          time_taken: timeTaken
        })
      });

      if (!response.ok) throw new Error('Submission failed');

      const data = await response.json();
      setResults(data);
      setAttemptId(data.attempt_id);
      setStep('results');
    } catch (error) {
      console.error('Error submitting quiz:', error);
      alert('Failed to submit quiz. Please try again.');
    }
  };

  const handleAutoSubmit = async () => {
    alert('Time is up! Submitting your answers...');
    await handleSubmitQuiz();
  };

  // Download PDF
  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/quizzes/${quiz.quiz_id}/download-pdf?attempt_id=${attemptId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz-results-${quiz.quiz_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF');
    }
  };

  // Restart quiz
  const handleRestart = () => {
    setStep('upload');
    setUploadedFiles([]);
    setQuiz(null);
    setAnswers({});
    setCurrentQuestion(0);
    setResults(null);
    setAttemptId(null);
  };

  // Utility functions
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFileIcon = (type) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('image')) return '🖼️';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📊';
    if (type.includes('word') || type.includes('document')) return '📝';
    return '📎';
  };

  // Render upload step
  const renderUploadStep = () => (
    <div className="quiz-upload-container">
      <div className="upload-header">
        <div className="header-icon">
          <Sparkles size={32} />
        </div>
        <div>
          <h1>Generate Quiz</h1>
          <p className="subtitle">Upload your study materials to create a customized quiz</p>
        </div>
      </div>

      {/* Configuration */}
      <div className="config-card">
        <h3>Quiz Settings</h3>
        <div className="config-grid">
          <div className="config-item">
            <label>Number of Questions</label>
            <input
              type="number"
              min="5"
              max="50"
              value={config.numQuestions}
              onChange={(e) => setConfig({ ...config, numQuestions: parseInt(e.target.value) })}
            />
          </div>
          <div className="config-item">
            <label>Difficulty</label>
            <select
              value={config.difficulty}
              onChange={(e) => setConfig({ ...config, difficulty: e.target.value })}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="config-item">
            <label>Time Limit (minutes)</label>
            <input
              type="number"
              min="10"
              max="120"
              value={config.timeLimit}
              onChange={(e) => setConfig({ ...config, timeLimit: parseInt(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* File Upload */}
      <div className="upload-card">
        <input
          type="file"
          id="file-upload"
          multiple
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <label htmlFor="file-upload" className="upload-area">
          <Upload size={48} />
          <h3>Drop files here or click to upload</h3>
          <p>Supports: PDF, DOC, PPT, Images (Max 10MB each)</p>
        </label>

        {uploadedFiles.length > 0 && (
          <div className="uploaded-files">
            <h4>Uploaded Files ({uploadedFiles.length})</h4>
            <div className="files-list">
              {uploadedFiles.map(file => (
                <div key={file.id} className="file-item">
                  <span className="file-icon">{getFileIcon(file.type)}</span>
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{file.size}</span>
                  </div>
                  <button className="remove-btn" onClick={() => removeFile(file.id)}>
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        className="generate-btn"
        onClick={handleGenerateQuiz}
        disabled={uploadedFiles.length === 0 || isGenerating}
      >
        {isGenerating ? (
          <>
            <div className="spinner"></div>
            <span>Generating Quiz...</span>
          </>
        ) : (
          <>
            <Sparkles size={20} />
            <span>Generate Quiz</span>
          </>
        )}
      </button>
    </div>
  );

  // Render quiz taking step
  const renderTakingStep = () => {
    if (!quiz) return null;

    const question = quiz.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

    return (
      <div className="quiz-layout">
        <div className="quiz-main">
          {/* Header */}
          <div className="quiz-header">
            <div>
              <h1>{quiz.title}</h1>
              <p>{quiz.description}</p>
            </div>
            <div className="quiz-timer">
              <Clock size={20} />
              <span>{formatTime(timeRemaining)}</span>
            </div>
          </div>

          {/* Progress */}
          <div className="progress-section">
            <div className="progress-header">
              <span>Progress</span>
              <span>Question {currentQuestion + 1} of {quiz.questions.length}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="progress-percentage">{Math.round(progress)}%</span>
          </div>

          {/* Question Card */}
          <div className="question-card">
            <div className="question-header">
              <span className="question-badge">Question {question.question_number}</span>
              <span className="difficulty-badge">{question.difficulty}</span>
            </div>

            <h2 className="question-text">{question.question_text}</h2>

            {question.code_snippet && (
              <div className="code-snippet">
                <div className="code-header">Code Snippet</div>
                <pre><code>{question.code_snippet}</code></pre>
              </div>
            )}

            <div className="options-list">
              {question.options.map(option => (
                <label
                  key={option.option_id}
                  className={`option-item ${answers[currentQuestion] === option.option_letter ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={`question-${question.question_id}`}
                    value={option.option_letter}
                    checked={answers[currentQuestion] === option.option_letter}
                    onChange={() => handleAnswerSelect(option.option_letter)}
                  />
                  <span className="option-label">{option.option_letter}.</span>
                  <span className="option-text">{option.option_text}</span>
                </label>
              ))}
            </div>

            <div className="question-navigation">
              <button
                className="nav-btn secondary"
                onClick={handlePrevious}
                disabled={currentQuestion === 0}
              >
                <ChevronLeft size={20} />
                Previous
              </button>

              {currentQuestion === quiz.questions.length - 1 ? (
                <button className="nav-btn submit" onClick={handleSubmitQuiz}>
                  Submit Quiz
                  <ChevronRight size={20} />
                </button>
              ) : (
                <button className="nav-btn primary" onClick={handleNext}>
                  Next Question
                  <ChevronRight size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Question Navigation Grid */}
          <div className="question-nav-grid">
            <h3>Question Navigation</h3>
            <div className="nav-grid">
              {quiz.questions.map((q, index) => (
                <button
                  key={q.question_id}
                  className={`nav-number ${index === currentQuestion ? 'current' : ''} ${answers[index] ? 'answered' : ''}`}
                  onClick={() => handleQuestionNavigate(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <div className="nav-legend">
              <div className="legend-item">
                <span className="legend-box answered"></span>
                <span>Answered</span>
              </div>
              <div className="legend-item">
                <span className="legend-box current"></span>
                <span>Current</span>
              </div>
              <div className="legend-item">
                <span className="legend-box"></span>
                <span>Not Answered</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="quiz-sidebar">
          <div className="info-card">
            <h3>Quiz Information</h3>
            <div className="info-item">
              <span>Total Questions:</span>
              <strong>{quiz.questions.length}</strong>
            </div>
            <div className="info-item">
              <span>Answered:</span>
              <strong>{Object.keys(answers).length}</strong>
            </div>
            <div className="info-item">
              <span>Remaining:</span>
              <strong>{quiz.questions.length - Object.keys(answers).length}</strong>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render results step
  const renderResultsStep = () => {
    if (!results) return null;

    return (
      <div className="results-container">
        <div className="results-header">
          <h1>Quiz Results</h1>
          <p>Here's how you performed on this quiz</p>
        </div>

        <div className="score-card">
          <div className="score-circle">
            <svg viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" fill="none" stroke="#f3f4f6" strokeWidth="20" />
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke="#9333ea"
                strokeWidth="20"
                strokeDasharray={`${565 * (results.score_percentage / 100)} 565`}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
              />
              <text x="100" y="100" textAnchor="middle" dy=".3em" fontSize="48" fontWeight="bold" fill="#111827">
                {Math.round(results.score_percentage)}%
              </text>
            </svg>
          </div>

          <h2>{results.score_percentage >= 70 ? '🎉 Great Job!' : '📚 Keep Practicing!'}</h2>
          <p>You scored {results.correct_answers} out of {results.total_questions} correct</p>
        </div>

        <div className="stats-grid">
          <div className="stat-box correct">
            <div className="stat-icon">✓</div>
            <div className="stat-content">
              <span className="stat-label">Correct</span>
              <span className="stat-value">{results.correct_answers}</span>
            </div>
          </div>
          <div className="stat-box incorrect">
            <div className="stat-icon">✕</div>
            <div className="stat-content">
              <span className="stat-label">Incorrect</span>
              <span className="stat-value">{results.total_questions - results.correct_answers}</span>
            </div>
          </div>
          <div className="stat-box time">
            <div className="stat-icon">⏱</div>
            <div className="stat-content">
              <span className="stat-label">Time Taken</span>
              <span className="stat-value">{formatTime(results.time_taken)}</span>
            </div>
          </div>
        </div>

        <div className="results-actions">
          <button className="action-btn primary" onClick={() => setShowReview(!showReview)}>
            <FileText size={20} />
            {showReview ? 'Hide Review' : 'Review Answers'}
          </button>
          <button className="action-btn secondary" onClick={handleDownloadPDF}>
            <Download size={20} />
            Download PDF
          </button>
          <button className="action-btn secondary" onClick={handleRestart}>
            <Sparkles size={20} />
            New Quiz
          </button>
        </div>

        {showReview && (
          <div className="review-section">
            <h3>Answer Review</h3>
            {results.detailed_results.map((item, index) => (
              <div key={index} className={`review-item ${item.is_correct ? 'correct' : 'incorrect'}`}>
                <div className="review-header">
                  <span className="review-number">Question {index + 1}</span>
                  <span className={`review-badge ${item.is_correct ? 'correct' : 'incorrect'}`}>
                    {item.is_correct ? 'Correct' : 'Incorrect'}
                  </span>
                </div>
                <p className="review-question">{item.question_text}</p>
                <div className="review-answers">
                  <div className="answer-row">
                    <span className="answer-label">Your Answer:</span>
                    <span className={item.is_correct ? 'correct-text' : 'incorrect-text'}>
                      {item.user_answer}. {item.user_answer_text}
                    </span>
                  </div>
                  {!item.is_correct && (
                    <div className="answer-row">
                      <span className="answer-label">Correct Answer:</span>
                      <span className="correct-text">
                        {item.correct_answer}. {item.correct_answer_text}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Main render
  return (
    <div className="quiz-page">
      {step === 'upload' && renderUploadStep()}
      {step === 'taking' && renderTakingStep()}
      {step === 'results' && renderResultsStep()}
    </div>
  );
};

export default QuizPage;
