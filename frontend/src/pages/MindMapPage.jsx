import React, { useState, useEffect } from 'react';
import { Box, Container } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMindMap } from '../components/mindmap/hooks/useMindMap';
import PdfUploadSection from '../components/mindmap/PdfUploadSection';
import MindMapEditor from '../components/mindmap/MindMapEditor';

const MindMapPage = () => {
  const theme = useTheme();
  const [mindmapId, setMindmapId] = useState(null);
  
  const {
    mindmap,
    selectedNodeId,
    setSelectedNodeId,
    isLoading,
    error,
    createNode,
    updateNode,
    deleteNode,
    undo,
    redo,
    canUndo,
    canRedo,
    loadMindmap,
  } = useMindMap();

  useEffect(() => {
    if (mindmapId) {
      loadMindmap(mindmapId);
    }
  }, [mindmapId, loadMindmap]);

  const handleReset = () => {
    setMindmapId(null);
  };

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.default,
        minHeight: '100vh',
        py: 4,
      }}
    >
      <Container maxWidth="lg">
        {mindmapId === null ? (
          <PdfUploadSection onMindmapCreated={setMindmapId} />
        ) : (
          <MindMapEditor
            mindmap={mindmap}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
            isLoading={isLoading}
            error={error}
            createNode={createNode}
            updateNode={updateNode}
            deleteNode={deleteNode}
            undo={undo}
            redo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onReset={handleReset}
          />
        )}
      </Container>
    </Box>
  );
};

export default MindMapPage;
