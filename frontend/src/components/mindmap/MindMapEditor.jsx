import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Button,
  Grid,
  Paper,
  Dialog,
  Menu,
  Box,
  IconButton,
  Typography,
  MenuItem,
  TextField,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stack,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowLeft,
  Download,
  Edit2,
  Plus,
  Trash2,
  Undo2,
  Redo2,
} from 'lucide-react';
import MindMapCanvas from './MindMapCanvas';
import NotesPanel from './NotesPanel';

const MindMapEditor = ({
  mindmap,
  isLoading,
  selectedNodeId,
  setSelectedNodeId,
  updateNode,
  deleteNode,
  createNode,
  onReset,
  undo,
  redo,
  canUndo,
  canRedo,
}) => {
  const theme = useTheme();

  // State for Edit Node Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editNodeData, setEditNodeData] = useState({ content: '', notes: '', color: '' });

  // State for Add Child Dialog
  const [isAddChildDialogOpen, setIsAddChildDialogOpen] = useState(false);
  const [newChildContent, setNewChildContent] = useState('');

  // State for Export Menu
  const [exportAnchorEl, setExportAnchorEl] = useState(null);

  // Helper to find a node recursively
  const findNodeInTree = (nodes, targetId) => {
    for (const node of nodes) {
      if (node.id === targetId) return node;
      if (node.children && node.children.length > 0) {
        const found = findNodeInTree(node.children, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedNode = mindmap && selectedNodeId ? findNodeInTree(mindmap.nodes || [], selectedNodeId) : null;

  // Handlers
  const handleEditNode = () => {
    if (!selectedNode) return;
    setEditNodeData({
      content: selectedNode.content,
      notes: selectedNode.notes || '',
      color: selectedNode.color || '#6366f1',
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveNode = async () => {
    if (!editNodeData.content.trim()) return;
    try {
      await updateNode(selectedNodeId, {
        content: editNodeData.content,
        notes: editNodeData.notes,
        color: editNodeData.color,
      });
      setIsEditDialogOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedNodeId) return;
    if (window.confirm('Are you sure you want to delete this concept and all its sub-concepts?')) {
      try {
        await deleteNode(selectedNodeId);
        setSelectedNodeId(null);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAddChild = async () => {
    if (!newChildContent.trim()) return;
    try {
      await createNode(selectedNodeId, newChildContent);
      setNewChildContent('');
      setIsAddChildDialogOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportClick = (event) => {
    setExportAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportAnchorEl(null);
  };

  const handleExportAction = (format) => {
    handleExportClose();
    if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(mindmap, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `${mindmap.title.toLowerCase().replace(/\s+/g, '_')}_mindmap.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else {
      alert(`Exporting mind map as ${format.toUpperCase()}...`);
    }
  };

  // Color categories
  const colorsList = [
    { value: '#6366f1', label: 'Core Concept' },
    { value: '#10b981', label: 'Learning' },
    { value: '#f59e0b', label: 'Example' },
    { value: '#ec4899', label: 'Important' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '80vh' }}>
      {/* 1. AppBar (sticky) */}
      <AppBar
        position="sticky"
        sx={{
          background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          borderRadius: 1,
          mb: 3,
        }}
      >
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onReset} sx={{ mr: 2 }}>
            <ArrowLeft />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: '700' }}>
            {mindmap?.title || 'Mind Map Editor'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton color="inherit" onClick={undo} disabled={!canUndo || isLoading}>
              <Undo2 />
            </IconButton>
            <IconButton color="inherit" onClick={redo} disabled={!canRedo || isLoading}>
              <Redo2 />
            </IconButton>
            <IconButton color="inherit" onClick={handleExportClick}>
              <Download />
            </IconButton>
            <Menu anchorEl={exportAnchorEl} open={Boolean(exportAnchorEl)} onClose={handleExportClose}>
              <MenuItem onClick={() => handleExportAction('json')}>Export as JSON</MenuItem>
              <MenuItem onClick={() => handleExportAction('pdf')}>Export as PDF</MenuItem>
              <MenuItem onClick={() => handleExportAction('png')}>Export as PNG</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* 2. Grid Layout (2 columns) */}
      <Grid container spacing={3} sx={{ flexGrow: 1 }}>
        {/* Column 1 (md=9): MindMapCanvas */}
        <Grid item xs={12} md={9}>
          <Paper
            elevation={3}
            sx={{
              p: 2,
              minHeight: '65vh',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: theme.palette.mode === 'dark' ? '#111827' : '#fafafa',
            }}
          >
            <MindMapCanvas
              mindmap={mindmap}
              selectedNodeId={selectedNodeId}
              setSelectedNodeId={setSelectedNodeId}
            />
          </Paper>
        </Grid>

        {/* Column 2 (md=3): Side panel */}
        <Grid item xs={12} md={3}>
          <Paper
            elevation={3}
            sx={{
              p: 3,
              minHeight: '65vh',
              borderRadius: 2,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {selectedNode ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 3 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <NotesPanel nodeId={selectedNodeId} mindmap={mindmap} />
                </Box>

                <Stack spacing={1.5} sx={{ mt: 'auto' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Edit2 size={16} />}
                    onClick={handleEditNode}
                    fullWidth
                  >
                    Edit Concept
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<Plus size={16} />}
                    onClick={() => setIsAddChildDialogOpen(true)}
                    fullWidth
                  >
                    Add Child Concept
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Trash2 size={16} />}
                    onClick={handleDeleteNode}
                    fullWidth
                  >
                    Delete Concept
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  minHeight: 250,
                  textAlign: 'center',
                }}
              >
                <Box>
                  <Typography variant="subtitle1" fontWeight="600" color="text.secondary" gutterBottom>
                    No concept selected
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Select a node in the mind map canvas to view details, add children, or edit concepts.
                  </Typography>
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* 3. Edit Node Dialog */}
      <Dialog open={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Edit Concept Node</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Concept Title"
              value={editNodeData.content}
              onChange={(e) => setEditNodeData({ ...editNodeData, content: e.target.value })}
              fullWidth
              size="small"
              required
            />
            <TextField
              label="Notes"
              value={editNodeData.notes}
              onChange={(e) => setEditNodeData({ ...editNodeData, notes: e.target.value })}
              multiline
              rows={4}
              fullWidth
              size="small"
            />
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Color Theme
              </Typography>
              <Box display="flex" gap={1}>
                {colorsList.map((colorOpt) => (
                  <Box
                    key={colorOpt.value}
                    onClick={() => setEditNodeData({ ...editNodeData, color: colorOpt.value })}
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: colorOpt.value,
                      cursor: 'pointer',
                      border: '3px solid',
                      borderColor: editNodeData.color === colorOpt.value ? 'primary.main' : 'transparent',
                      transition: 'all 0.1s',
                      '&:hover': { transform: 'scale(1.1)' },
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSaveNode} variant="contained" disabled={!editNodeData.content.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Child Node Dialog */}
      <Dialog open={isAddChildDialogOpen} onClose={() => setIsAddChildDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Sub-Concept Node</DialogTitle>
        <DialogContent>
          <TextField
            label="Sub-concept Name"
            placeholder="e.g. key fact, secondary category..."
            value={newChildContent}
            onChange={(e) => setNewChildContent(e.target.value)}
            fullWidth
            size="small"
            required
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddChildDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleAddChild} variant="contained" disabled={!newChildContent.trim()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MindMapEditor;
