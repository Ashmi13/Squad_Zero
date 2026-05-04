import React, { useRef } from 'react';
import { Upload, X, Sparkles, BarChart3, Settings } from 'lucide-react';

const MAX_FILES = 20;

const QuizHomePage = ({
  uploadedFiles,
  isGenerating,
  dragActive,
  config,
  onFilesAdded,
  onRemoveFile,
  onDrag,
  onDrop,
  onGenerateQuiz,
  onShowHistory,
  onConfigChange,
  showToast,
}) => {
  const fileInputRef = useRef(null);

  const getDifficultyIcon = (d) => ({ easy: '⭐', medium: '⭐⭐', hard: '⭐⭐⭐' }[d] || '⭐');

  const getFileIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return '📄';
    if (['xlsx', 'xls'].includes(ext)) return '📊';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['ppt', 'pptx'].includes(ext)) return '📊';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
    if (ext === 'epub') return '📚';
    return '📎';
  };

  const handleFileInput = (e) => {
    if (e.target.files) onFilesAdded(e.target.files);
  };

  return (
    <div className="quiz-workspace" style={{ position: 'relative' }}>
      {/* ── Blur overlay while generating ── */}
      {isGenerating && (
        <div className="generating-overlay">
          <div className="generating-modal">
            <div className="generating-icon">
              <Sparkles size={36} />
            </div>
            <h2>Generating {config.difficulty.charAt(0).toUpperCase() + config.difficulty.slice(1)} Quiz</h2>
            <p>Creating questions based on your materials…</p>
            <div className="spinner spinner--lg"></div>
          </div>
        </div>
      )}

      {/* ── Settings Sidebar ── */}
      <aside className="settings-sidebar" style={isGenerating ? { filter: 'blur(3px)', pointerEvents: 'none', userSelect: 'none' } : {}}>
        <div className="sidebar-header">
          <div className="sidebar-header-icon"><Settings size={18} /></div>
          <h2>Quiz Settings</h2>
        </div>

        <div className="sidebar-section">
          <label className="sidebar-label">Questions</label>
          <div className="sidebar-input-group">
            <input
              type="number" min="1" max="25"
              value={config.numQuestions}
              onChange={(e) => onConfigChange({ numQuestions: Math.min(25, Math.max(1, parseInt(e.target.value) || 1)) })}
              className="sidebar-input"
            />
            <span className="sidebar-input-hint">max 25</span>
          </div>
        </div>

        <div className="sidebar-section">
          <label className="sidebar-label">Time Limit</label>
          <div className="sidebar-input-group">
            <input
              type="number" min="1" max="180"
              value={config.timeLimit}
              onChange={(e) => onConfigChange({ timeLimit: Math.min(180, Math.max(1, parseInt(e.target.value) || 1)) })}
              className="sidebar-input"
            />
            <span className="sidebar-input-hint">minutes</span>
          </div>
        </div>

        <div className="sidebar-section">
          <label className="sidebar-label">Difficulty</label>
          <div className="sidebar-pill-group">
            {[
              { value: 'easy',   label: 'Easy',   color: '#10b981' },
              { value: 'medium', label: 'Medium', color: '#f59e0b' },
              { value: 'hard',   label: 'Hard',   color: '#ef4444' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`sidebar-pill ${config.difficulty === opt.value ? 'sidebar-pill--active' : ''}`}
                style={config.difficulty === opt.value ? { '--pill-color': opt.color } : {}}
                onClick={() => onConfigChange({ difficulty: opt.value })}
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
                onClick={() => onConfigChange({ questionType: opt.value })}
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
              { value: 'theoretical', icon: '📖', label: 'Theoretical', desc: 'Concepts & theory'   },
              { value: 'practical',   icon: '⚙️', label: 'Practical',   desc: 'Application & code'  },
              { value: 'both',        icon: '🔀', label: 'Both',        desc: 'Balanced mix'        },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`sidebar-option ${config.contentFocus === opt.value ? 'sidebar-option--active' : ''}`}
                onClick={() => onConfigChange({ contentFocus: opt.value })}
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

      {/* ── Main Content ── */}
      <main
        className="quiz-main-content"
        style={isGenerating ? { filter: 'blur(3px)', pointerEvents: 'none', userSelect: 'none' } : {}}
      >
        <div className="upload-header">
          <div className="header-icon"><Sparkles size={28} /></div>
          <div>
            <h1>Generate Quiz</h1>
            <p className="subtitle">Upload your study materials to create a customized quiz</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.epub,text/plain,image/*"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />

        <div
          className={`upload-dropzone ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={onDrag}
          onDragLeave={onDrag}
          onDragOver={onDrag}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="dropzone-icon"><Upload size={32} /></div>
          <h3>Drag &amp; Drop files here</h3>
          <p>or click to browse</p>
          <div className="dropzone-formats">PDF · DOC · PPT · XLS · TXT · EPUB · Images</div>
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
                  <button className="remove-btn" onClick={(e) => { e.stopPropagation(); onRemoveFile(file.id); }}>
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
            onClick={onGenerateQuiz}
            disabled={uploadedFiles.length === 0 || isGenerating}
          >
            <Sparkles size={18} />
            <span>Generate Quiz</span>
          </button>
          <button className="main-history-btn" onClick={onShowHistory}>
            <BarChart3 size={18} />
            <span>View History</span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default QuizHomePage;
