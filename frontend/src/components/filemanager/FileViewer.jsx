import React from 'react';
import { FileText, X } from 'lucide-react';

const FileViewer = ({ selectedFile, onClose }) => {

  if (!selectedFile) {
    return (
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '12px',
        color: '#ccc', fontSize: '14px',
        backgroundColor: '#f9f9f9',
      }}>
        <FileText size={48} color="#ddd" />
        <p>Click a file to view it here</p>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f9f9f9',
      overflow: 'hidden',
    }}>

      {/* Viewer header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px',
        backgroundColor: 'white',
        borderBottom: '1px solid #eee',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={18} color="#6C5DD3" />
          <span style={{ fontWeight: '600', fontSize: '15px', color: '#1a1a2e' }}>
            {selectedFile.name}
          </span>
          <span style={{
            backgroundColor: '#f0eeff', color: '#6C5DD3',
            padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600'
          }}>
            {selectedFile.type}
          </span>
        </div>
        <X
          size={18}
          color="#aaa"
          style={{ cursor: 'pointer' }}
          onClick={onClose}
        />
      </div>

      {/* PDF Viewer */}
      {selectedFile.fileUrl ? (
        <iframe
          src={selectedFile.fileUrl}
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          title={selectedFile.name}
        />
      ) : (
        <div style={{
          flex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '12px', color: '#aaa', fontSize: '14px'
        }}>
          <FileText size={48} color="#ddd" />
          <p>File preview not available</p>
          <p style={{ fontSize: '12px' }}>Re-upload the file to view it</p>
        </div>
      )}
    </div>
  );
};

export default FileViewer;