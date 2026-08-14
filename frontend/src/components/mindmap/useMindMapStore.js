import { create } from 'zustand';

export const useMindMapStore = create((set, get) => ({
  // State
  selectedNodeId: null,
  mindmapData: null,

  // Actions
  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
  clearSelectedNode: () => set({ selectedNodeId: null }),
  setMindmapData: (data) => set({ mindmapData: data }),

  // Selectors
  getSelectedNode: (state) => {
    const { mindmapData, selectedNodeId } = state;
    if (!mindmapData || !selectedNodeId) return null;

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

    return findNode(mindmapData.nodes || [], selectedNodeId);
  },
}));
