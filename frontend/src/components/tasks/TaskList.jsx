import React from 'react';
import { Box, Typography, Chip, LinearProgress, Button } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import TaskItem from './TaskItem';
import { TaskIcon } from './taskIcons';

export default function TaskList({ category, tasks, onToggle, onAdd, onEdit, onDelete }) {
  if (!category) return (
    <Box display="flex" alignItems="center" justifyContent="center" height="100%">
      <Typography sx={{ color: '#6b7280' }}>No list selected — click + to create one.</Typography>
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
          <Box className="progress-section">
          <LinearProgress variant="determinate" value={progress}
              sx={{
                height: 4, borderRadius: 4,
                bgcolor: 'rgba(255,255,255,0.06)',
                '& .MuiLinearProgress-root': { bgcolor: 'rgba(255,255,255,0.06)' },
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: `linear-gradient(90deg, ${category.color}, #ec4899)`,
                },
                '&.MuiLinearProgress-root': {
                  backgroundColor: 'rgba(255,255,255,0.06) !important',
                },
              }} />
            <Typography variant="caption" className="progress-text">{Math.round(progress)}% complete</Typography>
          </Box>
        )}
      </Box>

      <Button fullWidth variant="outlined" startIcon={<AddRoundedIcon />} onClick={onAdd}
        className="add-task-btn"
        sx={{ borderColor: category.color, color: category.color,
              '&:hover': { borderColor: category.color, bgcolor: `${category.color}18` } }}>
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