import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderPlus, Plus, Trash2, Pencil } from 'lucide-react';
import { workspaceApi } from '@/services/workspaceApi';

const PANEL_WIDTH = 280;

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
  const [folders, setFolders] = useState(() => {
    try {
      const saved = localStorage.getItem('neuranote_folders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [expanded, setExpanded] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('neuranote_expanded_folders') || '{}');
    } catch {
      return {};
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const allFlatFolders = useMemo(() => flattenFolders([...folders]), [folders]);

  const loadFolders = async () => {
    if (!folders || folders.length === 0) {
      setLoading(true);
    }
    setError('');
    try {
      const data = await workspaceApi.getFolders();
      const nextFolders = data.folders || [];
      setFolders(nextFolders);
      localStorage.setItem('neuranote_folders', JSON.stringify(nextFolders));
    } catch (err) {
      setError(err.message || 'Failed to load folders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFolders();
  }, []);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const newState = { ...prev, [id]: !prev[id] };
      localStorage.setItem('neuranote_expanded_folders', JSON.stringify(newState));
      return newState;
    });
  };

  const createLocalFolder = async (name) => {
    if (typeof window.showDirectoryPicker !== 'function') {
      throw new Error('Local folder creation is only supported in Chromium-based browsers (Edge/Chrome).');
    }

    const parentHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });

    const childHandle = await parentHandle.getDirectoryHandle(name, { create: true });
    return { parentHandle, childHandle };
  };

  const rollbackLocalFolder = async (parentHandle, name) => {
    try {
      await parentHandle.removeEntry(name);
    } catch {
      // Ignore rollback failures; folder may contain files or permission may have changed.
    }
  };

  const createFolder = async (parentFolderId = null) => {
    const name = window.prompt(parentFolderId ? 'Enter subfolder name' : 'Enter folder name');
    if (!name || !name.trim()) return;

    const cleanName = name.trim();

    let localCreation = null;
    try {
      localCreation = await createLocalFolder(cleanName);

      await workspaceApi.createFolder(cleanName, parentFolderId);
      await loadFolders();

      if (parentFolderId) {
        setExpanded((prev) => {
          const newState = { ...prev, [parentFolderId]: true };
          localStorage.setItem('neuranote_expanded_folders', JSON.stringify(newState));
          return newState;
        });
      }
    } catch (err) {
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
          <button onClick={(e) => { e.stopPropagation(); createFolder(folder.id); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} title="Add subfolder">
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
