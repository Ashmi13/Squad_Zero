import React, { useState } from 'react';
import { Upload, Plus, FileText, File, Trash2, MoreHorizontal } from 'lucide-react';

const FileList = ({ selectedFolder, onSelectFile, onFolderDelete }) => {
  const [files, setFiles] = useState(() => {
    const saved = localStorage.getItem('neuranote_files');
    return saved ? JSON.parse(saved) : {};
  });
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const folderFiles = selectedFolder ? (files[selectedFolder.name] || []) : [];

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !selectedFolder) return;
    const newFile = {
      id: Date.now(),
      name: file.name.replace(/\.[^/.]+$/, ''),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      type: file.name.split('.').pop().toUpperCase(),
    };
    const updatedFiles = {
      ...files,
      [selectedFolder.name]: [...(files[selectedFolder.name] || []), newFile]
    };
    setFiles(updatedFiles);
    localStorage.setItem('neuranote_files', JSON.stringify(updatedFiles));
  };

  const handleDelete = (fileId) => {
    const updatedFiles = {
      ...files,
      [selectedFolder.name]: files[selectedFolder.name].filter(f => f.id !== fileId)
    };
    setFiles(updatedFiles);
    localStorage.setItem('neuranote_files', JSON.stringify(updatedFiles));
  };

  const handleRename = () => {
    if (!newFolderName.trim()) return;
    const updatedFiles = { ...files };
    updatedFiles[newFolderName] = updatedFiles[selectedFolder.name] || [];
    delete updatedFiles[selectedFolder.name];
    setFiles(updatedFiles);
    localStorage.setItem('neuranote_files', JSON.stringify(updatedFiles));
    setRenamingFolder(false);
  };

 const handleDeleteFolder = () => {
  if (window.confirm(`Delete "${selectedFolder.name}" and all its files?`)) {
    onFolderDelete(selectedFolder.name);
    setShowMenu(false);
  }
};

  const handleSelectFile = (file) => {
    setSelectedFileId(file.id);
    onSelectFile(file);
  };

  if (!selectedFolder) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#aaa', fontSize: '15px'
      }}>
        👈 Select a folder to view files
      </div>
    );
  }

  return (
    <div>
      {/* Title + Buttons */}
      <h2 style={{ margin: '0 0 16px', fontSize: '26px', fontWeight: '700', color: '#1a1a2e' }}>
        {selectedFolder.name}
      </h2>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', justifyContent: 'flex-end' }}>
        <label style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: '#1a1a2e', color: 'white',
          padding: '10px 20px', borderRadius: '12px',
          cursor: 'pointer', fontSize: '14px', fontWeight: '600'
        }}>
          <Upload size={16} /> Upload Note
          <input type="file" hidden onChange={handleUpload} accept=".pdf,.docx,.txt" />
        </label>

        <button style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: 'white', color: '#333',
          padding: '10px 20px', borderRadius: '12px',
          cursor: 'pointer', fontSize: '14px', fontWeight: '600',
          border: '1px solid #ddd'
        }}>
          <Plus size={16} /> Create Note
        </button>
      </div>

      {/* File card */}
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        width: '100%',
        height: 'calc(100vh - 220px)',
      }}>

        {/* Card header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid #f0f0f0'
        }}>

          {/* Title or Rename input */}
          {renamingFolder ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') setRenamingFolder(false);
                }}
                style={{
                  padding: '4px 10px', borderRadius: '8px',
                  border: '1px solid #6C5DD3', fontSize: '14px',
                  fontWeight: '600', outline: 'none', width: '180px'
                }}
              />
              <button
                onClick={handleRename}
                style={{
                  backgroundColor: '#6C5DD3', color: 'white',
                  border: 'none', borderRadius: '8px',
                  padding: '4px 10px', cursor: 'pointer', fontSize: '13px'
                }}
              >
                Save
              </button>
              <button
                onClick={() => setRenamingFolder(false)}
                style={{
                  backgroundColor: '#f5f5f5', color: '#888',
                  border: 'none', borderRadius: '8px',
                  padding: '4px 10px', cursor: 'pointer', fontSize: '13px'
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>
              {selectedFolder.name} - Notes
            </h3>
          )}

          {/* Three dots menu */}
          <div style={{ position: 'relative' }}>
            <MoreHorizontal
              size={20} color="#aaa"
              style={{ cursor: 'pointer' }}
              onClick={() => setShowMenu(!showMenu)}
            />
            {showMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '28px',
                backgroundColor: 'white', borderRadius: '10px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                padding: '6px', zIndex: 100, minWidth: '160px'
              }}>
                <div
                  onClick={() => {
                    setRenamingFolder(true);
                    setNewFolderName(selectedFolder.name);
                    setShowMenu(false);
                  }}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', borderRadius: '8px',
                    fontSize: '13px', color: '#333',
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  ✏️ Rename Folder
                </div>
                <div
                  onClick={handleDeleteFolder}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', borderRadius: '8px',
                    fontSize: '13px', color: '#e74c3c',
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff0f0'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  🗑️ Delete Folder
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 160px 100px',
          padding: '10px 20px', backgroundColor: '#fafafa',
          borderBottom: '1px solid #f0f0f0',
          fontSize: '12px', color: '#999', fontWeight: '600'
        }}>
          <span>Name</span>
          <span>Date Modified</span>
          <span>Type</span>
        </div>

        {/* Files */}
        {folderFiles.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#bbb', fontSize: '13px' }}>
            No files yet. Upload one!
          </div>
        ) : (
          folderFiles.map(file => (
            <div
              key={file.id}
              onClick={() => handleSelectFile(file)}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 160px 100px',
                alignItems: 'center', padding: '14px 20px',
                borderBottom: '1px solid #f9f9f9', cursor: 'pointer',
                backgroundColor: selectedFileId === file.id ? '#f0eeff' : 'transparent',
                transition: 'background 0.15s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {file.type === 'PDF'
                  ? <FileText size={16} color="#555" />
                  : <File size={16} color="#555" />
                }
                <span style={{ fontSize: '14px', color: '#1a1a2e' }}>{file.name}</span>
              </div>
              <span style={{ fontSize: '13px', color: '#999' }}>{file.date}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#555' }}>{file.type}</span>
                <Trash2
                  size={14} color="#ddd"
                  style={{ cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); handleDelete(file.id); }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FileList;