import React, { useState } from 'react';
import FolderPanel from '../components/filemanager/FolderPanel';
import FileList from '../components/filemanager/FileList';
import FileViewer from '../components/filemanager/FileViewer';
import TopBar from '../components/filemanager/TopBar';
import { FileText, File, Clock } from 'lucide-react';

const FileManagerPage = ({ activeView, setActiveView }) => {
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState(() => {
    const saved = localStorage.getItem('neuranote_files');
    return saved ? JSON.parse(saved) : {};
  });
  const [folders, setFolders] = useState(() => {
    const saved = localStorage.getItem('neuranote_folders');
    return saved ? JSON.parse(saved) : [];
  });

  const handleFolderDelete = (folderName) => {
    const updatedFiles = { ...files };
    delete updatedFiles[folderName];
    setFiles(updatedFiles);
    localStorage.setItem('neuranote_files', JSON.stringify(updatedFiles));

    const updatedFolders = folders.filter(f => f.name !== folderName);
    setFolders(updatedFolders);
    localStorage.setItem('neuranote_folders', JSON.stringify(updatedFolders));

    setSelectedFolder(null);
    setSelectedFile(null);
  };

  const handleFolderRename = (oldName, newName) => {
    const updatedFiles = { ...files };
    updatedFiles[newName] = updatedFiles[oldName] || [];
    delete updatedFiles[oldName];
    setFiles(updatedFiles);
    localStorage.setItem('neuranote_files', JSON.stringify(updatedFiles));

    const updatedFolders = folders.map(f =>
      f.name === oldName ? { ...f, name: newName } : f
    );
    setFolders(updatedFolders);
    localStorage.setItem('neuranote_folders', JSON.stringify(updatedFolders));

    setSelectedFolder(prev => prev?.name === oldName ? { ...prev, name: newName } : prev);
  };

  const getRecentFiles = () => {
    const allFiles = [];
    Object.entries(files).forEach(([folderName, folderFiles]) => {
      folderFiles.forEach(file => {
        allFiles.push({ ...file, folderName });
      });
    });
    return allFiles.slice(-8).reverse();
  };

  const HomeView = () => (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
      <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: '700', color: '#1a1a2e' }}>
        Welcome back! 👋
      </h2>
      <p style={{ margin: '0 0 28px', fontSize: '14px', color: '#aaa' }}>
        Here are your recently uploaded files
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Clock size={16} color="#6C5DD3" />
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#888' }}>RECENT FILES</span>
      </div>

      {getRecentFiles().length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '300px', color: '#ccc', gap: '12px'
        }}>
          <FileText size={48} color="#ddd" />
          <p style={{ fontSize: '14px' }}>No files yet — upload some notes!</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '16px',
        }}>
          {getRecentFiles().map(file => (
            <div
              key={file.id}
              onClick={() => {
                setSelectedFile(file);
                setActiveView('files');
              }}
              style={{
                backgroundColor: 'white',
                borderRadius: '14px',
                padding: '20px 16px',
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                border: '1px solid #f0f0f0',
                transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', gap: '12px'
              }}
            >
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                backgroundColor: file.type === 'PDF' ? '#fff0f0' : '#f0eeff',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {file.type === 'PDF'
                  ? <FileText size={22} color="#e74c3c" />
                  : <File size={22} color="#6C5DD3" />
                }
              </div>

              <div>
                <p style={{
                  margin: '0 0 4px', fontSize: '13px', fontWeight: '600',
                  color: '#1a1a2e', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {file.name}
                </p>
                <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#aaa' }}>
                  {file.folderName}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: '#bbb' }}>
                  {file.date}
                </p>
              </div>

              <span style={{
                backgroundColor: file.type === 'PDF' ? '#fff0f0' : '#f0eeff',
                color: file.type === 'PDF' ? '#e74c3c' : '#6C5DD3',
                padding: '3px 10px', borderRadius: '20px',
                fontSize: '11px', fontWeight: '600', alignSelf: 'flex-start'
              }}>
                {file.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: '#f5f5f5',
    }}>

      {/* Folder Panel — hide on home view */}
      {activeView !== 'home' && (
        <FolderPanel
          selectedFolder={selectedFolder}
          onSelectFolder={(folder) => {
            setSelectedFolder(folder);
            setSelectedFile(null);
          }}
          files={files}
          onFilesUpdate={setFiles}
          onFolderDelete={handleFolderDelete}
          onFolderRename={handleFolderRename}
          folders={folders}
          setFolders={setFolders}
        />
      )}

      {/* Right side */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top Bar */}
        <TopBar folderName={activeView === 'home' ? 'Home' : selectedFolder?.name} />

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Home view */}
          {activeView === 'home' && <HomeView />}

          {/* Files view */}
          {activeView === 'files' && !selectedFile && (
            <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1 }}>
              <FileList
                selectedFolder={selectedFolder}
                onSelectFile={setSelectedFile}
                files={files}
                onFilesUpdate={setFiles}
                onFolderDelete={handleFolderDelete}
                onFolderRename={handleFolderRename}
              />
            </div>
          )}

          {/* File Viewer */}
          {activeView === 'files' && selectedFile && (
            <FileViewer
              selectedFile={selectedFile}
              onClose={() => setSelectedFile(null)}
            />
          )}

        </div>
      </div>
    </div>
  );
};

export default FileManagerPage;