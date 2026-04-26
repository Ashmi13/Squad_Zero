import React, { useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import ChevronLeftIcon  from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import OpenInFullIcon   from '@mui/icons-material/OpenInFull';

const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function MiniCalendar({ tasks, events, onExpand }) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const prev = () => month === 0  ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1);
  const next = () => month === 11 ? (setMonth(0),  setYear(y => y + 1)) : setMonth(m => m + 1);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const isToday     = d => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // build a map of day -> colored dots (max 3 per day)
  const dots = {};
  const addDot = (isoDate, color) => {
    const d = new Date(isoDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!dots[day]) dots[day] = [];
      if (dots[day].length < 3) dots[day].push(color);
    }
  };
  tasks.forEach(t  => t.due_date   && addDot(t.due_date,   t.color || '#6366f1'));
  events.forEach(e => e.start_time && addDot(e.start_time, e.color || '#ec4899'));

  // pad the start of the grid with empty cells so day 1 lands on the right weekday
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  // grab the next 4 upcoming tasks and events combined, sorted by date
  const now = new Date();
  const upcoming = [
    ...tasks.filter(t  => t.due_date   && new Date(t.due_date)   >= now)
            .map(t  => ({ title: t.title, date: t.due_date,   color: t.color  || '#6366f1' })),
    ...events.filter(e => e.start_time && new Date(e.start_time) >= now)
             .map(e  => ({ title: e.title, date: e.start_time, color: e.color  || '#ec4899' })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 4);

  return (
    <Box className="mini-cal">
      <Box className="mini-cal-header">
        <Typography className="panel-title">CALENDAR</Typography>
        <IconButton size="small" onClick={onExpand} sx={{ color: '#6366f1', ml: 'auto', p: 0.5 }} title="Expand">
          <OpenInFullIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Box>

      {/* month navigation */}
      <Box className="mini-cal-nav">
        <IconButton size="small" onClick={prev} sx={{ color: '#6b7280', p: 0.25 }}><ChevronLeftIcon fontSize="small" /></IconButton>
        <Typography sx={{ color: '#e5e7eb', fontWeight: 600, fontSize: 12 }}>{MONTHS[month]} {year}</Typography>
        <IconButton size="small" onClick={next} sx={{ color: '#6b7280', p: 0.25 }}><ChevronRightIcon fontSize="small" /></IconButton>
      </Box>

      {/* day grid */}
      <Box className="mini-cal-grid">
        {DAYS.map(d => <Box key={d} className="mini-day-name">{d}</Box>)}
        {cells.map((day, i) => (
          <Box key={i} className={`mini-day ${day ? 'has-day' : ''} ${day && isToday(day) ? 'today' : ''}`}>
            {day && <>
              <span className="mini-day-num">{day}</span>
              {dots[day] && (
                <Box className="mini-dots">
                  {dots[day].map((c, j) => <span key={j} className="mini-dot" style={{ background: c }} />)}
                </Box>
              )}
            </>}
          </Box>
        ))}
      </Box>

      {/* upcoming items list below the grid */}
      <Box className="mini-cal-upcoming">
        <Typography sx={{ color: '#4b5563', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>UPCOMING</Typography>
        {upcoming.length === 0
          ? <Typography sx={{ color: '#374151', fontSize: 12 }}>Nothing coming up</Typography>
          : upcoming.map((item, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
              <Box sx={{ width: 3, minHeight: 28, borderRadius: 4, bgcolor: item.color, flexShrink: 0, mt: 0.25 }} />
              <Box>
                <Typography sx={{ color: '#d1d5db', fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>{item.title}</Typography>
                <Typography sx={{ color: '#6b7280', fontSize: 10 }}>
                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
            </Box>
          ))
        }
      </Box>
    </Box>
  );
}