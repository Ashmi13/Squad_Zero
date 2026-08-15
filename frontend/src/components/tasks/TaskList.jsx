import React from 'react';
import { Box, Typography, Chip, Button } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import TaskItem from './TaskItem';
import { TaskIcon } from './taskIcons';
import { useTheme } from '../../context/ThemeContext';

const PALETTE = {
  dark: {
    colors: {
      text: { primary: '#f3f4f6', secondary: '#e5e7eb', tertiary: '#9ca3af', muted: '#6b7280', subtle: '#4b5563' },
      bg: { primary: '#0b0f19', secondary: '#111827' },
      ui: { border: 'rgba(255,255,255,0.07)' },
      accent: '#6366f1', accentSoft: '#818cf8', accentDark: '#4f46e5',
    },
  },
  light: {
    colors: {
      text: { primary: '#1a202c', secondary: '#4a5568', tertiary: '#718096', muted: '#64748b', subtle: '#94a3b8' },
      bg: { primary: '#f8fafc', secondary: '#ffffff' },
      ui: { border: '#e2e8f0' },
      accent: '#6366f1', accentSoft: '#818cf8', accentDark: '#4f46e5',
    },
  },
};

export default function TaskList({ category, tasks, onToggle, onAdd, onEdit, onDelete }) {
  const { isDark = true } = useTheme();
  const theme = isDark ? PALETTE.dark : PALETTE.light;

  if (!category) return (
    <Box display="flex" alignItems="center" justifyContent="center" height="100%">
      <Typography sx={{ color: theme.colors.text.tertiary, fontSize: '0.95rem' }}>
        No list selected — click + to create one.
      </Typography>
    </Box>
  );

  const done     = tasks.filter(t => t.status === 'done').length;
  const total    = tasks.length;
  const progress = total > 0 ? (done / total) * 100 : 0;

  return (
    <Box className="task-list">
      <Box className="task-list-header">
        <Box className="header-title-row">
          <span className="list-icon-large">
            <TaskIcon name={category.icon} sx={{ fontSize: 28, color: category.color }} />
          </span>
          <Typography variant="h4" className="list-title" style={{ color: category.color }}>
            {category.name}
          </Typography>
          <Chip label={`${done}/${total}`} size="small" className="task-counter" />
        </Box>

        {total > 0 && (
          <div style={{ marginBottom: '6px' }}>
            <div style={{
              height: '5px', borderRadius: '99px',
              backgroundColor: theme.colors.ui.border, overflow: 'hidden', marginBottom: '4px',
            }}>
              <div style={{
                height: '100%', width: `${progress}%`, borderRadius: '99px',
                background: `linear-gradient(90deg, ${category.color}, #ec4899)`,
                transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: `0 0 10px ${category.color}70`,
              }} />
            </div>
            <span style={{ color: theme.colors.text.tertiary, fontSize: '0.85rem' }}>
              {Math.round(progress)}% complete
            </span>
          </div>
        )}
      </Box>

      <Button fullWidth variant="outlined" startIcon={<AddRoundedIcon />} onClick={onAdd}
        className="add-task-btn"
        sx={{
          borderColor: category.color, color: category.color,
          '&:hover': { borderColor: category.color, bgcolor: `${category.color}18` },
        }}>
        Add Task
      </Button>

      <Box className="tasks-container">
        {tasks.length === 0 ? (
          <Box className="empty-state">
            <Typography className="empty-message">No tasks yet</Typography>
            <Typography variant="caption" className="empty-hint">Click "Add Task" to get started</Typography>
          </Box>
        ) : (
          tasks.map(task => (
            <TaskItem key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
          ))
        )}
      </Box>
    </Box>
  );
}
