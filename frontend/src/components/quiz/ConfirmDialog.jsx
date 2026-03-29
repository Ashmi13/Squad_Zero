import { useEffect } from 'react';
import ReactDOM from 'react-dom';

/**
 * ConfirmDialog — renders via React portal directly on document.body.
 * This bypasses ALL parent stacking contexts, overflow:hidden, z-index issues.
 *
 * Props:
 *   isOpen     {bool}    whether to show
 *   type       {string}  'unanswered' | 'submit' | 'cancel'
 *   message    {string}  body text
 *   okLabel    {string}  confirm button label
 *   cancelLabel{string}  dismiss button label
 *   onConfirm  {fn}      called when user clicks OK
 *   onCancel   {fn}      called when user clicks Cancel / backdrop
 */
const ConfirmDialog = ({
  isOpen,
  type = 'submit',
  message,
  okLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) => {
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

  const icon = type === 'unanswered' ? '⚠️' : type === 'cancel' ? '🚫' : '✅';
  const title = type === 'unanswered' ? 'Unanswered Questions'
              : type === 'cancel'     ? 'Cancel Quiz?'
              :                         'Submit Quiz?';

  const isWarn = type === 'unanswered' || type === 'cancel';

  const overlay = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999999,
  };

  const box = {
    background: '#fff',
    borderRadius: '16px',
    padding: '2rem 2.5rem',
    maxWidth: '420px',
    width: '90%',
    boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
    textAlign: 'center',
    animation: 'cdSlideUp 0.2s ease',
  };

  const btnBase = {
    padding: '0.65rem 1.5rem',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.15s',
  };

  const cancelBtnStyle = {
    ...btnBase,
    background: '#f3f4f6',
    color: '#374151',
    border: '1.5px solid #d1d5db',
  };

  const okBtnStyle = {
    ...btnBase,
    background: isWarn
      ? 'linear-gradient(135deg,#ef4444,#dc2626)'
      : 'linear-gradient(135deg,#9333ea,#7e22ce)',
    color: '#fff',
  };

  return ReactDOM.createPortal(
    <>
      <style>{`
        @keyframes cdSlideUp {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <div style={overlay} onClick={onCancel}>
        <div style={box} onClick={e => e.stopPropagation()}>

          <div style={{ fontSize: '2.4rem', lineHeight: 1, marginBottom: '0.5rem' }}>
            {icon}
          </div>

          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem', color: '#111827' }}>
            {title}
          </h3>

          <p style={{
            margin: '0 0 1.5rem',
            fontSize: '0.95rem',
            color: '#4b5563',
            lineHeight: 1.6,
            background: isWarn ? '#fff7ed' : '#f0fdf4',
            border: `1px solid ${isWarn ? '#fed7aa' : '#bbf7d0'}`,
            borderRadius: '8px',
            padding: '0.75rem 1rem',
          }}>
            {message}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button style={cancelBtnStyle} onClick={onCancel}>
              {cancelLabel}
            </button>
            <button style={okBtnStyle} onClick={onConfirm}>
              {okLabel}
            </button>
          </div>

        </div>
      </div>
    </>,
    document.body
  );
};

export default ConfirmDialog;
