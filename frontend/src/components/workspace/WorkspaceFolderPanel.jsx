import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderPlus, Plus, Trash2, Pencil } from 'lucide-react';
import { workspaceApi } from '@/services/workspaceApi';
import { getScopedStorageKey, useSupabaseUser } from '@/hooks/useSupabaseUser';
import { createLocalFolderAndBind, getFolderHandleBinding, pickDirectoryHandle, ensureReadWritePermission } from '@/utils/localFsSync';

const PANEL_WIDTH = 280;
const FOLDERS_STORAGE_KEY = 'neuranote_folders';
const EXPANDED_STORAGE_KEY = 'neuranote_expanded_folders';

function flattenFolders(nodes, output = []) {
  nodes.forEach((node) => {
    output.push(node);
    if (node.children?.length) {
      flattenFolders(node.children, output);
    }
  });
  return output;
}

const WorkspaceFolderPanel = ({ onSelectFolder, selectedFolderId }) => {
  const { userScope, loading: userLoading } = useSupabaseUser();
  const foldersStorageKey = getScopedStorageKey(FOLDERS_STORAGE_KEY, userScope);
  const expandedStorageKey = getScopedStorageKey(EXPANDED_STORAGE_KEY, userScope);
  const [folders, setFolders] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const folderHandleCacheRef = useRef({});

  const allFlatFolders = useMemo(() => flattenFolders([...folders]), [folders]);

  useEffect(() => {
    if (userLoading) return;

    try {
      const savedFolders = localStorage.getItem(foldersStorageKey);
      const savedExpanded = localStorage.getItem(expandedStorageKey);
      setFolders(savedFolders ? JSON.parse(savedFolders) : []);
      setExpanded(savedExpanded ? JSON.parse(savedExpanded) : {});
    } catch {
      setFolders([]);
      setExpanded({});
    }
  }, [expandedStorageKey, foldersStorageKey, userLoading]);

  const loadFolders = async () => {
    if (userLoading) return;

    if (!folders || folders.length === 0) {
      setLoading(true);
    }
    setError('');
    try {
      const data = await workspaceApi.getFolders();
      const nextFolders = data.folders || [];
      setFolders(nextFolders);
      localStorage.setItem(foldersStorageKey, JSON.stringify(nextFolders));
    } catch (err) {
      setError(err.message || 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFolders();
  }, [foldersStorageKey, userLoading, userScope]);

  useEffect(() => {
    if (userLoading) return;

    let active = true;

    const preloadFolderHandles = async () => {
      const cache = {};

      // Flattened folders already includes nested children, so every known folder id can be hydrated here.
      for (const folder of allFlatFolders) {
        if (!folder?.id) continue;
        try {
          const record = await getFolderHandleBinding(folder.id);
          if (!active) return;
          if (record?.handle) {
            cache[String(folder.id)] = record.handle;
          }
        } catch {
          // Best-effort cache warmup only.
        }
      }

      if (active) {
        folderHandleCacheRef.current = cache;
      }
    };

    preloadFolderHandles();

    return () => {
      active = false;
    };
  }, [allFlatFolders, userLoading, userScope]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const newState = { ...prev, [id]: !prev[id] };
      localStorage.setItem(expandedStorageKey, JSON.stringify(newState));
      return newState;
    });
  };

  const rollbackLocalFolder = async (parentHandle, name) => {
    try {
      await parentHandle.removeEntry(name);
    } catch {
      // Ignore rollback failures; folder may contain files or permission may have changed.
    }
  };

  const createFolder = async (parentFolder = null) => {
    const parentFolderId = parentFolder?.id || null;
    let preselectedParentHandle = null;

    if (!parentFolderId) {
      preselectedParentHandle = await pickDirectoryHandle();
      const granted = await ensureReadWritePermission(preselectedParentHandle);
      if (!granted) {
        throw new Error('Permission denied for selected local directory.');
      }
    }

    const name = window.prompt(parentFolderId ? 'Enter subfolder name' : 'Enter folder name');
    if (!name || !name.trim()) return;

    const cleanName = name.trim();

    let localCreation = null;
    let createdFolderId = null;
    try {
      if (parentFolderId) {
        const parentHandle = folderHandleCacheRef.current[String(parentFolderId)];
        if (!parentHandle) {
          throw new Error('Local folder handle is not ready yet. Please open the parent folder once and try again.');
        }

        const created = await workspaceApi.createFolder(cleanName, parentFolderId);
        const createdFolder = created?.folder;
        if (!createdFolder?.id) {
          throw new Error('Folder was not created in backend.');
        }
        createdFolderId = createdFolder.id;

        localCreation = await createLocalFolderAndBind({
          folderId: createdFolder.id,
          folderName: cleanName,
          parentFolder: { id: parentFolderId, name: parentFolder?.name || 'Folder' },
          parentHandle,
        });
      } else {
        const created = await workspaceApi.createFolder(cleanName, null);
        const createdFolder = created?.folder;
        if (!createdFolder?.id) {
          throw new Error('Folder was not created in backend.');
        }
        createdFolderId = createdFolder.id;

        localCreation = await createLocalFolderAndBind({
          folderId: createdFolder.id,
          folderName: cleanName,
          parentHandle: preselectedParentHandle,
        });
      }

      await loadFolders();

      if (parentFolderId) {
        setExpanded((prev) => {
          const newState = { ...prev, [parentFolderId]: true };
          localStorage.setItem(expandedStorageKey, JSON.stringify(newState));
          return newState;
        });
      }
    } catch (err) {
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

      window.alert(
        err?.name === 'AbortError'
          ? 'Folder creation cancelled.'
          : err.message || 'Failed to create folder locally and in workspace.'
      );
    }
  };

  const renameFolder = async (folder) => {
    const newName = window.prompt('Rename folder', folder.name);
    if (!newName || !newName.trim() || newName.trim() === folder.name) return;
    try {
      await workspaceApi.renameFolder(folder.id, newName.trim());
      await loadFolders();
    } catch (err) {
      window.alert(err.message || 'Failed to rename folder');
    }
  };

  const deleteFolder = async (folder) => {
    if (!window.confirm(`Delete folder "${folder.name}" and all nested content?`)) return;
    try {
      await workspaceApi.deleteFolder(folder.id);
      if (selectedFolderId === folder.id) {
        onSelectFolder(null);
      }
      await loadFolders();
    } catch (err) {
      window.alert(err.message || 'Failed to delete folder');
    }
  };

  const renderNode = (folder, depth = 0) => {
    const isExpanded = !!expanded[folder.id];
    const hasChildren = !!folder.children?.length;
    const isActive = selectedFolderId === folder.id;

    return (
      <div key={folder.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 10px',
            paddingLeft: `${12 + depth * 16}px`,
            background: isActive ? '#f0eeff' : 'transparent',
            borderLeft: isActive ? '3px solid #6C5DD3' : '3px solid transparent',
            cursor: 'pointer',
          }}
          onClick={() => onSelectFolder(folder)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) toggleExpand(folder.id);
            }}
            style={{ border: 'none', background: 'transparent', cursor: hasChildren ? 'pointer' : 'default', width: 16 }}
          >
            {hasChildren ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
          </button>
          <Folder size={16} color="#6C5DD3" />
          <span style={{ fontSize: 13, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{folder.name}</span>
          <button onClick={(e) => { e.stopPropagation(); createFolder(folder); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} title="Add subfolder">
            <FolderPlus size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); renameFolder(folder); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} title="Rename folder">
            <Pencil size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); deleteFolder(folder); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#d14343' }} title="Delete folder">
            <Trash2 size={14} />
          </button>
        </div>
        {hasChildren && isExpanded && folder.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <aside
      style={{
        width: PANEL_WIDTH,
        minWidth: PANEL_WIDTH,
        background: '#ffffff',
        borderRight: '1px solid #ececec',
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Workspace Folders</h3>
        <button onClick={() => createFolder(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} title="Create folder">
          <Plus size={18} color="#6C5DD3" />
        </button>
      </div>

      {loading && folders.length === 0 && <p style={{ padding: 12, margin: 0, fontSize: 13, color: '#888' }}>Loading folders...</p>}
      {error && <p style={{ padding: 12, margin: 0, fontSize: 13, color: '#d14343' }}>{error}</p>}
      {!loading && !error && folders.length === 0 && (
        <p style={{ padding: 12, margin: 0, fontSize: 13, color: '#888' }}>No folders yet. Create one to start organizing files.</p>
      )}

      {folders.map((folder) => renderNode(folder))}

      {/* Hidden metadata in case parent layouts need all folders later */}
      <div style={{ display: 'none' }} data-folder-count={allFlatFolders.length} />
    </aside>
  );
};

export default WorkspaceFolderPanel;
