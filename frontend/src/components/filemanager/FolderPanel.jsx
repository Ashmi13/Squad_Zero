import React, { useState } from 'react';
import { Folder, FileText, ChevronDown, ChevronRight, ChevronUp, Plus } from 'lucide-react';

const initialFolders = [];

const getFileCount = (folderName) => {
  const saved = localStorage.getItem('neuranote_files');
  if (!saved) return 0;
  const files = JSON.parse(saved);
  return (files[folderName] || []).length;
};

const getFileNames = (folderName) => {
  const saved = localStorage.getItem('neuranote_files');
  if (!saved) return [];
  const files = JSON.parse(saved);
  return (files[folderName] || []).map(f => f.name);
};

const FolderPanel = ({ selectedFolder, onSelectFolder, files, onFilesUpdate, onFolderDelete }) => {
 const [folders, setFolders] = useState(() => {
  const saved = localStorage.getItem('neuranote_folders');
  return saved ? JSON.parse(saved) : initialFolders;
});

// Listen for folder changes
React.useEffect(() => {
  const saved = localStorage.getItem('neuranote_folders');
  setFolders(saved ? JSON.parse(saved) : []);
}, []);
  const [expanded, setExpanded] = useState({});
  const [showInput, setShowInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

 const addFolder = () => {
  if (!newFolderName.trim()) return;
  const newFolder = {
    id: Date.now(), name: newFolderName, count: 0, subfolders: []
  };
  const updatedFolders = [...folders, newFolder];
  setFolders(updatedFolders);
  localStorage.setItem('neuranote_folders', JSON.stringify(updatedFolders));
  setNewFolderName('');
  setShowInput(false);
};

  return (
    <div style={{
      width: '280px',
      margin: '16px 0 16px 8px',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0',
      boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      height: 'calc(100vh - 32px)',
      overflowY: 'auto',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', padding: '0 16px 16px',
        borderBottom: '1px solid #f0f0f0',
      }}>
        <span style={{ fontWeight: '700', fontSize: '18px', color: '#1a1a2e' }}>My Folders</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowInput(!showInput)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#6C5DD3'
          }}>
            <Plus size={20} />
          </button>
          <ChevronUp size={20} color="#888" />
        </div>
      </div>

      {/* New folder input */}
      {showInput && (
        <div style={{ padding: '10px 16px', display: 'flex', gap: '8px' }}>
          <input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Folder name..."
            onKeyDown={e => e.key === 'Enter' && addFolder()}
            autoFocus
            style={{
              flex: 1, padding: '6px 10px', borderRadius: '8px',
              border: '1px solid #ddd', fontSize: '13px', outline: 'none'
            }}
          />
          <button onClick={addFolder} style={{
            backgroundColor: '#6C5DD3', color: 'white', border: 'none',
            borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '13px'
          }}>Add</button>
        </div>
      )}

      {/* Label */}
      <p style={{ padding: '12px 16px 6px', fontSize: '11px', color: '#aaa', fontWeight: '600', margin: 0, letterSpacing: '0.5px' }}>
        FOLDER ORGANIZATION
      </p>

      {/* Folder list */}
      {folders.map(folder => (
        <div key={folder.id}>

          {/* Parent folder row */}
          <div
            onClick={() => {
              toggleExpand(folder.id);
              onSelectFolder(folder);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '9px 16px', cursor: 'pointer',
              backgroundColor: selectedFolder?.id === folder.id ? '#f0eeff' : 'transparent',
              borderLeft: selectedFolder?.id === folder.id ? '3px solid #6C5DD3' : '3px solid transparent',
            }}
          >
            {expanded[folder.id]
              ? <ChevronDown size={14} color="#888" />
              : <ChevronRight size={14} color="#888" />
            }
            <Folder size={16} color="#6C5DD3" />
            <span style={{ flex: 1, fontSize: '14px', color: '#1a1a2e' }}>{folder.name}</span>
            {getFileCount(folder.name) > 0 && (
              <span style={{
                backgroundColor: '#f0f0f0', borderRadius: '20px',
                padding: '2px 8px', fontSize: '12px', color: '#666', fontWeight: '600'
              }}>
                {getFileCount(folder.name)}
              </span>
            )}
          </div>

          {/* Files under folder - tree view */}
          {expanded[folder.id] && (
            <div>
              {getFileNames(folder.name).length === 0 ? (
                <div style={{
                  padding: '6px 16px 6px 50px',
                  fontSize: '12px', color: '#ccc', fontStyle: 'italic'
                }}>
                  No files yet
                </div>
              ) : (
                getFileNames(folder.name).map((fileName, index) => (
                  <div key={index} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 16px 6px 50px',
                    fontSize: '12px', color: '#777',
                    borderLeft: '3px solid transparent',
                    cursor: 'pointer',
                  }}>
                    <FileText size={12} color="#aaa" />
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>{fileName}</span>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      ))}
    </div>
  );
};

export default FolderPanel;