import { useState, useCallback } from 'react';
import mindmapService from '../../../services/mindmapService';

// Helper to recursively add a new node to the tree
const addNodeToTree = (nodes, parentId, newNode) => {
  if (parentId === null || parentId === undefined) {
    return [...nodes, newNode];
  }
  return nodes.map((node) => {
    if (node.id === parentId) {
      return {
        ...node,
        children: [...(node.children || []), newNode],
      };
    }
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: addNodeToTree(node.children, parentId, newNode),
      };
    }
    return node;
  });
};

// Helper to recursively update a node in the tree
const updateNodeInTree = (nodes, nodeId, updatedNode) => {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return {
        ...node,
        ...updatedNode,
        children: node.children, // Preserve local children
      };
    }
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: updateNodeInTree(node.children, nodeId, updatedNode),
      };
    }
    return node;
  });
};

// Helper to recursively delete a node from the tree
const deleteNodeFromTree = (nodes, nodeId) => {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => {
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: deleteNodeFromTree(node.children, nodeId),
        };
      }
      return node;
    });
};

export const useMindMap = () => {
  const [mindmap, setMindmap] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Helper to save a state snapshot to history
  const saveToHistory = useCallback((newMindmap, currentHistory, currentIndex) => {
    const updatedHistory = currentHistory.slice(0, currentIndex + 1);
    const nextHistory = [...updatedHistory, newMindmap];
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  }, []);

  const loadMindmap = useCallback(async (mindmapId) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await mindmapService.getMindmap(mindmapId);
      const data = response.data;
      setMindmap(data);
      setHistory([data]);
      setHistoryIndex(0);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to load mind map');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createNode = useCallback(async (parentId, content, notes = '', color = '') => {
    if (!mindmap) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await mindmapService.createNode(mindmap.id, {
        parent_id: parentId,
        content,
        notes,
        color,
      });
      const newNode = response.data;

      const updatedNodes = addNodeToTree(mindmap.nodes || [], parentId, newNode);
      const updatedMindmap = {
        ...mindmap,
        nodes: updatedNodes,
      };

      setMindmap(updatedMindmap);
      saveToHistory(updatedMindmap, history, historyIndex);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to create node');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [mindmap, history, historyIndex, saveToHistory]);

  const updateNode = useCallback(async (nodeId, updates) => {
    if (!mindmap) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await mindmapService.updateNode(nodeId, updates);
      const updatedNode = response.data;

      const updatedNodes = updateNodeInTree(mindmap.nodes || [], nodeId, updatedNode);
      const updatedMindmap = {
        ...mindmap,
        nodes: updatedNodes,
      };

      setMindmap(updatedMindmap);
      saveToHistory(updatedMindmap, history, historyIndex);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to update node');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [mindmap, history, historyIndex, saveToHistory]);

  const deleteNode = useCallback(async (nodeId) => {
    if (!mindmap) return;
    setIsLoading(true);
    setError(null);
    try {
      await mindmapService.deleteNode(nodeId);

      const updatedNodes = deleteNodeFromTree(mindmap.nodes || [], nodeId);
      const updatedMindmap = {
        ...mindmap,
        nodes: updatedNodes,
      };

      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }

      setMindmap(updatedMindmap);
      saveToHistory(updatedMindmap, history, historyIndex);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to delete node');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [mindmap, selectedNodeId, history, historyIndex, saveToHistory]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setMindmap(history[newIndex]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setMindmap(history[newIndex]);
    }
  }, [history, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return {
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
  };
};

export default useMindMap;
