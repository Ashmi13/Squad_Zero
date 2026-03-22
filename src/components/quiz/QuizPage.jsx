import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, Sparkles, Clock, ChevronLeft, ChevronRight, FileText, Download, TrendingUp, Award, XCircle, BarChart3 } from 'lucide-react';
import Toast from './Toast';
import QuizHistory from './QuizHistory';
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
  const [dragActive, setDragActive] = useState(false);
  
  // Toast notifications
  const [toasts, setToasts] = useState([]);
  
  // Quiz Levels State
  const [sourceContent, setSourceContent] = useState(null);
  const [completedLevels, setCompletedLevels] = useState([]);

  // Quiz History State
  const [showHistory, setShowHistory] = useState(false);

  const [config, setConfig] = useState({
    numQuestions: 10,
    difficulty: 'easy',
    timeLimit: 30,
    questionType: 'mixed'
  });

  const fileInputRef = useRef(null);
  const isGeneratingRef = useRef(false);
  const generationPromiseRef = useRef(null);

  const MAX_FILES = 20;
  const MAX_FILE_SIZE = 25 * 1024 * 1024;

  // Toast notification functions
  const showToast = (message, type = 'error', duration = 5000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Cancel Quiz functionality
  const handleCancelQuiz = () => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel this quiz? All progress will be lost.'
    );
    
    if (confirmed) {
      setStep('upload');
      setQuiz(null);
      setAnswers({});
      setCurrentQuestion(0);
      setTimeRemaining(null);
      setQuizStartTime(null);
      
      showToast('Quiz cancelled', 'info', 3000);
    }
  };

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

  // FIXED: Updated file validation with new file types
  const handleFiles = (fileList) => {
    const files = Array.from(fileList);
    
    const totalFilesAfterAdd = uploadedFiles.length + files.length;
    if (totalFilesAfterAdd > MAX_FILES) {
      showToast(`Cannot upload more than ${MAX_FILES} files. You currently have ${uploadedFiles.length} file(s). You can add ${MAX_FILES - uploadedFiles.length} more.`, 'error');
      return;
    }
    
    const validFiles = files.filter(file => {
      // FIXED: Added PowerPoint, Image, and eBook formats
      const validTypes = [
        '.pdf', '.doc', '.docx', '.txt', '.xlsx', '.xls',  // Documents
        '.ppt', '.pptx',  // PowerPoint
        '.jpg', '.jpeg', '.png', '.gif', '.webp',  // Images
        '.epub'  // eBooks
      ];
      const extension = '.' + file.name.split('.').pop().toLowerCase();
      const isValidType = validTypes.includes(extension);
      const isValidSize = file.size <= MAX_FILE_SIZE;
      
      if (!isValidType) {
        showToast(`File "${file.name}" has invalid type. Accepted: PDF, DOC, DOCX, TXT, XLSX, XLS, PPT, PPTX, JPG, PNG, GIF, WEBP, EPUB`, 'error');
        return false;
      }
      
      if (!isValidSize) {
        showToast(`File "${file.name}" exceeds 25MB limit`, 'error');
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
      showToast(`Successfully uploaded ${validFiles.length} file(s)`, 'success', 3000);
    }
  };

  const handleFileUpload = (e) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (id) => {
    setUploadedFiles(uploadedFiles.filter(f => f.id !== id));
    showToast('File removed', 'info', 2000);
  };

  const handleGenerateQuiz = async (levelSourceContent = null, forceDifficulty = null) => {
    // Prevent duplicate calls
    if (isGeneratingRef.current || generationPromiseRef.current) {
      console.log('⏸️ Already generating, ignoring duplicate call');
      return generationPromiseRef.current;
    }

    if (!levelSourceContent && uploadedFiles.length === 0) {
      showToast('Please upload at least one file', 'error');
      return;
    }

    if (!levelSourceContent && uploadedFiles.length > MAX_FILES) {
      showToast(`Cannot generate quiz with more than ${MAX_FILES} files`, 'error');
      return;
    }

    if (config.numQuestions > 25) {
      showToast('Number of questions must not exceed 25', 'error');
      return;
    }

    if (config.timeLimit < 1 || config.timeLimit > 180) {
      showToast('Time limit must be between 1 and 180 minutes', 'error');
      return;
    }

    isGeneratingRef.current = true;
    setIsGenerating(true);

    const generationPromise = (async () => {
      try {
        const formData = new FormData();
        
        // Use the forced difficulty if provided (for level progression)
        const difficultyToUse = forceDifficulty || config.difficulty;
        
        if (levelSourceContent) {
          console.log('📦 Using source content for', difficultyToUse, 'level');
          formData.append('source_content', levelSourceContent);
          formData.append('files', new Blob(['placeholder']), 'placeholder.txt');
        } else {
          console.log('📁 Using uploaded files');
          uploadedFiles.forEach(fileObj => {
            formData.append('files', fileObj.file);
          });
        }
        
        formData.append('num_questions', config.numQuestions);
        formData.append('difficulty', difficultyToUse);  // Use forced difficulty if provided
        formData.append('time_limit', config.timeLimit);
        formData.append('question_type', config.questionType);
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
        console.log('✅ Quiz generated:', data.quiz_id, 'Difficulty:', data.difficulty);
        
        setQuiz(data);
        setTimeRemaining(data.time_limit);
        setQuizStartTime(Date.now());
        setSourceContent(data.source_content);
        
        // Update config difficulty to match what was actually generated
        if (forceDifficulty) {
          setConfig(prev => ({ ...prev, difficulty: difficultyToUse }));
        }
        
        setStep('taking');
        showToast(`${difficultyToUse.charAt(0).toUpperCase() + difficultyToUse.slice(1)} quiz generated successfully!`, 'success', 3000);
        
        return data;
        
      } catch (error) {
        console.error('❌ Error generating quiz:', error);
        showToast(error.message || 'Failed to generate quiz. Please try again.', 'error');
        throw error;
      } finally {
        setIsGenerating(false);
        isGeneratingRef.current = false;
        generationPromiseRef.current = null;
      }
    })();

    generationPromiseRef.current = generationPromise;
    return generationPromise;
  };

  const handleNextLevel = async () => {
    if (!results?.can_progress) {
      showToast('You have completed all difficulty levels!', 'info');
      return;
    }

    if (!results?.source_content) {
      showToast('Cannot progress: source content missing', 'error');
      return;
    }

    if (!results?.next_difficulty) {
      showToast('Cannot progress: next difficulty not defined', 'error');
      return;
    }

    // Add current level to completed levels
    const currentDiff = results.current_difficulty;
    if (currentDiff && !completedLevels.includes(currentDiff)) {
      setCompletedLevels([...completedLevels, currentDiff]);
    }

    const nextDiff = results.next_difficulty;
    
    // Reset quiz state
    setAnswers({});
    setCurrentQuestion(0);
    setResults(null);
    setShowReview(false);
    
    // Generate quiz with the next difficulty level
    // Pass the difficulty as the third parameter
    console.log('🎯 Progressing to', nextDiff, 'level');
    await handleGenerateQuiz(results.source_content, nextDiff);
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
      
      if (quiz.difficulty && !completedLevels.includes(quiz.difficulty)) {
        setCompletedLevels([...completedLevels, quiz.difficulty]);
      }
      
      setResults(data);
      setStep('results');
      showToast('Quiz submitted successfully!', 'success', 3000);
      
    } catch (error) {
      console.error('Error submitting quiz:', error);
      showToast('Failed to submit quiz. Please try again.', 'error');
    }
  };

  const handleAutoSubmit = async () => {
    showToast('Time is up! Submitting your answers...', 'info', 3000);
    await handleSubmitQuiz();
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/quizzes/${quiz.quiz_id}/results/${results.attempt_id}/pdf`
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
      
      showToast('PDF downloaded successfully!', 'success', 3000);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showToast('Failed to download PDF. Please try again.', 'error');
    }
  };

  const handleRestart = () => {
    setStep('upload');
    setUploadedFiles([]);
    setQuiz(null);
    setAnswers({});
    setCurrentQuestion(0);
    setResults(null);
    setSourceContent(null);
    setCompletedLevels([]);
    setConfig(prev => ({ ...prev, difficulty: 'easy' }));
    showToast('Starting new quiz', 'info', 2000);
  };

  // Utility functions
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // FIXED: Updated file icons for new types
  const getFileIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return '📄';
    if (ext === 'xlsx' || ext === 'xls') return '📊';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['ppt', 'pptx'].includes(ext)) return '📊';  // PowerPoint
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';  // Images
    if (ext === 'epub') return '📚';  // eBooks
    return '📎';
  };

  const getDifficultyColor = (difficulty) => {
    const colors = {
      'easy': '#10b981',
      'medium': '#f59e0b',
      'hard': '#ef4444'
    };
    return colors[difficulty?.toLowerCase()] || '#6b7280';
  };

  const getDifficultyIcon = (difficulty) => {
    const icons = {
      'easy': '⭐',
      'medium': '⭐⭐',
      'hard': '⭐⭐⭐'
    };
    return icons[difficulty?.toLowerCase()] || '⭐';
  };

  const getLevelStepClass = (level) => {
    if (!results) return '';
    
    const currentDiff = results.current_difficulty?.toLowerCase();
    const nextDiff = results.next_difficulty?.toLowerCase();
    const levelLower = level.toLowerCase();
    
    if (completedLevels.includes(levelLower)) {
      return 'completed';
    }
    
    if (currentDiff === levelLower) {
      return 'completed';
    }
    
    if (nextDiff === levelLower) {
      return 'current';
    }
    
    return '';
  };

  // Loading state
  if (isGenerating && step !== 'upload') {
    return (
      <div className="quiz-page">
        <div className="toast-container">
          {toasts.map(toast => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </div>
        
        <div className="quiz-upload-container">
          <div className="upload-header">
            <div className="header-icon">
              <Sparkles size={32} />
            </div>
            <div>
              <h1>Generating {config.difficulty.charAt(0).toUpperCase() + config.difficulty.slice(1)} Level Quiz</h1>
              <p className="subtitle">Please wait while we create your quiz...</p>
            </div>
          </div>
          <div className="generating-spinner">
            <div className="spinner"></div>
            <p>Creating questions based on your materials...</p>
          </div>
        </div>
      </div>
    );
  }

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
            <label>Difficulty Level</label>
            <select
              value={config.difficulty}
              onChange={(e) => setConfig({ ...config, difficulty: e.target.value })}
            >
              <option value="easy">Easy {getDifficultyIcon('easy')}</option>
              <option value="medium">Medium {getDifficultyIcon('medium')}</option>
              <option value="hard">Hard {getDifficultyIcon('hard')}</option>
            </select>
            <small>Start with Easy to unlock levels</small>
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

      <div className="upload-card">
        <input
          ref={fileInputRef}
          type="file"
          id="file-upload"
          multiple
          accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.epub"
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
          {/* FIXED: Updated supported formats */}
          <p>Supports: PDF, DOC/X, XLS/X, PPT/X, TXT, EPUB, IMAGES (Max 25MB each, {MAX_FILES} files max)</p>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="uploaded-files">
            <h4>Uploaded Files ({uploadedFiles.length}/{MAX_FILES})</h4>
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
            {uploadedFiles.length >= MAX_FILES && (
              <div className="file-limit-warning">
                ⚠️ Maximum file limit reached ({MAX_FILES} files)
              </div>
            )}
            {uploadedFiles.length >= MAX_FILES - 3 && uploadedFiles.length < MAX_FILES && (
              <div className="file-limit-info">
                ℹ️ You can upload {MAX_FILES - uploadedFiles.length} more file(s)
              </div>
            )}
          </div>
        )}
      </div>

      {/* FIXED: Generate Quiz button FIRST */}
      <button
        className="generate-btn"
        onClick={() => handleGenerateQuiz()}
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

      {/* FIXED: View Quiz History button BELOW Generate Quiz */}
      <button
        className="history-btn"
        onClick={() => setShowHistory(true)}
      >
        <BarChart3 size={20} />
        <span>View Quiz History</span>
      </button>
    </div>
  );

  // Render quiz taking step
  const renderTakingStep = () => {
    if (!quiz) return <div>Loading quiz...</div>;

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
              <button className="cancel-quiz-btn" onClick={handleCancelQuiz}>
                <XCircle size={20} />
                <span>Cancel Quiz</span>
              </button>
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
          </div>
        </div>
      </div>
    );
  };

  // Render results step
  const renderResultsStep = () => {
    if (!results) return <div>Loading results...</div>;

    return (
      <div className="results-container">
        <div className="results-header">
          <h1>Quiz Results</h1>
          <p>Here's how you performed on this quiz</p>
          {results.current_difficulty && (
            <div className="level-indicator" style={{ color: getDifficultyColor(results.current_difficulty) }}>
              {getDifficultyIcon(results.current_difficulty)} {results.current_difficulty.toUpperCase()} Level Completed
            </div>
          )}
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

        {results.can_progress && (
          <div className="level-progression-card">
            <div className="progression-header">
              <Award size={32} color="#f59e0b" />
              <div>
                <h3>Ready for Next Level?</h3>
                <p>Challenge yourself with {results.next_difficulty} difficulty</p>
              </div>
            </div>
            <div className="progression-path">
              <div className={`level-step ${getLevelStepClass('easy')}`}>
                <div className="level-icon" style={{ background: getDifficultyColor('easy') }}>
                  {getDifficultyIcon('easy')}
                </div>
                <span>Easy</span>
              </div>
              <div className="level-connector"></div>
              
              <div className={`level-step ${getLevelStepClass('medium')}`}>
                <div className="level-icon" style={{ background: getDifficultyColor('medium') }}>
                  {getDifficultyIcon('medium')}
                </div>
                <span>Medium</span>
              </div>
              <div className="level-connector"></div>
              
              <div className={`level-step ${getLevelStepClass('hard')}`}>
                <div className="level-icon" style={{ background: getDifficultyColor('hard') }}>
                  {getDifficultyIcon('hard')}
                </div>
                <span>Hard</span>
              </div>
            </div>
            <button 
              className="next-level-btn" 
              onClick={handleNextLevel}
              disabled={isGenerating}
            >
              <TrendingUp size={20} />
              <span>
                {isGenerating 
                  ? 'Generating...' 
                  : `Progress to ${results.next_difficulty?.charAt(0).toUpperCase() + results.next_difficulty?.slice(1)} Level`
                }
              </span>
            </button>
          </div>
        )}

        {!results.can_progress && (
          <div className="completion-card">
            <Award size={48} color="#10b981" />
            <h3>🏆 All Levels Completed!</h3>
          </div>
        )}

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
            New Topic
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

  // Main render with Quiz History integration
  return (
    <div className="quiz-page">
      {showHistory ? (
        <QuizHistory 
          userId={userId || 1} 
          onBack={() => setShowHistory(false)} 
        />
      ) : (
        <>
          <div className="toast-container">
            {toasts.map(toast => (
              <Toast
                key={toast.id}
                message={toast.message}
                type={toast.type}
                duration={toast.duration}
                onClose={() => removeToast(toast.id)}
              />
            ))}
          </div>

          {step === 'upload' && renderUploadStep()}
          {step === 'taking' && renderTakingStep()}
          {step === 'results' && renderResultsStep()}
        </>
      )}
    </div>
  );
};

export default QuizPage;
