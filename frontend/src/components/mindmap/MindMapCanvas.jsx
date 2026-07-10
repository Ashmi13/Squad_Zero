import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const MindMapCanvas = ({ mindmap, selectedNodeId, onNodeSelect, setSelectedNodeId }) => {
  const theme = useTheme();
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);

  const selectNode = onNodeSelect || setSelectedNodeId;

  useEffect(() => {
    if (!mindmap) return;

    const layoutNodes = [];
    const layoutLinks = [];
    const cx = 400;
    const cy = 300;

    // 1. Add virtual central node for the mind map title
    layoutNodes.push({
      id: 'center-root',
      content: mindmap.title,
      color: theme.palette.primary.main,
      x: cx,
      y: cy,
      isCenter: true,
      depth: 0,
    });

    // 2. Recursive helper to position children
    const positionNodeRecursive = (node, x, y, angle, depth) => {
      layoutNodes.push({
        id: node.id,
        content: node.content,
        color: node.color || '#6366f1',
        x,
        y,
        depth,
      });

      if (node.children && node.children.length > 0) {
        const K = node.children.length;
        // Radius increases with depth to prevent crowding
        const radius = 80 + depth * 15;
        // Angle spread arc narrows with depth to avoid overlaps
        const spread = Math.PI / (1 + depth * 0.5);

        node.children.forEach((child, index) => {
          let childAngle;
          if (K === 1) {
            childAngle = angle;
          } else {
            childAngle = angle - spread / 2 + (index * spread) / (K - 1);
          }

          const childX = x + radius * Math.cos(childAngle);
          const childY = y + radius * Math.sin(childAngle);

          layoutLinks.push({
            id: `${node.id}-${child.id}`,
            sourceX: x,
            sourceY: y,
            targetX: childX,
            targetY: childY,
          });

          positionNodeRecursive(child, childX, childY, childAngle, depth + 1);
        });
      }
    };

    // 3. Position root nodes in a circle around the center
    const roots = mindmap.nodes || [];
    const N = roots.length;
    const rootRadius = 140;

    roots.forEach((root, index) => {
      const angle = (index * 2 * Math.PI) / (N || 1);
      const x = cx + rootRadius * Math.cos(angle);
      const y = cy + rootRadius * Math.sin(angle);

      // Link center to root
      layoutLinks.push({
        id: `center-${root.id}`,
        sourceX: cx,
        sourceY: cy,
        targetX: x,
        targetY: y,
      });

      // Recurse children
      positionNodeRecursive(root, x, y, angle, 1);
    });

    setNodes(layoutNodes);
    setLinks(layoutLinks);
  }, [mindmap, theme]);

  const handleNodeClick = (nodeId) => {
    if (nodeId === 'center-root') {
      selectNode(null); // Deselect if clicking center
    } else {
      selectNode(nodeId);
    }
  };

  // Helper to wrap text into multiple tspans inside the SVG circle
  const renderTextLines = (text, x, y, isCenter = false) => {
    const maxChars = isCenter ? 12 : 9;
    const words = text.split(' ');
    let lines = [];
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

    // Limit to max 3 lines inside the circle
    lines = lines.slice(0, 3);

    const lineHeight = 12;
    const startY = y - ((lines.length - 1) * lineHeight) / 2;

    return lines.map((line, idx) => (
      <tspan
        key={idx}
        x={x}
        y={startY + idx * lineHeight}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#ffffff"
        style={{ fontSize: isCenter ? '10px' : '9px', fontWeight: 'bold' }}
      >
        {line.length > maxChars + 2 ? line.substring(0, maxChars) + '..' : line}
      </tspan>
    ));
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <svg
        viewBox="0 0 800 600"
        width="100%"
        height="100%"
        style={{
          userSelect: 'none',
          overflow: 'visible',
        }}
      >
        {/* Draw Connection Lines */}
        {links.map((link) => (
          <line
            key={link.id}
            x1={link.sourceX}
            y1={link.sourceY}
            x2={link.targetX}
            y2={link.targetY}
            stroke={theme.palette.divider}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ))}

        {/* Draw Nodes */}
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isCenter = node.isCenter;
          const radius = isCenter ? 50 : 45;

          return (
            <g
              key={node.id}
              onClick={() => handleNodeClick(node.id)}
              style={{ cursor: 'pointer' }}
            >
              {/* Highlight Outer Glow Circle */}
              {isSelected && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius + 8}
                  fill={node.color}
                  opacity={0.35}
                  style={{
                    transition: 'all 0.2s',
                  }}
                />
              )}

              {/* Main Node Circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={node.color}
                stroke={isSelected ? theme.palette.primary.main : theme.palette.background.paper}
                strokeWidth={isSelected ? 3.5 : 2}
                style={{
                  transition: 'all 0.2s',
                }}
              />

              {/* Text label */}
              <text>
                {renderTextLines(node.content, node.x, node.y, isCenter)}
              </text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
};

export default MindMapCanvas;
