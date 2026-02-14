import React from 'react';
import { Box, Typography, Checkbox, IconButton } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

function TaskItem({ task, onToggle, onDelete }) {
  return (
    <Box className={`task-item ${task.completed ? 'completed' : ''}`}>
      
      {/* Checkbox */}
      <Checkbox
        checked={task.completed}
        onChange={() => onToggle(task.id)}
        icon={<RadioButtonUncheckedIcon />}
        checkedIcon={<CheckCircleRoundedIcon />}
        className="task-checkbox"
      />
      
      {/* Task Title */}
      <Typography className="task-title">
        {task.title}
      </Typography>

      {/* Delete Button */}
      <IconButton 
        size="small" 
        onClick={() => onDelete(task.id)}
        className="delete-button"
      >
        <DeleteOutlineRoundedIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

export default TaskItem;
