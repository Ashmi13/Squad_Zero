import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { useTheme } from '@mui/material/styles';

const MindMapNode = ({ data, isConnecting, selected }) => {
  const theme = useTheme();

  // Get node label - wrap text
  const getLabel = () => {
    const text = data.label || data.content || 'Node';
    const maxChars = 15;
    
    if (text.length <= maxChars) {
      return text;
    }
    
    // Split into words and wrap
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
    
    return lines.slice(0, 3).join('\n'); // Max 3 lines
  };

  const getNodeSize = () => {
    switch (data.type) {
      case 'root':
        return { width: 120, height: 120, fontSize: '14px' };
      case 'branch':
        return { width: 110, height: 110, fontSize: '12px' };
      case 'subbranch':
        return { width: 100, height: 100, fontSize: '11px' };
      default:
        return { width: 90, height: 90, fontSize: '10px' };
    }
  };

  const size = getNodeSize();

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        border: selected ? `4px solid #FFD700` : `2px solid rgba(0,0,0,0.2)`,
        boxShadow: selected ? `0 0 12px rgba(255,215,0,0.6)` : '0 2px 8px rgba(0,0,0,0.15)',
        transition: 'all 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Circle background with text */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          textAlign: 'center',
          padding: '8px',
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            fontSize: size.fontSize,
            fontWeight: 'bold',
            color: '#ffffff',
            lineHeight: 1.2,
            wordWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            maxWidth: '90%',
          }}
        >
          {getLabel()}
        </span>
      </div>

      {/* Handles for connections */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={!isConnecting}
        style={{
          background: 'transparent',
          border: 'none',
          width: 0,
          height: 0,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={!isConnecting}
        style={{
          background: 'transparent',
          border: 'none',
          width: 0,
          height: 0,
        }}
      />

      {/* Optional: Hover effect */}
      <style>{`
        div:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.25) !important;
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
};

export default MindMapNode;
