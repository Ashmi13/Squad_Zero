import React, { useState, useEffect } from 'react';
import { Box, Paper, CircularProgress, Typography, IconButton } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import './styles.css';
import TaskList from './TaskList';
import MiniCalendar from './MiniCalendar';
import ExpandedCalendar from './ExpandedCalendar';
import CategoryModal from './CategoryModal';
import AddTaskModal from './AddTaskModal';
import axiosInstance from '@/lib/axios';
import { TaskIcon } from './taskIcons';

// default lists created for new users who have no categories yet
const DEFAULT_CATEGORIES = [
  { name: 'Work',     icon: 'work',     color: '#6366f1' },
  { name: 'Study',    icon: 'study',    color: '#10b981' },
  { name: 'Personal', icon: 'personal', color: '#ec4899' },
];

export default function TaskDashboard() {
  const [categories,       setCategories]       = useState([]);
  const [tasksByCategory,  setTasksByCategory]  = useState({});
  const [activeCategory,   setActiveCategory]   = useState(null);
  const [calendarEvents,   setCalendarEvents]   = useState([]);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);
  const [categoryModal,    setCategoryModal]    = useState(false);
  const [editingCategory,  setEditingCategory]  = useState(null);
  const [taskModal,        setTaskModal]        = useState(false);
  const [editingTask,      setEditingTask]       = useState(null);

  useEffect(() => { init(); }, []);

  // sort tasks into buckets by category id
  const groupTasks = (cats, allTasks) => {
    const grouped = {};
    cats.forEach(c => { grouped[c.id] = []; });
    allTasks.forEach(task => {
      const cat = cats.find(c => c.name === task.category || c.id === task.category);
      const key = cat ? cat.id : (cats[0]?.id || '__none__');
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });
    return grouped;
  };

  // fetch categories, tasks, and calendar events all at once on first load
  const init = async () => {
    try {
      setLoading(true);
      const [catsRes, tasksRes, eventsRes] = await Promise.all([
        axiosInstance.get('/api/v1/tasks/categories'),
        axiosInstance.get('/api/v1/tasks/'),
        axiosInstance.get('/api/v1/calendar/events'),
      ]);

      let cats = catsRes.data;

      // if user has no lists yet, seed the three defaults
      if (cats.length === 0) {
        const seeded = await Promise.all(
          DEFAULT_CATEGORIES.map(c => axiosInstance.post('/api/v1/tasks/categories', c))
        );
        cats = seeded.map(r => r.data);
      }

      setCategories(cats);
      setActiveCategory(cats[0]?.id || null);
      setTasksByCategory(groupTasks(cats, tasksRes.data));
      setCalendarEvents(eventsRes.data);
      setError(null);
    } catch (err) {
      if (err.response?.status === 401) {
        window.location.href = '/login';
      } else {
        setError('Failed to load. Is the backend running?');
      }
    } finally {
      setLoading(false);
    }
  };

  // check every minute if any task reminder is due and fire a browser notification
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') Notification.requestPermission();

    const interval = setInterval(() => {
      if (Notification.permission !== 'granted') return;
      const now = new Date();
      Object.values(tasksByCategory).flat().forEach(task => {
        if (!task.due_date || !task.reminder_minutes_before || task.status === 'done') return;
        const due = new Date(task.due_date);
        const diff = (due - now) / 60000;
        if (diff > 0 && diff <= task.reminder_minutes_before && diff > task.reminder_minutes_before - 1) {
          new Notification(`Task Reminder: ${task.title}`, {
            body: `Due in ${Math.round(diff)} minute${Math.round(diff) !== 1 ? 's' : ''}`,
            icon: '/logo.png',
          });
        }
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [tasksByCategory]);

  // --- category handlers ---

  const handleAddCategory = async (data) => {
    try {
      const res = await axiosInstance.post('/api/v1/tasks/categories', data);
      const cat = res.data;
      setCategories(prev => [...prev, cat]);
      setTasksByCategory(prev => ({ ...prev, [cat.id]: [] }));
      setActiveCategory(cat.id);
    } catch (e) { console.error(e); }
  };

  const handleEditCategory = async (catId, data) => {
    try {
      const res = await axiosInstance.patch(`/api/v1/tasks/categories/${catId}`, data);
      setCategories(prev => prev.map(c => c.id === catId ? res.data : c));
    } catch (e) { console.error(e); }
  };

  const handleDeleteCategory = async (catId) => {
    try {
      await axiosInstance.delete(`/api/v1/tasks/categories/${catId}`);
      const remaining = categories.filter(c => c.id !== catId);
      setCategories(remaining);
      setTasksByCategory(prev => { const n = { ...prev }; delete n[catId]; return n; });
      setActiveCategory(remaining[0]?.id || null);
    } catch (e) { console.error(e); }
  };

  // --- task handlers ---

  const handleAddTask = async (taskData) => {
    try {
      const res = await axiosInstance.post('/api/v1/tasks/', taskData);
      const newTask = res.data;
      // put the new task in the right category bucket
      const cat = categories.find(c => c.name === newTask.category || c.id === newTask.category);
      const key = cat ? cat.id : activeCategory;
      setTasksByCategory(prev => ({ ...prev, [key]: [newTask, ...(prev[key] || [])] }));
    } catch (e) { console.error(e); }
  };

  const handleEditTask = async (taskId, taskData) => {
    try {
      const res = await axiosInstance.patch(`/api/v1/tasks/${taskId}`, taskData);
      const updated = res.data;
      // replace the old task with the updated one across all buckets
      setTasksByCategory(prev => {
        const n = {};
        Object.keys(prev).forEach(k => { n[k] = prev[k].map(t => t.id === taskId ? updated : t); });
        return n;
      });
    } catch (e) { console.error(e); }
  };

  // flip done/todo status
  const handleToggle = async (taskId) => {
    try {
      const res = await axiosInstance.patch(`/api/v1/tasks/${taskId}/toggle`, {});
      const updated = res.data;
      setTasksByCategory(prev => {
        const n = {};
        Object.keys(prev).forEach(k => { n[k] = prev[k].map(t => t.id === taskId ? updated : t); });
        return n;
      });
    } catch (e) { console.error(e); }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await axiosInstance.delete(`/api/v1/tasks/${taskId}`);
      setTasksByCategory(prev => {
        const n = {};
        Object.keys(prev).forEach(k => { n[k] = prev[k].filter(t => t.id !== taskId); });
        return n;
      });
    } catch (e) { console.error(e); }
  };

  // --- calendar handlers ---

  const handleAddEvent = async (eventData) => {
    try {
      const res = await axiosInstance.post('/api/v1/calendar/events', eventData);
      setCalendarEvents(prev => [...prev, res.data]);
    } catch (e) { console.error(e); }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await axiosInstance.delete(`/api/v1/calendar/events/${eventId}`);
      setCalendarEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (e) { console.error(e); }
  };

  const handleUpdateEvent = async (eventId, eventData) => {
    try {
      const res = await axiosInstance.patch(`/api/v1/calendar/events/${eventId}`, eventData);
      setCalendarEvents(prev => prev.map(e => e.id === eventId ? res.data : e));
    } catch (e) { console.error(e); }
  };

  if (loading) return (
    <Box className="zen-container" display="flex" alignItems="center" justifyContent="center">
      <CircularProgress sx={{ color: '#6366f1' }} />
    </Box>
  );

  if (error) return (
    <Box className="zen-container" display="flex" alignItems="center" justifyContent="center">
      <Typography color="error">{error}</Typography>
    </Box>
  );

  const activeCat   = categories.find(c => c.id === activeCategory);
  const activeTasks = tasksByCategory[activeCategory] || [];
  const allTasks    = Object.values(tasksByCategory).flat();

  return (
    <Box className="zen-container">
      <Box className="zen-grid">

        {/* left sidebar — list of categories */}
        <Paper className="zen-sidebar" elevation={0}>
          <Box className="task-sidebar-header">
            <Typography className="task-sidebar-title">LISTS</Typography>
            <button className="add-cat-btn" title="New list"
              onClick={() => { setEditingCategory(null); setCategoryModal(true); }}>+</button>
          </Box>
          <div className="list-selector">
            {categories.map(cat => (
              <div key={cat.id}
                className={`list-item-row ${activeCategory === cat.id ? 'active' : ''}`}
                style={{ '--cat-color': cat.color }}
                onClick={() => setActiveCategory(cat.id)}>
                <span className="cat-icon">
                  <TaskIcon name={cat.icon} sx={{ fontSize: 18, color: activeCategory === cat.id ? cat.color : '#6b7280' }} />
                </span>
                <div className="cat-text">
                  <span className="cat-name">{cat.name}</span>
                  <span className="cat-count">{tasksByCategory[cat.id]?.length || 0} tasks</span>
                </div>
                <div className="cat-actions" onClick={e => e.stopPropagation()}>
                  <IconButton size="small" title="Edit"
                    onClick={() => { setEditingCategory(cat); setCategoryModal(true); }}
                    sx={{ padding: '2px', color: '#4b5563', '&:hover': { color: '#6366f1', background: 'rgba(99,102,241,0.1)' } }}>
                    <EditOutlinedIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                  <IconButton size="small" title="Delete"
                    onClick={() => handleDeleteCategory(cat.id)}
                    sx={{ padding: '2px', color: '#4b5563', '&:hover': { color: '#ef4444', background: 'rgba(239,68,68,0.08)' } }}>
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        </Paper>

        {/* center — task list for the selected category */}
        <Paper className="zen-main" elevation={0}>
          <TaskList
            category={activeCat}
            tasks={activeTasks}
            onToggle={handleToggle}
            onAdd={() => { setEditingTask(null); setTaskModal(true); }}
            onEdit={task => { setEditingTask(task); setTaskModal(true); }}
            onDelete={handleDeleteTask}
          />
        </Paper>

        {/* right — mini calendar preview */}
        <Paper className="zen-right" elevation={0}>
          <MiniCalendar
            tasks={allTasks}
            events={calendarEvents}
            onExpand={() => setCalendarExpanded(true)}
          />
        </Paper>

      </Box>

      {/* full screen calendar overlay */}
      {calendarExpanded && (
        <ExpandedCalendar
          tasks={allTasks}
          events={calendarEvents}
          onClose={() => setCalendarExpanded(false)}
          onAddEvent={handleAddEvent}
          onDeleteEvent={handleDeleteEvent}
          onUpdateEvent={handleUpdateEvent}
        />
      )}

      <CategoryModal
        open={categoryModal}
        onClose={() => setCategoryModal(false)}
        onSave={editingCategory
          ? data => handleEditCategory(editingCategory.id, data)
          : handleAddCategory}
        initial={editingCategory}
      />

      <AddTaskModal
        open={taskModal}
        onClose={() => setTaskModal(false)}
        onSave={editingTask
          ? data => handleEditTask(editingTask.id, data)
          : handleAddTask}
        categories={categories}
        defaultCategory={activeCat}
        initial={editingTask}
      />
    </Box>
  );
}