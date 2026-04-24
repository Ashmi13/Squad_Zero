import React from 'react';
import { Box, Typography, Checkbox, IconButton, Chip } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon         from '@mui/icons-material/EditOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CheckCircleRoundedIcon   from '@mui/icons-material/CheckCircleRounded';
import AccessTimeIcon           from '@mui/icons-material/AccessTime';
import NotificationsNoneIcon    from '@mui/icons-material/NotificationsNone';

const P_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };

function formatDue(raw) {
  if (!raw) return null;
  const d   = new Date(raw);
  const now = new Date();
  return {
    label:   d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    overdue: d < now,
  };
}

export default function TaskItem({ task, onToggle, onEdit, onDelete }) {
  const done  = task.status === 'done';
  const due   = formatDue(task.due_date);
  const color = task.color || '#6366f1';

  return (
    <Box className={`task-item ${done ? 'completed' : ''}`} style={{ borderLeftColor: color }}>
      <Checkbox checked={done} onChange={() => onToggle(task.id)} size="small"
        icon={<RadioButtonUncheckedIcon />} checkedIcon={<CheckCircleRoundedIcon />}
        sx={{ color, '&.Mui-checked': { color } }} />

      <Box className="task-content">
        <Typography className={`task-title ${done ? 'done' : ''}`}>{task.title}</Typography>
        {task.description && (
          <Typography className="task-desc">{task.description}</Typography>
        )}
        <Box className="task-meta">
          {due && (
            <Box className={`due-badge ${due.overdue && !done ? 'overdue' : ''}`}>
              <AccessTimeIcon sx={{ fontSize: 11 }} /><span>{due.label}</span>
            </Box>
          )}
          {task.reminder_minutes_before && (
            <Box className="reminder-badge">
              <NotificationsNoneIcon sx={{ fontSize: 11 }} />
              <span>{task.reminder_minutes_before >= 60
                ? `${task.reminder_minutes_before / 60}h before`
                : `${task.reminder_minutes_before}m before`}</span>
            </Box>
          )}
          <Chip label={task.priority} size="small" variant="outlined" className="priority-chip"
            sx={{ bgcolor: `${P_COLORS[task.priority]}18`, color: P_COLORS[task.priority],
                  borderColor: P_COLORS[task.priority], height: 20, fontSize: 10 }} />
        </Box>
      </Box>

      <Box className="task-actions">
        <IconButton size="small" onClick={() => onEdit(task)} className="edit-button">
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => onDelete(task.id)} className="delete-button">
          <DeleteOutlineRoundedIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}