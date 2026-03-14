import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, Sparkles, Clock, ChevronLeft, ChevronRight, FileText, Download } from 'lucide-react';
import './QuizPage.css';

const QuizPage = ({ noteId, userId }) => {
  const [step, setStep] = useState('upload');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [quizStartTime, setQuizStartTime] = useState(null);
  const [results, setResults] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // FIXED: Updated configuration with new limits
  const [config, setConfig] = useState({
    numQuestions: 10,
    difficulty: 'medium',
    timeLimit: 30,
    questionType: 'mixed'  // FIXED: Changed from includeShortAnswer to questionType dropdown
  });

  const fileInputRef = useRef(null);

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

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFiles = (fileList) => {
    const files = Array.from(fileList);
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // FIXED: 25MB limit
    
    const validFiles = files.filter(file => {
      // Check file type
      const validTypes = ['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.xls'];
      const extension = '.' + file.name.split('.').pop().toLowerCase();
      const isValidType = validTypes.includes(extension);
      
      // FIXED: Check file size (25MB)
      const isValidSize = file.size <= MAX_FILE_SIZE;
      
      if (!isValidType) {
        setError(`File ${file.name} has invalid type. Accepted: PDF, DOC, DOCX, TXT, XLSX, XLS`);
        return false;
      }
      
      if (!isValidSize) {
        setError(`File ${file.name} exceeds 25MB limit`);
        return false;
      }
      
      return true;
    });

    const newFiles = validFiles.map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      type: file.type,
      file: file
    }));
    
    setUploadedFiles([...uploadedFiles, ...newFiles]);
    if (validFiles.length > 0) {
      setError(null);
    }
  };

  const handleFileUpload = (e) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (id) => {
    setUploadedFiles(uploadedFiles.filter(f => f.id !== id));
  };

  // Generate quiz
  const handleGenerateQuiz = async () => {
    if (uploadedFiles.length === 0) {
      setError('Please upload at least one file');
      return;
    }

    // FIXED: Validate question limit (max 25)
    if (config.numQuestions > 25) {
      setError('Number of questions must not exceed 25');
      return;
    }

    // FIXED: Validate time limit (min 1, max 180)
    if (config.timeLimit < 1) {
      setError('Time limit must be at least 1 minute');
      return;
    }
    
    if (config.timeLimit > 180) {
      setError('Time limit must not exceed 180 minutes');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const formData = new FormData();
      uploadedFiles.forEach(fileObj => {
        formData.append('files', fileObj.file);
      });
      formData.append('num_questions', config.numQuestions);
      formData.append('difficulty', config.difficulty);
      formData.append('time_limit', config.timeLimit);
      formData.append('question_type', config.questionType);  // FIXED: Send question_type instead of include_short_answer
      formData.append('user_id', userId || 1);
      if (noteId) formData.append('note_id', noteId);

      const response = await fetch('http://localhost:8000/api/quizzes/generate', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Quiz generation failed');
      }

      const data = await response.json();
      setQuiz(data);
      setTimeRemaining(data.time_limit);
      setQuizStartTime(Date.now());
      setStep('taking');
      
    } catch (error) {
      console.error('Error generating quiz:', error);
      setError(error.message || 'Failed to generate quiz. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Answer handlers
  const handleAnswerSelect = (value) => {
    setAnswers({
      ...answers,
      [currentQuestion]: value
    });
  };

  const handleShortAnswerChange = (e) => {
    setAnswers({
      ...answers,
      [currentQuestion]: e.target.value
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
    const unanswered = quiz.questions.length - Object.keys(answers).length;
    
    if (unanswered > 0) {
      if (!window.confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) {
        return;
      }
    }

    try {
      const timeTaken = Math.floor((Date.now() - quizStartTime) / 1000);

      const formData = new FormData();
      formData.append('user_id', userId || 1);
      formData.append('answers', JSON.stringify(answers));
      formData.append('time_taken', timeTaken);

      const response = await fetch(`http://localhost:8000/api/quizzes/${quiz.quiz_id}/submit`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Submission failed');
      }

      const data = await response.json();
      setResults(data);
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

  // FIXED: Download PDF with proper parameters
  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/quizzes/${quiz.quiz_id}/results/${results.attempt_id}/pdf?user_id=${userId || 1}`
      );
      
      if (!response.ok) throw new Error('PDF generation failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz_results_${quiz.quiz_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please try again.');
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
    setError(null);
  };

  // Utility functions
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFileIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return '📄';
    if (ext === 'xlsx' || ext === 'xls') return '📊';
    if (['doc', 'docx'].includes(ext)) return '📝';
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

      {error && (
        <div className="error-message">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* FIXED: Configuration with updated limits */}
      <div className="config-card">
        <h3>Quiz Settings</h3>
        <div className="config-grid">
          <div className="config-item">
            <label>Number of Questions</label>
            <input
              type="number"
              min="1"
              max="25"
              value={config.numQuestions}
              onChange={(e) => setConfig({ ...config, numQuestions: Math.min(25, Math.max(1, parseInt(e.target.value) || 1)) })}
            />
            <small>Must be between 1 and 25</small>
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
              min="1"
              max="180"
              value={config.timeLimit}
              onChange={(e) => setConfig({ ...config, timeLimit: Math.min(180, Math.max(1, parseInt(e.target.value) || 1)) })}
            />
            <small>Between 1 and 180 minutes</small>
          </div>
          {/* FIXED: Dropdown for question type selection */}
          <div className="config-item">
            <label>Question Type</label>
            <select
              value={config.questionType}
              onChange={(e) => setConfig({ ...config, questionType: e.target.value })}
            >
              <option value="mcq">Multiple Choice Only</option>
              <option value="short_answer">Short Answer Only</option>
              <option value="mixed">Mixed (Both Types)</option>
            </select>
            <small>Choose question format</small>
          </div>
        </div>
      </div>

      {/* File Upload with Drag & Drop */}
      <div className="upload-card">
        <input
          ref={fileInputRef}
          type="file"
          id="file-upload"
          multiple
          accept=".pdf,.doc,.docx,.txt,.xlsx,.xls"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <div
          className={`upload-area ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={48} />
          <h3>Drag & Drop files here or click to upload</h3>
          <p>Supports: PDF, DOC, DOCX, TXT, XLSX, XLS (Max <strong>25MB</strong> each)</p>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="uploaded-files">
            <h4>Uploaded Files ({uploadedFiles.length})</h4>
            <div className="files-list">
              {uploadedFiles.map(file => (
                <div key={file.id} className="file-item">
                  <span className="file-icon">{getFileIcon(file.name)}</span>
                  <div className="file-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{file.size}</span>
                  </div>
                  <button className="remove-btn" onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.id);
                  }}>
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

  // Render quiz taking step (same as before but with proper handling)
  const renderTakingStep = () => {
    if (!quiz) return null;

    const question = quiz.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="quiz-layout">
        <div className="quiz-main">
          <div className="quiz-header">
            <div>
              <h1>{quiz.title}</h1>
              <p>{quiz.description}</p>
            </div>
            <div className="quiz-timer">
              <Clock size={20} />
              <span className={timeRemaining < 60 ? 'timer-warning' : ''}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          </div>

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

          <div className="question-card">
            <div className="question-header">
              <span className="question-badge">Question {question.question_number}</span>
              <span className="difficulty-badge">{question.difficulty}</span>
              <span className="type-badge">{question.question_type === 'short_answer' ? 'Short Answer' : 'Multiple Choice'}</span>
            </div>

            <h2 className="question-text">{question.question_text}</h2>

            {question.code_snippet && (
              <div className="code-snippet">
                <div className="code-header">Code Snippet</div>
                <pre><code>{question.code_snippet}</code></pre>
              </div>
            )}

            {question.question_type === 'multiple_choice' ? (
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
            ) : (
              <div className="short-answer-container">
                <textarea
                  className="short-answer-input"
                  placeholder="Type your answer here... (1-3 sentences recommended)"
                  value={answers[currentQuestion] || ''}
                  onChange={handleShortAnswerChange}
                  rows={5}
                />
                <small className="char-count">
                  {(answers[currentQuestion] || '').length} characters
                </small>
              </div>
            )}

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

          <div className="question-nav-grid">
            <h3>Question Navigation</h3>
            <div className="nav-grid">
              {quiz.questions.map((q, index) => (
                <button
                  key={q.question_id}
                  className={`nav-number ${index === currentQuestion ? 'current' : ''} ${answers[index] ? 'answered' : ''}`}
                  onClick={() => handleQuestionNavigate(index)}
                  title={q.question_type === 'short_answer' ? 'Short Answer' : 'Multiple Choice'}
                >
                  {index + 1}
                  {q.question_type === 'short_answer' && <span className="sa-indicator">✎</span>}
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
              <div className="legend-item">
                <span className="legend-box">✎</span>
                <span>Short Answer</span>
              </div>
            </div>
          </div>
        </div>

        <div className="quiz-sidebar">
          <div className="info-card">
            <h3>Quiz Information</h3>
            <div className="info-item">
              <span>Total Questions:</span>
              <strong>{quiz.questions.length}</strong>
            </div>
            <div className="info-item">
              <span>Answered:</span>
              <strong>{answeredCount}</strong>
            </div>
            <div className="info-item">
              <span>Remaining:</span>
              <strong>{quiz.questions.length - answeredCount}</strong>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render results step (same as before)
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
            Download as PDF
          </button>
          <button className="action-btn secondary" onClick={handleRestart}>
            <Sparkles size={20} />
            New Quiz
          </button>
        </div>

        {showReview && results.detailed_results && (
          <div className="review-section">
            <h3>Answer Review</h3>
            {results.detailed_results.map((item, index) => (
              <div key={index} className={`review-item ${item.is_correct === true ? 'correct' : item.is_correct === false ? 'incorrect' : 'needs-review'}`}>
                <div className="review-header">
                  <span className="review-number">Question {index + 1}</span>
                  <span className={`review-badge ${item.is_correct === true ? 'correct' : item.is_correct === false ? 'incorrect' : 'needs-review'}`}>
                    {item.is_correct === true ? 'Correct' : item.is_correct === false ? 'Incorrect' : 'Needs Review'}
                  </span>
                  {item.question_type === 'short_answer' && (
                    <span className="type-badge">Short Answer</span>
                  )}
                </div>
                <p className="review-question">{item.question_text}</p>
                <div className="review-answers">
                  <div className="answer-row">
                    <span className="answer-label">Your Answer:</span>
                    <span className={item.is_correct === true ? 'correct-text' : item.is_correct === false ? 'incorrect-text' : 'review-text'}>
                      {item.question_type === 'multiple_choice' 
                        ? `${item.user_answer}. ${item.user_answer_text}`
                        : item.user_answer_text
                      }
                    </span>
                  </div>
                  {item.is_correct === false && (
                    <div className="answer-row">
                      <span className="answer-label">Correct Answer:</span>
                      <span className="correct-text">
                        {item.question_type === 'multiple_choice'
                          ? `${item.correct_answer}. ${item.correct_answer_text}`
                          : item.correct_answer_text
                        }
                      </span>
                    </div>
                  )}
                  {item.is_correct === null && (
                    <div className="answer-row">
                      <span className="answer-label">Expected Answer:</span>
                      <span className="review-text">{item.correct_answer_text}</span>
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

  return (
    <div className="quiz-page">
      {step === 'upload' && renderUploadStep()}
      {step === 'taking' && renderTakingStep()}
      {step === 'results' && renderResultsStep()}
    </div>
  );
};

export default QuizPage;
