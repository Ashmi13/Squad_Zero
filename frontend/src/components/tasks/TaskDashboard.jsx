import React, { useState, useEffect } from 'react';
import { Box, Paper, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import './styles.css';
import TaskList from './TaskList';

function TaskDashboard() {
  const [taskLists, setTaskLists] = useState(() => {
    const saved = localStorage.getItem('neuranote-task-lists');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      work: {
        id: 'work',
        name: 'Work',
        icon: 'work',
        tasks: [
          { id: 1, title: 'Complete SRS Document', completed: false },
          { id: 2, title: 'Design database schema', completed: false },
        ]
      },
      study: {
        id: 'study',
        name: 'Study',
        icon: 'study',
        tasks: [
          { id: 3, title: 'Prepare interim demo', completed: true },
          { id: 4, title: 'Read React documentation', completed: false },
        ]
      },
      personal: {
        id: 'personal',
        name: 'Personal',
        icon: 'personal',
        tasks: [
          { id: 5, title: 'Buy groceries', completed: false },
        ]
      }
    };
  });

  const [activeList, setActiveList] = useState('work');

  useEffect(() => {
    localStorage.setItem('neuranote-task-lists', JSON.stringify(taskLists));
  }, [taskLists]);

  const handleToggle = (taskId) => {
    setTaskLists(prev => ({
      ...prev,
      [activeList]: {
        ...prev[activeList],
        tasks: prev[activeList].tasks.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        )
      }
    }));
  };

  const handleAdd = (title) => {
    const newTask = {
      id: Date.now(),
      title,
      completed: false
    };
    setTaskLists(prev => ({
      ...prev,
      [activeList]: {
        ...prev[activeList],
        tasks: [...prev[activeList].tasks, newTask]
      }
    }));
  };

  const handleDelete = (taskId) => {
    setTaskLists(prev => ({
      ...prev,
      [activeList]: {
        ...prev[activeList],
        tasks: prev[activeList].tasks.filter(task => task.id !== taskId)
      }
    }));
  };

  const getIcon = (iconType) => {
    switch(iconType) {
      case 'work': return <WorkOutlineIcon />;
      case 'study': return <SchoolOutlinedIcon />;
      case 'personal': return <HomeOutlinedIcon />;
      default: return null;
    }
  };

  return (
    <Box className="zen-container">
      <Box className="zen-grid">
        
        {/* LEFT SIDEBAR */}
        <Paper className="zen-sidebar" elevation={0}>
          <Typography variant="h6" className="sidebar-title">
            LISTS
          </Typography>
          
          <List className="list-selector">
            {Object.values(taskLists).map(list => (
              <ListItemButton
                key={list.id}
                selected={activeList === list.id}
                onClick={() => setActiveList(list.id)}
                className="list-item"
              >
                <ListItemIcon className="list-icon">
                  {getIcon(list.icon)}
                </ListItemIcon>
                <ListItemText 
                  primary={list.name}
                  secondary={`${list.tasks.length} tasks`}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        {/* CENTER - MAIN TASKS */}
        <Paper className="zen-main" elevation={0}>
          <TaskList
            listName={taskLists[activeList].name}
            tasks={taskLists[activeList].tasks}
            onToggle={handleToggle}
            onAdd={handleAdd}
            onDelete={handleDelete}
          />
        </Paper>

        {/* RIGHT PANEL - CALENDAR */}
        <Paper className="zen-right" elevation={0}>
          <Typography variant="h6" className="panel-title">
            CALENDAR
          </Typography>
          <Box className="calendar-placeholder">
            <Typography variant="body2" className="placeholder-text">
              Calendar integration coming soon
            </Typography>
          </Box>
        </Paper>

      </Box>
    </Box>
  );
}

export default TaskDashboard;
