import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Markdown from 'react-markdown';

// Helper function to search for the node recursively in the tree hierarchy
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

const NotesPanel = ({ nodeId, mindmap }) => {
  const theme = useTheme();

  if (!mindmap || !nodeId) {
    return null;
  }

  const node = findNodeInTree(mindmap.nodes || [], nodeId);

  if (!node) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 1,
          backgroundColor: theme.palette.action.hover,
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          Concept node not found.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        borderRadius: 1,
        backgroundColor: theme.palette.action.hover,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {/* Node Content / Title */}
      <Box>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          {node.content}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: node.color || '#6366f1',
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Category
          </Typography>
        </Box>
      </Box>

      {/* Node Notes */}
      <Box sx={{ mt: 1 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          gutterBottom
          sx={{ fontWeight: '600' }}
        >
          Concept Notes
        </Typography>
        {node.notes ? (
          <Box
            sx={{
              fontSize: '0.875rem',
              color: theme.palette.text.secondary,
              lineHeight: 1.5,
              maxHeight: '22vh',
              overflowY: 'auto',
              pr: 0.5,
              '& p': { margin: 0, mb: 1 },
              '& ul, & ol': { pl: 2, margin: 0, mb: 1 },
              '& a': { color: theme.palette.primary.main, textDecoration: 'none' },
            }}
          >
            <Markdown>{node.notes}</Markdown>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No notes for this node
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default NotesPanel;
