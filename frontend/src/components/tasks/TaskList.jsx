import React, { useState } from 'react';
import { Box, Typography, TextField, Chip, LinearProgress } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import TaskItem from './TaskItem';

function TaskList({ listName, tasks, onToggle, onAdd, onDelete }) {
  const [newTask, setNewTask] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newTask.trim()) {
      onAdd(newTask);
      setNewTask('');
    }
  };

  // Calculate progress
  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <Box className="task-list">
      
      {/* Header Section */}
      <Box className="task-list-header">
        <Box className="header-title-row">
          <Typography variant="h4" className="list-title">
            {listName} Tasks
          </Typography>
          <Chip 
            label={`${completedCount} / ${totalCount}`}
            size="small"
            className="task-counter"
          />
        </Box>
        
        {/* Progress Bar */}
        {totalCount > 0 && (
          <Box className="progress-section">
            <LinearProgress 
              variant="determinate" 
              value={progress}
              className="progress-bar"
            />
            <Typography variant="caption" className="progress-text">
              {Math.round(progress)}% Complete
            </Typography>
          </Box>
        )}

        <Typography variant="body2" className="list-description">
          Manage your {listName.toLowerCase()} schedule efficiently
        </Typography>
      </Box>

      {/* Add Task Form */}
      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          placeholder={`Add new ${listName.toLowerCase()} task...`}
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          className="add-task-input"
          InputProps={{
            startAdornment: <AddRoundedIcon className="add-icon" />,
          }}
        />
      </form>

      {/* Tasks Container */}
      <Box className="tasks-container">
        {tasks.length === 0 ? (
          <Box className="empty-state">
            <Typography className="empty-message">
              No tasks yet
            </Typography>
            <Typography variant="caption" className="empty-hint">
              Add your first task above to get started
            </Typography>
          </Box>
        ) : (
          tasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))
        )}
      </Box>
    </Box>
  );
}

export default TaskList;
