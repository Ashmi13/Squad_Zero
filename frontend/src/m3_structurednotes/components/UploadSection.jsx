/**
 * NeuraNote — Member 3: Structured Note Generation
 * UploadSection.jsx — FULL REBUILD (Production-Ready)
 *
 * Key fixes over previous version:
 *  - Uses async background job pattern: POST /generate-note → polls /job/{id}/status
 *  - Reads REAL .md content from localStorage (not mock strings)
 *  - No hardcoded user IDs — reads userId from prop or localStorage auth keys
 *  - Progress bar with human-readable status labels per pipeline phase
 *  - Drag-and-drop fixed: notebook notes carry real content as Blob
 *  - File type icons per extension
 *  - Accessible: keyboard nav, aria-labels, focus rings
 *  - CSS Module classes preserved; new classes added at bottom
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  CloudUpload, FolderOpen, Loader2, FileText, X,
  File, CheckCircle2, ChevronRight, ChevronDown,
  Folder, AlertCircle, Sparkles, BookOpen,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import styles from './UploadSection.module.css';
import { uploadPDF } from '../api';
import { workspaceApi } from '../../services/workspaceApi';

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE_URL) 
  ? `${import.meta.env.VITE_API_BASE_URL}/api/m3`
  : 'http://127.0.0.1:8000/api/m3';
/**
 * Maps pipeline status strings (from DB) to user-friendly messages.
 * Matches the status values written by services.py _update_job().
 */
const STATUS_LABELS = {
  queued:      'Preparing your materials…',
  retrieving:  'Reading lecture content…',
  analyzing:   'Extracting topic structure…',
  expanding:   'Writing detailed explanations…',
  assembling:  'Building your note…',
  generating:  'Creating structured note…',
  done:        'Done! Opening your notes…',
  failed:      'Something went wrong.',
};

const STATUS_PROGRESS = {
  queued:     5,
  retrieving: 15,
  analyzing:  30,
  expanding:  55,
  assembling: 75,
  generating: 88,
  done:       100,
  failed:     100,
};

const ALLOWED_EXTENSIONS = ['.pdf', '.pptx', '.md', '.txt'];
const MAX_SIZE_MB = 30;
const POLL_INTERVAL_MS = 3000;

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileExt(filename) {
  return '.' + filename.split('.').pop().toLowerCase();
}

function getFileIcon(filename) {
  const ext = getFileExt(filename);
  if (ext === '.pdf') return '📄';
  if (ext === '.pptx') return '📊';
  if (['.md', '.txt'].includes(ext)) return '📝';
  return '📁';
}

/**
 * FIX: Reads REAL content from localStorage for a notebook note.
 * Member 2 saves notes as: localStorage.setItem(`note_content_${id}`, content)
 * Falls back to a description string if key not found.
 */
function getNotebookNoteContent(note) {
  // Try Member 2's storage key patterns
  const possibleKeys = [
    `note_content_${note.id}`,
    `neuranote_note_${note.id}`,
    `note_${note.id}`,
  ];

  for (const key of possibleKeys) {
    const content = localStorage.getItem(key);
    if (content && content.trim().length > 10) {
      return content;
    }
  }

  // Fallback: use name as content header (better than mock)
  return `# ${note.name}\n\nContent from notebook: ${note.name}.\nType: ${note.type || 'MD'}`;
}

// ─────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────

