import React, { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Grid,
  Dialog,
  TextField,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  useTheme,
  Tooltip
} from '@mui/material';
import {
  ArrowLeft,
  Download,
  Edit2,
  Plus,
  Trash2,
  Undo2,
  Redo2,
  ChevronLeft,
  ChevronRight,
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
  
  // State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Get selected node
  const selectedNode = mindmap?.nodes?.find(n => n.id === selectedNodeId);

  // Handlers
  const handleEditNode = () => {
    if (!selectedNode) return;
    setEditContent(selectedNode.content || '');
    setEditNotes(selectedNode.notes || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (selectedNodeId) {
      updateNode(selectedNodeId, {
        content: editContent,
        notes: editNotes
      });
      setEditDialogOpen(false);
    }
  };

  const handleDeleteNode = () => {
    if (selectedNodeId) {
      if (window.confirm('Are you sure? This will delete the node and all children.')) {
        deleteNode(selectedNodeId);
        setSelectedNodeId(null);
      }
    }
  };

  const handleAddChild = () => {
    const childContent = prompt('Enter child concept:');
    if (childContent) {
      createNode(selectedNodeId, childContent);
    }
  };

  const handleNodeDragEnd = (nodeId, position) => {
    updateNode(nodeId, {
      position_x: position.x,
      position_y: position.y
    });
  };

  const handleNodeDragToConnect = (fromNodeId, toNodeId) => {
    alert(`Connected: ${fromNodeId} → ${toNodeId}`);
    // TODO: Implement relationship creation in backend
  };

  // Render
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      
      {/* TOP APPBAR */}
      <AppBar
        position="sticky"
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
          boxShadow: 3
        }}
      >
        <Toolbar>
          <Tooltip title="Go back">
            <IconButton
              color="inherit"
              onClick={onReset}
              sx={{ mr: 2 }}
            >
              <ArrowLeft size={24} />
            </IconButton>
          </Tooltip>

          <Typography
            variant="h6"
            sx={{
              flexGrow: 1,
              fontWeight: 'bold',
              fontSize: '18px'
            }}
          >
            📚 {mindmap?.title || 'Mind Map'}
          </Typography>

          {/* Undo/Redo Buttons */}
          <Tooltip title="Undo (Ctrl+Z)">
            <span>
              <IconButton
                color="inherit"
                disabled={!canUndo}
                onClick={undo}
                size="small"
              >
                <Undo2 size={20} />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Redo (Ctrl+Y)">
            <span>
              <IconButton
                color="inherit"
                disabled={!canRedo}
                onClick={redo}
                size="small"
              >
                <Redo2 size={20} />
              </IconButton>
            </span>
          </Tooltip>

          {/* Export Button */}
          <Tooltip title="Export options">
            <IconButton
              color="inherit"
            >
              <Download size={20} />
            </IconButton>
          </Tooltip>

          {/* Sidebar Toggle */}
          <Tooltip title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
            <IconButton
              color="inherit"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              sx={{ ml: 1 }}
            >
              {sidebarOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* MAIN CONTENT */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        
        {/* CANVAS (Main) */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            backgroundColor: theme.palette.background.default,
            position: 'relative'
          }}
        >
          <MindMapCanvas
            mindmap={mindmap}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
            onNodeDragEnd={handleNodeDragEnd}
            onNodeDragToConnect={handleNodeDragToConnect}
          />
        </Box>

        {/* SIDEBAR (Collapsible Notes Panel) */}
        <Box
          sx={{
            width: sidebarOpen ? 360 : 0,
            minWidth: sidebarOpen ? 360 : 0,
            maxWidth: sidebarOpen ? 360 : 0,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            borderLeft: sidebarOpen ? `1px solid ${theme.palette.divider}` : 'none',
            backgroundColor: theme.palette.background.paper,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: sidebarOpen ? `-4px 0 12px rgba(0,0,0,0.1)` : 'none',
            zIndex: 10
          }}
        >
          {/* Sidebar Header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 2,
              borderBottom: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.action.hover
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              📖 Concept Notes
            </Typography>
            <IconButton
              size="small"
              onClick={() => setSidebarOpen(false)}
              sx={{
                '&:hover': {
                  backgroundColor: theme.palette.action.selected
                }
              }}
            >
              <ChevronRight size={18} />
            </IconButton>
          </Box>

          {/* Sidebar Content */}
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {selectedNode ? (
              <>
                {/* Selected Node Info */}
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 'bold',
                      color: theme.palette.primary.main,
                      mb: 1
                    }}
                  >
                    {selectedNode.content}
                  </Typography>
                  
                  {/* Color Indicator */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: selectedNode.color || '#6366f1'
                      }}
                    />
                    <Typography variant="caption" color="textSecondary">
                      {['Main Topic', 'Sub Topic', 'Details', 'Key Points'][selectedNode.depth || 0]}
                    </Typography>
                  </Box>
                </Box>

                {/* Notes Panel */}
                <NotesPanel
                  nodeId={selectedNodeId}
                  mindmap={mindmap}
                  sx={{ mb: 2, flex: 1 }}
                />

                {/* Action Buttons */}
                <Stack spacing={1.5} sx={{ mt: 'auto' }}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="medium"
                    startIcon={<Edit2 size={18} />}
                    onClick={handleEditNode}
                    sx={{
                      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                      fontWeight: 'bold'
                    }}
                  >
                    Edit Concept
                  </Button>

                  <Button
                    fullWidth
                    variant="outlined"
                    size="medium"
                    color="success"
                    startIcon={<Plus size={18} />}
                    onClick={handleAddChild}
                  >
                    Add Sub-Topic
                  </Button>

                  <Button
                    fullWidth
                    variant="outlined"
                    size="medium"
                    color="error"
                    startIcon={<Trash2 size={18} />}
                    onClick={handleDeleteNode}
                  >
                    Delete
                  </Button>
                </Stack>
              </>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center'
                }}
              >
                <Typography color="textSecondary" variant="body2">
                  👆 Select a concept to view and edit its notes
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Sidebar Toggle Button (When Closed) */}
        {!sidebarOpen && (
          <Box
            onClick={() => setSidebarOpen(true)}
            sx={{
              width: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderLeft: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                backgroundColor: theme.palette.action.hover
              }
            }}
          >
            <ChevronLeft size={18} />
          </Box>
        )}
      </Box>

      {/* EDIT DIALOG */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Edit Concept</DialogTitle>
        <DialogContent sx={{ pt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            autoFocus
            label="Concept Name"
            fullWidth
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            variant="outlined"
            multiline
            rows={2}
          />

          <TextField
            label="Concept Notes / Details"
            fullWidth
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            variant="outlined"
            multiline
            rows={5}
            placeholder="Add important points, examples, or key takeaways..."
            helperText="Include all key information for this concept"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveEdit}
            variant="contained"
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MindMapEditor;