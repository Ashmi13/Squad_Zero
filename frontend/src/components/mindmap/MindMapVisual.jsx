import React, { useState, useRef } from 'react';
import { Box } from '@mui/material';

export default function MindMapVisual({ mindmapData, onDataChange }) {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const svgRef = useRef(null);
  const canvasRef = useRef(null);

  // Same logic as HTML version
  const calculatePositions = () => {
    const positions = new Map();
    const levelHeight = 180;
    const baseY = 80;

    positions.set('root', { x: 1000, y: baseY });

    const level1 = mindmapData.nodes;
    const level1Width = 350;
    const level1StartX = 1000 - (level1Width * (level1.length - 1)) / 2;

    level1.forEach((node, idx) => {
      const x = level1StartX + idx * level1Width;
      const y = baseY + levelHeight;
      positions.set(node.id, { x, y });

      const level2 = node.children || [];
      const level2Width = 220;
      const level2StartX = x - (level2Width * (level2.length - 1)) / 2;

      level2.forEach((child2, idx2) => {
        const x2 = level2StartX + idx2 * level2Width;
        const y2 = y + levelHeight;
        positions.set(child2.id, { x: x2, y: y2 });

        const level3 = child2.children || [];
        const level3Width = 150;
        const level3StartX = x2 - (level3Width * (level3.length - 1)) / 2;

        level3.forEach((child3, idx3) => {
          const x3 = level3StartX + idx3 * level3Width;
          const y3 = y2 + levelHeight;
          positions.set(child3.id, { x: x3, y: y3 });
        });
      });
    });

    return positions;
  };

  const renderDiagram = () => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    svg.innerHTML = '';

    const positions = calculatePositions();
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

    // Draw lines
    const drawLines = (node, positions, depth = 0) => {
      if (!node.children) return;

      const parentPos = positions.get(node.id);
      if (!parentPos) return;

      node.children.forEach(child => {
        const childPos = positions.get(child.id);
        if (childPos) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', parentPos.x);
          line.setAttribute('y1', parentPos.y + 30);
          line.setAttribute('x2', childPos.x);
          line.setAttribute('y2', childPos.y - 30);
          line.setAttribute('stroke', '#000000');
          line.setAttribute('stroke-width', '2');
          line.setAttribute('opacity', '0.4');
          svg.appendChild(line);

          drawLines(child, positions, depth + 1);
        }
      });
    };

    drawLines({ id: 'root', children: mindmapData.nodes }, positions);

    // Draw nodes
    const drawNodes = (nodes, depth = 1) => {
      nodes.forEach(node => {
        const pos = positions.get(node.id);
        if (pos) {
          const width = depth === 1 ? 160 : 140;
          const height = 60;
          const color = colors[Math.min(depth, colors.length - 1)];

          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('data-node-id', node.id);
          g.style.cursor = 'pointer';

          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', pos.x - width / 2);
          rect.setAttribute('y', pos.y - height / 2);
          rect.setAttribute('width', width);
          rect.setAttribute('height', height);
          rect.setAttribute('rx', '6');
          rect.setAttribute('fill', color);
          rect.setAttribute('stroke', selectedNodeId === node.id ? '#000' : 'white');
          rect.setAttribute('stroke-width', selectedNodeId === node.id ? '3' : '2');

          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', pos.x);
          text.setAttribute('y', pos.y - 10);
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('font-weight', '600');
          text.setAttribute('font-size', '12');
          text.setAttribute('fill', 'white');
          text.setAttribute('pointer-events', 'none');
          text.textContent = node.title;

          const notes = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          notes.setAttribute('x', pos.x);
          notes.setAttribute('y', pos.y + 12);
          notes.setAttribute('text-anchor', 'middle');
          notes.setAttribute('font-size', '10');
          notes.setAttribute('fill', 'rgba(255,255,255,0.8)');
          notes.setAttribute('pointer-events', 'none');
          notes.textContent = node.notes;

          g.appendChild(rect);
          g.appendChild(text);
          g.appendChild(notes);

          g.onclick = () => setSelectedNodeId(node.id);

          svg.appendChild(g);
        }

        if (node.children) {
          drawNodes(node.children, depth + 1);
        }
      });
    };

    // Draw root first
    const rootPos = positions.get('root');
    if (rootPos) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', rootPos.x - 100);
      rect.setAttribute('y', rootPos.y - 30);
      rect.setAttribute('width', 200);
      rect.setAttribute('height', 60);
      rect.setAttribute('rx', '6');
      rect.setAttribute('fill', '#6366f1');
      rect.setAttribute('stroke', 'white');
      rect.setAttribute('stroke-width', '2');

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', rootPos.x);
      text.setAttribute('y', rootPos.y);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-weight', '600');
      text.setAttribute('font-size', '14');
      text.setAttribute('fill', 'white');
      text.setAttribute('pointer-events', 'none');
      text.textContent = mindmapData.title;

      g.appendChild(rect);
      g.appendChild(text);
      svg.appendChild(g);
    }

    drawNodes(mindmapData.nodes);
  };

  React.useEffect(() => {
    renderDiagram();
  }, [mindmapData, selectedNodeId]);

  return (
    <Box sx={{
      flex: 1,
      background: white,
      overflow: 'auto',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '40px 20px'
    }}>
      <svg
        ref={svgRef}
        width="2000"
        height="2000"
        style={{ display: 'block' }}
      />
    </Box>
  );
}