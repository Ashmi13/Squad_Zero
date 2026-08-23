import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

let pushToast = null;
let removeToast = null;

export function toast(content, opts = {}) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  if (pushToast) pushToast({ id, content, opts });
  return id;
}

toast.dismiss = (id) => {
  if (removeToast) removeToast(id);
};

toast.success = (msg) => {
  const id = toast(msg, { type: 'success', duration: 4000 });
  return id;
};

toast.error = (msg) => {
  const id = toast(msg, { type: 'error', duration: 4000 });
  return id;
};

export const Toaster = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    pushToast = (t) => setToasts((s) => [...s, t]);
    removeToast = (id) => setToasts((s) => s.filter(x => x.id !== id));
    return () => {
      pushToast = null;
      removeToast = null;
    };
  }, []);

  useEffect(() => {
    const timers = toasts.map((t) => {
      if (t.opts && t.opts.duration) {
        const timer = setTimeout(() => removeToast(t.id), t.opts.duration);
        return () => clearTimeout(timer);
      }
      return null;
    });
    return () => timers.forEach((c) => c && c());
  }, [toasts]);

  if (!toasts.length) return null;

  return createPortal(
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ minWidth: 260, background: '#0f172a', color: '#e6eef8', padding: 12, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
          {typeof t.content === 'function' ? t.content({ id: t.id }) : t.content}
        </div>
      ))}
    </div>,
    document.body
  );
};

export default toast;
