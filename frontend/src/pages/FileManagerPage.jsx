/*
FileManagerPage Component - Main file management interface

CHANGES MADE:
- Added onFilesUpdate callback to propagate file changes (for Extract Text/Generate Summary)
- Pass currentFolder to FileViewer for nested file creation
- Enhanced state management to support nested file structures
- Added handler for child file creation under parent PDFs

FIX #1: Delete File Functionality
- Added onFileDeleted callback to FileViewer to close preview when file is deleted
- When a file is deleted from the preview, the FileViewer automatically closes
- The deleted file is immediately removed from both UI state and localStorage

FIX #2: Recent Files Navigation
- When user clicks a file from Recent Files section:
  1. System finds the folder that contains the file (using file.folderName)
  2. Automatically selects/opens that folder in the Folder Panel
  3. Selects and opens the specific file for preview
  4. Displays the PDF preview exactly like manual folder view access
- This ensures proper context and folder hierarchy is maintained
- User sees the file highlighted in the correct folder when accessing from Recent Files

MERGE NOTE (dev_sandavi_M3 + develop):
- Kept TopBar rendering from dev_sandavi_M3
- Added "Create Notes" button from develop, placed alongside folder title
*/
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FilePlus } from 'lucide-react';
import FolderPanel from '../components/filemanager/FolderPanel';
import FileList from '../components/filemanager/FileList';
import FileViewer from '../components/filemanager/FileViewer';
import TopBar from '../components/filemanager/TopBar';
import { useTheme } from '@/context/ThemeContext';
import ProductivityDashboard from '@/components/dashboard/ProductivityDashboard';
import { getScopedStorageKey, useSupabaseUser } from '@/hooks/useSupabaseUser';

