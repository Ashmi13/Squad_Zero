import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

/**
 * ConfirmDialog — dark-themed reusable confirmation dialog.
 * Renders via React portal directly on document.body.
 *
 * Props:
 *   isOpen        — boolean
 *   title         — dialog heading
 *   message       — body text (supports \n → <br/>)
 *   type          — "danger" | "warning" | "info" (default: "danger")
 *   confirmLabel  — confirm button text (default: "Confirm")
 *   cancelLabel   — cancel button text (default: "Cancel")
 *   onConfirm     — called when user clicks confirm
 *   onCancel      — called when user clicks cancel / backdrop / Escape
 */
export default function ConfirmDialog({
  isOpen,
  title = 'Confirm',
  message = 'Are you sure?',
  type = 'danger',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const icons = { danger: '\u{1F5D1}\uFE0F', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F' };
  const colormap = {
    danger:  { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', text: '#fca5a5', btn: '#ef4444', hover: '#dc2626' },
    warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', text: '#fcd34d', btn: '#f59e0b', hover: '#d97706' },
    info:    { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)', text: '#a5b4fc', btn: '#6366f1', hover: '#4f46e5' },
  };
  const c = colormap[type] || colormap.danger;

  return ReactDOM.createPortal(
    <>
      <style>{`
        @keyframes cdmFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cdmSlideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999999,
          animation: 'cdmFadeIn 0.15s ease',
        }}
        onClick={onCancel}
      >
        <div
          style={{
            background: '#1a1f2e',
            borderRadius: '16px',
            padding: '2rem 2.5rem',
            maxWidth: '420px',
            width: '90%',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            textAlign: 'center',
            animation: 'cdmSlideUp 0.2s ease',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontSize: '2.4rem', lineHeight: 1, marginBottom: '0.5rem' }}>
            {icons[type] || icons.danger}
          </div>

          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem', color: '#f3f4f6', fontWeight: 700 }}>
            {title}
          </h3>

          <p style={{
            margin: '0 0 1.5rem',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            background: c.bg,
            border: `1px solid ${c.border}`,
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            color: c.text,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {message}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              style={{
                padding: '0.65rem 1.5rem',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1.5px solid rgba(255,255,255,0.12)',
                background: 'transparent',
                color: '#9ca3af',
                transition: 'all 0.15s',
              }}
              onClick={onCancel}
              onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.color = '#d1d5db'; }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#9ca3af'; }}
            >
              {cancelLabel}
            </button>
            <button
              style={{
                padding: '0.65rem 1.5rem',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: c.btn,
                color: '#fff',
                transition: 'all 0.15s',
              }}
              onClick={onConfirm}
              onMouseEnter={e => { e.target.style.background = c.hover; }}
              onMouseLeave={e => { e.target.style.background = c.btn; }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}