import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAccessToken } from '@/utils/tokenStorage';
import { API } from '@/config/api';

import QuizHomePage from './QuizHomePage';
import QuizTaking   from './QuizTaking';
import QuizResults  from './QuizResults';
import QuizHistory  from './QuizHistory';
import Toast        from './Toast';
import ConfirmDialog from './ConfirmDialog';
import './QuizPage.css';

const MAX_FILES    = 20;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const QuizPage = ({ noteId }) => {
  const { user } = useAuth();

  // Return Headers object with only Authorization header set.
  // Using plain object { Authorization, Content-Type } would break FormData
  // requests — browser must set Content-Type
  const getAuthHeaders = useCallback(() => {
    const token = getAccessToken();
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }, []);

  const [step, setStep]               = useState('upload');
  const [showHistory, setShowHistory] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [quiz,          setQuiz]          = useState(null);
  const [answers,       setAnswers]       = useState({});
  const [results,       setResults]       = useState(null);
  const [completedLevels, setCompletedLevels] = useState([]);
  const [showReview,    setShowReview]    = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeRemaining,   setTimeRemaining]   = useState(null);
  const [quizStartTime,   setQuizStartTime]   = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragActive,   setDragActive]   = useState(false);
  const [toasts,       setToasts]       = useState([]);
  const [dialog,       setDialog]       = useState({ isOpen: false });
  const [config, setConfig] = useState({
    numQuestions: 5, difficulty: 'easy', timeLimit: 30, questionType: 'mixed', contentFocus: 'both',
  });

  const isGeneratingRef      = useRef(false);
  const generationPromiseRef = useRef(null);
  const handleAutoSubmitRef  = useRef(null);
  useEffect(() => { handleAutoSubmitRef.current = handleAutoSubmit; });

  const showToast  = useCallback((message, type = 'error', duration = 5000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);
  const removeToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  const closeDialog = () => setDialog({ isOpen: false });

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('neuranote_quiz_state');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.step && s.step !== 'taking') setStep(s.step);
        if (s.currentQuestion !== undefined) setCurrentQuestion(s.currentQuestion);
        if (s.completedLevels)  setCompletedLevels(s.completedLevels);
        if (s.config)           setConfig(s.config);
        if (s.showHistory !== undefined) setShowHistory(s.showHistory);
      }
    } catch (_) {}
  }, []); // eslint-disable-line

  useEffect(() => {
    try {
      sessionStorage.setItem('neuranote_quiz_state', JSON.stringify({
        step, currentQuestion, config, completedLevels, showHistory,
        quizId: quiz?.quiz_id || null,
      }));
    } catch (_) {}
  }, [step, currentQuestion, config, completedLevels, showHistory, quiz?.quiz_id]);

  useEffect(() => {
    if (step !== 'taking') return;
    const handler = (e) => { e.preventDefault(); e.returnValue = 'Quiz in progress.'; return e.returnValue; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [step]);

  useEffect(() => {
    if (step !== 'taking' || timeRemaining === null || timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) { clearInterval(timer); handleAutoSubmitRef.current?.(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step]); // eslint-disable-line

  const handleFiles = (fileList) => {
    const files = Array.from(fileList);
    if (uploadedFiles.length + files.length > MAX_FILES) {
      showToast(`Cannot upload more than ${MAX_FILES} files.`, 'error'); return;
    }
    const validFiles = files.filter(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      const ok  = ['.pdf','.doc','.docx','.txt','.xlsx','.xls','.ppt','.pptx','.jpg','.jpeg','.png','.gif','.webp','.epub'];
      if (!ok.includes(ext)) { showToast(`"${file.name}" invalid type.`, 'error'); return false; }
      if (file.size > MAX_FILE_SIZE) { showToast(`"${file.name}" exceeds 25MB`, 'error'); return false; }
      return true;
    });
    setUploadedFiles(prev => [...prev, ...validFiles.map(f => ({
      id: Date.now() + Math.random(), name: f.name,
      size: (f.size / (1024 * 1024)).toFixed(2) + ' MB', type: f.type, file: f,
    }))]);
    if (validFiles.length) showToast(`Uploaded ${validFiles.length} file(s)`, 'success', 3000);
  };

  const handleRemoveFile = (id) => { setUploadedFiles(prev => prev.filter(f => f.id !== id)); showToast('File removed', 'info', 2000); };
  const handleDrag = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(e.type === 'dragenter' || e.type === 'dragover'); };
  const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); if (e.dataTransfer.files?.[0]) handleFiles(e.dataTransfer.files); };

  const handleGenerateQuiz = async (levelSourceContent = null, forceDifficulty = null) => {
    if (isGeneratingRef.current || generationPromiseRef.current) return generationPromiseRef.current;
    if (!levelSourceContent && uploadedFiles.length === 0) { showToast('Please upload at least one file', 'error'); return; }
    if (config.numQuestions > 25) { showToast('Max 25 questions', 'error'); return; }
    if (config.timeLimit < 1 || config.timeLimit > 180) { showToast('Time limit 1–180 minutes', 'error'); return; }

    isGeneratingRef.current = true;
    setIsGenerating(true);

    const promise = (async () => {
      try {
        const formData = new FormData();
        const diff = forceDifficulty || config.difficulty;
        if (levelSourceContent) {
          formData.append('source_content', levelSourceContent);
          formData.append('files', new Blob(['placeholder']), 'placeholder.txt');
        } else {
          uploadedFiles.forEach(f => formData.append('files', f.file));
        }
        formData.append('num_questions', config.numQuestions);
        formData.append('difficulty', diff);
        formData.append('time_limit', config.timeLimit);
        formData.append('question_type', config.questionType);
        formData.append('content_focus', config.contentFocus);
        if (noteId) formData.append('note_id', noteId);

        const response = await fetch(API.generate, { method: 'POST', headers: getAuthHeaders(), body: formData });
        if (!response.ok) { const e = await response.json(); throw new Error(e.detail || 'Quiz generation failed'); }

        const data = await response.json();
        setQuiz(data); setTimeRemaining(data.time_limit * 60); setQuizStartTime(Date.now());
        if (forceDifficulty) setConfig(prev => ({ ...prev, difficulty: diff }));
        setStep('taking');
        showToast(`${diff.charAt(0).toUpperCase() + diff.slice(1)} quiz generated!`, 'success', 3000);
        return data;
      } catch (err) {
        showToast(err.message || 'Failed to generate quiz.', 'error');
        throw err;
      } finally {
        setIsGenerating(false); isGeneratingRef.current = false; generationPromiseRef.current = null;
      }
    })();

    generationPromiseRef.current = promise;
    return promise;
  };

  const handleAnswerSelect      = (v) => setAnswers(prev => ({ ...prev, [currentQuestion]: v }));
  const handleShortAnswerChange = (e) => setAnswers(prev => ({ ...prev, [currentQuestion]: e.target.value }));
  const handleNext              = ()  => setCurrentQuestion(q => Math.min(q + 1, quiz.questions.length - 1));
  const handlePrevious          = ()  => setCurrentQuestion(q => Math.max(q - 1, 0));
  const handleQuestionNavigate  = (i) => setCurrentQuestion(i);

  const _doSubmit = async () => {
    setIsSubmitting(true);
    try {
      const timeTaken = Math.floor((Date.now() - quizStartTime) / 1000);
      const formData  = new FormData();
      formData.append('answers', JSON.stringify(answers));
      formData.append('time_taken', timeTaken);

      const response = await fetch(API.submit(quiz.quiz_id), { method: 'POST', headers: getAuthHeaders(), body: formData });
      if (!response.ok) {
        let detail = 'Submission failed';
        try { const e = await response.json(); detail = e.detail || detail; } catch (_) {}
        throw new Error(detail);
      }

      const data = await response.json();
      if (quiz.difficulty && !completedLevels.includes(quiz.difficulty))
        setCompletedLevels(prev => [...prev, quiz.difficulty]);
      setResults(data); setStep('results');
      showToast('Quiz submitted successfully!', 'success', 3000);
    } catch (err) {
      showToast(`Failed to submit: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitQuiz = async (autoSubmit = false) => {
    const totalQ = quiz.questions.length;
    const answered = Object.values(answers).filter(v => v !== null && v !== undefined && String(v).trim() !== '').length;
    const unanswered = totalQ - answered;
    if (autoSubmit) { await _doSubmit(); return; }
    setDialog({
      isOpen: true, type: unanswered > 0 ? 'unanswered' : 'submit',
      message: unanswered > 0
        ? `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?`
        : `All ${totalQ} questions answered. Submit?`,
      okLabel: unanswered > 0 ? 'Submit Anyway' : 'Submit Quiz',
      cancelLabel: 'Return to Quiz',
      onConfirm: () => { closeDialog(); _doSubmit(); },
    });
  };

  const handleAutoSubmit = async () => { showToast('Time is up! Submitting…', 'info', 3000); await handleSubmitQuiz(true); };

  const handleCancelQuiz = () => {
    setDialog({
      isOpen: true, type: 'cancel',
      message: 'Cancel quiz? All progress will be lost.',
      okLabel: 'Yes, Cancel Quiz', cancelLabel: 'Return to Quiz',
      onConfirm: () => {
        closeDialog(); setStep('upload'); setQuiz(null); setAnswers({});
        setCurrentQuestion(0); setTimeRemaining(null); setQuizStartTime(null);
        showToast('Quiz cancelled', 'info', 3000);
      },
    });
  };

  const handleNextLevel = async () => {
    if (!results?.can_progress) { showToast('All levels complete!', 'info'); return; }
    const cd = results.current_difficulty;
    if (cd && !completedLevels.includes(cd)) setCompletedLevels(prev => [...prev, cd]);
    const { next_difficulty, source_content: sc } = results;
    // Show loading overlay on the results page BEFORE clearing state
    setIsGenerating(true);
    // Small delay so React flushes the isGenerating=true render (shows overlay)
    // before handleGenerateQuiz resets and re-sets the flag itself
    await new Promise(r => setTimeout(r, 0));
    setAnswers({}); setCurrentQuestion(0); setResults(null); setShowReview(false);
    await handleGenerateQuiz(sc, next_difficulty);
  };

  const handleRetryLevel = async (sc, difficulty) => {
    // Show loading overlay on the results page BEFORE clearing state
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 0));
    setAnswers({}); setCurrentQuestion(0); setResults(null); setShowReview(false);
    setTimeRemaining(null); setQuizStartTime(null);
    await handleGenerateQuiz(sc, difficulty);
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await fetch(API.pdf(quiz.quiz_id, results.attempt_id), { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `quiz-results-${quiz.quiz_id}.pdf`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
      showToast('PDF downloaded!', 'success', 3000);
    } catch (_) { showToast('Failed to download PDF.', 'error'); }
  };

  const handleRestart = () => {
    sessionStorage.removeItem('neuranote_quiz_state');
    setStep('upload'); setUploadedFiles([]); setQuiz(null); setAnswers({});
    setCurrentQuestion(0); setResults(null); setCompletedLevels([]);
    setConfig(prev => ({ ...prev, difficulty: 'easy' }));
    showToast('Starting new quiz', 'info', 2000);
  };

  if (showHistory) {
    return (
      <div className="quiz-page">
        <ToastLayer toasts={toasts} removeToast={removeToast} />
        <QuizHistory onBack={() => setShowHistory(false)} />
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <ToastLayer toasts={toasts} removeToast={removeToast} />

      {step === 'upload' && (
        <QuizHomePage
          uploadedFiles={uploadedFiles}
          isGenerating={isGenerating}
          dragActive={dragActive}
          config={config}
          onFilesAdded={handleFiles}
          onRemoveFile={handleRemoveFile}
          onDrag={handleDrag}
          onDrop={handleDrop}
          onGenerateQuiz={() => handleGenerateQuiz()}
          onShowHistory={() => setShowHistory(true)}
          onConfigChange={(partial) => setConfig(prev => ({ ...prev, ...partial }))}
          showToast={showToast}
        />
      )}

      {step === 'taking' && (
        <QuizTaking
          quiz={quiz}
          currentQuestion={currentQuestion}
          answers={answers}
          timeRemaining={timeRemaining}
          isSubmitting={isSubmitting}
          onAnswerSelect={handleAnswerSelect}
          onShortAnswerChange={handleShortAnswerChange}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onQuestionNavigate={handleQuestionNavigate}
          onSubmitQuiz={handleSubmitQuiz}
          onCancelQuiz={handleCancelQuiz}
        />
      )}

      {step === 'results' && (
        <QuizResults
          results={results}
          quiz={quiz}
          completedLevels={completedLevels}
          isGenerating={isGenerating}
          showReview={showReview}
          onToggleReview={() => setShowReview(r => !r)}
          onDownloadPDF={handleDownloadPDF}
          onShowHistory={() => setShowHistory(true)}
          onRestart={handleRestart}
          onNextLevel={handleNextLevel}
          onRetryLevel={handleRetryLevel}
        />
      )}

      <ConfirmDialog
        isOpen={dialog.isOpen}
        type={dialog.type}
        message={dialog.message}
        okLabel={dialog.okLabel}
        cancelLabel={dialog.cancelLabel}
        onConfirm={dialog.onConfirm || closeDialog}
        onCancel={closeDialog}
      />
    </div>
  );
};

const ToastLayer = ({ toasts, removeToast }) => (
  <div className="toast-container">
    {toasts.map(t => (
      <Toast key={t.id} message={t.message} type={t.type} duration={t.duration} onClose={() => removeToast(t.id)} />
    ))}
  </div>
);

export default QuizPage;
