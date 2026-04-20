import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, Sparkles, Clock, ChevronLeft, ChevronRight, FileText, Download, TrendingUp, Award, XCircle, BarChart3, Settings, BookOpen, Zap, Layers } from 'lucide-react';
import Toast from './Toast';
import QuizHistory from './QuizHistory';
import ConfirmDialog from './ConfirmDialog';
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
  
  const [toasts, setToasts] = useState([]);
  const [sourceContent, setSourceContent] = useState(null);
  const [completedLevels, setCompletedLevels] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [dialog, setDialog] = useState({ isOpen: false });
  const closeDialog = () => setDialog({ isOpen: false });

  const [config, setConfig] = useState({
    numQuestions: 5,
    difficulty: 'easy',
    timeLimit: 30,
    questionType: 'mixed',
    contentFocus: 'both'
  });

  const fileInputRef = useRef(null);
  const isGeneratingRef = useRef(false);
  const generationPromiseRef = useRef(null);

  const MAX_FILES = 20;
  const MAX_FILE_SIZE = 25 * 1024 * 1024;

  const showToast = (message, type = 'error', duration = 5000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const handleCancelQuiz = () => {
    setDialog({
      isOpen: true,
      type: 'cancel',
      message: 'Are you sure you want to cancel? All progress will be lost.',
      okLabel: 'Yes, Cancel Quiz',
      cancelLabel: 'Return to Quiz',
      onConfirm: () => {
        closeDialog();
        setStep('upload');
        setQuiz(null);
        setAnswers({});
        setCurrentQuestion(0);
        setTimeRemaining(null);
        setQuizStartTime(null);
        showToast('Quiz cancelled', 'info', 3000);
      },
    });
  };

  const handleAutoSubmitRef = React.useRef(null);
  useEffect(() => { handleAutoSubmitRef.current = handleAutoSubmit; });

  useEffect(() => {
    if (step !== 'taking' || timeRemaining === null || timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmitRef.current && handleAutoSubmitRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('neuranote_quiz_state');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.step) setStep(s.step);
        if (s.quiz) setQuiz(s.quiz);
        if (s.answers) setAnswers(s.answers);
        if (s.currentQuestion !== undefined) setCurrentQuestion(s.currentQuestion);
        if (s.timeRemaining !== undefined) setTimeRemaining(s.timeRemaining);
        if (s.quizStartTime) setQuizStartTime(s.quizStartTime);
        if (s.results) setResults(s.results);
        if (s.showReview !== undefined) setShowReview(s.showReview);
        if (s.sourceContent) setSourceContent(s.sourceContent);
        if (s.completedLevels) setCompletedLevels(s.completedLevels);
        if (s.config) setConfig(s.config);
        if (s.showHistory !== undefined) setShowHistory(s.showHistory);
      }
    } catch (e) {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      const state = {
        step, quiz, answers, currentQuestion, timeRemaining,
        quizStartTime, results, showReview, sourceContent,
        completedLevels, config, showHistory
      };
      sessionStorage.setItem('neuranote_quiz_state', JSON.stringify(state));
    } catch (e) {}
  }, [step, quiz, answers, currentQuestion, timeRemaining, quizStartTime,
      results, showReview, sourceContent, completedLevels, config, showHistory]);

  useEffect(() => {
    if (step !== 'taking') return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'You have a quiz in progress. If you refresh, your current answers will be lost. Are you sure?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [step]);

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
    const totalFilesAfterAdd = uploadedFiles.length + files.length;
    if (totalFilesAfterAdd > MAX_FILES) {
      showToast(`Cannot upload more than ${MAX_FILES} files. You currently have ${uploadedFiles.length} file(s). You can add ${MAX_FILES - uploadedFiles.length} more.`, 'error');
      return;
    }
    const validFiles = files.filter(file => {
      const validTypes = [
        '.pdf', '.doc', '.docx', '.txt', '.xlsx', '.xls',
        '.ppt', '.pptx',
        '.jpg', '.jpeg', '.png', '.gif', '.webp',
        '.epub'
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
    if (isGeneratingRef.current || generationPromiseRef.current) {
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
        const difficultyToUse = forceDifficulty || config.difficulty;
        if (levelSourceContent) {
          formData.append('source_content', levelSourceContent);
          formData.append('files', new Blob(['placeholder']), 'placeholder.txt');
        } else {
          uploadedFiles.forEach(fileObj => {
            formData.append('files', fileObj.file);
          });
        }
        formData.append('num_questions', config.numQuestions);
        formData.append('difficulty', difficultyToUse);
        formData.append('time_limit', config.timeLimit);
        formData.append('question_type', config.questionType);
        formData.append('content_focus', config.contentFocus);
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
        setTimeRemaining(data.time_limit * 60);
        setQuizStartTime(Date.now());
        setSourceContent(data.source_content);
        if (forceDifficulty) {
          setConfig(prev => ({ ...prev, difficulty: difficultyToUse }));
        }
        setStep('taking');
        showToast(`${difficultyToUse.charAt(0).toUpperCase() + difficultyToUse.slice(1)} quiz generated successfully!`, 'success', 3000);
        return data;
      } catch (error) {
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

  const handleRetryLevel = async (sourceContent, difficulty) => {
    const savedContent = sourceContent;
    const savedDifficulty = difficulty;
    setQuiz(null);
    setAnswers({});
    setCurrentQuestion(0);
    setResults(null);
    setShowReview(false);
    setTimeRemaining(null);
    setQuizStartTime(null);
    await handleGenerateQuiz(savedContent, savedDifficulty);
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
    const currentDiff = results.current_difficulty;
    if (currentDiff && !completedLevels.includes(currentDiff)) {
      setCompletedLevels([...completedLevels, currentDiff]);
    }
    const nextDiff = results.next_difficulty;
    const savedSourceContent = results.source_content;
    setAnswers({});
    setCurrentQuestion(0);
    setResults(null);
    setShowReview(false);
    await handleGenerateQuiz(savedSourceContent, nextDiff);
  };

  const handleAnswerSelect = (value) => {
    setAnswers({ ...answers, [currentQuestion]: value });
  };

  const handleShortAnswerChange = (e) => {
    setAnswers({ ...answers, [currentQuestion]: e.target.value });
  };

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

  const handleSubmitQuiz = async (autoSubmit = false) => {
    const totalQ = quiz.questions.length;
    const answered = Object.values(answers).filter(
      v => v !== null && v !== undefined && String(v).trim() !== ''
    ).length;
    const unanswered = totalQ - answered;

    if (autoSubmit) {
      await _doSubmit();
      return;
    }

    if (unanswered > 0) {
      setDialog({
        isOpen: true,
        type: 'unanswered',
        message: `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''} out of ${totalQ}. Unanswered questions will be marked incorrect. Submit anyway?`,
        okLabel: 'Submit Anyway',
        cancelLabel: 'Return to Quiz',
        onConfirm: () => { closeDialog(); _doSubmit(); },
      });
    } else {
      setDialog({
        isOpen: true,
        type: 'submit',
        message: `All ${totalQ} questions answered. Are you ready to submit?`,
        okLabel: 'Submit Quiz',
        cancelLabel: 'Return to Quiz',
        onConfirm: () => { closeDialog(); _doSubmit(); },
      });
    }
  };

  const _doSubmit = async () => {
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

      if (!response.ok) throw new Error('Submission failed');

      const data = await response.json();
      if (quiz.difficulty && !completedLevels.includes(quiz.difficulty)) {
        setCompletedLevels(prev => [...prev, quiz.difficulty]);
      }
      setResults(data);
      setStep('results');
      showToast('Quiz submitted successfully!', 'success', 3000);
    } catch (error) {
      console.error('Submit error:', error);
      showToast(`Failed to submit quiz: ${error.message || 'Unknown error'}`, 'error');
    }
  };

  const handleAutoSubmit = async () => {
    showToast('Time is up! Submitting your answers...', 'info', 3000);
    await handleSubmitQuiz(true);
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
      a.download = `quiz-results-${quiz.quiz_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('PDF downloaded successfully!', 'success', 3000);
    } catch (error) {
      showToast('Failed to download PDF. Please try again.', 'error');
    }
  };

  const handleRestart = () => {
    sessionStorage.removeItem('neuranote_quiz_state');
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
    if (['ppt', 'pptx'].includes(ext)) return '📊';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
    if (ext === 'epub') return '📚';
    return '📎';
  };

  const getDifficultyColor = (difficulty) => {
    const colors = { 'easy': '#10b981', 'medium': '#f59e0b', 'hard': '#ef4444' };
    return colors[difficulty?.toLowerCase()] || '#6b7280';
  };

  const getDifficultyIcon = (difficulty) => {
    const icons = { 'easy': '⭐', 'medium': '⭐⭐', 'hard': '⭐⭐⭐' };
    return icons[difficulty?.toLowerCase()] || '⭐';
  };

  const getLevelStepClass = (level) => {
    if (!results) return '';
    const currentDiff = results.current_difficulty?.toLowerCase();
    const nextDiff = results.next_difficulty?.toLowerCase();
    const levelLower = level.toLowerCase();
    if (completedLevels.includes(levelLower)) return 'completed';
    if (currentDiff === levelLower) return 'completed';
    if (nextDiff === levelLower) return 'current';
    return '';
  };

  // ── Settings Sidebar (only shown on upload step) ────────────────────────
  const renderSettingsSidebar = () => (
    <aside className="settings-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-icon">
          <Settings size={18} />
        </div>
        <h2>Quiz Settings</h2>
      </div>

      <div className="sidebar-section">
        <label className="sidebar-label">Questions</label>
        <div className="sidebar-input-group">
          <input
            type="number"
            min="1"
            max="25"
            value={config.numQuestions}
            onChange={(e) => setConfig({ ...config, numQuestions: Math.min(25, Math.max(1, parseInt(e.target.value) || 1)) })}
            className="sidebar-input"
          />
          <span className="sidebar-input-hint">max 25</span>
        </div>
      </div>

      <div className="sidebar-section">
        <label className="sidebar-label">Time Limit</label>
        <div className="sidebar-input-group">
          <input
            type="number"
            min="1"
            max="180"
            value={config.timeLimit}
            onChange={(e) => setConfig({ ...config, timeLimit: Math.min(180, Math.max(1, parseInt(e.target.value) || 1)) })}
            className="sidebar-input"
          />
          <span className="sidebar-input-hint">minutes</span>
        </div>
      </div>

      <div className="sidebar-section">
        <label className="sidebar-label">Difficulty</label>
        <div className="sidebar-pill-group">
          {[
            { value: 'easy', label: 'Easy', color: '#10b981' },
            { value: 'medium', label: 'Medium', color: '#f59e0b' },
            { value: 'hard', label: 'Hard', color: '#ef4444' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`sidebar-pill ${config.difficulty === opt.value ? 'sidebar-pill--active' : ''}`}
              style={config.difficulty === opt.value ? { '--pill-color': opt.color } : {}}
              onClick={() => setConfig({ ...config, difficulty: opt.value })}
            >
              {getDifficultyIcon(opt.value)} {opt.label}
            </button>
          ))}
        </div>
        <p className="sidebar-hint">Start with Easy to unlock levels</p>
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <label className="sidebar-label">Question Type</label>
        <div className="sidebar-option-group">
          {[
            { value: 'mcq',          icon: '☑️', label: 'Multiple Choice' },
            { value: 'short_answer', icon: '✏️', label: 'Short Answer'    },
            { value: 'mixed',        icon: '🔀', label: 'Mixed'           },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`sidebar-option ${config.questionType === opt.value ? 'sidebar-option--active' : ''}`}
              onClick={() => setConfig({ ...config, questionType: opt.value })}
            >
              <span className="sidebar-option-icon">{opt.icon}</span>
              <span className="sidebar-option-label">{opt.label}</span>
              {config.questionType === opt.value && <span className="sidebar-option-check">✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <label className="sidebar-label">Content Focus</label>
        <div className="sidebar-option-group">
          {[
            { value: 'theoretical', icon: '📖', label: 'Theoretical', desc: 'Concepts & theory' },
            { value: 'practical',   icon: '⚙️', label: 'Practical',   desc: 'Application & code' },
            { value: 'both',        icon: '🔀', label: 'Both',        desc: 'Balanced mix' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`sidebar-option ${config.contentFocus === opt.value ? 'sidebar-option--active' : ''}`}
              onClick={() => setConfig({ ...config, contentFocus: opt.value })}
            >
              <span className="sidebar-option-icon">{opt.icon}</span>
              <div className="sidebar-option-text">
                <span className="sidebar-option-label">{opt.label}</span>
                <span className="sidebar-option-desc">{opt.desc}</span>
              </div>
              {config.contentFocus === opt.value && <span className="sidebar-option-check">✓</span>}
            </button>
          ))}
        </div>
      </div>

    </aside>
  );

  // Loading state
  if (isGenerating && step !== 'upload') {
    return (
      <div className="quiz-page">
        <div className="toast-container">
          {toasts.map(toast => (
            <Toast key={toast.id} message={toast.message} type={toast.type} duration={toast.duration} onClose={() => removeToast(toast.id)} />
          ))}
        </div>
        <div className="quiz-generating-fullscreen">
          <div className="generating-content">
            <div className="generating-icon">
              <Sparkles size={36} />
            </div>
            <h2>Generating {config.difficulty.charAt(0).toUpperCase() + config.difficulty.slice(1)} Quiz</h2>
            <p>Creating questions based on your materials...</p>
            <div className="spinner spinner--lg"></div>
          </div>
        </div>
      </div>
    );
  }

  // ── Upload Step ────────────────────────────────────────────────────────
  const renderUploadStep = () => (
    <div className="quiz-workspace">
      {renderSettingsSidebar()}

      <main className="quiz-main-content">
        <div className="upload-header">
          <div className="header-icon">
            <Sparkles size={28} />
          </div>
          <div>
            <h1>Generate Quiz</h1>
            <p className="subtitle">Upload your study materials to create a customized quiz</p>
          </div>
        </div>

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
          className={`upload-dropzone ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="dropzone-icon">
            <Upload size={32} />
          </div>
          <h3>Drag & Drop files here</h3>
          <p>or click to browse</p>
          <div className="dropzone-formats">
            PDF · DOC · PPT · XLS · TXT · EPUB · Images
          </div>
          <div className="dropzone-limit">Max 25MB per file · Up to {MAX_FILES} files</div>
        </div>

        {uploadedFiles.length > 0 && (
          <div className="uploaded-files-panel">
            <div className="files-panel-header">
              <h4>Uploaded Files</h4>
              <span className="files-count">{uploadedFiles.length} / {MAX_FILES}</span>
            </div>
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
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            {uploadedFiles.length >= MAX_FILES && (
              <div className="file-limit-warning">⚠️ Maximum file limit reached ({MAX_FILES} files)</div>
            )}
            {uploadedFiles.length >= MAX_FILES - 3 && uploadedFiles.length < MAX_FILES && (
              <div className="file-limit-info">ℹ️ You can upload {MAX_FILES - uploadedFiles.length} more file(s)</div>
            )}
          </div>
        )}

        {uploadedFiles.length === 0 && (
          <div className="upload-tips">
            <h4>Tips for best results</h4>
            <ul>
              <li>📄 Upload lecture notes, textbook chapters, or slides</li>
              <li>🎯 More material = more diverse questions</li>
              <li>📋 PDFs and Word documents work best</li>
              <li>⚙️ Configure your quiz settings in the sidebar</li>
            </ul>
          </div>
        )}

        <div className="main-action-row">
          <button
            className="main-generate-btn"
            onClick={() => handleGenerateQuiz()}
            disabled={uploadedFiles.length === 0 || isGenerating}
          >
            {isGenerating ? (
              <>
                <div className="spinner spinner--sm"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Generate Quiz</span>
              </>
            )}
          </button>

          <button
            className="main-history-btn"
            onClick={() => setShowHistory(true)}
          >
            <BarChart3 size={18} />
            <span>View History</span>
          </button>
        </div>
      </main>
    </div>
  );

  // ── Quiz Taking Step ───────────────────────────────────────────────────
  const renderTakingStep = () => {
    if (!quiz) return <div>Loading quiz...</div>;

    const question = quiz.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;
    const answeredCount = Object.values(answers).filter(v => v !== null && v !== undefined && String(v).trim() !== '').length;

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
            <div className="question-meta">
              <span className="question-number">Question {currentQuestion + 1}</span>
              {question.question_type === 'short_answer' && (
                <span className="question-type-badge">Short Answer</span>
              )}
            </div>
            <h2 className="question-text">{question.question_text}</h2>

            {question.question_type === 'multiple_choice' ? (
              <div className="options-list">
                {question.options && question.options.map((opt) => (
                  <button
                    key={opt.option_letter}
                    className={`option-btn ${answers[currentQuestion] === opt.option_letter ? 'selected' : ''}`}
                    onClick={() => handleAnswerSelect(opt.option_letter)}
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
                  placeholder="Type your answer here..."
                  value={answers[currentQuestion] || ''}
                  onChange={handleShortAnswerChange}
                  rows={4}
                />
              </div>
            )}
          </div>

          <div className="quiz-navigation">
            <button
              className="nav-btn"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
            >
              <ChevronLeft size={20} />
              Previous
            </button>

            {currentQuestion < quiz.questions.length - 1 && (
              <button className="nav-btn next" onClick={handleNext}>
                Next
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </div>

        <div className="quiz-sidebar">
          <h3>Questions</h3>
          <div className="question-grid">
            {quiz.questions.map((_, index) => (
              <button
                key={index}
                className={`question-dot ${index === currentQuestion ? 'current' : ''} ${answers[index] !== undefined && String(answers[index]).trim() !== '' ? 'answered' : ''}`}
                onClick={() => handleQuestionNavigate(index)}
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
          <button className="submit-btn sidebar-submit-btn" onClick={() => handleSubmitQuiz()}>
            Submit ({answeredCount}/{quiz.questions.length})
          </button>
        </div>
      </div>
    );
  };

  // ── Results Step ───────────────────────────────────────────────────────
  const renderResultsStep = () => {
    if (!results) return <div>Loading results...</div>;

    const percentage = results.score_percentage ?? results.percentage ?? 0;
    const correct = results.correct_answers || 0;
    const total = results.total_questions || 0;
    const incorrect = total - correct;
    const timeTaken = results.time_taken || 0;
    const passed = percentage >= 50;
    const scoreColor = '#9333ea';
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="results-container">
        <div className="results-header">
          <h1>Quiz Results</h1>
          <p className="subtitle">Here's how you performed on this quiz</p>
        </div>

        {/* Donut score card */}
        <div className="score-card-new">
          <svg className="score-donut" viewBox="0 0 180 180" width="180" height="180">
            <circle cx="90" cy="90" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="14" />
            <circle
              cx="90" cy="90" r={radius} fill="none"
              stroke={scoreColor} strokeWidth="14"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 90 90)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
            <text x="90" y="95" textAnchor="middle" fontSize="30" fontWeight="800" fill="#111827">{Math.round(percentage)}%</text>
          </svg>
          <p className="score-verdict">{passed ? '🎉 Great job!' : '📚 Keep Practicing!'}</p>
          <p className="score-sub">You scored {correct} out of {total} correct</p>
        </div>

        {/* Stat cards row */}
        <div className="stat-cards-row">
          <div className="stat-card stat-card--correct">
            <div className="stat-card-icon">✓</div>
            <div className="stat-card-body">
              <span className="stat-card-label">Correct</span>
              <span className="stat-card-value">{correct}</span>
            </div>
          </div>
          <div className="stat-card stat-card--incorrect">
            <div className="stat-card-icon">✗</div>
            <div className="stat-card-body">
              <span className="stat-card-label">Incorrect</span>
              <span className="stat-card-value">{incorrect}</span>
            </div>
          </div>
          <div className="stat-card stat-card--time">
            <div className="stat-card-icon">⏱</div>
            <div className="stat-card-body">
              <span className="stat-card-label">Time Taken</span>
              <span className="stat-card-value">{Math.floor(timeTaken/60)}:{String(timeTaken%60).padStart(2,'0')}</span>
            </div>
          </div>
        </div>

        {results.current_difficulty !== 'hard' && (
          <div className={`level-progression-card ${results.can_progress ? 'can-progress' : 'needs-retry'}`}>
            <div className="progression-header">
              <Award size={32} color={results.can_progress ? '#f59e0b' : '#9333ea'} />
              <div>
                {results.can_progress ? (
                  <>
                    <h3>🎉 Ready for Next Level!</h3>
                    <p>You passed! Move on to <strong>{results.next_difficulty}</strong> difficulty</p>
                  </>
                ) : (
                  <>
                    <h3>📚 Keep Practicing!</h3>
                    <p>Score 50% or more to unlock the next level</p>
                  </>
                )}
              </div>
            </div>

            <div className="progression-path">
              {['easy', 'medium', 'hard'].map((level, idx, arr) => (
                <React.Fragment key={level}>
                  <div className={`level-step ${getLevelStepClass(level)}`}>
                    <div className="level-icon" style={{ background: getDifficultyColor(level) }}>
                      {getDifficultyIcon(level)}
                    </div>
                    <span>{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                    {getLevelStepClass(level) === 'completed' && <span className="level-check">✓</span>}
                    {getLevelStepClass(level) === 'current' && <span className="level-next-label">Next</span>}
                  </div>
                  {idx < arr.length - 1 && (
                    <div className={`level-connector ${getLevelStepClass(level) === 'completed' ? 'active' : ''}`}></div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {results.can_progress ? (
              <button className="next-level-btn" onClick={handleNextLevel} disabled={isGenerating}>
                <TrendingUp size={20} />
                <span>
                  {isGenerating ? 'Generating...' : `Progress to ${results.next_difficulty?.charAt(0).toUpperCase() + results.next_difficulty?.slice(1)} Level →`}
                </span>
              </button>
            ) : (
              <button className="retry-level-btn" onClick={() => handleRetryLevel(results.source_content, results.current_difficulty)} disabled={isGenerating}>
                <Sparkles size={20} />
                <span>{isGenerating ? 'Generating...' : `Retry ${results.current_difficulty?.charAt(0).toUpperCase() + results.current_difficulty?.slice(1)} Level`}</span>
              </button>
            )}
          </div>
        )}

        {results.current_difficulty === 'hard' && results.passed && (
          <div className="completion-card">
            <Award size={48} color="#10b981" />
            <h3>🏆 All Levels Completed!</h3>
            <p>Congratulations — you mastered all three difficulty levels!</p>
          </div>
        )}

        {results.current_difficulty === 'hard' && !results.passed && (
          <div className={`level-progression-card needs-retry`}>
            <div className="progression-header">
              <Award size={32} color="#9333ea" />
              <div>
                <h3>📚 Almost There!</h3>
                <p>Score 50% or more to complete the Hard level</p>
              </div>
            </div>
            <button className="retry-level-btn" onClick={() => handleRetryLevel(results.source_content, 'hard')} disabled={isGenerating}>
              <Sparkles size={20} />
              <span>{isGenerating ? 'Generating...' : 'Retry Hard Level'}</span>
            </button>
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
          <button className="action-btn secondary" onClick={() => setShowHistory(true)}>
            <BarChart3 size={20} />
            History & Analytics
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

          <ConfirmDialog
            isOpen={dialog.isOpen}
            type={dialog.type}
            message={dialog.message}
            okLabel={dialog.okLabel}
            cancelLabel={dialog.cancelLabel}
            onConfirm={dialog.onConfirm || closeDialog}
            onCancel={closeDialog}
          />
        </>
      )}
    </div>
  );
};

export default QuizPage;
