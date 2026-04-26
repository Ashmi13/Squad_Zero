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
import {
  CloudUpload, FolderOpen, Loader2, FileText, X,
  File, CheckCircle2, ChevronRight, ChevronDown,
  Folder, AlertCircle, Sparkles, BookOpen,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import styles from './UploadSection.module.css';
import { uploadPDF } from '../api';

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

  // ── State ──────────────────────────────────────────────────
  const [selectedFiles, setSelectedFiles]     = useState([]);   // Real File objects
  const [notebookNotes, setNotebookNotes]     = useState([]);   // { id, name, type, content }
  const [folders, setFolders]                 = useState([]);
  const [filesByFolder, setFilesByFolder]     = useState({});
  const [expandedFolders, setExpandedFolders] = useState({});

  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [ordering, setOrdering]                 = useState('ai');
  const [instruction, setInstruction]           = useState('');

  const [jobId, setJobId]             = useState(null);
  const [jobStatus, setJobStatus]     = useState(null);   // pipeline status string
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');
  const [dragOver, setDragOver]       = useState(false);

  const fileInputRef  = useRef(null);
  const pollTimerRef  = useRef(null);

  // ── Resolve userId ─────────────────────────────────────────
  const userId = userIdProp
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
  const startPolling = useCallback((id, allFiles = []) => {
    const poll = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/job/${id}/status`);
        setJobStatus(data.status);

        if (data.status === 'done') {
          setIsProcessing(false);
          // Store minimal info + file metadata for editor
          localStorage.setItem('currentNote', JSON.stringify({
            noteId: data.note_id,
            filename: allFiles[0]?.filename,
            pdfUrl: allFiles[0]?.pdf_url,
            pdfId: allFiles[0]?.pdf_id,
            allFiles: allFiles
          }));
          setTimeout(() => navigate(`/notes/editor/${data.note_id}`), 600);

        } else if (data.status === 'failed') {
          setIsProcessing(false);
          setErrorMsg(data.error || 'Generation failed. Please try again.');

        } else {
          // Still running — poll again
          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        console.error('[poll]', err);
        pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS * 2);
      }
    };
    poll();
  }, [navigate]);

  // ── File selection ──────────────────────────────────────────
  const addLocalFiles = useCallback((files) => {
    const valid = [];
    const errors = [];

    Array.from(files).forEach(file => {
      const ext = getFileExt(file.name);
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        errors.push(`${file.name}: unsupported type (${ext})`);
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        errors.push(`${file.name}: exceeds ${MAX_SIZE_MB}MB limit`);
        return;
      }
      const alreadyAdded = selectedFiles.some(
        f => f.name === file.name && f.size === file.size
      );
      if (!alreadyAdded) valid.push(file);
    });

    if (errors.length) setErrorMsg(errors.join('\n'));
    if (valid.length)  setSelectedFiles(prev => [...prev, ...valid]);
  }, [selectedFiles]);

  const handleFileInputChange = (e) => {
    addLocalFiles(e.target.files);
    e.target.value = '';
  };

  const removeLocalFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeNotebookNote = (index) => {
    setNotebookNotes(prev => prev.filter((_, i) => i !== index));
  };

  // ── Notebook note selection ─────────────────────────────────
  const addNotebookNote = useCallback((note) => {
    setNotebookNotes(prev => {
      if (prev.some(n => n.id === note.id)) return prev;
      return [...prev, { ...note, content: getNotebookNoteContent(note) }];
    });
  }, []);

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

  const handleDropZoneDrop = (e) => {
    e.preventDefault();
    setDragOver(false);

    const json = e.dataTransfer.getData('application/json');
    if (json) {
      try {
        const note = JSON.parse(json);
        addNotebookNote(note);
      } catch {}
    } else if (e.dataTransfer.files.length) {
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
        // FIX: use real content, not mock string
        const content = note.content || getNotebookNoteContent(note);
        const blob = new Blob([content], { type: 'text/markdown' });
        const virtualFile = new File([blob], `${note.name}.md`, { type: 'text/markdown' });
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

      const allPdfIds = successfulUploads.map(f => f.pdf_id);

      // Step 3 — Start structured note background job
      const inputItems = successfulUploads.map(f => ({
        type: "pdf_id",
        value: f.pdf_id
      }));

      const { data: jobData } = await axios.post(`${API_BASE}/generate-structured-note`, {
        input_items: inputItems,
        user_id: userId,
        language: selectedLanguage,
        module_name: "Study Notes" // title or default
      });

      const newJobId = jobData.job_id;
      setJobId(newJobId);
      setJobStatus(jobData.status || 'queued');

      // Step 4 — Poll until done or failed
      startPolling(newJobId, successfulUploads);

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

          {/* LEFT: Notebook Explorer */}
          <div className={styles.explorerSection}>
            <div className={styles.sectionHeader}>
              <FolderOpen size={16} />
              <span>My Notebooks</span>
            </div>

            <div className={styles.treeContainer}>
              {folders.length === 0 ? (
                <div className={styles.emptyTree}>
                  <BookOpen size={18} style={{ opacity: 0.4 }} />
                  <span>No notebooks found</span>
                </div>
              ) : (
                folders.map(folder => (
                  <div key={folder.id} className={styles.folderNode}>
                    <button
                      className={styles.folderRow}
                      onClick={() => toggleFolder(folder.name)}
                      aria-expanded={!!expandedFolders[folder.name]}
                    >
                      {expandedFolders[folder.name]
                        ? <ChevronDown size={13} />
                        : <ChevronRight size={13} />}
                      <Folder size={13} className={styles.folderIcon} />
                      <span>{folder.name}</span>
                    </button>

                    {expandedFolders[folder.name] && (
                      <div className={styles.fileNodes}>
                        {(filesByFolder[folder.name] || []).length === 0 && (
                          <span className={styles.emptyFolder}>Empty folder</span>
                        )}
                        {(filesByFolder[folder.name] || []).map(file => {
                          const isAdded = notebookNotes.some(n => n.id === file.id);
                          return (
                            <div
                              key={file.id}
                              className={`${styles.fileRow} ${isAdded ? styles.fileRowAdded : ''}`}
                              draggable={!isAdded}
                              onDragStart={(e) => handleDragStart(e, file)}
                              onClick={() => !isAdded && addNotebookNote(file)}
                              role="button"
                              tabIndex={0}
                              aria-label={`Add ${file.name} to selection`}
                              onKeyDown={(e) => e.key === 'Enter' && !isAdded && addNotebookNote(file)}
                            >
                              <FileText size={12} className={styles.fileIconSmall} />
                              <span className={styles.fileRowName}>{file.name}</span>
                              {isAdded && (
                                <CheckCircle2 size={12} className={styles.addedCheck} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <p className={styles.hintText}>
              💡 Drag notes to the drop zone, or click to add
            </p>
          </div>

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
