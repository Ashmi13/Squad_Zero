// frontend/src/utils/validators.js

export const validateFileSize = (file, maxSize = 25 * 1024 * 1024) => {
  return file.size <= maxSize;
};

export const validateFileType = (filename) => {
  const validExtensions = [
    'pdf', 'doc', 'docx', 'txt', 'xlsx', 'xls',
    'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'epub'
  ];
  const ext = filename.split('.').pop().toLowerCase();
  return validExtensions.includes(ext);
};

export const validateQuizConfig = (config) => {
  const errors = [];
  
  if (config.numQuestions < 1 || config.numQuestions > 25) {
    errors.push('Number of questions must be between 1 and 25');
  }
  
  if (config.timeLimit < 1 || config.timeLimit > 180) {
    errors.push('Time limit must be between 1 and 180 minutes');
  }
  
  if (!['easy', 'medium', 'hard'].includes(config.difficulty)) {
    errors.push('Invalid difficulty level');
  }
  
  return errors;
};
