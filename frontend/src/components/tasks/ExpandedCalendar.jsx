import React, { useState } from 'react';
import {
  Box, Typography, IconButton, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import CloseIcon         from '@mui/icons-material/Close';
import ChevronLeftIcon   from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon  from '@mui/icons-material/ChevronRight';
import AddIcon           from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon  from '@mui/icons-material/EditOutlined';
import { useTheme } from '../../context/ThemeContext';

const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const COLORS   = ['#6366f1','#ec4899','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#f97316'];

export default function ExpandedCalendar({ tasks, events, onClose, onAddEvent, onDeleteEvent, onUpdateEvent }) {
  const { isDark = true } = useTheme();
  const theme = isDark
    ? {
        colors: {
          text: { primary: '#f3f4f6', tertiary: '#9ca3af', muted: '#6b7280' },
          bg: { secondary: '#111827' },
          ui: { border: 'rgba(255,255,255,0.07)' },
          accent: '#6366f1', accentDark: '#4f46e5',
        },
      }
    : {
        colors: {
          text: { primary: '#1a202c', tertiary: '#718096', muted: '#64748b' },
          bg: { secondary: '#ffffff' },
          ui: { border: '#e2e8f0' },
          accent: '#6366f1', accentDark: '#4f46e5',
        },
      };

  const today = new Date();
  const [year,        setYear]        = useState(today.getFullYear());
  const [month,       setMonth]       = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [addOpen,     setAddOpen]     = useState(false);
  const [editOpen,    setEditOpen]    = useState(false);

  const [ev, setEv]     = useState({ title: '', description: '', start: '', end: '', color: '#6366f1' });
  const [editEv, setEditEv] = useState({ id: '', title: '', description: '', start: '', end: '', color: '#6366f1' });

  const prev = () => month === 0  ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1);
  const next = () => month === 11 ? (setMonth(0),  setYear(y => y + 1)) : setMonth(m => m + 1);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const isToday     = d => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const dayMap = {};
  const push   = (day, item) => { if (!dayMap[day]) dayMap[day] = []; dayMap[day].push(item); };

  tasks.forEach(t => {
    if (!t.due_date) return;
    const d = new Date(t.due_date);
    if (d.getFullYear() === year && d.getMonth() === month)
      push(d.getDate(), { ...t, _type: 'task', _color: t.color || '#6366f1' });
  });

  events.forEach(e => {
    const d = new Date(e.start_time);
    if (d.getFullYear() === year && d.getMonth() === month)
      push(d.getDate(), { ...e, _type: 'event', _color: e.color || '#ec4899' });
  });

  const cells        = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const selectedItems = selectedDay ? (dayMap[selectedDay] || []) : [];

  const handleAdd = async () => {
    if (!ev.title.trim() || !ev.start) return;
    await onAddEvent({
      title: ev.title, description: ev.description || null,
      start_time: new Date(ev.start).toISOString(),
      end_time:   new Date(ev.end || ev.start).toISOString(),
      color: ev.color, all_day: false,
    });
    setAddOpen(false);
    setEv({ title: '', description: '', start: '', end: '', color: '#6366f1' });
  };

  const handleEdit = async () => {
    if (!editEv.title.trim() || !editEv.start) return;
    await onUpdateEvent(editEv.id, {
      title: editEv.title, description: editEv.description || null,
      start_time: new Date(editEv.start).toISOString(),
      end_time:   new Date(editEv.end || editEv.start).toISOString(),
      color: editEv.color,
    });
    setEditOpen(false);
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      color: theme.colors.text.primary,
      '& fieldset': { borderColor: theme.colors.ui.border },
      '&:hover fieldset': { borderColor: theme.colors.accent },
      '&.Mui-focused fieldset': { borderColor: theme.colors.accent },
    },
    '& .MuiInputLabel-root': { color: theme.colors.text.tertiary },
    '& .MuiInputLabel-root.Mui-focused': { color: theme.colors.accent },
  };

  const dialogPaperSx = {
    bgcolor: theme.colors.bg.secondary,
    color: theme.colors.text.primary,
    border: `1px solid ${theme.colors.ui.border}`,
    borderRadius: 3,
  };

  return (
    <Box className="exp-cal-overlay">

      <Box className="exp-cal-header">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton onClick={prev} sx={{ color: theme.colors.text.tertiary }}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography sx={{ color: theme.colors.text.primary, fontWeight: 700, fontSize: 20, minWidth: 180 }}>
            {MONTHS[month]} {year}
          </Typography>
          <IconButton onClick={next} sx={{ color: theme.colors.text.tertiary }}>
            <ChevronRightIcon />
          </IconButton>
          <Button startIcon={<AddIcon />} variant="contained" size="small"
            onClick={() => setAddOpen(true)}
            sx={{ bgcolor: theme.colors.accent, '&:hover': { bgcolor: theme.colors.accentDark }, ml: 1, textTransform: 'none', fontSize: '0.85rem' }}>
            Add Event
          </Button>
        </Box>
        <IconButton onClick={onClose} sx={{ color: theme.colors.text.muted, '&:hover': { color: '#ef4444' } }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 270px', flex: 1, overflow: 'hidden' }}>

        <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 2 }}>
          <Box className="exp-cal-grid">
            {DAYS.map(d => <Box key={d} className="exp-day-name">{d}</Box>)}
            {cells.map((day, i) => (
              <Box key={i}
                className={`exp-day-cell ${day ? 'active-cell' : ''} ${day && isToday(day) ? 'today' : ''} ${day && selectedDay === day ? 'selected' : ''}`}
                onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}>
                {day && <>
                  <span className={`exp-day-num ${isToday(day) ? 'today-num' : ''}`}>{day}</span>
                  <Box className="exp-day-items">
                    {(dayMap[day] || []).slice(0, 3).map((item, j) => (
                      <Box key={j} className="exp-item-pill"
                        style={{ background: item._color + '28', borderLeft: `3px solid ${item._color}` }}>
                        <Typography sx={{ fontSize: 12, color: item._color, fontWeight: 500,
                                         overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item._type === 'task' ? 'T' : 'E'} {item.title}
                        </Typography>
                      </Box>
                    ))}
                    {(dayMap[day] || []).length > 3 && (
                      <Typography sx={{ fontSize: 12, color: theme.colors.text.muted, pl: 0.5 }}>
                        +{(dayMap[day] || []).length - 3} more
                      </Typography>
                    )}
                  </Box>
                </>}
              </Box>
            ))}
          </Box>
        </Box>

        <Box className="exp-detail-panel">
          <Typography sx={{ color: theme.colors.text.muted, fontSize: 13, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.08em', mb: 2 }}>
            {selectedDay ? `${MONTHS[month]} ${selectedDay}` : 'Click a day'}
          </Typography>

          {selectedDay && selectedItems.length === 0 && (
            <Typography sx={{ color: theme.colors.text.muted, fontSize: 14 }}>Nothing scheduled</Typography>
          )}

          {selectedItems.map((item, i) => (
            <Box key={i} className="exp-detail-item" style={{ borderLeftColor: item._color }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: theme.colors.text.primary, fontWeight: 600, fontSize: 15 }}>{item.title}</Typography>
                  {item.description && (
                    <Typography sx={{ color: theme.colors.text.tertiary, fontSize: 13, mt: 0.5 }}>{item.description}</Typography>
                  )}
                  <Typography sx={{ color: theme.colors.text.tertiary, fontSize: 13, mt: 0.5 }}>
                    {item._type === 'task'
                      ? `${item.priority} priority · ${item.status}`
                      : `${new Date(item.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – ${new Date(item.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                    }
                  </Typography>
                </Box>

                {item._type === 'event' && (
                  <Box sx={{ display: 'flex', flexShrink: 0 }}>
                    <IconButton size="small"
                      onClick={() => {
                        const pad = d => new Date(d).toISOString().slice(0, 16);
                        setEditEv({ id: item.id, title: item.title, description: item.description || '',
                                    start: pad(item.start_time), end: pad(item.end_time), color: item._color });
                        setEditOpen(true);
                      }}
                      sx={{ color: theme.colors.text.muted, '&:hover': { color: theme.colors.accent } }}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => onDeleteEvent(item.id)}
                      sx={{ color: theme.colors.text.muted, '&:hover': { color: '#ef4444' } }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* edit event dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={{ color: theme.colors.text.primary, borderBottom: `1px solid ${theme.colors.ui.border}` }}>
          Edit Event
        </DialogTitle>
        <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField label="Title *" value={editEv.title} onChange={e => setEditEv(p => ({ ...p, title: e.target.value }))} fullWidth sx={fieldSx} />
          <TextField label="Description" value={editEv.description} onChange={e => setEditEv(p => ({ ...p, description: e.target.value }))} fullWidth multiline rows={2} sx={fieldSx} />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField label="Start *" type="datetime-local" value={editEv.start} onChange={e => setEditEv(p => ({ ...p, start: e.target.value }))} InputLabelProps={{ shrink: true }} sx={fieldSx} inputProps={{ style: { colorScheme: isDark ? 'dark' : 'light' } }} />
            <TextField label="End" type="datetime-local" value={editEv.end} onChange={e => setEditEv(p => ({ ...p, end: e.target.value }))} InputLabelProps={{ shrink: true }} sx={fieldSx} inputProps={{ style: { colorScheme: isDark ? 'dark' : 'light' } }} />
          </Box>
          <Box>
            <Typography sx={{ color: theme.colors.text.tertiary, fontSize: 13, mb: 1, fontWeight: 700, letterSpacing: '0.08em' }}>COLOR</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {COLORS.map(c => (
                <Box key={c} onClick={() => setEditEv(p => ({ ...p, color: c }))}
                  sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                        border: editEv.color === c ? '3px solid #fff' : '3px solid transparent',
                        boxShadow: editEv.color === c ? `0 0 0 2px ${c}` : 'none', transition: 'all 0.15s' }} />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${theme.colors.ui.border}`, px: 3, py: 2 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ color: theme.colors.text.tertiary }}>Cancel</Button>
          <Button onClick={handleEdit} variant="contained" sx={{ bgcolor: theme.colors.accent, '&:hover': { bgcolor: theme.colors.accentDark } }}>Save Changes</Button>
        </DialogActions>
      </Dialog>

      {/* add event dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={{ color: theme.colors.text.primary, borderBottom: `1px solid ${theme.colors.ui.border}` }}>
          Add Event
        </DialogTitle>
        <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField label="Title *" value={ev.title} onChange={e => setEv(p => ({ ...p, title: e.target.value }))} fullWidth sx={fieldSx} />
          <TextField label="Description" value={ev.description} onChange={e => setEv(p => ({ ...p, description: e.target.value }))} fullWidth multiline rows={2} sx={fieldSx} />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField label="Start *" type="datetime-local" value={ev.start} onChange={e => setEv(p => ({ ...p, start: e.target.value }))} InputLabelProps={{ shrink: true }} sx={fieldSx} inputProps={{ style: { colorScheme: isDark ? 'dark' : 'light' } }} />
            <TextField label="End" type="datetime-local" value={ev.end} onChange={e => setEv(p => ({ ...p, end: e.target.value }))} InputLabelProps={{ shrink: true }} sx={fieldSx} inputProps={{ style: { colorScheme: isDark ? 'dark' : 'light' } }} />
          </Box>
          <Box>
            <Typography sx={{ color: theme.colors.text.tertiary, fontSize: 13, mb: 1, fontWeight: 700, letterSpacing: '0.08em' }}>COLOR</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {COLORS.map(c => (
                <Box key={c} onClick={() => setEv(p => ({ ...p, color: c }))}
                  sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                        border: ev.color === c ? '3px solid #fff' : '3px solid transparent',
                        boxShadow: ev.color === c ? `0 0 0 2px ${c}` : 'none', transition: 'all 0.15s' }} />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${theme.colors.ui.border}`, px: 3, py: 2 }}>
          <Button onClick={() => setAddOpen(false)} sx={{ color: theme.colors.text.tertiary }}>Cancel</Button>
          <Button onClick={handleAdd} variant="contained" sx={{ bgcolor: theme.colors.accent, '&:hover': { bgcolor: theme.colors.accentDark } }}>Add Event</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
