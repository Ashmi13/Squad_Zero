import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const DEPTH_SPACING = 220; // Expanded spacing

// 3. Word wrapping helper for SVG text
const wrapText = (text, maxChars = 16) => {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    if ((currentLine + ' ' + word).trim().length <= maxChars) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines;
};

// Flatten tree to render links and nodes easily
const flattenNodes = (nodes, parentId = null, depth = 1) => {
  let flat = [];
  if (!nodes) return flat;

  nodes.forEach((node) => {
    const lines = wrapText(node.content);
    // Dynamically calculate node card box size based on line count and length
    const maxLineLength = lines.reduce((max, l) => Math.max(max, l.length), 0);
    const width = Math.max(130, maxLineLength * 8 + 24);
    const height = Math.max(50, lines.length * 15 + 20);

    flat.push({
      id: node.id,
      content: node.content,
      notes: node.notes,
      color: node.color,
      parentId: parentId,
      depth: depth,
      lines,
      width,
      height,
    });
    if (node.children && node.children.length > 0) {
      flat = [...flat, ...flattenNodes(node.children, node.id, depth + 1)];
    }
  });
  return flat;
};

// Calculate the subtree weights (leaf count) for layout partitioning
const calculateSubtreeWeight = (node) => {
  if (!node.children || node.children.length === 0) {
    return 1;
  }
  return node.children.reduce((sum, child) => sum + calculateSubtreeWeight(child), 0);
};

