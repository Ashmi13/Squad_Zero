import React, { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import './styles/Toast.css';

const Toast = ({ message, type = 'error', onClose, duration = 5000 }) => {
  const [closing, setClosing] = useState(false);

  const triggerClose = () => {
    setClosing(true);
    setTimeout(() => onClose(), 300); // wait for slideOut animation
  };

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        triggerClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]); // eslint-disable-line react-hooks/exhaustive-deps

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} />;
      case 'info':
        return <Info size={20} />;
      case 'error':
      default:
        return <AlertCircle size={20} />;
    }
  };

  const getTypeClass = () => {
    switch (type) {
      case 'success':
        return 'toast-success';
      case 'info':
        return 'toast-info';
      case 'error':
      default:
        return 'toast-error';
    }
  };

  return (
    <div className={`toast ${getTypeClass()} ${closing ? 'closing' : ''}`}>
      <div className="toast-icon">
        {getIcon()}
      </div>
      <div className="toast-message">
        {message}
      </div>
      <button className="toast-close" onClick={triggerClose}>
        <X size={18} />
      </button>
    </div>
  );
};

export default Toast;
