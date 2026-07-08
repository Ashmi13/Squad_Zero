import React, { useState, useRef, useCallback } from 'react';
import { getValidAccessToken } from '@/utils/authSession';
import { workspaceApi } from '@/services/workspaceApi';

const API_BASE = 'http://localhost:8000/api/v1';

const FlashcardsPage = () => {
  const [flashcards, setFlashcards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(null);
  const fileInputRef = useRef(null);



  const processFile = useCallback(async (file) => {
    // Accept both .pdf and .txt extensions, plus their mime types
    const isPdfOrText =
      file.name.toLowerCase().endsWith('.pdf') ||
      file.name.toLowerCase().endsWith('.txt') ||
      (file.type && (file.type === 'application/pdf' || file.type.startsWith('text/')));

    if (!file || !isPdfOrText) {
      setError('Please upload a PDF or Text file.');
      return;
    }

    setLoading(true);
    setError(null);
    setFlashcards([]);
    setFlipped(false);
    setCurrentIndex(0);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = await getValidAccessToken();
      const response = await fetch(`${API_BASE}/flashcards/generate`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server error: ${response.status}`);
      }

      const data = await response.json();
      setFlashcards(data.flashcards || []);
    } catch (err) {
      setError(err.message || 'Failed to generate flashcards.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    // ── Internal workspace file drag (from sidebar / file list) ────────
    const dragData = e.dataTransfer.getData('application/json');
    if (dragData) {
      let parsed;
      try { parsed = JSON.parse(dragData); } catch { parsed = null; }

      if (parsed?.fileId) {
        const { fileId, fileName: dragFileName, fileType } = parsed;

        setLoading(true);
        setError(null);
        setFileName(dragFileName || 'Workspace File');

        try {
          // Export to track usage
          const exportResult = await workspaceApi.exportFileToModule(fileId, 'flashcards');
          const fileMeta = exportResult?.file || {};

          // The backend supports both PDF parsing and plain text parsing.
          // Extracted text files may not have explicit metadata in the DB, so we let the backend validate.

          // Get signed URL or raw content from backend
          const previewData = await workspaceApi.getFilePreview(fileId);
          const previewObj = previewData?.preview;
          const fileUrl =
            previewObj?.preview_url ||
            previewObj?.content ||
            (typeof previewObj === 'string' ? previewObj : null) ||
            fileMeta.storage_url ||
            fileMeta.file_content ||
            fileMeta.storage_path ||
            fileMeta.raw_text ||
            fileMeta.summary;

          if (!fileUrl) {
            throw new Error('Could not retrieve file URL. Please re-upload the file.');
          }

          // Convert to blob
          let blob;
          let blobType = 'application/octet-stream';
          if (typeof fileUrl === 'string' && fileUrl.startsWith('data:')) {
            const parts = fileUrl.split(',');
            blobType = parts[0].split(':')[1].split(';')[0];
            const bytes = atob(parts[1]);
            const buf = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
            blob = new Blob([buf], { type: blobType });
          } else if (typeof fileUrl === 'string' && !fileUrl.startsWith('http')) {
            // It's raw text content
            blob = new Blob([fileUrl], { type: 'text/plain' });
            blobType = 'text/plain';
          } else {
            const res = await fetch(fileUrl);
            if (!res.ok) throw new Error('File URL expired. Please re-open the file first.');
            blob = await res.blob();
            blobType = res.headers.get('content-type') || 'application/octet-stream';
          }

          // Determine extension based on blob type or original
          const isPdfMime = blobType.includes('pdf') || String(fileType).toUpperCase() === 'PDF';
          const ext = isPdfMime ? '.pdf' : '.txt';
          
          const baseName = dragFileName || fileMeta.original_filename || 'workspace-file';
          const safeName = (baseName.toLowerCase().endsWith('.pdf') || baseName.toLowerCase().endsWith('.txt')) 
            ? baseName 
            : `${baseName}${ext}`;

          // Build FormData and call backend directly
          setFlashcards([]);
          setFlipped(false);
          setCurrentIndex(0);

          const formData = new FormData();
          formData.append('file', new File([blob], safeName, { type: blobType }));

          const token = await getValidAccessToken();
          const response = await fetch(`${API_BASE}/flashcards/generate`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || `Server error ${response.status}`);
          }

          const data = await response.json();
          setFlashcards(data.flashcards || []);
        } catch (err) {
          console.error('Workspace drag error:', err);
          setError(err.message || 'Error importing workspace file.');
        } finally {
          setLoading(false);
        }
        return;
      }
    }

    // ── OS file drop (from local filesystem) ───────────────────────────
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };
  const handleFileInput = (e) => { if (e.target.files[0]) processFile(e.target.files[0]); };

  const goNext = () => {
    setFlipped(false);
    setTimeout(() => setCurrentIndex((i) => Math.min(i + 1, flashcards.length - 1)), 150);
  };

  const goPrev = () => {
    setFlipped(false);
    setTimeout(() => setCurrentIndex((i) => Math.max(i - 1, 0)), 150);
  };

  const resetAll = () => {
    setFlashcards([]);
    setCurrentIndex(0);
    setFlipped(false);
    setError(null);
    setFileName(null);
  };

  const card = flashcards[currentIndex];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Flashcards</h2>
          <p style={styles.subtitle}>Drop a PDF or Text file to generate AI-powered flashcards</p>
        </div>
        {flashcards.length > 0 && (
          <button onClick={resetAll} style={styles.resetBtn}>
            ↩ New File
          </button>
        )}
      </div>

      {/* Drop Zone — always mounted when flashcards aren't showing so drop events always fire */}
      {flashcards.length === 0 && (
        <div
          style={{
            ...styles.dropZone,
            ...(dragOver ? styles.dropZoneActive : {}),
            ...(loading ? { opacity: 0, pointerEvents: 'none', position: 'absolute' } : {}),
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !loading && fileInputRef.current?.click()}
        >
          <div style={styles.dropIcon}>📄</div>
          <p style={styles.dropText}>Drag & drop a PDF or Text file here</p>
          <p style={styles.dropSub}>or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={styles.centerBox}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Generating flashcards from <strong>{fileName}</strong>…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={styles.errorBox}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} style={styles.dismissBtn}>✕</button>
        </div>
      )}

      {/* Flashcard UI */}
      {flashcards.length > 0 && card && (
        <div style={styles.cardSection}>
          {/* Progress */}
          <div style={styles.progress}>
            <span style={styles.progressText}>{currentIndex + 1} / {flashcards.length}</span>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${((currentIndex + 1) / flashcards.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Card */}
          <div style={styles.cardWrapper} onClick={() => setFlipped((f) => !f)}>
            <div style={{ ...styles.card, ...(flipped ? styles.cardFlipped : {}) }}>
              {/* Front */}
              <div style={styles.cardFace}>
                <span style={styles.cardLabel}>QUESTION</span>
                <p style={styles.cardText}>{card.question}</p>
                <span style={styles.cardHint}>Click to reveal answer</span>
              </div>
              {/* Back */}
              <div style={{ ...styles.cardFace, ...styles.cardBack }}>
                <span style={{ ...styles.cardLabel, color: '#6366f1' }}>ANSWER</span>
                <p style={styles.cardText}>{card.answer}</p>
                <span style={styles.cardHint}>Click to flip back</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div style={styles.nav}>
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              style={{ ...styles.navBtn, ...(currentIndex === 0 ? styles.navBtnDisabled : {}) }}
            >
              ← Prev
            </button>
            <button onClick={() => setFlipped((f) => !f)} style={styles.flipBtn}>
              {flipped ? 'Show Question' : 'Show Answer'}
            </button>
            <button
              onClick={goNext}
              disabled={currentIndex === flashcards.length - 1}
              style={{
                ...styles.navBtn,
                ...(currentIndex === flashcards.length - 1 ? styles.navBtnDisabled : {}),
              }}
            >
              Next →
            </button>
          </div>

          {/* Card list thumbnails */}
          <div style={styles.thumbnailRow}>
            {flashcards.map((_, i) => (
              <button
                key={i}
                onClick={() => { setFlipped(false); setCurrentIndex(i); }}
                style={{
                  ...styles.dot,
                  ...(i === currentIndex ? styles.dotActive : {}),
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  page: {
    height: '100%',
    overflowY: 'auto',
    background: '#f8f9fc',
    padding: '32px',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '28px',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 700,
    color: '#1f2430',
  },
  subtitle: {
    margin: '6px 0 0 0',
    fontSize: '14px',
    color: '#5f667a',
  },
  resetBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #e7e9f2',
    background: '#fff',
    color: '#5f667a',
    cursor: 'pointer',
    fontSize: '14px',
  },
  dropZone: {
    border: '2px dashed #d1d5db',
    borderRadius: '16px',
    padding: '60px 32px',
    textAlign: 'center',
    cursor: 'pointer',
    background: '#fff',
    transition: 'all 0.2s',
  },
  dropZoneActive: {
    borderColor: '#6366f1',
    background: '#f0f0ff',
  },
  dropIcon: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  dropText: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#1f2430',
  },
  dropSub: {
    margin: '6px 0 0 0',
    fontSize: '14px',
    color: '#9ca3af',
  },
  centerBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 0',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e7e9f2',
    borderTop: '3px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '16px',
  },
  loadingText: {
    fontSize: '14px',
    color: '#5f667a',
  },
  errorBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    padding: '12px 16px',
    marginBottom: '20px',
    fontSize: '14px',
    color: '#dc2626',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: '16px',
  },
  cardSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
  },
  progress: {
    width: '100%',
    maxWidth: '600px',
  },
  progressText: {
    fontSize: '13px',
    color: '#9ca3af',
    display: 'block',
    marginBottom: '6px',
    textAlign: 'center',
  },
  progressBar: {
    height: '4px',
    background: '#e7e9f2',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#6366f1',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  cardWrapper: {
    width: '100%',
    maxWidth: '600px',
    height: '280px',
    perspective: '1000px',
    cursor: 'pointer',
  },
  card: {
    width: '100%',
    height: '100%',
    position: 'relative',
    transformStyle: 'preserve-3d',
    transition: 'transform 0.45s ease',
  },
  cardFlipped: {
    transform: 'rotateY(180deg)',
  },
  cardFace: {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    background: '#fff',
    border: '1px solid #e7e9f2',
    borderRadius: '16px',
    boxShadow: '0 8px 24px rgba(17,24,39,0.07)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    boxSizing: 'border-box',
    textAlign: 'center',
  },
  cardBack: {
    transform: 'rotateY(180deg)',
    background: '#fafafe',
  },
  cardLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    color: '#9ca3af',
    marginBottom: '16px',
  },
  cardText: {
    margin: 0,
    fontSize: '17px',
    fontWeight: 500,
    color: '#1f2430',
    lineHeight: 1.6,
  },
  cardHint: {
    marginTop: '20px',
    fontSize: '12px',
    color: '#c4c8d8',
  },
  nav: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  navBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid #e7e9f2',
    background: '#fff',
    color: '#1f2430',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  navBtnDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  flipBtn: {
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    background: '#6366f1',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
  },
  thumbnailRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: '600px',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: 'none',
    background: '#e7e9f2',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.2s',
  },
  dotActive: {
    background: '#6366f1',
  },
};

// Inject spinner keyframes
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

export default FlashcardsPage;