const MindMapCanvas = ({
  mindmap,
  selectedNodeId,
  onNodeSelect,
  setSelectedNodeId,
  updateNode,
  onNodeDoubleClick,
  onNodeContextMenu,
}) => {
  const theme = useTheme();
  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const selectNode = onNodeSelect || setSelectedNodeId;

  // 2. Viewport zoom & pan state
  const [viewState, setViewState] = useState({ x: 50, y: 50, zoom: 0.65 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Node position & drag states
  const [positions, setPositions] = useState({});
  const [draggedOffsets, setDraggedOffsets] = useState({});
  const [dragging, setDragging] = useState(null); // { nodeId, startX, startY }

  // Auto-center mind map on load
  useEffect(() => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setViewState({
        x: rect.width / 2 - 1000 * 0.55,
        y: rect.height / 2 - 1000 * 0.55,
        zoom: 0.55,
      });
    }
  }, [mindmap]);

  // 1. Layout Algorithm: Calculate Radial Positions with Angular Space Budget
  useEffect(() => {
    if (!mindmap || !mindmap.nodes) return;

    const newPositions = {};
    const cx = 1000; // Center of the 2000x2000 canvas
    const cy = 1000;

    // Central Title Node (Depth 0)
    newPositions['center-root'] = {
      x: cx,
      y: cy,
      depth: 0,
      width: 180,
      height: 60,
      lines: wrapText(mindmap.title || 'Root Topic', 18),
    };

    const roots = mindmap.nodes || [];
    const totalWeight = roots.reduce((sum, r) => sum + calculateSubtreeWeight(r), 0);

    const positionNodeRecursive = (node, parentX, parentY, startAngle, endAngle, depth) => {
      // Radius increases outwards to give child branches more circumferential space
      const radius = DEPTH_SPACING + (depth - 1) * 160;
      const midAngle = (startAngle + endAngle) / 2;

      const x = cx + radius * Math.cos(midAngle);
      const y = cy + radius * Math.sin(midAngle);

      const lines = wrapText(node.content);
      const maxLineLength = lines.reduce((max, l) => Math.max(max, l.length), 0);
      const width = Math.max(135, maxLineLength * 8 + 24);
      const height = Math.max(50, lines.length * 15 + 20);

      newPositions[node.id] = { x, y, depth, width, height, lines };

      if (node.children && node.children.length > 0) {
        const K = node.children.length;
        const subtreeWeights = node.children.map(calculateSubtreeWeight);
        const totalSubtreeWeight = subtreeWeights.reduce((a, b) => a + b, 0);

        const totalAngleRange = endAngle - startAngle;
        let currentAngle = startAngle;

        node.children.forEach((child, index) => {
          const childWeight = subtreeWeights[index];
          // Allocate angle slice proportional to the subtree weight (leaf count)
          const angleSlice = (childWeight / totalSubtreeWeight) * totalAngleRange;
          
          positionNodeRecursive(
            child,
            x,
            y,
            currentAngle,
            currentAngle + angleSlice,
            depth + 1
          );
          currentAngle += angleSlice;
        });
      }
    };

    // Partition initial 360-degree circle among top level branches
    let currentAngle = 0;
    roots.forEach((root) => {
      const rootWeight = calculateSubtreeWeight(root);
      const angleSlice = (rootWeight / totalWeight) * 2 * Math.PI;

      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSlice;

      positionNodeRecursive(root, cx, cy, startAngle, endAngle, 1);
      currentAngle += angleSlice;
    });

    setPositions(newPositions);
  }, [mindmap]);

  // Distinct colors per level
  const getNodeColor = (depth) => {
    switch (depth) {
      case 0:
        return '#3b82f6'; // Center node: Blue
      case 1:
        return '#0d9488'; // Second level: Teal
      case 2:
        return '#f59e0b'; // Third level: Orange
      default:
        return '#ec4899'; // Fourth level+: Pink
    }
  };

  // Convert client cursor coords to local SVG space
  const getLocalMouseCoords = (clientX, clientY) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2000;
    const y = ((clientY - rect.top) / rect.height) * 2000;
    return { x, y };
  };

  // Canvas zoom wheel handler
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const nextZoom = Math.max(0.2, Math.min(3, viewState.zoom * zoomFactor));
    setViewState((prev) => ({ ...prev, zoom: nextZoom }));
  };

  // Canvas pan / drag-to-move handlers
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'svg' || e.target.id === 'grid-background') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewState.x, y: e.clientY - viewState.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setViewState((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
      return;
    }

    if (dragging) {
      // Divide by zoom so the node dragging speed matches the cursor movement precisely
      const dx = (e.clientX - dragging.startX) / viewState.zoom;
      const dy = (e.clientY - dragging.startY) / viewState.zoom;

      setDraggedOffsets((prev) => ({
        ...prev,
        [dragging.nodeId]: {
          x: (prev[dragging.nodeId]?.x || 0) + dx,
          y: (prev[dragging.nodeId]?.y || 0) + dy,
        },
      }));

      setDragging({
        nodeId: dragging.nodeId,
        startX: e.clientX,
        startY: e.clientY,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDragging(null);
  };

  const handleNodeMouseDown = (e, nodeId) => {
    e.stopPropagation();
    setDragging({ nodeId, startX: e.clientX, startY: e.clientY });
    selectNode(nodeId);
  };

  const flatNodesList = mindmap ? flattenNodes(mindmap.nodes || []) : [];

  return (
    <Box
      ref={canvasRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        cursor: isPanning ? 'grabbing' : dragging ? 'grabbing' : 'grab',
        backgroundColor: theme.palette.background.default,
      }}
    >
      <svg
        ref={svgRef}
        id="mindmap-canvas-svg"
        viewBox="0 0 2000 2000"
        width="2000"
        height="2000"
        style={{
          width: '2000px',
          height: '2000px',
          display: 'block',
          userSelect: 'none',
        }}
      >
        {/* Background Grid Pattern */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke={theme.palette.mode === 'dark' ? '#374151' : '#e5e7eb'}
              strokeWidth="0.8"
            />
          </pattern>
        </defs>
        
        {/* Grid Background */}
        <rect id="grid-background" width="100%" height="100%" fill="url(#grid)" />

        {/* Viewport Transform Group for Zoom & Pan */}
        <g
          id="mindmap-transform-group"
          transform={`translate(${viewState.x}, ${viewState.y}) scale(${viewState.zoom})`}
          style={{ transition: isPanning || dragging ? 'none' : 'transform 0.15s ease-out' }}
        >
          {/* Connection Lines (Bezier Paths) */}
          {flatNodesList.map((node) => {
            const parentId = node.parentId || 'center-root';
            const parentDefault = positions[parentId];
            const childDefault = positions[node.id];

            if (!parentDefault || !childDefault) return null;

            const pOffset = draggedOffsets[parentId] || { x: 0, y: 0 };
            const cOffset = draggedOffsets[node.id] || { x: 0, y: 0 };

            const px = parentDefault.x + pOffset.x;
            const py = parentDefault.y + pOffset.y;
            const cx = childDefault.x + cOffset.x;
            const cy = childDefault.y + cOffset.y;

            return (
              <path
                key={`link-${node.id}`}
                d={`M ${px} ${py} C ${(px + cx) / 2} ${py}, ${(px + cx) / 2} ${cy}, ${cx} ${cy}`}
                fill="none"
                stroke={theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'}
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            );
          })}

          {/* Central Root Node (Depth 0) */}
          {positions['center-root'] && (() => {
            const defaultPos = positions['center-root'];
            const offset = draggedOffsets['center-root'] || { x: 0, y: 0 };
            const x = defaultPos.x + offset.x;
            const y = defaultPos.y + offset.y;
            const isSelected = selectedNodeId === 'center-root';
            const { width, height, lines } = defaultPos;

            return (
              <g
                key="center-root"
                transform={`translate(${x}, ${y})`}
                onMouseDown={(e) => handleNodeMouseDown(e, 'center-root')}
                onDoubleClick={(e) => { e.stopPropagation(); onNodeDoubleClick?.('center-root'); }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onNodeContextMenu?.(e, 'center-root'); }}
                style={{ cursor: 'pointer' }}
              >
                {/* Selected Node Glow */}
                {isSelected && (
                  <rect
                    x={-width / 2 - 8}
                    y={-height / 2 - 8}
                    width={width + 16}
                    height={height + 16}
                    rx={12}
                    fill="#3b82f6"
                    opacity={0.35}
                    style={{ filter: 'blur(4px)' }}
                  />
                )}
                <rect
                  x={-width / 2}
                  y={-height / 2}
                  width={width}
                  height={height}
                  rx={8}
                  fill="#3b82f6"
                  stroke={isSelected ? '#ffffff' : 'transparent'}
                  strokeWidth={2.5}
                />
                <text textAnchor="middle" dominantBaseline="middle" fill="#ffffff">
                  {lines.map((line, i) => (
                    <tspan
                      key={i}
                      x={0}
                      dy={i === 0 ? `-${(lines.length - 1) * 7.5}` : '15'}
                      style={{ fontSize: '12px', fontWeight: 'bold' }}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })()}

          {/* All Other Level Nodes */}
          {flatNodesList.map((node) => {
            const defaultPos = positions[node.id];
            if (!defaultPos) return null;

            const offset = draggedOffsets[node.id] || { x: 0, y: 0 };
            const x = defaultPos.x + offset.x;
            const y = defaultPos.y + offset.y;

            const isSelected = selectedNodeId === node.id;
            const color = getNodeColor(node.depth);
            const { width, height, lines } = node;

            return (
              <g
                key={node.id}
                transform={`translate(${x}, ${y})`}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onDoubleClick={(e) => { e.stopPropagation(); onNodeDoubleClick?.(node.id); }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onNodeContextMenu?.(e, node.id); }}
                style={{ cursor: 'pointer' }}
              >
                {/* Glow effect */}
                {isSelected && (
                  <rect
                    x={-width / 2 - 8}
                    y={-height / 2 - 8}
                    width={width + 16}
                    height={height + 16}
                    rx={12}
                    fill={color}
                    opacity={0.35}
                    style={{ filter: 'blur(4px)' }}
                  />
                )}

                <rect
                  x={-width / 2}
                  y={-height / 2}
                  width={width}
                  height={height}
                  rx={8}
                  fill={color}
                  stroke={isSelected ? '#ffffff' : 'transparent'}
                  strokeWidth={2.5}
                />

                <text textAnchor="middle" dominantBaseline="middle" fill="#ffffff">
                  {lines.map((line, i) => (
                    <tspan
                      key={i}
                      x={0}
                      dy={i === 0 ? `-${(lines.length - 1) * 7}` : '14'}
                      style={{ fontSize: '11px', fontWeight: '600' }}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Legend */}
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          p: 1.5,
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.75,
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(4px)',
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="caption" fontWeight="bold" color="text.secondary" gutterBottom>
          Mind Map Spacing Levels:
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#3b82f6' }} />
          <Typography variant="caption" color="text.primary">L0 - Core Topic</Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#0d9488' }} />
          <Typography variant="caption" color="text.primary">L1 - Main Concept</Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
          <Typography variant="caption" color="text.primary">L2 - Sub-Concept</Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ec4899' }} />
          <Typography variant="caption" color="text.primary">L3+ - Details</Typography>
        </Box>
      </Paper>

      {/* Tooltip removed to favor sidebar Concept Notes panel */}
    </Box>
  );
};

export default MindMapCanvas;
