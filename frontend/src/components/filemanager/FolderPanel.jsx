import React, { useEffect, useState } from 'react';
import { Folder, ChevronDown, ChevronRight, Plus, FolderPlus, Pencil, Trash2, FileText, File } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { workspaceApi } from '@/services/workspaceApi';
import {
  createLocalFolderAndBind,
  ensureReadWritePermission,
  pickDirectoryHandle,
  removeFolderFromLocalMachine,
  deleteFolderHandleBinding,
  renameFolderOnLocalMachine,
  getFolderHandleBinding,
} from '@/utils/localFsSync';

const LOCAL_FOLDER_MAP_KEY = 'neuranote_local_folder_map';
const INVALID_WINDOWS_FOLDER_CHARS = /[<>:"/\\|?*\x00-\x1F]/;

const flattenFoldersForStorage = (nodes, output = []) => {
  (nodes || []).forEach((node) => {
    output.push({
      id: node.id,
      name: node.name,
      parent_folder_id: node.parent_folder_id || node.parent_id || null,
    });
    if (node.children?.length) {
      flattenFoldersForStorage(node.children, output);
    }
  });
  return output;
};

const getLocalFolderMap = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_FOLDER_MAP_KEY) || '{}');
  } catch {
    return {};
  }
};

const setLocalFolderMap = (map) => {
  localStorage.setItem(LOCAL_FOLDER_MAP_KEY, JSON.stringify(map));
};

const resolveTextPayload = (file) => {
  const candidates = [file?.file_content, file?.raw_text, file?.summary, file?.content, file?.text];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return null;
};

