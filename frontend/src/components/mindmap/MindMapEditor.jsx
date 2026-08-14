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
  Tooltip,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Fab
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

// Helper to recursively search for a node
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

// Helper to flatten hierarchy to flat lists for select drop-downs
const flattenNodesForSelect = (nodes) => {
  let flat = [];
  if (!nodes) return flat;
  nodes.forEach(node => {
    flat.push({ id: node.id, content: node.content });
    if (node.children && node.children.length > 0) {
      flat = [...flat, ...flattenNodesForSelect(node.children)];
    }
  });
  return flat;
};

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

  // Navigation / Sidebar layout states
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [exportAnchorEl, setExportAnchorEl] = useState(null);

  // Concept Edit Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Add Concept Dialog state
  const [addNodeDialogOpen, setAddNodeDialogOpen] = useState(false);
  const [addNodeLabel, setAddNodeLabel] = useState('');
  const [addNodeParentId, setAddNodeParentId] = useState('');
  const [addNodeNotes, setAddNodeNotes] = useState('');
  const [addNodeLevel, setAddNodeLevel] = useState(1);

  // Delete Confirm choice state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState(null);

  // Custom Context Menu state
  const [contextMenu, setContextMenu] = useState(null);

  // Retrieve current selected node object (supporting recursive lookup)
  const selectedNode = selectedNodeId === 'center-root' 
    ? { id: 'center-root', content: mindmap?.title || 'Root Topic', notes: 'Main Mind Map Concept', depth: 0 }
    : findNodeInTree(mindmap?.nodes || [], selectedNodeId);

  // Export handlers
  const handleExportClick = (event) => {
    setExportAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportAnchorEl(null);
  };

  const handleExportAction = async (format) => {
    handleExportClose();
    if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(mindmap, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `${mindmap.title.toLowerCase().replace(/\s+/g, '_')}_mindmap.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      return;
    }

    const svgElement = document.querySelector('#mindmap-canvas-svg');
    if (!svgElement) {
      alert('Could not find mind map SVG to export.');
      return;
    }

    try {
      // 1. Clone the SVG element
      const clonedSvg = svgElement.cloneNode(true);
      
      // 2. Reset the zoom/pan transform on the inner <g> wrapper so it exports the full map at scale 1
      const innerGroup = clonedSvg.querySelector('#mindmap-transform-group');
      if (innerGroup) {
        innerGroup.setAttribute('transform', 'translate(0, 0) scale(1)');
      }
      
      // 3. Remove grid definitions and pattern rects to prevent canvas tainting/rendering issues
      const gridRect = clonedSvg.querySelector('#grid-background');
      if (gridRect) gridRect.remove();
      const defs = clonedSvg.querySelector('defs');
      if (defs) defs.remove();

      // 4. Force absolute pixel dimensions on the SVG for rendering
      clonedSvg.setAttribute('width', '2000');
      clonedSvg.setAttribute('height', '2000');
      clonedSvg.style.width = '2000px';
      clonedSvg.style.height = '2000px';

      // 5. Serialize
      const svgString = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 2000;
        canvas.height = 2000;
        
        const context = canvas.getContext('2d');
        // Clean white background
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, 2000, 2000);
        
        context.drawImage(image, 0, 0, 2000, 2000);

        if (format === 'png') {
          const pngUrl = canvas.toDataURL('image/png');
          const downloadAnchor = document.createElement('a');
          downloadAnchor.href = pngUrl;
          downloadAnchor.download = `${mindmap.title.toLowerCase().replace(/\s+/g, '_')}_mindmap.png`;
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();
          downloadAnchor.remove();
        } else if (format === 'pdf') {
          const { jsPDF } = await import('jspdf');
          // Create landscape PDF matching 2000x2000 canvas size
          const pdf = new jsPDF('landscape', 'px', [2000, 2000]);
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 2000, 2000);
          pdf.save(`${mindmap.title.toLowerCase().replace(/\s+/g, '_')}_mindmap.pdf`);
        }
        
        URL.revokeObjectURL(blobURL);
      };
      image.src = blobURL;
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export mind map: ' + err.message);
    }
  };

  // Node editing handlers
  const handleEditNode = () => {
    if (!selectedNode) return;
    setEditContent(selectedNode.content || '');
    setEditNotes(selectedNode.notes || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (selectedNodeId) {
      if (selectedNodeId === 'center-root') {
        alert('Root topic details are generated from the document context.');
        return;
      }
      updateNode(selectedNodeId, {
        content: editContent,
        notes: editNotes
      });
      setEditDialogOpen(false);
    }
  };

  // Node Add Handlers
  const handleOpenAddNode = () => {
    setAddNodeLabel('');
    setAddNodeNotes('');
    setAddNodeParentId(selectedNodeId || 'center-root');
    setAddNodeLevel(selectedNodeId ? 2 : 1);
    setAddNodeDialogOpen(true);
  };

  const handleConfirmAddNode = () => {
    if (!addNodeLabel.trim()) return;
    const colors = {
      0: '#3b82f6',
      1: '#0d9488',
      2: '#f59e0b',
      3: '#ec4899',
    };
    const color = colors[addNodeLevel] || '#ec4899';
    const parentVal = addNodeParentId === 'center-root' ? null : addNodeParentId;
    createNode(parentVal, addNodeLabel, addNodeNotes, color);
    setAddNodeDialogOpen(false);
  };

  // Node Right Click & Delete Handlers
  const handleNodeContextMenu = (event, nodeId) => {
    setContextMenu(
      contextMenu === null
        ? { mouseX: event.clientX - 2, mouseY: event.clientY - 4, nodeId }
        : null
    );
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleNodeDoubleClick = (nodeId) => {
    setSelectedNodeId(nodeId);
    handleEditNode();
  };

  const handleDeleteNodeClick = (nodeId) => {
    const targetId = nodeId || selectedNodeId;
    if (!targetId || targetId === 'center-root') return;

    const targetNode = findNodeInTree(mindmap?.nodes || [], targetId);
    if (!targetNode) return;

    setNodeToDelete(targetId);
    handleContextMenuClose();

    // If node has children, prompt to reconnect or delete all
    if (targetNode.children && targetNode.children.length > 0) {
      setDeleteConfirmOpen(true);
    } else {
      if (window.confirm(`Are you sure you want to delete "${targetNode.content}"?`)) {
        deleteNode(targetId);
        setSelectedNodeId(null);
      }
    }
  };

  const handleDeleteNodeAction = async (deleteChildren) => {
    setDeleteConfirmOpen(false);
    if (!nodeToDelete) return;

    const targetNode = findNodeInTree(mindmap?.nodes || [], nodeToDelete);
    if (!targetNode) return;

    if (!deleteChildren && targetNode.children && targetNode.children.length > 0) {
      // Reconnect children to grand-parent
      const parentId = targetNode.parentId || null;
      for (const child of targetNode.children) {
        await updateNode(child.id, { parent_id: parentId });
      }
    }

    await deleteNode(nodeToDelete);
    setSelectedNodeId(null);
    setNodeToDelete(null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      
      {/* TOP BAR / CONTROL PANEL */}
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
                sx={{ mr: 0.5 }}
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
                sx={{ mr: 1.5 }}
              >
                <Redo2 size={20} />
              </IconButton>
            </span>
          </Tooltip>

          {/* Add Node Toolbar Button */}
          <Button
            variant="contained"
            color="success"
            startIcon={<Plus size={18} />}
            onClick={handleOpenAddNode}
            sx={{
              mr: 2,
              textTransform: 'none',
              fontWeight: 'bold',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
              }
            }}
          >
            Add Node
          </Button>

          {/* Export options */}
          <Tooltip title="Export options">
            <IconButton
              color="inherit"
              onClick={handleExportClick}
            >
              <Download size={20} />
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={exportAnchorEl}
            open={Boolean(exportAnchorEl)}
            onClose={handleExportClose}
          >
            <MenuItem onClick={() => handleExportAction('json')}>Export as JSON</MenuItem>
            <MenuItem onClick={() => handleExportAction('png')}>Export as PNG Image</MenuItem>
            <MenuItem onClick={() => handleExportAction('pdf')}>Export as PDF Document</MenuItem>
          </Menu>

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

      {/* MAIN VIEWPORT LAYOUT */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        
        {/* CANVAS */}
        <Box
          sx={{
            flex: 1,
            height: '100%',
            overflow: 'hidden',
            backgroundColor: theme.palette.background.default,
            position: 'relative'
          }}
        >
          <MindMapCanvas
            mindmap={mindmap}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodeContextMenu={handleNodeContextMenu}
            updateNode={updateNode}
          />

          {/* Floating Action Button (FAB) for Adding Node */}
          <Tooltip title="Add New Concept Node">
            <Fab
              color="success"
              aria-label="add"
              onClick={handleOpenAddNode}
              sx={{
                position: 'absolute',
                bottom: 24,
                right: 24,
                boxShadow: 4,
                background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                '&:hover': {
                  background: `linear-gradient(135deg, ${theme.palette.success.dark} 0%, ${theme.palette.success.dark} 100%)`,
                }
              }}
            >
              <Plus size={24} style={{ color: 'white' }} />
            </Fab>
          </Tooltip>
        </Box>

        {/* SIDEBAR NOTES PANEL */}
        {sidebarOpen && (
          <Box
            sx={{
              width: 320,
              borderLeft: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              display: 'flex',
              flexDirection: 'column',
              zIndex: 10
            }}
          >
            <Box
              sx={{
                p: 2,
                borderBottom: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '15px' }}>
                📝 Concept Notes
              </Typography>
              <IconButton size="small" onClick={() => setSidebarOpen(false)}>
                <ChevronRight size={18} />
              </IconButton>
            </Box>

            {/* Sidebar Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column' }}>
              {selectedNode ? (
                <>
                  <NotesPanel
                    nodeId={selectedNodeId}
                    mindmap={mindmap}
                    onEditClick={selectedNodeId === 'center-root' ? null : handleEditNode}
                    sx={{ mb: 2, flex: 1 }}
                  />

                  {/* Actions buttons */}
                  {selectedNodeId !== 'center-root' && (
                    <Stack spacing={1.5} sx={{ mt: 'auto', pt: 2 }}>
                      <Button
                        fullWidth
                        variant="contained"
                        size="medium"
                        startIcon={<Edit2 size={18} />}
                        onClick={handleEditNode}
                        sx={{
                          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                          fontWeight: 'bold',
                          textTransform: 'none'
                        }}
                      >
                        Edit Concept
                      </Button>

                      <Button
                        fullWidth
                        variant="outlined"
                        size="medium"
                        color="error"
                        startIcon={<Trash2 size={18} />}
                        onClick={() => handleDeleteNodeClick(selectedNodeId)}
                        sx={{ textTransform: 'none', fontWeight: 'bold' }}
                      >
                        Delete Concept
                      </Button>
                    </Stack>
                  )}
                </>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    textAlign: 'center',
                    p: 2
                  }}
                >
                  <Typography color="textSecondary" variant="body2">
                    👆 Click a concept on the canvas to view and edit its notes & details.
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* DIALOGS & POPUPS */}

      {/* Inline Edit Node Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>✏️ Edit Concept Detail</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1.5 }}>
            <TextField
              label="Concept Name / Node Label"
              fullWidth
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              required
            />
            <TextField
              label="Notes & Descriptions"
              fullWidth
              multiline
              rows={4}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Add key details, code syntax, or examples..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={!editContent.trim()}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Concept Node Dialog */}
      <Dialog open={addNodeDialogOpen} onClose={() => setAddNodeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>➕ Add Concept Node</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1.5 }}>
            <TextField
              autoFocus
              label="Node Label (Concept Title)"
              fullWidth
              value={addNodeLabel}
              onChange={(e) => setAddNodeLabel(e.target.value)}
              required
            />
            <FormControl fullWidth>
              <InputLabel id="add-node-parent-label">Parent Node</InputLabel>
              <Select
                labelId="add-node-parent-label"
                value={addNodeParentId}
                label="Parent Node"
                onChange={(e) => setAddNodeParentId(e.target.value)}
              >
                <MenuItem value="center-root">Core Topic (Root): {mindmap?.title || 'Main Concept'}</MenuItem>
                {flattenNodesForSelect(mindmap?.nodes || []).map((node) => (
                  <MenuItem key={node.id} value={node.id}>
                    {node.content}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="add-node-level-label">Concept Hierarchy Level</InputLabel>
              <Select
                labelId="add-node-level-label"
                value={addNodeLevel}
                label="Concept Hierarchy Level"
                onChange={(e) => setAddNodeLevel(e.target.value)}
              >
                <MenuItem value={0}>L0 - Core Topic (Blue)</MenuItem>
                <MenuItem value={1}>L1 - Main Concept (Teal)</MenuItem>
                <MenuItem value={2}>L2 - Sub-Concept (Orange)</MenuItem>
                <MenuItem value={3}>L3+ - Detailed Point (Pink)</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Notes & Description"
              fullWidth
              multiline
              rows={3}
              value={addNodeNotes}
              onChange={(e) => setAddNodeNotes(e.target.value)}
              placeholder="Add definition or description..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setAddNodeDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmAddNode} disabled={!addNodeLabel.trim()}>
            Add Node
          </Button>
        </DialogActions>
      </Dialog>

      {/* Recursive Delete Confirmation Choice Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>🗑️ Delete Concept Node</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            This concept node contains sub-concepts (child nodes). How would you like to delete this concept?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1.5, p: 2.5 }}>
          <Button
            variant="contained"
            color="error"
            onClick={() => handleDeleteNodeAction(true)}
            sx={{ fontWeight: 'bold', textTransform: 'none' }}
          >
            Delete Node & All Sub-Concepts (Children)
          </Button>
          <Button
            variant="outlined"
            color="warning"
            onClick={() => handleDeleteNodeAction(false)}
            sx={{ fontWeight: 'bold', textTransform: 'none' }}
          >
            Delete Node Only (Reconnect Sub-Concepts to Parent)
          </Button>
          <Button variant="text" color="inherit" onClick={() => setDeleteConfirmOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Node Right-Click Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => { handleContextMenuClose(); handleOpenAddNode(); }}>
          ➕ Add Child Concept
        </MenuItem>
        <MenuItem onClick={() => { handleContextMenuClose(); handleEditNode(); }}>
          ✏️ Edit Concept
        </MenuItem>
        <MenuItem 
          onClick={() => handleDeleteNodeClick(contextMenu?.nodeId)} 
          sx={{ color: 'error.main', fontWeight: 'bold' }}
        >
          🗑️ Delete Concept
        </MenuItem>
      </Menu>

    </Box>
  );
};

export default MindMapEditor;