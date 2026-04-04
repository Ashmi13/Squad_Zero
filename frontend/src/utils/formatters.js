// frontend/src/utils/formatters.js

export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getDifficultyColor = (difficulty) => {
  const colors = {
    'easy': '#10b981',
    'medium': '#f59e0b',
    'hard': '#ef4444'
  };
  return colors[difficulty?.toLowerCase()] || '#6b7280';
};

export const getScoreColor = (score) => {
  if (score >= 90) return '#10b981';
  if (score >= 70) return '#3b82f6';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
};

export const getFileIcon = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    'pdf': '📄',
    'xlsx': '📊',
    'xls': '📊',
    'doc': '📝',
    'docx': '📝',
    'ppt': '📊',
    'pptx': '📊',
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️',
    'webp': '🖼️',
    'epub': '📚'
  };
  return icons[ext] || '📎';
};