const FolderPanel = ({ selectedFolder, onSelectFolder, onSelectFile, onFolderDelete }) => {
  const { theme } = useTheme();
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});
  const [filesByFolder, setFilesByFolder] = useState({});
  const [filesLoadingByFolder, setFilesLoadingByFolder] = useState({});
  const filesByFolderRef = React.useRef({});
  const filesLoadingRef = React.useRef({});
  const [showInput, setShowInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('info');
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [isMovingFile, setIsMovingFile] = useState(false);

  const showStatus = (message, type = 'info') => {
    setStatusMessage(message);
    setStatusType(type);
  };

  const findFolderById = (nodes, folderId) => {
    for (const node of nodes || []) {
      if (String(node.id) === String(folderId)) {
        return node;
      }
      if (node.children?.length) {
        const nested = findFolderById(node.children, folderId);
        if (nested) {
          return nested;
        }
      }
    }
    return null;
  };

  const buildFileTree = (files) => {
    const lookup = {};
    const roots = [];

    (files || []).forEach((file) => {
      lookup[file.id] = { ...file, children: [] };
    });

    Object.values(lookup).forEach((file) => {
      if (file.parent_file_id && lookup[file.parent_file_id]) {
        lookup[file.parent_file_id].children.push(file);
      } else {
        roots.push(file);
      }
    });

    return roots;
  };

  const loadFolderFiles = async (folderId, { force = false } = {}) => {
    if (!folderId) return;
    if (filesLoadingRef.current[folderId]) return;
    if (!force && Array.isArray(filesByFolderRef.current[folderId])) return;

    filesLoadingRef.current = { ...filesLoadingRef.current, [folderId]: true };
    setFilesLoadingByFolder((prev) => ({ ...prev, [folderId]: true }));
    try {
      const data = await workspaceApi.getFiles(folderId);
      const normalized = (data.files || []).map((f) => {
        const resolvedPayload = resolveTextPayload(f);
        const inlineAsset = typeof resolvedPayload === 'string' && resolvedPayload.startsWith('data:')
          ? resolvedPayload
          : null;

        return {
          id: f.id,
          name: f.name || f.original_filename || 'Untitled file',
          originalFilename: f.original_filename,
          file_type: (f.file_type || '').toUpperCase() || 'FILE',
          mimeType: f.mime_type,
          folderId: f.folder_id,
          parent_file_id: f.parent_file_id,
          fileUrl: f.storage_url || inlineAsset,
          content: inlineAsset ? null : resolvedPayload,
          isParentPDF: (f.file_type || '').toUpperCase() === 'PDF',
        };
      });
      setFilesByFolder((prev) => {
        const next = { ...prev, [folderId]: buildFileTree(normalized) };
        filesByFolderRef.current = next;
        return next;
      });
    } catch {
      setFilesByFolder((prev) => {
        const next = { ...prev, [folderId]: [] };
        filesByFolderRef.current = next;
        return next;
      });
    } finally {
      filesLoadingRef.current = { ...filesLoadingRef.current, [folderId]: false };
      setFilesLoadingByFolder((prev) => ({ ...prev, [folderId]: false }));
    }
  };

  const loadFolders = async () => {
    const data = await workspaceApi.getFolders();
    const nextFolders = data.folders || [];
    setFolders(nextFolders);
    localStorage.setItem('neuranote_folders', JSON.stringify(flattenFoldersForStorage(nextFolders)));
  };

  useEffect(() => {
    const fetchFolders = async () => {
      setLoading(true);
      setError('');
      try {
        await loadFolders();
      } catch (e) {
        setError(e.message || 'Failed to load folders');
      } finally {
        setLoading(false);
      }
    };
    fetchFolders();
  }, []);

  useEffect(() => {
    if (selectedFolder) {
      setExpanded((prev) => ({ ...prev, [selectedFolder.id]: true }));
      loadFolderFiles(selectedFolder.id);
    }
  }, [selectedFolder?.id]); // eslint-disable-line

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const nextExpanded = !prev[id];
      if (nextExpanded) {
        loadFolderFiles(id);
      }
      return { ...prev, [id]: nextExpanded };
    });
  };

  const validateFolderName = (name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return 'Folder name is required.';
    if (trimmed.length > 120) return 'Folder name is too long.';
    if (INVALID_WINDOWS_FOLDER_CHARS.test(trimmed)) {
      return 'Folder name contains invalid characters: < > : " / \\ | ? *';
    }
    if (trimmed === '.' || trimmed === '..') {
      return 'Folder name cannot be . or ..';
    }
    return null;
  };

  const createFolderOnLocalMachine = async (folderName, folderId, parentFolderId = null, preselectedParentHandle = null) => {
    const parentFolder = parentFolderId ? findFolderById(folders, parentFolderId) : null;
    const localCreation = await createLocalFolderAndBind({
      folderId,
      folderName,
      parentFolder,
      parentHandle: preselectedParentHandle,
    });

    return {
      ...localCreation,
      parentName: localCreation?.parentHandle?.name || null,
    };
  };

  const rollbackLocalFolder = async (parentHandle, folderName) => {
    if (!parentHandle) return;
    try {
      await parentHandle.removeEntry(folderName);
    } catch {
      // If rollback fails we keep backend as source of truth and surface the main error.
    }
  };

  const addFolder = async (parentFolderId = null) => {
    if (creatingFolder) return;

    const rawName = parentFolderId ? window.prompt('Subfolder name') : newFolderName;
    if (!rawName || !rawName.trim()) return;

    const cleanName = rawName.trim();
    const validationError = validateFolderName(cleanName);
    if (validationError) {
      showStatus(validationError, 'error');
      window.alert(validationError);
      return;
    }

    setCreatingFolder(true);
    showStatus('Select a local destination path to create this folder...', 'info');

    let localCreation = null;
    let createdFolderId = null;
    let preselectedParentHandle = null;

    try {
      // Call picker directly in this click-driven flow before backend awaits,
      // so browser user-gesture requirements are satisfied.
      preselectedParentHandle = await pickDirectoryHandle();
      const granted = await ensureReadWritePermission(preselectedParentHandle);
      if (!granted) {
        throw new Error('Permission denied for selected local directory.');
      }

      const created = await workspaceApi.createFolder(cleanName, parentFolderId);
      const createdFolder = created?.folder;

      if (!createdFolder?.id) {
        throw new Error('Folder was not created in backend.');
      }
      createdFolderId = createdFolder.id;

      localCreation = await createFolderOnLocalMachine(cleanName, createdFolder.id, parentFolderId, preselectedParentHandle);

      const map = getLocalFolderMap();
      map[createdFolder.id] = {
        folder_name: cleanName,
        parent_folder_id: parentFolderId || null,
        local_parent_label: localCreation?.parentName || null,
        created_at: new Date().toISOString(),
      };
      setLocalFolderMap(map);

      await loadFolders();
      setNewFolderName('');
      setShowInput(false);
      if (parentFolderId) {
        setExpanded((prev) => ({ ...prev, [parentFolderId]: true }));
      }

      showStatus(`Folder "${cleanName}" created locally and synced.`, 'success');
    } catch (e) {
      if (createdFolderId) {
        try {
          await workspaceApi.deleteFolder(createdFolderId);
        } catch {
          // Best-effort rollback for backend folder creation.
        }
      }

      if (localCreation?.parentHandle) {
        await rollbackLocalFolder(localCreation.parentHandle, cleanName);
      }

      const message = e?.name === 'AbortError'
        ? 'Folder creation canceled. No changes were saved.'
        : (e.message || 'Failed to create folder locally and in backend.');

      showStatus(message, 'error');
      window.alert(message);
    } finally {
      setCreatingFolder(false);
    }
  };

  const renameFolder = async (folder) => {
    const newName = window.prompt('Rename folder', folder.name);
    if (!newName || !newName.trim() || newName.trim() === folder.name) return;

    const trimmedName = newName.trim();
    const validationError = validateFolderName(trimmedName);
    if (validationError) {
      showStatus(validationError, 'error');
      window.alert(validationError);
      return;
    }

    let localRenamed = false;
    try {
      const localRenameResult = await renameFolderOnLocalMachine(folder, trimmedName);
      if (!localRenameResult?.renamed) {
        throw new Error(localRenameResult?.reason || 'Failed to rename local folder');
      }
      localRenamed = true;

      await workspaceApi.renameFolder(folder.id, trimmedName);

      const map = getLocalFolderMap();
      if (map[folder.id]) {
        map[folder.id] = {
          ...map[folder.id],
          folder_name: trimmedName,
          updated_at: new Date().toISOString(),
        };
        setLocalFolderMap(map);
      }

      await loadFolders();
      setStatusMessage('');
    } catch (e) {
      if (localRenamed) {
        try {
          await renameFolderOnLocalMachine({ ...folder, name: trimmedName }, folder.name);
        } catch {
          // Best-effort rollback if backend rename fails.
        }
      }
      window.alert(e.message || 'Failed to rename folder');
    }
  };

  const removeFolder = async (folder) => {
    if (!window.confirm(`Delete "${folder.name}" and all nested folders/files?`)) return;

    const collectFolderIds = (node) => {
      const ids = [node.id];
      (node.children || []).forEach((child) => {
        ids.push(...collectFolderIds(child));
      });
      return ids;
    };

    try {
      let preselectedParentHandle = null;

      // Preflight permission request while this click still has user activation.
      try {
        const record = await getFolderHandleBinding(folder.id);
        if (record?.parentHandle) {
          await ensureReadWritePermission(record.parentHandle, { requestIfNeeded: true });
          preselectedParentHandle = record.parentHandle;
        } else if (!record?.parentHandle) {
          // Fallback for older bindings that only stored child folder handles.
          preselectedParentHandle = await pickDirectoryHandle();
          const granted = await ensureReadWritePermission(preselectedParentHandle);
          if (!granted) {
            preselectedParentHandle = null;
          }
        }
      } catch {
        // Best-effort preflight only.
      }

      await workspaceApi.deleteFolder(folder.id);
      let localDeleteIssue = null;
      try {
        const localDeleteResult = await removeFolderFromLocalMachine(folder, {
          requestIfNeeded: false,
          preselectedParentHandle,
        });
        if (!localDeleteResult?.removed && localDeleteResult?.code !== 'NOT_FOUND') {
          localDeleteIssue = localDeleteResult?.reason || 'Local folder deletion failed.';
        }
      } catch (localErr) {
        localDeleteIssue = localErr?.message || 'Local folder deletion failed.';
      }

      const folderIds = collectFolderIds(folder);
      await Promise.all(folderIds.map((id) => deleteFolderHandleBinding(id)));

      if (onFolderDelete) onFolderDelete(folder.name);
      if (selectedFolder?.id === folder.id) onSelectFolder(null);
      await loadFolders();

      if (localDeleteIssue) {
        window.alert(`Folder deleted from app, but local deletion needs attention: ${localDeleteIssue}`);
      }
    } catch (e) {
      window.alert(e.message || 'Failed to delete folder');
    }
  };

  const handleFolderDragOver = (e, folderId) => {
    // Only highlight folder as drop target for folder-move drags, not quiz-file drags
    if (e.dataTransfer.types.includes('neuranote-quiz-file')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(folderId);
  };

  const handleFolderDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
  };

  const handleFolderDrop = async (e, targetFolderId) => {
    // Don't intercept quiz-file drags — let them bubble to the quiz dropzone
    if (e.dataTransfer.types.includes('neuranote-quiz-file')) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    try {
      const dragData = e.dataTransfer.getData('application/json');
      if (!dragData) return;

      const { fileId, sourceFolderId } = JSON.parse(dragData);
      if (!fileId || !targetFolderId || fileId === targetFolderId) return;

      // Prevent moving to the same folder
      if (sourceFolderId === targetFolderId) {
        showStatus('File is already in this folder', 'info');
        return;
      }

      setIsMovingFile(true);
      showStatus('Moving file...', 'info');

      // Call the backend to move the file
      await workspaceApi.moveFile(fileId, targetFolderId);

      showStatus('File moved successfully!', 'success');
      
      // Reload files for both source and target folders
      await Promise.all([
        loadFolderFiles(sourceFolderId, { force: true }),
        loadFolderFiles(targetFolderId, { force: true }),
      ]);

      // Dispatch event for file manager to refresh
      window.dispatchEvent(new Event('neuranote:files-updated'));
    } catch (err) {
      console.error('Error moving file:', err);
      showStatus(`Error moving file: ${err.message}`, 'error');
    } finally {
      setIsMovingFile(false);
    }
  };

  const renderFolder = (folder, depth = 0) => {
    const hasChildren = !!folder.children?.length;
    const isExpanded = !!expanded[folder.id];
    const folderFiles = filesByFolder[folder.id] || [];
    const isFilesLoading = !!filesLoadingByFolder[folder.id];
    const isDragOver = dragOverFolderId === folder.id;

    const renderFileNode = (fileNode, fileDepth = 0) => {
      const isPdf = String(fileNode.file_type || '').toUpperCase() === 'PDF';
      // Track whether a drag started so click doesn't also fire on drag-end
      let isDraggingNode = false;

      return (
        <div key={fileNode.id}>
          <div
            draggable={true}
            onDragStart={(e) => {
              isDraggingNode = true;
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('application/json', JSON.stringify({
                fileId: fileNode.id,
                fileName: fileNode.name,
                fileType: fileNode.file_type,
                sourceFolderId: folder.id,
              }));
              // Also expose as quiz-droppable payload so QuizHomePage dropzone can accept it
              e.dataTransfer.setData('neuranote-quiz-file', JSON.stringify({
                fileId: fileNode.id,
                fileName: fileNode.name,
                fileType: fileNode.file_type,
                fileUrl: fileNode.fileUrl || null,
                content: fileNode.content || null,
                folderId: folder.id,
              }));
              e.currentTarget.style.opacity = '0.5';
            }}
            onDragEnd={(e) => {
              e.currentTarget.style.opacity = '1';
              isDraggingNode = false;
            }}
            onClick={() => {
              // Don't fire click if this was a drag gesture
              if (isDraggingNode) { isDraggingNode = false; return; }
              if (onSelectFile) {
                onSelectFile({
                  ...fileNode,
                  type: fileNode.file_type || 'FILE',
                  folderId: folder.id,
                  backendFile: true,
                });
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '7px 16px',
              paddingLeft: `${40 + (depth + fileDepth) * 14}px`,
              color: '#555',
              fontSize: '13px',
              cursor: 'grab',
              userSelect: 'none',
            }}
          >
            {isPdf ? <FileText size={14} color="#7b61ff" /> : <File size={14} color="#999" />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileNode.name}</span>
          </div>
          {fileNode.children?.length > 0 && fileNode.children.map((child) => renderFileNode(child, fileDepth + 1))}
        </div>
      );
    };

    return (
      <div key={folder.id}>
        <div
          onDragOver={(e) => handleFolderDragOver(e, folder.id)}
          onDragLeave={handleFolderDragLeave}
          onDrop={(e) => handleFolderDrop(e, folder.id)}
          onClick={() => {
            if (hasChildren) {
              toggleExpand(folder.id);
            }
            onSelectFolder(folder);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 16px', paddingLeft: `${16 + depth * 14}px`, cursor: 'pointer',
            backgroundColor: isDragOver ? '#e8deff' : selectedFolder?.id === folder.id ? '#f0eeff' : 'transparent',
            borderLeft: selectedFolder?.id === folder.id ? '3px solid #6C5DD3' : '3px solid transparent',
            transition: 'background-color 150ms',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(folder.id);
            }}
            style={{
              width: 18,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
            title={isExpanded ? 'Collapse folder' : 'Expand folder'}
          >
            {isExpanded ? <ChevronDown size={14} color="#888" /> : <ChevronRight size={14} color="#888" />}
          </button>
          <Folder size={16} color={isDragOver ? '#7c3aed' : '#6C5DD3'} style={{ transition: 'color 150ms' }} />
          <span style={{ flex: 1, fontSize: '14px', color: '#1a1a2e', fontWeight: isDragOver ? 600 : 400 }}>{folder.name}</span>
          <button onClick={(e) => { e.stopPropagation(); addFolder(folder.id); }} disabled={creatingFolder || isMovingFile} style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: isMovingFile ? 0.5 : 1 }}>
            <FolderPlus size={13} color="#888" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); renameFolder(folder); }} disabled={isMovingFile} style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: isMovingFile ? 0.5 : 1 }}>
            <Pencil size={13} color="#888" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); removeFolder(folder); }} disabled={isMovingFile} style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: isMovingFile ? 0.5 : 1 }}>
            <Trash2 size={13} color="#d14343" />
          </button>
        </div>

        {isExpanded && (
          <>
            {hasChildren && folder.children.map((child) => renderFolder(child, depth + 1))}

            {isFilesLoading ? (
              <div style={{ padding: '6px 16px', paddingLeft: `${40 + depth * 14}px`, color: '#999', fontSize: '12px' }}>
                Loading files...
              </div>
            ) : folderFiles.length > 0 ? (
              folderFiles.map((fileNode) => renderFileNode(fileNode))
            ) : (
              <div style={{ padding: '6px 16px', paddingLeft: `${40 + depth * 14}px`, color: '#999', fontSize: '12px' }}>
                No files in this folder
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{
      width: '280px',
      margin: '16px 0 16px 8px',
      backgroundColor: theme.colors.bg.secondary,
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0',
      boxShadow: theme.isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.08)',
      height: 'calc(100vh - 32px)',
      overflowY: 'auto',
      transition: 'background-color 0.3s, box-shadow 0.3s',
    }}>

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
        </div>
      </div>

      {showInput && (
        <div style={{ padding: '10px 16px', display: 'flex', gap: '8px' }}>
          <input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Folder name..."
            onKeyDown={e => e.key === 'Enter' && addFolder(null)}
            autoFocus
            disabled={creatingFolder}
            style={{
              flex: 1, padding: '6px 10px', borderRadius: '8px',
              border: '1px solid #ddd', fontSize: '13px', outline: 'none'
            }}
          />
          <button onClick={() => addFolder(null)} disabled={creatingFolder} style={{
            backgroundColor: '#6C5DD3', color: 'white', border: 'none',
            borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '13px'
          }}>{creatingFolder ? '...' : 'Add'}</button>
        </div>
      )}

      {statusMessage && (
        <p
          style={{
            margin: 0,
            padding: '6px 16px 0',
            fontSize: '12px',
            color: statusType === 'error' ? '#d14343' : statusType === 'success' ? '#1c7c45' : '#6b7280',
          }}
        >
          {statusMessage}
        </p>
      )}

      <p style={{ padding: '12px 16px 6px', fontSize: '11px', color: '#aaa', fontWeight: '600', margin: 0, letterSpacing: '0.5px' }}>
        FOLDER ORGANIZATION
      </p>

      {loading && <p style={{ padding: '8px 16px', color: '#999', fontSize: '12px' }}>Loading folders...</p>}
      {error && <p style={{ padding: '8px 16px', color: '#d14343', fontSize: '12px' }}>{error}</p>}
      {!loading && !error && folders.map(folder => renderFolder(folder))}
    </div>
  );
};

export default FolderPanel;