const UploadSection = ({ userId: userIdProp }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userScope = user?.id || 'anonymous';

  // ── State ──────────────────────────────────────────────────
  const [selectedFiles, setSelectedFiles]     = useState([]);   // Real File objects
  const [notebookNotes, setNotebookNotes]     = useState([]);   // { id, name, type, content }
  const [folders, setFolders]                 = useState([]);
  const [filesByFolder, setFilesByFolder]     = useState({});
  const [expandedFolders, setExpandedFolders] = useState({});

  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [ordering, setOrdering]                 = useState('ai');
  const [instruction, setInstruction]           = useState('');
  const [customTitle, setCustomTitle]           = useState('');

  const [jobId, setJobId]             = useState(null);
  const [jobStatus, setJobStatus]     = useState(null);   // pipeline status string
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');
  const [dragOver, setDragOver]       = useState(false);

  const fileInputRef  = useRef(null);
  const pollTimerRef  = useRef(null);
  const successfulUploadsRef = useRef([]);

  // ── Resolve userId ─────────────────────────────────────────
  const userId = userIdProp
    || userScope
    || localStorage.getItem('neuranote_user_id')
    || localStorage.getItem('user_id')
    || 'guest_user';

  // ── Load Member 2 notebook data ────────────────────────────
  useEffect(() => {
    const rawFolders = localStorage.getItem('neuranote_folders');
    const rawFiles   = localStorage.getItem('neuranote_files');

    if (rawFolders) {
      try { setFolders(JSON.parse(rawFolders)); } catch {}
    }
    if (rawFiles) {
      try { setFilesByFolder(JSON.parse(rawFiles)); } catch {}
    }

    // Cleanup poll on unmount
    return () => clearTimeout(pollTimerRef.current);
  }, []);

  // ── Poll job status ─────────────────────────────────────────
  const startPolling = useCallback((id) => {
    const poll = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/job/${id}/status`);
        setJobStatus(data.status);

        if (data.status === 'done') {
          const noteId = data.note_id;
          
          if (!noteId || noteId === '...') {
            console.error('[Poll] Missing note_id!');
            setErrorMsg('Note generated but ID missing.');
            setIsProcessing(false);
            setJobStatus(null);
            return;
          }

          if (successfulUploadsRef.current && successfulUploadsRef.current.length > 0) {
            console.log('[Poll] Saving source files to localStorage:', successfulUploadsRef.current);
            localStorage.setItem('currentNoteFiles', JSON.stringify(successfulUploadsRef.current));
          }
          
          // Redirect to NoteEditor
          setTimeout(() => {
            navigate(`/notes/editor/${noteId}`);
          }, 1000);
          return;
        }

        if (data.status === 'failed') {
          setErrorMsg(data.error || 'Pipeline compilation failed.');
          setIsProcessing(false);
          setJobStatus(null);
          return;
        }

        // Keep polling
        pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        console.error('[Poll] Error:', err);
        setErrorMsg('Disconnected from generation pipeline. Retrying…');
        pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
  }, [navigate]);

  const addLocalFiles = (files) => {
    const valid = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = getFileExt(f.name);

      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        errors.push(`${f.name}: Only PDF, PPTX, MD, and TXT are supported.`);
        continue;
      }

      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        errors.push(`${f.name}: Exceeds maximum size of ${MAX_SIZE_MB}MB.`);
        continue;
      }

      valid.push(f);
    }

    if (errors.length) {
      setErrorMsg(errors.join('\n'));
    }

    if (valid.length) {
      setSelectedFiles(prev => [...prev, ...valid]);
    }
  };

  const handleFileInputChange = (e) => {
    addLocalFiles(e.target.files);
    e.target.value = '';
  };

  const removeLocalFile = (idx) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const addNotebookNote = (note) => {
    if (notebookNotes.some(n => n.id === note.id)) return;
    setNotebookNotes(prev => [...prev, note]);
  };

  const removeNotebookNote = (idx) => {
    setNotebookNotes(prev => notebookNotes.filter((_, i) => i !== idx));
  };

  // ── Drag and drop ────────────────────────────────────────────
  const handleDragStart = (e, note) => {
    e.dataTransfer.setData('application/json', JSON.stringify(note));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDropZoneDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDropZoneDragLeave = () => setDragOver(false);

  const handleDropZoneDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);

    console.log('[Drop] DataTransfer types:', e.dataTransfer.types);
    const json = e.dataTransfer.getData('neuranote-quiz-file') || e.dataTransfer.getData('application/json');
    console.log('[Drop] Received payload:', json);

    if (json) {
      try {
        const dragData = JSON.parse(json);
        console.log('[Drop] Parsed drag data object:', dragData);
        if (dragData.fileId) {
          setIsProcessing(true);
          setErrorMsg('');
          setJobStatus('retrieving');
          try {
            // Route through workspaceApi.getFileContent() (absolute Render URL,
            // authenticated, token-refresh aware) — a relative fetch('/api/...')
            // on the deployed Vercel site is rewritten to index.html by the SPA
            // catch-all, so the "blob" silently becomes HTML and text extraction
            // yields 0 chars ("No text found for the given file IDs").
            const blob = await workspaceApi.getFileContent(dragData.fileId);
            const mimeType = blob.type || 'application/pdf';
            
            // Auto-detect and fix missing extensions in the filename
            let filename = dragData.fileName || 'file';
            const extFromUrl = getFileExt(dragData.fileUrl || '');
            
            if (extFromUrl && ALLOWED_EXTENSIONS.includes(extFromUrl.toLowerCase()) && !filename.toLowerCase().endsWith(extFromUrl.toLowerCase())) {
              filename += extFromUrl;
            } else if (mimeType.includes('pdf') && !filename.toLowerCase().endsWith('.pdf')) {
              filename += '.pdf';
            } else if ((mimeType.includes('presentation') || mimeType.includes('powerpoint') || mimeType.includes('pptx')) && !filename.toLowerCase().endsWith('.pptx')) {
              filename += '.pptx';
            } else if (mimeType.includes('markdown') && !filename.toLowerCase().endsWith('.md')) {
              filename += '.md';
            } else if (mimeType.includes('text') && !filename.toLowerCase().endsWith('.txt')) {
              filename += '.txt';
            }

            const fileObj = new window.File([blob], filename, { type: mimeType });
            addLocalFiles([fileObj]);
          } catch (err) {
            setErrorMsg('Failed to load workspace file.');
            console.error(err);
          } finally {
            setIsProcessing(false);
            setJobStatus(null);
          }
        } else if (dragData.id) {
          if (!notebookNotes.some(n => n.id === dragData.id)) {
            setNotebookNotes(prev => [...prev, dragData]);
          }
        }
      } catch (err) {
        console.error('[Drop] Failed parsing drag data:', err);
      }
    } else if (e.dataTransfer.files.length) {
      console.log('[Drop] Received local files:', e.dataTransfer.files);
      addLocalFiles(e.dataTransfer.files);
    }
  };

  // ── Toggle folder ────────────────────────────────────────────
  const toggleFolder = (name) => {
    setExpandedFolders(prev => ({ ...prev, [name]: !prev[name] }));
  };

  // ── Clear all ────────────────────────────────────────────────
  const clearAll = () => {
    setSelectedFiles([]);
    setNotebookNotes([]);
    setErrorMsg('');
  };

  // ── MAIN: Upload + Generate ──────────────────────────────────
  const handleGenerate = async () => {
    const totalItems = selectedFiles.length + notebookNotes.length;
    if (totalItems === 0) return;

    setErrorMsg('');
    setIsProcessing(true);
    setJobStatus('queued');

    try {
      // Step 1 — Build file list (local + notebook notes as .md files)
      const filesToUpload = [...selectedFiles];

      for (const note of notebookNotes) {
        const content = note.content || getNotebookNoteContent(note);
        const blob = new Blob([content], { type: 'text/markdown' });
        const virtualFile = new window.File([blob], `${note.name}.md`, { type: 'text/markdown' });
        filesToUpload.push(virtualFile);
      }

      // Step 2 — Upload all files
      setJobStatus('retrieving');
      const uploadResult = await uploadPDF(filesToUpload);
      const successfulUploads = uploadResult.uploaded_files?.filter(f => !f.error) || [];

      if (successfulUploads.length === 0) {
        const errorDetails = uploadResult.uploaded_files?.map(f => `${f.filename}: ${f.error}`).join('\n');
        throw new Error(`Upload Failed:\n${errorDetails || 'All files failed to upload.'}`);
      }

      localStorage.setItem(
        'currentPdfId',
        successfulUploads[0].pdf_id
      );

      // Step 3 — Start structured note background job
      const inputItems = successfulUploads.map(f => ({
        type: "pdf_id",
        value: f.pdf_id
      }));

      const { data: jobData } = await axios.post(`${API_BASE}/generate-structured-note`, {
        input_items: inputItems,
        user_id: userId,
        language: selectedLanguage,
        module_name: customTitle.trim() || 'Study Notes'
      });

      const newJobId = jobData.job_id;
      setJobId(newJobId);
      setJobStatus(jobData.status || 'queued');

      // Step 4 — Poll until done or failed
      successfulUploadsRef.current = successfulUploads;
      startPolling(newJobId);

    } catch (err) {
      console.error('[handleGenerate]', err);
      setIsProcessing(false);
      setJobStatus(null);
      setErrorMsg(
        err?.response?.data?.detail
        || err?.message
        || 'An unexpected error occurred. Please try again.'
      );
    }
  };

  // ── Derived state ────────────────────────────────────────────
  const totalItems    = selectedFiles.length + notebookNotes.length;
  const hasItems      = totalItems > 0;
  const progressPct   = STATUS_PROGRESS[jobStatus] || 0;
  const statusLabel   = STATUS_LABELS[jobStatus] || '';
  const isFailed      = jobStatus === 'failed';

  // ─────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.wrapper}>
      <div className={styles.uploadCard} style={{ maxWidth: 960, margin: '0 auto', width: '100%' }}>

        {/* ── Header ── */}
        <div className={styles.cardHeader}>
          <div className={styles.iconCirclePurple}>
            <Sparkles size={28} color="white" />
          </div>
          <div>
            <h2 className={styles.cardTitle}>Smart Material Synthesizer</h2>
            <p className={styles.cardSubtitle}>
              Upload lecture PDFs, slides, or drag notes from your notebook.
              NeuraNote reads everything and writes one complete study guide.
            </p>
          </div>
        </div>

        {/* ── Main Grid ── */}
        <div className={styles.mainGrid}>

         
          {/* RIGHT: Drop Zone + File List */}
          <div className={styles.actionSection}>

            {/* Drop zone */}
            <div
              className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ''}`}
              onClick={() => !isProcessing && fileInputRef.current?.click()}
              onDragOver={handleDropZoneDragOver}
              onDragLeave={handleDropZoneDragLeave}
              onDrop={handleDropZoneDrop}
              role="button"
              tabIndex={0}
              aria-label="Upload files — click or drag and drop"
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <CloudUpload
                size={34}
                className={styles.dropIcon}
                style={{ opacity: isProcessing ? 0.4 : 1 }}
              />
              <span className={styles.dropLabel}>
                {dragOver ? 'Release to add' : 'Drop files or notebook notes here'}
              </span>
              <span className={styles.dropHint}>PDF · PPTX · MD · TXT — max {MAX_SIZE_MB}MB each</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.pptx,.md,.txt"
                multiple
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
                disabled={isProcessing}
                aria-hidden="true"
              />
            </div>

            {/* Selected items list */}
            {hasItems && (
              <div className={styles.fileListContainer}>
                <div className={styles.fileListHeader}>
                  <span>{totalItems} item{totalItems !== 1 ? 's' : ''} selected</span>
                  <button
                    className={styles.clearBtn}
                    onClick={clearAll}
                    disabled={isProcessing}
                  >
                    Clear all
                  </button>
                </div>

                <div className={styles.fileList}>
                  {/* Local files */}
                  {selectedFiles.map((file, i) => (
                    <div key={`local-${i}`} className={styles.fileItem}>
                      <span className={styles.fileEmoji}>{getFileIcon(file.name)}</span>
                      <div className={styles.fileDetails}>
                        <span className={styles.fileName}>{file.name}</span>
                        <span className={styles.fileMeta}>
                          Local · {getFileExt(file.name).toUpperCase().slice(1)} · {formatSize(file.size)}
                        </span>
                      </div>
                      <button
                        className={styles.removeBtn}
                        onClick={() => removeLocalFile(i)}
                        disabled={isProcessing}
                        aria-label={`Remove ${file.name}`}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}

                  {/* Notebook notes */}
                  {notebookNotes.map((note, i) => (
                    <div key={`note-${i}`} className={`${styles.fileItem} ${styles.notebookItem}`}>
                      <span className={styles.fileEmoji}>📝</span>
                      <div className={styles.fileDetails}>
                        <span className={styles.fileName}>{note.name}</span>
                        <span className={styles.fileMeta}>
                          Notebook · {note.type || 'MD'}
                          {note.content ? ` · ${Math.round(note.content.length / 5)} words` : ''}
                        </span>
                      </div>
                      <button
                        className={styles.removeBtn}
                        onClick={() => removeNotebookNote(i)}
                        disabled={isProcessing}
                        aria-label={`Remove ${note.name}`}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}


                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Options Row ── */}
        <div className={styles.optionsRow}>

          {/* Note Title / Topic */}
          <div className={styles.optionGroup} style={{ flex: 1, minWidth: '180px' }}>
            <label className={styles.optionLabel} htmlFor="title-input">
              Note Title / Topic <span style={{ opacity: 0.5 }}>(optional)</span>
            </label>
            <input
              id="title-input"
              type="text"
              placeholder="e.g. Lecture 6 Overview"
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
              disabled={isProcessing}
              className={styles.textInput}
            />
          </div>

          {/* Language */}
          <div className={styles.optionGroup}>
            <label className={styles.optionLabel} htmlFor="lang-select">
              Target Language
            </label>
            <select
              id="lang-select"
              value={selectedLanguage}
              onChange={e => setSelectedLanguage(e.target.value)}
              disabled={isProcessing}
              className={styles.selectInput}
            >
              <option value="English">English</option>
              <option value="Sinhala">Sinhala</option>
              <option value="Tamil">Tamil</option>
            </select>
          </div>

          {/* Custom instruction */}
          <div className={styles.optionGroup} style={{ flex: 2 }}>
            <label className={styles.optionLabel} htmlFor="instruction-input">
              Focus instruction <span style={{ opacity: 0.5 }}>(optional)</span>
            </label>
            <input
              id="instruction-input"
              type="text"
              placeholder="e.g. Focus on algorithms and complexity, skip examples"
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              disabled={isProcessing}
              className={styles.textInput}
            />
          </div>
        </div>


        {/* ── Error message ── */}
        {errorMsg && (
          <div className={styles.errorBox} role="alert">
            <AlertCircle size={16} />
            <pre className={styles.errorText}>{errorMsg}</pre>
            <button
              className={styles.errorDismiss}
              onClick={() => setErrorMsg('')}
              aria-label="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Progress bar (visible during processing) ── */}
        {isProcessing && (
          <div className={styles.progressContainer} role="status" aria-live="polite">
            <div className={styles.progressTrack}>
              <div
                className={`${styles.progressFill} ${isFailed ? styles.progressFailed : ''}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className={styles.progressLabel}>
              {isFailed
                ? <><AlertCircle size={14} /> {statusLabel}</>
                : <><Loader2 size={14} className={styles.spinner} /> {statusLabel}</>
              }
            </div>
          </div>
        )}

        {/* ── Generate button ── */}
        <div className={styles.generateRow}>
          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={isProcessing || !hasItems}
            aria-label="Generate structured study note"
          >
            {isProcessing ? (
              <><Loader2 size={18} className={styles.spinner} /> Processing…</>
            ) : (
              <><Sparkles size={18} /> Generate Study Notes</>
            )}
          </button>

          {hasItems && !isProcessing && (
            <span className={styles.itemCount}>
              {totalItems} material{totalItems !== 1 ? 's' : ''} ready
            </span>
          )}
        </div>

      </div>
    </div>
  );
};

export default UploadSection;
