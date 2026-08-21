import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  useTheme,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Copy, Check, X } from 'lucide-react';

const NodeDetailPanel = ({ mindmap, selectedNodeId }) => {
  const theme = useTheme();
  const [copiedText, setCopiedText] = useState(false);

  // Find selected node
  const findNode = (nodes, targetId) => {
    if (!nodes) return null;
    for (let node of nodes) {
      if (node.id === targetId) return node;
      if (node.children) {
        const found = findNode(node.children, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedNode = selectedNodeId ? findNode(mindmap?.nodes || [], selectedNodeId) : null;

  if (!selectedNode) {
    return null;
  }

  // Get color by depth
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

  // Handle copy
  const handleCopyNotes = async () => {
    const text = `${selectedNode.content}\n\n${selectedNode.notes || '(No notes)'}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const depthColor = getDepthColor(selectedNode.depth || 0);
  const depthName = getDepthName(selectedNode.depth || 0);
  const childCount = selectedNode.children ? selectedNode.children.length : 0;

  return (
    <Box
      sx={{
        position: 'absolute',
        right: 16,
        top: 80,
        width: 320,
        maxHeight: 'calc(100% - 100px)',
        overflowY: 'auto',
        zIndex: 10,
        backgroundColor: theme.palette.background.paper,
        borderRadius: 2,
        boxShadow: 3,
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Header Card */}
        <Card
          sx={{
            background: `linear-gradient(135deg, ${depthColor}20 0%, ${depthColor}05 100%)`,
            border: `2px solid ${depthColor}40`,
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
                  boxShadow: `0 0 8px ${depthColor}80`,
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: depthColor,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
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
                wordBreak: 'break-word',
              }}
            >
              {selectedNode.content}
            </Typography>

            {/* Stats Row */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {childCount > 0 && (
                <Chip
                  size="small"
                  label={`${childCount} sub-topic${childCount !== 1 ? 's' : ''}`}
                  variant="outlined"
                  sx={{ height: 24, fontSize: '11px' }}
                />
              )}

              {selectedNode.notes && (
                <Chip
                  size="small"
                  label="Has notes"
                  variant="outlined"
                  color="success"
                  sx={{ height: 24, fontSize: '11px' }}
                />
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Notes Section */}
        {selectedNode.notes ? (
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
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: theme.palette.text.secondary,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {selectedNode.notes}
              </Typography>
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
              }}
            >
              {copiedText ? 'Copied!' : 'Copy Notes'}
            </Button>
          </Box>
        ) : (
          <Paper
            sx={{
              p: 2.5,
              backgroundColor: theme.palette.action.hover,
              border: `1px dashed ${theme.palette.divider}`,
              textAlign: 'center',
              borderRadius: 1,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontSize: '13px',
                color: theme.palette.text.secondary,
                fontStyle: 'italic',
              }}
            >
              📌 No notes available
            </Typography>
          </Paper>
        )}

        {/* Study Tip */}
        <Paper
          sx={{
            p: 1.5,
            backgroundColor: theme.palette.info.main + '15',
            border: `1px solid ${theme.palette.info.main}40`,
            borderRadius: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontSize: '11px',
              color: theme.palette.info.main,
              display: 'block',
              lineHeight: 1.4,
              fontWeight: 500,
            }}
          >
            💡 Click nodes to view details!
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

export default NodeDetailPanel;

