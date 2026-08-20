import React, { useEffect, useState } from 'react';
import { Upload, FileText, File, Trash2 } from 'lucide-react';
import { workspaceApi } from '@/services/workspaceApi';
import { saveFileToLocalFolder, removeFileFromLocalFolder } from '@/utils/localFsSync';
import { useTheme } from '@/context/ThemeContext';
import { getScopedStorageKey, useSupabaseUser } from '@/hooks/useSupabaseUser';

const LOCAL_FOLDER_MAP_KEY = 'neuranote_local_folder_map';

const readFileAsText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result || '');
  reader.onerror = () => reject(new Error('Unable to read text file'));
  reader.readAsText(file);
});

const hasKnownLocalFolderBinding = (folderId, storageKey) => {
  try {
    const map = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return Boolean(map?.[String(folderId)] || map?.[folderId]);
  } catch {
    return false;
  }
};

const inferFileType = (file) => {
  const declared = String(file.file_type || '').trim();
  if (declared) return declared.toUpperCase();

  const mime = String(file.mime_type || '').toLowerCase();
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('text/')) return 'TXT';

  const name = String(file.original_filename || file.name || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'PDF';
  if (name.endsWith('.txt') || name.endsWith('.md')) return 'TXT';
  if (name.endsWith('.docx')) return 'DOCX';
  if (name.endsWith('.doc')) return 'DOC';
  if (name.endsWith('.png')) return 'PNG';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'JPG';

  return 'FILE';
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

const buildFileTree = (files) => {
  const lookup = {};
  const roots = [];

  files.forEach((file) => {
    lookup[file.id] = { ...file, children: [] };
  });

  Object.values(lookup).forEach((file) => {
    if (file.parentFileId && lookup[file.parentFileId]) {
      lookup[file.parentFileId].children.push(file);
    } else {
      roots.push(file);
    }
  });

  return roots;
};

const buildContentLookup = (nodes, lookup = {}) => {
  (nodes || []).forEach((node) => {
    if (!node?.id) return;
    const cachedContent = node.content ?? node.file_content;
    if (typeof cachedContent === 'string' && cachedContent.trim() !== '') {
      lookup[String(node.id)] = cachedContent;
    }
    if (node.children?.length) {
      buildContentLookup(node.children, lookup);
    }
  });
  return lookup;
};

const findFileInTreeById = (nodes, targetId) => {
  for (const node of nodes || []) {
    if (String(node?.id) === String(targetId)) {
      return node;
    }
    if (node?.children?.length) {
      const nested = findFileInTreeById(node.children, targetId);
      if (nested) return nested;
    }
  }
  return null;
};

const FileList = ({ selectedFolder, files, onSelectFile, onFilesUpdate }) => {
  const { theme, isDark } = useTheme();
  const { userScope, loading: userLoading } = useSupabaseUser();
  const [folderFiles, setFolderFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [error, setError] = useState('');
  const [dragOverFileId, setDragOverFileId] = useState(null);
  const [isMoving, setIsMoving] = useState(false);
  const localFolderMapKey = getScopedStorageKey(LOCAL_FOLDER_MAP_KEY, userScope);

  const loadFiles = async () => {
    if (userLoading) {
      return;
    }

    if (!selectedFolder?.id) {
      setFolderFiles([]);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const data = await workspaceApi.getFiles(selectedFolder.id);
      const cachedNodes = files?.[selectedFolder?.name] || [];
      const cachedContentById = buildContentLookup(cachedNodes);
      const normalizedWithTypes = (data.files || []).map((f) => {
        const computedType = inferFileType(f);
        const resolvedPayload = resolveTextPayload(f);
        const inlineAsset = typeof resolvedPayload === 'string' && resolvedPayload.startsWith('data:')
          ? resolvedPayload
          : null;
        const persistedTextContent =
          inlineAsset
            ? null
            : (resolvedPayload ?? cachedContentById[String(f.id)] ?? null);
        return {
          id: f.id,
          name: f.name || f.original_filename,
          originalFilename: f.original_filename,
          folderId: f.folder_id,
          parentFileId: f.parent_file_id,
          date: new Date(f.created_at || Date.now()).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          type: computedType,
          // Do NOT pass raw S3 object keys (workspace/...) as fileUrl.
          // They are not loadable URLs. Leave null so the preview useEffect
          // calls the backend to get a fresh signed URL.
          fileUrl: null,
          storagePath: f.storage_path,
          content: persistedTextContent,
          mimeType: f.mime_type,
          isParentPDF: computedType === 'PDF',
          backendFile: true,
          children: [],
        };
      });
      const tree = buildFileTree(normalizedWithTypes);
      setFolderFiles(tree);
      if (onFilesUpdate) {
        onFilesUpdate((prevFiles) => {
          const updatedFiles = { ...(prevFiles || {}) };
          updatedFiles[selectedFolder.name] = tree;
          return updatedFiles;
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userLoading) {
      return;
    }

    const cached = files?.[selectedFolder?.name];
    if (Array.isArray(cached)) {
      setFolderFiles(cached);
    }
  }, [files, selectedFolder?.name, userLoading]);

  useEffect(() => {
    if (userLoading) {
      return;
    }

    loadFiles();
  }, [selectedFolder?.id, userLoading, userScope]);

  const processFileUpload = async (file) => {
    if (!file || !selectedFolder?.id) return;

    setIsUploading(true);
    setError('');
    setUploadSuccess('');
    setUploadProgress(0);
    try {
      const forcePickerFirst = !hasKnownLocalFolderBinding(selectedFolder.id, localFolderMapKey);
      let localSyncWarning = '';

      // Keep local machine, backend, and UI in sync: local save first.
      // If we do not have a known binding yet, force picker immediately from this user gesture.
      try {
        await saveFileToLocalFolder(selectedFolder, file, { forcePickerFirst });
      } catch (localSyncError) {
        console.warn('Local folder sync skipped:', localSyncError);
        localSyncWarning = ' Local device sync was skipped; file is still saved to workspace.';
      }
      const isTextFile = (file.type || '').startsWith('text/') || /\.(txt|md|csv|json|log)$/i.test(file.name);
      const fileContent = isTextFile ? await readFileAsText(file) : null;

      const uploadResult = await workspaceApi.uploadFile(selectedFolder.id, file, (progress) => {
        setUploadProgress(progress);
      });
      const uploadedFile = uploadResult?.file || uploadResult;
      const uploadedType = inferFileType({
        ...uploadedFile,
        mime_type: file.type,
        original_filename: uploadedFile?.original_filename || file.name,
      });

      if (onFilesUpdate) {
        onFilesUpdate((prevFiles) => {
          const updatedFiles = { ...(prevFiles || {}) };
          const folderKey = selectedFolder.name;
          const nextFile = {
            id: uploadedFile.id,
            name: uploadedFile.name || file.name,
            originalFilename: uploadedFile.original_filename || file.name,
            folderId: selectedFolder.id,
            date: new Date(uploadedFile.created_at || Date.now()).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            type: uploadedType,
            // Do NOT pass raw S3 object keys as fileUrl - leave null so preview API is called.
            fileUrl: null,
            storagePath: uploadedFile.storage_path,
            content: fileContent,
            mimeType: file.type || null,
            backendFile: true,
            isParentPDF: uploadedType === 'PDF',
            children: [],
            folderName: folderKey,
          };

          updatedFiles[folderKey] = [...(updatedFiles[folderKey] || []), nextFile];
          return updatedFiles;
        });

        onSelectFile?.({
          id: uploadedFile.id,
          name: uploadedFile.name || file.name,
          originalFilename: uploadedFile.original_filename || file.name,
          folderId: selectedFolder.id,
          type: uploadedType,
          // Do NOT pass raw S3 object keys as fileUrl - leave null so preview API is called.
          fileUrl: null,
          storagePath: uploadedFile.storage_path,
          content: fileContent,
          mimeType: file.type || null,
          backendFile: true,
          isParentPDF: uploadedType === 'PDF',
          folderName: selectedFolder.name,
          children: [],
        });
      }

      await loadFiles();
      window.dispatchEvent(new Event('neuranote:files-updated'));
      setUploadSuccess(`Upload complete. File is now visible in this folder.${localSyncWarning}`);
    } catch (err) {
      await removeFileFromLocalFolder(selectedFolder, file?.name);
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      await processFileUpload(file);
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  const removeFileNodeById = (nodes, id) =>
    (nodes || []).reduce((acc, node) => {
      if (String(node.id) === String(id)) return acc;
      return [...acc, { ...node, children: removeFileNodeById(node.children, id) }];
    }, []);

  const handleDelete = async (fileId) => {
    if (!window.confirm('Delete this file? This action cannot be undone.')) return;

    try {
      const targetFile = findFileInTreeById(folderFiles, fileId);
      // Call backend — check if it's a note or file
      if (targetFile?.is_note || targetFile?.type === 'NOTE') {
        await workspaceApi.deleteNote(fileId);
      } else {
        await workspaceApi.deleteFile(fileId);
      }

      // Immediately remove from local folderFiles state (no page refresh needed)
      setFolderFiles((prev) => removeFileNodeById(prev, fileId));

      // Sync removal into parent (FileManagerPage) files state
      if (onFilesUpdate && selectedFolder?.name) {
        onFilesUpdate((prevFiles) => {
          const folderKey = selectedFolder.name;
          const updatedFolder = removeFileNodeById(prevFiles?.[folderKey] || [], fileId);
          return { ...(prevFiles || {}), [folderKey]: updatedFolder };
        });
      }

      // Best-effort: remove local file copy — do NOT let errors here block the UI update
      try {
        await removeFileFromLocalFolder(
          {
            ...selectedFolder,
            name: targetFile?.name,
            originalFilename: targetFile?.originalFilename,
            original_filename: targetFile?.originalFilename,
          },
          targetFile?.originalFilename || targetFile?.name,
        );
      } catch (e) {
        // Ignore local sync errors; file is already deleted from the backend
      }

      await loadFiles();
      window.dispatchEvent(new Event('neuranote:files-updated'));
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      setDragOverFileId('upload-zone');
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverFileId === 'upload-zone') {
      setDragOverFileId(null);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFileId(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (const file of e.dataTransfer.files) {
        await processFileUpload(file);
      }
    }
  };

  if (!selectedFolder) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: theme.colors.text.tertiary }}>
        Select a folder to view files
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: '24px', fontWeight: 700, color: theme.colors.text.primary }}>{selectedFolder.name}</h2>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: isDark ? theme.colors.accentLight : '#1a1a2e',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 10,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          <Upload size={16} /> {isUploading ? 'Uploading...' : 'Upload File'}
          <input hidden type="file" onChange={handleUpload} accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" disabled={isUploading} />
        </label>
      </div>

      {error && <div style={{ marginBottom: 12, color: '#d14343', fontSize: 13 }}>{error}</div>}
      {uploadSuccess && <div style={{ marginBottom: 12, color: '#1c7c45', fontSize: 13 }}>{uploadSuccess}</div>}

      {isUploading && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: theme.colors.text.tertiary, marginBottom: 6 }}>Uploading... {uploadProgress}%</div>
          <div style={{ width: '100%', height: 8, borderRadius: 6, background: theme.colors.ui.hover, overflow: 'hidden' }}>
            <div
              style={{
                width: `${uploadProgress}%`,
                height: '100%',
                background: '#6C5DD3',
                transition: 'width 120ms linear',
              }}
            />
          </div>
        </div>
      )}

      <div
        style={{
          backgroundColor: dragOverFileId === 'upload-zone' ? '#e8deff' : theme.colors.bg.secondary,
          borderRadius: 16,
          boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.35)' : '0 4px 24px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          width: '100%',
          height: 'calc(100vh - 230px)',
          transition: 'background-color 200ms, border 200ms',
          border: dragOverFileId === 'upload-zone' ? '2px dashed #6C5DD3' : `1px solid ${theme.colors.ui.border}`,
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 160px 120px',
            padding: '10px 20px',
            backgroundColor: theme.colors.bg.tertiary,
            borderBottom: `1px solid ${theme.colors.ui.border}`,
            fontSize: 12,
            color: theme.colors.text.tertiary,
            fontWeight: 600,
          }}
        >
          <span>Name</span>
          <span>Date Modified</span>
          <span>Type</span>
        </div>

        {isLoading ? (
          <div style={{ padding: 24, color: theme.colors.text.tertiary }}>Loading files...</div>
        ) : folderFiles.length === 0 ? (
          <div style={{ padding: 24, color: theme.colors.text.tertiary }}>No files in this folder yet.</div>
        ) : (
          folderFiles.map((file) => (
            <FileRow key={file.id} file={file} depth={0} onSelectFile={onSelectFile} onDelete={handleDelete} theme={theme} isDark={isDark} />
          ))
        )}
      </div>
    </div>
  );
};