const sanitizeFilesForStorage = (items) => {
  const walk = (nodes) => (Array.isArray(nodes) ? nodes : []).map((item) => {
    const contentValue = item?.content ?? item?.file_content;
    const asString = typeof contentValue === 'string' ? contentValue : '';
    const isDataUrl = asString.startsWith('data:');
    const type = String(item?.type ?? item?.file_type ?? '').toUpperCase();
    const mime = String(item?.mimeType ?? item?.mime_type ?? '').toLowerCase();
    const name = String(item?.name ?? item?.originalFilename ?? item?.original_filename ?? '').toLowerCase();
    const isLikelyGeneratedText =
      type === 'TXT' ||
      mime.startsWith('text/') ||
      (name.includes('extract text') || name.includes('extracted text') || name.includes('summary'));

    return {
      ...item,
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
  const navigate = useNavigate();
  const { userScope, loading: userLoading } = useSupabaseUser();

  const filesStorageKey = getScopedStorageKey('neuranote_files', userScope);
  const foldersStorageKey = getScopedStorageKey('neuranote_folders', userScope);

  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState({});
  const [folders, setFolders] = useState([]);

  const handleSelectFile = (file) => {
    const noteTypes = ['NOTE', 'STRUCTURED', 'CHEATSHEET', 'DETAILED'];
    
    const isMindMap = file?.type === 'MINDMAP' || 
      file?.file_type === 'MINDMAP' || 
      String(file?.id).startsWith('mindmap_');
      
    if (isMindMap) {
      const realId = String(file.id).replace('mindmap_', '');
      navigate(`/mindmap?id=${realId}`);
      return;
    }

    const isNote = file?.is_note || 
      noteTypes.includes(file?.type?.toUpperCase()) || 
      noteTypes.includes(file?.file_type?.toUpperCase());

    if (isNote) {
      navigate(`/notes/editor/${file.id}`);
    } else {
      setSelectedFile(file);
    }
  };

  useEffect(() => {
    if (userLoading) {
      return;
    }

    try {
      const savedFiles = localStorage.getItem(filesStorageKey);
      const savedFolders = localStorage.getItem(foldersStorageKey);
      setFiles(savedFiles ? JSON.parse(savedFiles) : {});
      setFolders(savedFolders ? JSON.parse(savedFolders) : []);
    } catch {
      setFiles({});
      setFolders([]);
    }

    setSelectedFolder(null);
    setSelectedFile(null);
  }, [filesStorageKey, foldersStorageKey, userLoading]);

  useEffect(() => {
    if (userLoading) {
      return;
    }

    localStorage.setItem(filesStorageKey, JSON.stringify(sanitizeFilesForStorage(files)));
  }, [files, filesStorageKey, userLoading]);

  useEffect(() => {
    if (userLoading) {
      return;
    }

    localStorage.setItem(foldersStorageKey, JSON.stringify(folders));
  }, [folders, foldersStorageKey, userLoading]);

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

  const handleFilesUpdate = (updatedFiles) => {
    if (typeof updatedFiles === 'function') {
      setFiles(prevFiles => {
        const newFiles = updatedFiles(prevFiles);
        return newFiles;
      });
    } else {
      setFiles(updatedFiles);
    }
  };

  const handleFolderDelete = (folderName) => {
    const updatedFiles = { ...files };
    delete updatedFiles[folderName];
    setFiles(updatedFiles);

    const updatedFolders = folders.filter(f => f.name !== folderName);
    setFolders(updatedFolders);

    setSelectedFolder(null);
    setSelectedFile(null);
  };

  const handleFolderRename = (oldName, newName) => {
    const updatedFiles = { ...files };
    updatedFiles[newName] = updatedFiles[oldName] || [];
    delete updatedFiles[oldName];
    setFiles(updatedFiles);

    const updatedFolders = folders.map(f =>
      f.name === oldName ? { ...f, name: newName } : f
    );
    setFolders(updatedFolders);

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
      {activeView !== 'home' && (
        <FolderPanel
          selectedFolder={selectedFolder}
          selectedFile={selectedFile}
          onSelectFolder={(folder) => {
            setSelectedFolder(folder);
            setSelectedFile(null);
          }}
          onSelectFile={handleSelectFile}
          files={files}
          onFilesUpdate={setFiles}
          onFolderDelete={handleFolderDelete}
          onFolderRename={handleFolderRename}
          folders={folders}
          setFolders={setFolders}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeView === 'home' ? (
          <>
            <TopBar folderName="NeuraNote" />
            <div style={{ display: 'flex', flex: 1, overflow: 'auto' }}>
              <HomeView />
            </div>
          </>
        ) : (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 32px',
              backgroundColor: theme.colors.bg.primary,
              borderBottom: `1px solid ${theme.colors.ui.border}`,
              transition: 'background-color 0.3s, border-color 0.3s',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: theme.colors.text.primary, letterSpacing: '-0.5px' }}>
                  {selectedFolder?.name || 'Files'}
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: theme.colors.text.tertiary, fontWeight: '500' }}>
                  Browse and organize your uploaded files
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/files/create-note')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 10px 22px rgba(79, 70, 229, 0.24)',
                }}
                title="Create Notes"
              >
                <FilePlus size={16} />
                Create Notes
              </button>
            </div>

            {location.pathname !== '/files' && (
              <TopBar
                folderName={activeView === 'home' ? 'Home' : (selectedFolder?.name || 'My Files')}
              />
            )}

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

              {activeView === 'files' && !selectedFile && (
                <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1 }}>
                  <FileList
                    selectedFolder={selectedFolder}
                    onSelectFile={handleSelectFile}
                    files={files}
                    onFilesUpdate={handleFilesUpdate}
                    onFolderDelete={handleFolderDelete}
                    onFolderRename={handleFolderRename}
                  />
                </div>
              )}

              {activeView === 'files' && selectedFile && (
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                  <FileViewer
                    selectedFile={selectedFile}
                    onClose={() => setSelectedFile(null)}
                    onFilesUpdate={handleFilesUpdate}
                    currentFolder={selectedFolder?.name}
                    currentFolderId={selectedFolder?.id}
                    onSelectGeneratedFile={setSelectedFile}
                    onFileDeleted={() => {
                      setSelectedFile(null);
                    }}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FileManagerPage;
