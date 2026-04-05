import React, { useState } from 'react';
import Rail from '../components/filemanager/Rail';
import FolderPanel from '../components/filemanager/FolderPanel';
import FileList from '../components/filemanager/FileList';
import FileViewer from '../components/filemanager/FileViewer';
import TopBar from '../components/filemanager/TopBar';

const FileManagerPage = () => {
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState(() => {
    const saved = localStorage.getItem('neuranote_files');
    return saved ? JSON.parse(saved) : {};
  });

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: '#f5f5f5',
    }}>

      {/* Icon Rail */}
      <Rail />

      {/* Folder Panel */}
      <FolderPanel
        selectedFolder={selectedFolder}
        onSelectFolder={(folder) => {
          setSelectedFolder(folder);
          setSelectedFile(null); // clear file when switching folder
        }}
        files={files}
        onFilesUpdate={setFiles}
      />

      {/* Right side */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top Bar */}
        <TopBar folderName={selectedFolder?.name} />

        {/* Content area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Show File List only when no file is selected */}
          {!selectedFile && (
            <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1 }}>
              <FileList
                selectedFolder={selectedFolder}
                onSelectFile={setSelectedFile}
                files={files}
                onFilesUpdate={setFiles}
              />
            </div>
          )}

          {/* Show File Viewer when file is selected */}
          {selectedFile && (
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