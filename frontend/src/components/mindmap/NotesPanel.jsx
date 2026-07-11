import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  Button,
  useTheme,
  Card,
  CardContent,
  IconButton,
  Tooltip
} from '@mui/material';
import { Copy, Check } from 'lucide-react';
import Markdown from 'react-markdown';

// Helper function to search for the node recursively
const findNodeInTree = (nodes, targetId) => {
  if (!nodes || !Array.isArray(nodes)) return null;
  for (const node of nodes) {
    if (node.id === targetId) return node;
    if (node.children && node.children.length > 0) {
      const found = findNodeInTree(node.children, targetId);
      if (found) return found;
    }
  }
  return null;
};

const NotesPanel = ({ nodeId, mindmap, sx = {} }) => {
  const theme = useTheme();
  const [copiedText, setCopiedText] = useState(false);

  if (!mindmap || !nodeId) {
    return (
      <Paper
        sx={{
          p: 2,
          textAlign: 'center',
          backgroundColor: theme.palette.action.hover,
          ...sx
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No node selected
        </Typography>
      </Paper>
    );
  }

  const node = findNodeInTree(mindmap.nodes || [], nodeId);

  if (!node) {
    return (
      <Paper
        sx={{
          p: 2,
          textAlign: 'center',
          backgroundColor: theme.palette.action.hover,
          ...sx
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          Concept node not found
        </Typography>
      </Paper>
    );
  }

  // Get color based on depth
  const getDepthColor = (depth) => {
    const colors = {
      0: '#6366f1', // Indigo
      1: '#10b981', // Green
      2: '#f59e0b', // Orange
      3: '#ec4899', // Pink
    };
    return colors[depth] || '#8b5cf6';
  };

  // Get depth name
  const getDepthName = (depth) => {
    const names = {
      0: 'Main Topic',
      1: 'Sub Topic',
      2: 'Details',
      3: 'Key Points',
    };
    return names[depth] || 'Concept';
  };

  // Count children
  const childCount = node.children ? node.children.length : 0;

  // Handle copy to clipboard
  const handleCopyNotes = async () => {
    const text = `${node.content}\n\n${node.notes || '(No notes)'}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const depthColor = getDepthColor(node.depth || 0);
  const depthName = getDepthName(node.depth || 0);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        ...sx
      }}
    >
      {/* Node Header Card */}
      <Card
        sx={{
          background: `linear-gradient(135deg, ${depthColor}20 0%, ${depthColor}05 100%)`,
          border: `2px solid ${depthColor}40`,
          borderRadius: 1.5
        }}
      >
        <CardContent sx={{ pb: 1.5, '&:last-child': { pb: 1.5 } }}>
          {/* Depth Badge */}
          <Box sx={{ mb: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: depthColor,
                boxShadow: `0 0 8px ${depthColor}80`
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: depthColor,
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}
            >
              {depthName}
            </Typography>
          </Box>

          {/* Node Content */}
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              fontSize: '16px',
              color: theme.palette.text.primary,
              lineHeight: 1.4,
              mb: 1.5,
              wordBreak: 'break-word'
            }}
          >
            {node.content}
          </Typography>

          {/* Stats Row */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              flexWrap: 'wrap'
            }}
          >
            {childCount > 0 && (
              <Chip
                size="small"
                label={`${childCount} sub-topic${childCount !== 1 ? 's' : ''}`}
                variant="outlined"
                sx={{
                  height: 24,
                  fontSize: '11px',
                  '& .MuiChip-label': { px: 1 }
                }}
              />
            )}

            {node.notes && (
              <Chip
                size="small"
                label="Has notes"
                variant="outlined"
                color="success"
                sx={{
                  height: 24,
                  fontSize: '11px',
                  '& .MuiChip-label': { px: 1 }
                }}
              />
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Notes Section */}
      {node.notes ? (
        <Box>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              fontSize: '12px',
              textTransform: 'uppercase',
              color: theme.palette.text.secondary,
              mb: 1,
              letterSpacing: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}
          >
            📝 Key Points
          </Typography>

          {/* Notes Content */}
          <Paper
            sx={{
              p: 2,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              mb: 1.5,
              maxHeight: '200px',
              overflowY: 'auto',
              '& p': { margin: 0, mb: 1, fontSize: '13px' },
              '& ul, & ol': { 
                pl: 2, 
                margin: 0, 
                mb: 1,
                '& li': { mb: 0.5, fontSize: '13px' }
              },
              '& a': { 
                color: theme.palette.primary.main, 
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' }
              },
              '& strong': { fontWeight: 700, color: depthColor },
              '& code': { 
                backgroundColor: theme.palette.divider,
                p: '2px 6px',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace'
              }
            }}
          >
            <Markdown>{node.notes}</Markdown>
          </Paper>

          {/* Copy Button */}
          <Button
            size="small"
            variant="outlined"
            fullWidth
            startIcon={copiedText ? <Check size={16} /> : <Copy size={16} />}
            onClick={handleCopyNotes}
            sx={{
              color: copiedText ? 'success.main' : 'inherit',
              borderColor: copiedText ? 'success.main' : 'inherit',
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '12px',
              transition: 'all 0.2s',
              '&:hover': {
                backgroundColor: copiedText ? 'success.lighter' : theme.palette.action.hover
              }
            }}
          >
            {copiedText ? 'Copied to clipboard!' : 'Copy Notes'}
          </Button>
        </Box>
      ) : (
        <Paper
          sx={{
            p: 2.5,
            backgroundColor: theme.palette.action.hover,
            border: `1px dashed ${theme.palette.divider}`,
            textAlign: 'center',
            borderRadius: 1
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontSize: '13px',
              color: theme.palette.text.secondary,
              fontStyle: 'italic'
            }}
          >
            📌 No notes available for this concept yet
          </Typography>
        </Paper>
      )}

      {/* Study Tip */}
      <Paper
        sx={{
          p: 1.5,
          backgroundColor: theme.palette.info.main + '15',
          border: `1px solid ${theme.palette.info.main}40`,
          borderRadius: 1
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontSize: '11px',
            color: theme.palette.info.main,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            lineHeight: 1.4,
            fontWeight: 500
          }}
        >
          💡 <strong>Tip:</strong> Click "Copy Notes" to save for quick review!
        </Typography>
      </Paper>
    </Box>
  );
};

export default NotesPanel;
