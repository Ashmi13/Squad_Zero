/**
 * FileManagerPage Component - Main file management interface
 * 
 * CHANGES MADE:
 * - Added onFilesUpdate callback to propagate file changes (for Extract Text/Generate Summary)
 * - Pass currentFolder to FileViewer for nested file creation
 * - Enhanced state management to support nested file structures
 * - Added handler for child file creation under parent PDFs
 * 
 * FIX #1: Delete File Functionality
 * - Added onFileDeleted callback to FileViewer to close preview when file is deleted
 * - When a file is deleted from the preview, the FileViewer automatically closes
 * - The deleted file is immediately removed from both UI state and localStorage
 * 
 * FIX #2: Recent Files Navigation
 * - When user clicks a file from Recent Files section:
 *   1. System finds the folder that contains the file (using file.folderName)
 *   2. Automatically selects/opens that folder in the Folder Panel
 *   3. Selects and opens the specific file for preview
 *   4. Displays the PDF preview exactly like manual folder view access
 * - This ensures proper context and folder hierarchy is maintained
 * - User sees the file highlighted in the correct folder when accessing from Recent Files
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import FolderPanel from '../components/filemanager/FolderPanel';
import FileList from '../components/filemanager/FileList';
import FileViewer from '../components/filemanager/FileViewer';
import TopBar from '../components/filemanager/TopBar';
import { useTheme } from '@/context/ThemeContext';
import ProductivityDashboard from '@/components/dashboard/ProductivityDashboard';

const sanitizeFilesForStorage = (items) => {
  const walk = (nodes) => (Array.isArray(nodes) ? nodes : []).map((item) => {
    const contentValue = item?.content ?? item?.file_content;
    const asString = typeof contentValue === 'string' ? contentValue : '';
    const isDataUrl = asString.startsWith('data:');
    const type = String(item?.type || item?.file_type || '').toUpperCase();
    const mime = String(item?.mimeType || item?.mime_type || '').toLowerCase();
    const name = String(item?.name || item?.originalFilename || item?.original_filename || '').toLowerCase();
    const isLikelyGeneratedText =
      type === 'TXT' ||
      mime.startsWith('text/') ||
      /extract(ed)? text|summary/.test(name);

    return {
      ...item,
      // Keep plain text for extracted/summary files so previews survive navigation.
      // Continue dropping binary/base64 payloads to keep storage light.
      content: isLikelyGeneratedText && asString && !isDataUrl ? asString : undefined,
      fileUrl: item?.fileUrl && String(item.fileUrl).startsWith('data:') ? undefined : item?.fileUrl,
      children: walk(item.children),
    };
  });

  if (Array.isArray(items)) {
    return walk(items);
  }

  if (items && typeof items === 'object') {
    return Object.fromEntries(
      Object.entries(items).map(([folderName, folderItems]) => [folderName, walk(folderItems)])
    );
  }

  return {};
};

const FileManagerPage = ({ activeView, setActiveView }) => {
  const { theme } = useTheme();
  const location = useLocation();

  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Initialize from navigation state if coming from Recent Files
  useEffect(() => {
    if (location.state?.navigatedFromRecent) {
      if (location.state.targetFolder) {
        setSelectedFolder(location.state.targetFolder);
      }
      if (location.state.targetFile) {
        setSelectedFile(location.state.targetFile);
      }
    }
  }, [location.state]);
  const [files, setFiles] = useState(() => {
    const saved = localStorage.getItem('neuranote_files');
    return saved ? JSON.parse(saved) : {};
  });
  const [folders, setFolders] = useState(() => {
    const saved = localStorage.getItem('neuranote_folders');
    return saved ? JSON.parse(saved) : [];
  });

  // CHANGED: Enhanced setFiles handler to also persist to localStorage
  const handleFilesUpdate = (updatedFiles) => {
    // If it's a function (state setter), call it
    if (typeof updatedFiles === 'function') {
      setFiles(prevFiles => {
        const newFiles = updatedFiles(prevFiles);
        localStorage.setItem('neuranote_files', JSON.stringify(sanitizeFilesForStorage(newFiles)));
        return newFiles;
      });
    } else {
      // If it's an object, directly update
      setFiles(updatedFiles);
      localStorage.setItem('neuranote_files', JSON.stringify(sanitizeFilesForStorage(updatedFiles)));
    }
  };

  const handleFolderDelete = (folderName) => {
    const updatedFiles = { ...files };
    delete updatedFiles[folderName];
    setFiles(updatedFiles);
    localStorage.setItem('neuranote_files', JSON.stringify(sanitizeFilesForStorage(updatedFiles)));

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
    localStorage.setItem('neuranote_files', JSON.stringify(sanitizeFilesForStorage(updatedFiles)));

    const updatedFolders = folders.map(f =>
      f.name === oldName ? { ...f, name: newName } : f
    );
    setFolders(updatedFolders);
    localStorage.setItem('neuranote_folders', JSON.stringify(updatedFolders));

    setSelectedFolder(prev => prev?.name === oldName ? { ...prev, name: newName } : prev);
  };

  const HomeView = () => (
    <ProductivityDashboard />
  );

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: theme.colors.bg.primary,
      transition: 'background-color 0.3s',
    }}>

      {/* Folder Panel — hide on home view */}
      {activeView !== 'home' && (
        <FolderPanel
          selectedFolder={selectedFolder}
          selectedFile={selectedFile}
          onSelectFolder={(folder) => {
            setSelectedFolder(folder);
            setSelectedFile(null);
          }}
          onSelectFile={setSelectedFile}
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
        <TopBar folderName={activeView === 'home' ? 'NeuraNote' : selectedFolder?.name} />

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, overflow: activeView === 'home' ? 'auto' : 'hidden' }}>

          {/* Home view */}
          {activeView === 'home' && <HomeView />}

          {/* Files view */}
          {activeView === 'files' && !selectedFile && (
            <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1 }}>
              <FileList
                selectedFolder={selectedFolder}
                onSelectFile={setSelectedFile}
                files={files}
                onFilesUpdate={handleFilesUpdate}
                onFolderDelete={handleFolderDelete}
                onFolderRename={handleFolderRename}
              />
            </div>
          )}

          {/* File Viewer */}
          {activeView === 'files' && selectedFile && (
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Show FileList on the left if we want to see it alongside the FileViewer, but for now we just show FileViewer */}
              <FileViewer
                selectedFile={selectedFile}
                onClose={() => setSelectedFile(null)}
                onFilesUpdate={handleFilesUpdate}
                currentFolder={selectedFolder?.name}
                currentFolderId={selectedFolder?.id}
                onSelectGeneratedFile={setSelectedFile}
                // FIX #1: Callback when a file is deleted from the preview
                onFileDeleted={() => {
                  setSelectedFile(null);
                }}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default FileManagerPage;