const FileRow = ({ file, depth, onSelectFile, onDelete, theme, isDark }) => {
  const isPdf = (file.type || '').toUpperCase() === 'PDF';
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e) => {
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      fileId: file.id,
      fileName: file.name,
      fileType: file.file_type || file.mime_type || file.type,
      sourceFolderId: file.folderId,
    }));
    // Use setTimeout so the dragged ghost image doesn't appear 50% transparent initially on some browsers
    setTimeout(() => { e.target.style.opacity = '0.5'; }, 0);
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    e.target.style.opacity = '1';
  };

  return (
    <div>
      <div
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={() => onSelectFile(file)}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 160px 120px',
          alignItems: 'center',
          padding: '12px 20px',
          borderBottom: `1px solid ${theme.colors.ui.border}`,
          cursor: 'pointer',
          paddingLeft: `${20 + depth * 18}px`,
          opacity: isDragging ? 0.5 : 1,
          backgroundColor: isDragging ? theme.colors.ui.hover : 'transparent',
          transition: 'opacity 200ms, background-color 200ms',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {(file.type || '').toUpperCase() === 'PDF' ? <FileText size={16} color={theme.colors.text.secondary} /> : <File size={16} color={theme.colors.text.secondary} />}
          <span style={{ fontSize: 14, color: theme.colors.text.primary }}>{file.name}</span>
        </div>
        <span style={{ fontSize: 13, color: theme.colors.text.tertiary }}>{file.date}</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 12, color: theme.colors.text.secondary }}>{file.type}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isPdf && depth === 0 && <span style={{ fontSize: 11, color: '#6C5DD3', fontWeight: 700 }}>PDF</span>}
            <Trash2
              size={14}
              color="#d14343"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(file.id);
              }}
            />
          </div>
        </div>
      </div>
      {file.children?.length > 0 && file.children.map((child) => (
        <FileRow key={child.id} file={child} depth={depth + 1} onSelectFile={onSelectFile} onDelete={onDelete} theme={theme} isDark={isDark} />
      ))}
    </div>
  );
};

export default FileList;
