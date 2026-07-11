import React, { useState, useEffect, useRef } from 'react';
import { Box, useTheme } from '@mui/material';

const MindMapCanvas = ({
  mindmap,
  selectedNodeId,
  onNodeSelect,
  onNodeDragEnd,
  onNodeDragToConnect,
}) => {
  const svgRef = useRef(null);
  const theme = useTheme();
  
  // State
  const [nodePositions, setNodePositions] = useState(new Map());
  const [connections, setConnections] = useState([]);
  const [draggedNode, setDraggedNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState(null);
  const [connectionEnd, setConnectionEnd] = useState(null);

  // Position Calculation
  useEffect(() => {
    if (!mindmap || !mindmap.nodes || mindmap.nodes.length === 0) return;

    const positions = new Map();
    const CANVAS_WIDTH = 1400;
    const CANVAS_HEIGHT = 800;
    const CENTER_X = CANVAS_WIDTH / 2;
    const CENTER_Y = CANVAS_HEIGHT / 2;
    const BASE_RADIUS = 120;
    const DEPTH_SPACING = 200;

    const rootNodes = mindmap.nodes.filter(n => !n.parent_id);
    const totalRoots = rootNodes.length;

    rootNodes.forEach((root, index) => {
      const angle = (index / totalRoots) * Math.PI * 2 - Math.PI / 2;
      const radius = BASE_RADIUS + 60;
      
      positions.set(root.id, {
        id: root.id,
        x: CENTER_X + radius * Math.cos(angle),
        y: CENTER_Y + radius * Math.sin(angle),
        depth: 0,
        angle: angle
      });

      if (root.children && root.children.length > 0) {
        positionChildrenRecursive(root, positions, angle, 1, DEPTH_SPACING);
      }
    });

    setNodePositions(positions);
    createConnectionLines(positions, mindmap.nodes);
  }, [mindmap]);

  const positionChildrenRecursive = (parent, positions, parentAngle, depth, depthSpacing) => {
    const children = parent.children || [];
    if (children.length === 0) return;

    const childCount = children.length;
    const angleSpread = Math.PI / 2;
    const startAngle = parentAngle - angleSpread / 2;

    children.forEach((child, index) => {
      const childAngle = startAngle + (index / Math.max(1, childCount - 1)) * angleSpread;
      const distance = depthSpacing * 0.8;
      
      const parentPos = positions.get(parent.id);
      
      positions.set(child.id, {
        id: child.id,
        x: parentPos.x + distance * Math.cos(childAngle),
        y: parentPos.y + distance * Math.sin(childAngle),
        depth: depth,
        angle: childAngle
      });

      if (child.children && child.children.length > 0) {
        positionChildrenRecursive(child, positions, childAngle, depth + 1, depthSpacing);
      }
    });
  };

  const createConnectionLines = (positions, allNodes) => {
    const lines = [];
    
    allNodes.forEach(node => {
      if (node.parent_id) {
        const childPos = positions.get(node.id);
        const parentPos = positions.get(node.parent_id);
        
        if (childPos && parentPos) {
          lines.push({
            x1: parentPos.x,
            y1: parentPos.y,
            x2: childPos.x,
            y2: childPos.y,
            parentId: node.parent_id,
            childId: node.id
          });
        }
      }
    });

    setConnections(lines);
  };

  // Drag Handlers
  const handleNodeMouseDown = (e, nodeId) => {
    if (e.button !== 0) return;

    if (e.shiftKey) {
      setConnecting(nodeId);
      return;
    }

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const currentPos = nodePositions.get(nodeId);
    if (!currentPos) return;

    setDraggedNode(nodeId);
    setDragOffset({
      x: mouseX - currentPos.x,
      y: mouseY - currentPos.y
    });

    onNodeSelect(nodeId);
  };

  const handleMouseMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (connecting) {
      setConnectionEnd({ x: mouseX, y: mouseY });
      return;
    }

    if (draggedNode) {
      const newPositions = new Map(nodePositions);
      const currentPos = nodePositions.get(draggedNode);
      
      if (currentPos) {
        newPositions.set(draggedNode, {
          ...currentPos,
          x: mouseX - dragOffset.x,
          y: mouseY - dragOffset.y
        });

        setNodePositions(newPositions);
        createConnectionLines(newPositions, mindmap.nodes);
      }
    }
  };

  const handleMouseUp = (e) => {
    if (draggedNode) {
      const finalPos = nodePositions.get(draggedNode);
      onNodeDragEnd?.(draggedNode, finalPos);
      setDraggedNode(null);
    }

    if (connecting) {
      setConnecting(null);
      setConnectionEnd(null);
    }
  };

  const handleNodeMouseUpConnect = (e, targetNodeId) => {
    if (connecting && targetNodeId !== connecting) {
      onNodeDragToConnect?.(connecting, targetNodeId);
      setConnecting(null);
      setConnectionEnd(null);
    } else {
      handleMouseUp(e);
    }
  };

  // Get node color by depth
  const getNodeColor = (nodeId) => {
    const pos = nodePositions.get(nodeId);
    if (!pos) return '#6366f1';

    const colors = {
      0: '#6366f1', // Indigo
      1: '#10b981', // Green
      2: '#f59e0b', // Orange
      3: '#ec4899', // Pink
    };

    return colors[pos.depth] || '#8b5cf6';
  };

  // Find node by ID
  const getNode = (nodeId) => {
    const searchNode = (nodes) => {
      for (let node of nodes) {
        if (node.id === nodeId) return node;
        if (node.children) {
          const found = searchNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return searchNode(mindmap.nodes || []);
  };

  // Render
  return (
    <Box
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      sx={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.palette.background.default,
        overflow: 'auto',
        cursor: draggedNode ? 'grabbing' : connecting ? 'crosshair' : 'grab',
        position: 'relative'
      }}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 1400 800"
        style={{
          width: '100%',
          height: '100%',
          minWidth: '1400px',
          minHeight: '800px',
          display: 'block'
        }}
      >
        {/* Background Grid */}
        <defs>
          <pattern
            id="grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke={theme.palette.divider}
              strokeWidth="0.5"
            />
          </pattern>
        </defs>

        <rect width="1400" height="800" fill="url(#grid)" />

        {/* Connection Lines */}
        {connections.map((line, idx) => (
          <line
            key={`line-${idx}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={theme.palette.divider}
            strokeWidth="2"
            pointerEvents="none"
          />
        ))}

        {/* Temporary Connection Line */}
        {connecting && connectionEnd && (
          <line
            x1={nodePositions.get(connecting)?.x || 0}
            y1={nodePositions.get(connecting)?.y || 0}
            x2={connectionEnd.x}
            y2={connectionEnd.y}
            stroke="#FFA500"
            strokeWidth="3"
            strokeDasharray="5,5"
            pointerEvents="none"
          />
        )}

        {/* Nodes */}
        {Array.from(nodePositions.entries()).map(([nodeId, pos]) => {
          const node = getNode(nodeId);
          if (!node) return null;

          const isSelected = selectedNodeId === nodeId;
          const color = getNodeColor(nodeId);

          return (
            <g key={`node-${nodeId}`}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={45}
                fill={color}
                stroke={isSelected ? '#FFD700' : theme.palette.divider}
                strokeWidth={isSelected ? 4 : 2}
                opacity={isSelected ? 1 : 0.9}
                onMouseDown={(e) => handleNodeMouseDown(e, nodeId)}
                onMouseUp={(e) => handleNodeMouseUpConnect(e, nodeId)}
                style={{
                  cursor: connecting ? 'crosshair' : 'grab',
                  transition: draggedNode === nodeId ? 'none' : 'all 0.2s',
                  filter: isSelected ? 'drop-shadow(0 0 8px rgba(255,215,0,0.6))' : 'none'
                }}
              />

              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="bold"
                fill="white"
                pointerEvents="none"
              >
                {node.content?.substring(0, 15)}
                {node.content && node.content.length > 15 ? '...' : ''}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          p: 2,
          fontSize: '12px'
        }}
      >
        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Legend:</div>
        <div><span style={{ color: '#6366f1', fontWeight: 'bold' }}>●</span> Main Topic</div>
        <div><span style={{ color: '#10b981', fontWeight: 'bold' }}>●</span> Sub-Topic</div>
        <div><span style={{ color: '#f59e0b', fontWeight: 'bold' }}>●</span> Details</div>
        <div><span style={{ color: '#ec4899', fontWeight: 'bold' }}>●</span> Points</div>
      </Box>
    </Box>
  );
};

export default MindMapCanvas;