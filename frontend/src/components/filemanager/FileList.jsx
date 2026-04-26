import React, { useEffect, useState } from 'react';
import { Upload, FileText, File, Trash2 } from 'lucide-react';
import { workspaceApi } from '@/services/workspaceApi';
import { saveFileToLocalFolder, removeFileFromLocalFolder } from '@/utils/localFsSync';

const LOCAL_FOLDER_MAP_KEY = 'neuranote_local_folder_map';

const readFileAsText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result || '');
  reader.onerror = () => reject(new Error('Unable to read text file'));
  reader.readAsText(file);
});

const hasKnownLocalFolderBinding = (folderId) => {
  try {
    const map = JSON.parse(localStorage.getItem(LOCAL_FOLDER_MAP_KEY) || '{}');
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
  const [folderFiles, setFolderFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [error, setError] = useState('');
  const [dragOverFileId, setDragOverFileId] = useState(null);
  const [isMoving, setIsMoving] = useState(false);

  const loadFiles = async () => {
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
          fileUrl: f.storage_url || inlineAsset,
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
    const cached = files?.[selectedFolder?.name];
    if (Array.isArray(cached)) {
      setFolderFiles(cached);
    }
  }, [files, selectedFolder?.name]);

  useEffect(() => {
    loadFiles();
  }, [selectedFolder?.id]);

  const processFileUpload = async (file) => {
    if (!file || !selectedFolder?.id) return;

    setIsUploading(true);
    setError('');
    setUploadSuccess('');
    setUploadProgress(0);
    try {
      const forcePickerFirst = !hasKnownLocalFolderBinding(selectedFolder.id);
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
            fileUrl: uploadedFile.storage_url || null,
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
          fileUrl: uploadedFile.storage_url || null,
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

  const handleDelete = async (fileId) => {
    if (!window.confirm('Delete this file? This action cannot be undone.')) return;

    try {
      const targetFile = findFileInTreeById(folderFiles, fileId);
      await workspaceApi.deleteFile(fileId);
      await removeFileFromLocalFolder(
        {
          ...selectedFolder,
          name: targetFile?.name,
          originalFilename: targetFile?.originalFilename,
          original_filename: targetFile?.originalFilename,
        },
        targetFile?.originalFilename || targetFile?.name,
      );
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
        Select a folder to view files
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: '24px', fontWeight: 700, color: '#1a1a2e' }}>{selectedFolder.name}</h2>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: '#1a1a2e',
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
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Uploading... {uploadProgress}%</div>
          <div style={{ width: '100%', height: 8, borderRadius: 6, background: '#ececec', overflow: 'hidden' }}>
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
          backgroundColor: dragOverFileId === 'upload-zone' ? '#e8deff' : 'rgba(255,255,255,0.92)',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          width: '100%',
          height: 'calc(100vh - 230px)',
          transition: 'background-color 200ms, border 200ms',
          border: dragOverFileId === 'upload-zone' ? '2px dashed #6C5DD3' : '2px solid transparent',
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
            backgroundColor: '#fafafa',
            borderBottom: '1px solid #f0f0f0',
            fontSize: 12,
            color: '#999',
            fontWeight: 600,
          }}
        >
          <span>Name</span>
          <span>Date Modified</span>
          <span>Type</span>
        </div>

        {isLoading ? (
          <div style={{ padding: 24, color: '#777' }}>Loading files...</div>
        ) : folderFiles.length === 0 ? (
          <div style={{ padding: 24, color: '#999' }}>No files in this folder yet.</div>
        ) : (
          folderFiles.map((file) => (
            <FileRow key={file.id} file={file} depth={0} onSelectFile={onSelectFile} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
};

const FileRow = ({ file, depth, onSelectFile, onDelete }) => {
  const isPdf = (file.type || '').toUpperCase() === 'PDF';
  const [isDragging, setIsDragging] = useState(false);
  const mouseDownPos = React.useRef(null);

  const handleMouseDown = (e) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.draggable = false;
  };

  const handleMouseMove = (e) => {
    if (!mouseDownPos.current) return;
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    if (dx > 5 || dy > 5) {
      e.currentTarget.draggable = true;
    }
  };

  const handleMouseUp = (e) => {
    mouseDownPos.current = null;
    e.currentTarget.draggable = false;
  };

  const handleDragStart = (e) => {
    if (!e.currentTarget.draggable) {
      e.preventDefault();
      return;
    }
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      fileId: file.id,
      fileName: file.name,
      fileType: file.file_type || file.mime_type || file.type,
      sourceFolderId: file.folderId,
    }));
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    mouseDownPos.current = null;
    e.currentTarget.style.opacity = '1';
    e.currentTarget.draggable = false;
  };

  return (
    <div>
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={() => onSelectFile(file)}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 160px 120px',
          alignItems: 'center',
          padding: '12px 20px',
          borderBottom: '1px solid #f2f2f2',
          cursor: 'pointer',
          paddingLeft: `${20 + depth * 18}px`,
          opacity: isDragging ? 0.5 : 1,
          backgroundColor: isDragging ? '#f9f9f9' : 'transparent',
          transition: 'opacity 200ms, background-color 200ms',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {(file.type || '').toUpperCase() === 'PDF' ? <FileText size={16} color="#555" /> : <File size={16} color="#555" />}
          <span style={{ fontSize: 14, color: '#1a1a2e' }}>{file.name}</span>
        </div>
        <span style={{ fontSize: 13, color: '#999' }}>{file.date}</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#666' }}>{file.type}</span>
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
        <FileRow key={child.id} file={child} depth={depth + 1} onSelectFile={onSelectFile} onDelete={onDelete} />
      ))}
    </div>
  );
};

export default FileList;
