import React, { useState, useEffect } from 'react';
import { Box, Paper, List, ListItemButton, ListItemIcon, ListItemText, Typography, CircularProgress } from '@mui/material';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import './styles.css';
import TaskList from './TaskList';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const CATEGORIES = [
  { id: 'work',     name: 'Work',     icon: 'work' },
  { id: 'study',    name: 'Study',    icon: 'study' },
  { id: 'personal', name: 'Personal', icon: 'personal' },
];

function getAuthHeader() {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function TaskDashboard() {
  const [tasksByCategory, setTasksByCategory] = useState({
    work: [], study: [], personal: []
  });
  const [activeList, setActiveList] = useState('work');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all tasks on mount
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/api/v1/tasks/`, {
        headers: getAuthHeader()
      });

      // Group tasks by category
      const grouped = { work: [], study: [], personal: [] };
      response.data.forEach(task => {
        const cat = task.category || 'personal';
        if (grouped[cat]) grouped[cat].push(task);
        else grouped['personal'].push(task);
      });

      setTasksByCategory(grouped);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (taskId) => {
    try {
      const response = await axios.patch(
        `${API_BASE}/api/v1/tasks/${taskId}/toggle`,
        {},
        { headers: getAuthHeader() }
      );
      const updated = response.data;
      setTasksByCategory(prev => ({
        ...prev,
        [activeList]: prev[activeList].map(t =>
          t.id === taskId ? updated : t
        )
      }));
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const handleAdd = async (title) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/v1/tasks/`,
        { title, category: activeList, status: 'todo', priority: 'medium' },
        { headers: getAuthHeader() }
      );
      setTasksByCategory(prev => ({
        ...prev,
        [activeList]: [...prev[activeList], response.data]
      }));
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  const handleDelete = async (taskId) => {
    try {
      await axios.delete(
        `${API_BASE}/api/v1/tasks/${taskId}`,
        { headers: getAuthHeader() }
      );
      setTasksByCategory(prev => ({
        ...prev,
        [activeList]: prev[activeList].filter(t => t.id !== taskId)
      }));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const getIcon = (iconType) => {
    switch (iconType) {
      case 'work':     return <WorkOutlineIcon />;
      case 'study':    return <SchoolOutlinedIcon />;
      case 'personal': return <HomeOutlinedIcon />;
      default:         return null;
    }
  };

  const activeTasks = tasksByCategory[activeList] || [];

  return (
    <Box className="zen-container">
      <Box className="zen-grid">

        {/* LEFT SIDEBAR */}
        <Paper className="zen-sidebar" elevation={0}>
          <Typography variant="h6" className="sidebar-title">
            LISTS
          </Typography>
          <List className="list-selector">
            {CATEGORIES.map(cat => (
              <ListItemButton
                key={cat.id}
                selected={activeList === cat.id}
                onClick={() => setActiveList(cat.id)}
                className="list-item"
              >
                <ListItemIcon className="list-icon">
                  {getIcon(cat.icon)}
                </ListItemIcon>
                <ListItemText
                  primary={cat.name}
                  secondary={`${tasksByCategory[cat.id]?.length || 0} tasks`}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        {/* CENTER - MAIN TASKS */}
        <Paper className="zen-main" elevation={0}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
              <CircularProgress />
            </Box>
          ) : error ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
              <Typography color="error">{error}</Typography>
            </Box>
          ) : (
            <TaskList
              listName={CATEGORIES.find(c => c.id === activeList)?.name}
              tasks={activeTasks}
              onToggle={handleToggle}
              onAdd={handleAdd}
              onDelete={handleDelete}
            />
          )}
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