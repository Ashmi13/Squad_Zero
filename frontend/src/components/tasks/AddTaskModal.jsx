import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Button, Box, Typography, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';

const PRIORITIES = [
  { value: 'low',    label: 'Low',    color: '#10b981' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high',   label: 'High',   color: '#ef4444' },
];
const REMINDERS = [
  { value: null,  label: 'No reminder' },
  { value: 5,     label: '5 min before' },
  { value: 15,    label: '15 min before' },
  { value: 30,    label: '30 min before' },
  { value: 60,    label: '1 hour before' },
  { value: 1440,  label: '1 day before' },
];
const COLORS = ['#6366f1','#ec4899','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#f97316'];

const FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    color: '#f3f4f6',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: '#6366f1' },
    '&.Mui-focused fieldset': { borderColor: '#6366f1' },
  },
  '& .MuiInputLabel-root': { color: '#9ca3af' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#6366f1' },
};
const MENU_SX = { PaperProps: { sx: { bgcolor: '#1a1f2e', color: '#f3f4f6' } } };

export default function AddTaskModal({ open, onClose, onSave, categories, defaultCategory, initial }) {
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [priority,    setPriority]    = useState('medium');
  const [status,      setStatus]      = useState('todo');
  const [catId,       setCatId]       = useState('');
  const [dueDate,     setDueDate]     = useState('');
  const [reminder,    setReminder]    = useState(null);
  const [color,       setColor]       = useState('#6366f1');

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title || '');
      setDescription(initial.description || '');
      setPriority(initial.priority || 'medium');
      setStatus(initial.status || 'todo');
      setColor(initial.color || '#6366f1');
      setReminder(initial.reminder_minutes_before ?? null);
      setDueDate(initial.due_date ? new Date(initial.due_date).toISOString().slice(0, 16) : '');
      const cat = categories.find(c => c.name === initial.category || c.id === initial.category);
      setCatId(cat?.id || defaultCategory?.id || categories[0]?.id || '');
    } else {
      setTitle(''); setDescription(''); setPriority('medium'); setStatus('todo');
      setColor('#6366f1'); setReminder(null); setDueDate('');
      setCatId(defaultCategory?.id || categories[0]?.id || '');
    }
  }, [open, initial, defaultCategory, categories]);

  const handleSave = async () => {
    if (!title.trim()) return;
    const cat = categories.find(c => c.id === catId);
    await onSave({
      title:                   title.trim(),
      description:             description.trim() || null,
      priority, status,
      category:                cat?.name || '',
      due_date:                dueDate ? new Date(dueDate).toISOString() : null,
      reminder_minutes_before: reminder,
      color,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: '#1a1f2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } }}>
      <DialogTitle sx={{ color: '#f3f4f6', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {initial ? 'Edit Task' : 'New Task'}
      </DialogTitle>

      <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <TextField label="Title *" value={title} onChange={e => setTitle(e.target.value)} fullWidth sx={FIELD_SX} />
        <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)}
          fullWidth multiline rows={2} sx={FIELD_SX} />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <FormControl sx={FIELD_SX}>
            <InputLabel>Category</InputLabel>
            <Select value={catId} onChange={e => setCatId(e.target.value)} label="Category"
              sx={{ color: '#f3f4f6', '& .MuiSvgIcon-root': { color: '#9ca3af' } }} MenuProps={MENU_SX}>
              {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.icon} {c.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl sx={FIELD_SX}>
            <InputLabel>Status</InputLabel>
            <Select value={status} onChange={e => setStatus(e.target.value)} label="Status"
              sx={{ color: '#f3f4f6', '& .MuiSvgIcon-root': { color: '#9ca3af' } }} MenuProps={MENU_SX}>
              <MenuItem value="todo">To Do</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="done">Done</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box>
          <Typography sx={{ color: '#9ca3af', fontSize: 11, mb: 1, fontWeight: 700, letterSpacing: '0.08em' }}>PRIORITY</Typography>
          <ToggleButtonGroup value={priority} exclusive onChange={(_, v) => v && setPriority(v)} fullWidth size="small">
            {PRIORITIES.map(p => (
              <ToggleButton key={p.value} value={p.value}
                sx={{ color: '#9ca3af', borderColor: 'rgba(255,255,255,0.1)',
                      '&.Mui-selected': { bgcolor: `${p.color}18`, color: p.color, borderColor: `${p.color}50` },
                      '&.Mui-selected:hover': { bgcolor: `${p.color}28` } }}>
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <TextField label="Due date & time" type="datetime-local" value={dueDate}
            onChange={e => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }}
            sx={FIELD_SX} inputProps={{ style: { colorScheme: 'dark' } }} />
          <FormControl sx={FIELD_SX}>
            <InputLabel>Reminder</InputLabel>
            <Select value={reminder ?? 'none'} label="Reminder"
              onChange={e => setReminder(e.target.value === 'none' ? null : Number(e.target.value))}
              sx={{ color: '#f3f4f6', '& .MuiSvgIcon-root': { color: '#9ca3af' } }} MenuProps={MENU_SX}>
              {REMINDERS.map(r => <MenuItem key={r.value ?? 'none'} value={r.value ?? 'none'}>{r.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        <Box>
          <Typography sx={{ color: '#9ca3af', fontSize: 11, mb: 1, fontWeight: 700, letterSpacing: '0.08em' }}>COLOR</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {COLORS.map(c => (
              <Box key={c} onClick={() => setColor(c)}
                sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                      border: color === c ? '3px solid #fff' : '3px solid transparent',
                      boxShadow: color === c ? `0 0 0 2px ${c}` : 'none', transition: 'all 0.15s' }} />
            ))}
          </Box>
        </Box>
      {/* Notebook tag scaffold — enable after notebook sprint merges */}
        <Box>
          <Typography sx={{
            color: '#9ca3af', fontSize: 11, mb: 1, fontWeight: 700,
            letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 0.5,
          }}>
            <MenuBookOutlinedIcon sx={{ fontSize: 13 }} />
            NOTEBOOK
            <Box component="span" sx={{
              ml: 1, fontSize: 9, px: 0.7, py: 0.2,
              bgcolor: 'rgba(99,102,241,0.15)', color: '#818cf8',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 1, fontWeight: 700, letterSpacing: '0.06em',
            }}>
              COMING SOON
            </Box>
          </Typography>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            padding: '10px 12px', borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.02)',
            opacity: 0.45, cursor: 'not-allowed',
          }}>
            <MenuBookOutlinedIcon sx={{ fontSize: 16, color: '#6b7280' }} />
            <Typography sx={{ color: '#6b7280', fontSize: '0.85rem' }}>
              Link a notebook to this task…
            </Typography>
          </Box>
        </Box>

      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: '#9ca3af' }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained"
          sx={{ bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.85)' } }}>
          {initial ? 'Save Changes' : 'Add Task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}