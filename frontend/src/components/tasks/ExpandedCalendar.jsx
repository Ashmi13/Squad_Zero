import React, { useState } from 'react';
import {
  Box, Typography, IconButton, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import CloseIcon        from '@mui/icons-material/Close';
import ChevronLeftIcon  from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon          from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const COLORS   = ['#6366f1','#ec4899','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#f97316'];
const FIELD_SX = {
  '& .MuiOutlinedInput-root': { color: '#f3f4f6', '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '&:hover fieldset': { borderColor: '#6366f1' }, '&.Mui-focused fieldset': { borderColor: '#6366f1' } },
  '& .MuiInputLabel-root': { color: '#9ca3af' }, '& .MuiInputLabel-root.Mui-focused': { color: '#6366f1' },
};
const MENU_SX = { PaperProps: { sx: { bgcolor: '#1a1f2e', color: '#f3f4f6' } } };

export default function ExpandedCalendar({ tasks, events, onClose, onAddEvent, onDeleteEvent }) {
  const today = new Date();
  const [year,         setYear]         = useState(today.getFullYear());
  const [month,        setMonth]        = useState(today.getMonth());
  const [selectedDay,  setSelectedDay]  = useState(today.getDate());
  const [addOpen,      setAddOpen]      = useState(false);
  const [ev, setEv] = useState({ title: '', description: '', start: '', end: '', color: '#6366f1' });

  const prev = () => month === 0  ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1);
  const next = () => month === 11 ? (setMonth(0),  setYear(y => y + 1)) : setMonth(m => m + 1);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const isToday     = d => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // Build day map
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

  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
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

  return (
    <Box className="exp-cal-overlay">
      {/* ── HEADER ── */}
      <Box className="exp-cal-header">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton onClick={prev} sx={{ color: '#9ca3af' }}><ChevronLeftIcon /></IconButton>
          <Typography sx={{ color: '#f3f4f6', fontWeight: 700, fontSize: 18, minWidth: 180 }}>
            {MONTHS[month]} {year}
          </Typography>
          <IconButton onClick={next} sx={{ color: '#9ca3af' }}><ChevronRightIcon /></IconButton>
          <Button startIcon={<AddIcon />} variant="contained" size="small"
            onClick={() => setAddOpen(true)}
            sx={{ bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' }, ml: 1, textTransform: 'none' }}>
            Add Event
          </Button>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#6b7280', '&:hover': { color: '#ef4444' } }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* ── BODY ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 270px', flex: 1, overflow: 'hidden' }}>

        {/* Calendar grid */}
        <Box sx={{ overflow: 'auto', p: 2 }}>
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
                        <Typography sx={{ fontSize: 10, color: item._color, fontWeight: 500,
                                         overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item._type === 'task' ? '📋' : '📅'} {item.title}
                        </Typography>
                      </Box>
                    ))}
                    {(dayMap[day] || []).length > 3 && (
                      <Typography sx={{ fontSize: 10, color: '#6b7280', pl: 0.5 }}>
                        +{(dayMap[day] || []).length - 3} more
                      </Typography>
                    )}
                  </Box>
                </>}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Detail panel */}
        <Box className="exp-detail-panel">
          <Typography sx={{ color: '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.08em', mb: 2 }}>
            {selectedDay ? `${MONTHS[month]} ${selectedDay}` : 'Click a day'}
          </Typography>
          {selectedDay && selectedItems.length === 0 && (
            <Typography sx={{ color: '#374151', fontSize: 13 }}>Nothing scheduled</Typography>
          )}
          {selectedItems.map((item, i) => (
            <Box key={i} className="exp-detail-item" style={{ borderLeftColor: item._color }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: '#e5e7eb', fontWeight: 600, fontSize: 13 }}>{item.title}</Typography>
                  {item.description && (
                    <Typography sx={{ color: '#6b7280', fontSize: 11, mt: 0.5 }}>{item.description}</Typography>
                  )}
                  <Typography sx={{ color: '#4b5563', fontSize: 11, mt: 0.5 }}>
                    {item._type === 'task'
                      ? `${item.priority} priority · ${item.status}`
                      : `${new Date(item.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} – ${new Date(item.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                    }
                  </Typography>
                </Box>
                {item._type === 'event' && (
                  <IconButton size="small" onClick={() => onDeleteEvent(item.id)}
                    sx={{ color: '#4b5563', '&:hover': { color: '#ef4444' }, flexShrink: 0 }}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── ADD EVENT DIALOG ── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#1a1f2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } }}>
        <DialogTitle sx={{ color: '#f3f4f6', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Add Event</DialogTitle>
        <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField label="Title *" value={ev.title} onChange={e => setEv(p => ({ ...p, title: e.target.value }))} fullWidth sx={FIELD_SX} />
          <TextField label="Description" value={ev.description} onChange={e => setEv(p => ({ ...p, description: e.target.value }))} fullWidth multiline rows={2} sx={FIELD_SX} />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField label="Start *" type="datetime-local" value={ev.start} onChange={e => setEv(p => ({ ...p, start: e.target.value }))} InputLabelProps={{ shrink: true }} sx={FIELD_SX} inputProps={{ style: { colorScheme: 'dark' } }} />
            <TextField label="End" type="datetime-local" value={ev.end} onChange={e => setEv(p => ({ ...p, end: e.target.value }))} InputLabelProps={{ shrink: true }} sx={FIELD_SX} inputProps={{ style: { colorScheme: 'dark' } }} />
          </Box>
          <Box>
            <Typography sx={{ color: '#9ca3af', fontSize: 11, mb: 1, fontWeight: 700, letterSpacing: '0.08em' }}>COLOR</Typography>
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
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', px: 3, py: 2 }}>
          <Button onClick={() => setAddOpen(false)} sx={{ color: '#9ca3af' }}>Cancel</Button>
          <Button onClick={handleAdd} variant="contained" sx={{ bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}>Add Event</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}