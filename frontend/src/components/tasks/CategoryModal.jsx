import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, Typography } from '@mui/material';

import { ICON_MAP, TaskIcon } from './taskIcons';
const ICONS = Object.keys(ICON_MAP);
const COLORS = ['#6366f1','#ec4899','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#f97316','#06b6d4','#84cc16'];

export default function CategoryModal({ open, onClose, onSave, initial }) {
  const [name,  setName]  = useState('');
  const [icon,  setIcon]  = useState('📋');
  const [color, setColor] = useState('#6366f1');

  useEffect(() => {
    if (!open) return;
    setName(initial?.name   || '');
    setIcon(initial?.icon   || '📋');
    setColor(initial?.color || '#6366f1');
  }, [open, initial]);

  const handleSave = async () => {
    if (!name.trim()) return;
    await onSave({ name: name.trim(), icon, color });
    onClose();
  };

  const FIELD_SX = {
    '& .MuiOutlinedInput-root': {
      color: '#f3f4f6',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
      '&:hover fieldset': { borderColor: color },
      '&.Mui-focused fieldset': { borderColor: color },
    },
    '& .MuiInputLabel-root': { color: '#9ca3af' },
    '& .MuiInputLabel-root.Mui-focused': { color: color },
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: '#1a1f2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } }}>
      <DialogTitle sx={{ color: '#f3f4f6', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {initial ? 'Edit List' : 'New List'}
      </DialogTitle>

      <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Box sx={{ width: 56, height: 56, display: 'flex', alignItems: 'center',
                     justifyContent: 'center', bgcolor: `${color}18`, borderRadius: 2,
                     border: `2px solid ${color}`, flexShrink: 0 }}>
            <TaskIcon name={icon} sx={{ fontSize: 26, color }} />
          </Box>
          <TextField label="List name" value={name} onChange={e => setName(e.target.value)} fullWidth sx={FIELD_SX} />
        </Box>

        <Box>
          <Typography sx={{ color: '#9ca3af', fontSize: 11, mb: 1.5, fontWeight: 700, letterSpacing: '0.08em' }}>ICON</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {ICONS.map(i => (
              <Box key={i} onClick={() => setIcon(i)}
                sx={{ width: 36, height: 36, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', cursor: 'pointer', borderRadius: 1.5,
                      border: icon === i ? `2px solid ${color}` : '2px solid rgba(255,255,255,0.07)',
                      bgcolor: icon === i ? `${color}18` : 'transparent', transition: 'all 0.15s',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                <TaskIcon name={i} sx={{ fontSize: 18, color: icon === i ? color : '#6b7280' }} />
              </Box>
            ))}
          </Box>
        </Box>

        <Box>
          <Typography sx={{ color: '#9ca3af', fontSize: 11, mb: 1.5, fontWeight: 700, letterSpacing: '0.08em' }}>COLOR</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <Box key={c} onClick={() => setColor(c)}
                sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                      border: color === c ? '3px solid #fff' : '3px solid transparent',
                      boxShadow: color === c ? `0 0 0 2px ${c}` : 'none', transition: 'all 0.15s' }} />
            ))}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', px: 3, py: 2 }}>
        <Button onClick={onClose} sx={{ color: '#9ca3af' }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained"
          sx={{ bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.85)' } }}>
          {initial ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}