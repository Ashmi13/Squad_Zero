import React from 'react';
import { Box, Typography, Checkbox, IconButton, Chip } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon         from '@mui/icons-material/EditOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CheckCircleRoundedIcon   from '@mui/icons-material/CheckCircleRounded';
import AccessTimeIcon           from '@mui/icons-material/AccessTime';
import NotificationsNoneIcon    from '@mui/icons-material/NotificationsNone';
import MenuBookOutlinedIcon     from '@mui/icons-material/MenuBookOutlined';
import { useTheme } from '../../context/ThemeContext';

// color per priority level
const P_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };

// format the due date and check if it's already past
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
  const { isDark = true } = useTheme();
  const accent = isDark ? '#818cf8' : '#6366f1';

  const done  = task.status === 'done';
  const due   = formatDue(task.due_date);
  const color = task.color || '#6366f1';

  return (
    <Box className={`task-item ${done ? 'completed' : ''}`} style={{ borderLeftColor: color }}>
      <Checkbox
        checked={done}
        onChange={() => onToggle(task.id)}
        size="small"
        icon={<RadioButtonUncheckedIcon />}
        checkedIcon={<CheckCircleRoundedIcon />}
        sx={{ color, '&.Mui-checked': { color } }}
      />

      <Box className="task-content">
        <Typography className={`task-title ${done ? 'done' : ''}`}>{task.title}</Typography>

        {task.description && (
          <Typography className="task-desc">{task.description}</Typography>
        )}

        <Box className="task-meta">
          {/* due date badge — goes red if overdue */}
          {due && (
            <Box className={`due-badge ${due.overdue && !done ? 'overdue' : ''}`}>
              <AccessTimeIcon sx={{ fontSize: 14 }} />
              <span>{due.label}</span>
            </Box>
          )}

          {task.reminder_minutes_before && (
            <Box className="reminder-badge">
              <NotificationsNoneIcon sx={{ fontSize: 14 }} />
              <span>
                {task.reminder_minutes_before >= 60
                  ? `${task.reminder_minutes_before / 60}h before`
                  : `${task.reminder_minutes_before}m before`}
              </span>
            </Box>
          )}

          <Chip
            label={task.priority}
            size="small"
            variant="outlined"
            className="priority-chip"
            sx={{
              bgcolor: `${P_COLORS[task.priority]}18`,
              color: P_COLORS[task.priority],
              borderColor: P_COLORS[task.priority],
              height: 24, fontSize: 12,
            }}
          />

          {task.notebook_title && (
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: 12, color: accent, padding: '3px 7px', borderRadius: '5px',
              background: `${accent}18`, border: `1px solid ${accent}30`,
            }}>
              <MenuBookOutlinedIcon sx={{ fontSize: 14 }} />
              <span>{task.notebook_title}</span>
            </Box>
          )}
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
