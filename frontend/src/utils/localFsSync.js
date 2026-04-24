const DB_NAME = 'neuranote_local_fs';
const DB_VERSION = 1;
const STORE_NAME = 'folder_handles';

const openDb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'folderId' });
    }
  };

  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
});

const withStore = async (mode, action) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = action(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB operation failed'));
  });
};

export const isLocalFsSupported = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

export const saveFolderHandleBinding = async (folderId, handle, metadata = {}, parentHandle = null) => {
  if (!folderId || !handle) return;
  await withStore('readwrite', (store) => store.put({
    folderId: String(folderId),
    handle,
    parentHandle,
    metadata,
    updatedAt: Date.now(),
  }));
};

export const getFolderHandleBinding = async (folderId) => {
  if (!folderId) return null;
  const record = await withStore('readonly', (store) => store.get(String(folderId)));
  return record || null;
};

export const deleteFolderHandleBinding = async (folderId) => {
  if (!folderId) return;
  await withStore('readwrite', (store) => store.delete(String(folderId)));
};

export const ensureReadWritePermission = async (handle, options = {}) => {
  if (!handle) return false;

  const requestIfNeeded = options.requestIfNeeded !== false;

  const readState = await handle.queryPermission?.({ mode: 'readwrite' });
  if (readState === 'granted') {
    return true;
  }

  if (!requestIfNeeded) {
    return false;
  }

  try {
    const requestState = await handle.requestPermission?.({ mode: 'readwrite' });
    return requestState === 'granted';
  } catch {
    return false;
  }
};

export const pickDirectoryHandle = async () => {
  if (!isLocalFsSupported()) {
    throw new Error('Local folder access is not supported in this browser. Use latest Edge or Chrome.');
  }

  return window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
};

export const getOrBindFolderHandle = async (folder) => {
  if (!folder?.id) {
    throw new Error('Folder information is required to access local storage.');
  }

  const existing = await getFolderHandleBinding(folder.id);
  if (existing?.handle && await ensureReadWritePermission(existing.handle)) {
    return existing.handle;
  }

  const picked = await pickDirectoryHandle();
  const granted = await ensureReadWritePermission(picked);
  if (!granted) {
    throw new Error('Permission denied for selected local folder.');
  }

  await saveFolderHandleBinding(folder.id, picked, {
    folderName: folder.name,
    parentFolderId: folder.parent_folder_id || folder.parent_id || null,
  });

  return picked;
};

export const bindFolderHandleFromUserGesture = async (folder) => {
  if (!folder?.id) {
    throw new Error('Folder information is required to bind local storage.');
  }

  const picked = await pickDirectoryHandle();
  const granted = await ensureReadWritePermission(picked);
  if (!granted) {
    throw new Error('Permission denied for selected local folder.');
  }

  await saveFolderHandleBinding(folder.id, picked, {
    folderName: folder.name,
    parentFolderId: folder.parent_folder_id || folder.parent_id || null,
  });

  return picked;
};

export const createLocalFolderAndBind = async ({ folderId, folderName, parentFolder, parentHandle = null }) => {
  if (!folderId || !folderName) {
    throw new Error('Folder id and name are required for local folder binding.');
  }

  let resolvedParentHandle = parentHandle;
  if (!resolvedParentHandle && parentFolder?.id) {
    const parentRecord = await getFolderHandleBinding(parentFolder.id);
    if (parentRecord?.handle && await ensureReadWritePermission(parentRecord.handle)) {
      resolvedParentHandle = parentRecord.handle;
    } else {
      resolvedParentHandle = await pickDirectoryHandle();
      const granted = await ensureReadWritePermission(resolvedParentHandle);
      if (!granted) {
        throw new Error('Permission denied for local parent folder.');
      }
      await saveFolderHandleBinding(parentFolder.id, resolvedParentHandle, {
        folderName: parentFolder.name,
        parentFolderId: parentFolder.parent_folder_id || parentFolder.parent_id || null,
      });
    }
  } else if (!resolvedParentHandle) {
    resolvedParentHandle = await pickDirectoryHandle();
    const granted = await ensureReadWritePermission(resolvedParentHandle);
    if (!granted) {
      throw new Error('Permission denied for selected local directory.');
    }
  }

  const childHandle = await resolvedParentHandle.getDirectoryHandle(folderName, { create: true });

  await saveFolderHandleBinding(folderId, childHandle, {
    folderName,
    parentFolderId: parentFolder?.id || null,
  }, resolvedParentHandle);

  return { parentHandle: resolvedParentHandle, childHandle };
};

export const saveFileToLocalFolder = async (folder, file, options = {}) => {
  if (!folder?.id) {
    throw new Error('A valid folder must be selected for local save.');
  }
  if (!file) {
    throw new Error('No file selected for local save.');
  }

  const folderHandle = options?.forcePickerFirst
    ? await bindFolderHandleFromUserGesture(folder)
    : await getOrBindFolderHandle(folder);
  const fileHandle = await folderHandle.getFileHandle(file.name, { create: true });
  const writable = await fileHandle.createWritable();

  try {
    const data = await file.arrayBuffer();
    await writable.write(data);
  } finally {
    await writable.close();
  }
};

export const removeFileFromLocalFolder = async (folder, fileName) => {
  if (!folder?.id || !fileName) return;

  try {
    const record = await getFolderHandleBinding(folder.id);
    if (!record?.handle) return;
    if (!(await ensureReadWritePermission(record.handle))) return;
    await record.handle.removeEntry(fileName);
  } catch {
    // Best-effort rollback only.
  }
};

export const removeFolderFromLocalMachine = async (folder, options = {}) => {
  if (!folder?.id) return { removed: false, reason: 'Missing folder id' };

  const record = await getFolderHandleBinding(folder.id);
  if (!record?.handle) {
    return { removed: false, reason: 'No local folder binding found', code: 'NO_BINDING' };
  }

  const folderName = folder.name || record.metadata?.folderName || record.handle.name;
  const parentFolderId = folder.parent_folder_id || folder.parent_id || record.metadata?.parentFolderId || null;
  const requestIfNeeded = options.requestIfNeeded !== false;

  let parentHandle = options.preselectedParentHandle || record.parentHandle || null;
  if (parentHandle && !(await ensureReadWritePermission(parentHandle, { requestIfNeeded }))) {
    return { removed: false, reason: 'Permission denied for selected parent directory', code: 'PERMISSION_DENIED' };
  }

  if (parentFolderId) {
    const parentRecord = await getFolderHandleBinding(parentFolderId);
    if (parentRecord?.handle && await ensureReadWritePermission(parentRecord.handle, { requestIfNeeded })) {
      parentHandle = parentRecord.handle;
    }
  }

  if (!parentHandle) {
    return {
      removed: false,
      reason: 'Missing parent directory handle for local deletion',
      code: 'MISSING_PARENT_HANDLE',
    };
  }

  try {
    await parentHandle.removeEntry(folderName, { recursive: true });
  } catch (error) {
    if (error?.name === 'NotFoundError') {
      await deleteFolderHandleBinding(folder.id);
      return { removed: true, skipped: true, reason: 'Folder already missing locally', code: 'NOT_FOUND' };
    }
    throw error;
  }

  await deleteFolderHandleBinding(folder.id);
  return { removed: true };
};

const copyDirectoryContents = async (sourceDirHandle, targetDirHandle) => {
  // Clone all files/subfolders so rename works in browsers without native move support.
  // eslint-disable-next-line no-restricted-syntax
  for await (const [entryName, entryHandle] of sourceDirHandle.entries()) {
    if (entryHandle.kind === 'file') {
      const sourceFile = await entryHandle.getFile();
      const targetFileHandle = await targetDirHandle.getFileHandle(entryName, { create: true });
      const writable = await targetFileHandle.createWritable();
      try {
        await writable.write(await sourceFile.arrayBuffer());
      } finally {
        await writable.close();
      }
    } else if (entryHandle.kind === 'directory') {
      const nestedTarget = await targetDirHandle.getDirectoryHandle(entryName, { create: true });
      await copyDirectoryContents(entryHandle, nestedTarget);
    }
  }
};

const getExistingDirectoryHandle = async (parentHandle, folderName) => {
  try {
    return await parentHandle.getDirectoryHandle(folderName, { create: false });
  } catch {
    return null;
  }
};

const rebindFolderSubtree = async (folderNode, currentHandle, parentHandle = null) => {
  const existingRecord = await getFolderHandleBinding(folderNode.id);
  await saveFolderHandleBinding(
    folderNode.id,
    currentHandle,
    {
      ...(existingRecord?.metadata || {}),
      folderName: folderNode.name,
      parentFolderId: folderNode.parent_folder_id || folderNode.parent_id || existingRecord?.metadata?.parentFolderId || null,
    },
    parentHandle || existingRecord?.parentHandle || null,
  );

  for (const child of folderNode.children || []) {
    const childHandle = await getExistingDirectoryHandle(currentHandle, child.name);
    if (!childHandle) {
      continue;
    }
    await rebindFolderSubtree(child, childHandle, currentHandle);
  }
};

export const renameFolderOnLocalMachine = async (folder, newName) => {
  if (!folder?.id) {
    return { renamed: false, reason: 'Missing folder id', code: 'MISSING_FOLDER_ID' };
  }

  const cleanName = String(newName || '').trim();
  if (!cleanName) {
    return { renamed: false, reason: 'Folder name is required', code: 'INVALID_NAME' };
  }

  const record = await getFolderHandleBinding(folder.id);
  if (!record?.handle) {
    return { renamed: false, reason: 'No local folder binding found', code: 'NO_BINDING' };
  }

  const oldName = folder.name || record.metadata?.folderName || record.handle.name;
  if (oldName === cleanName) {
    return { renamed: true, skipped: true };
  }

  const parentFolderId = folder.parent_folder_id || folder.parent_id || record.metadata?.parentFolderId || null;
  let parentHandle = record.parentHandle || null;

  if (!parentHandle && parentFolderId) {
    const parentRecord = await getFolderHandleBinding(parentFolderId);
    parentHandle = parentRecord?.handle || null;
  }

  if (!parentHandle) {
    return {
      renamed: false,
      reason: 'Missing parent directory handle for local rename',
      code: 'MISSING_PARENT_HANDLE',
    };
  }

  if (!(await ensureReadWritePermission(parentHandle))) {
    return { renamed: false, reason: 'Permission denied for local parent directory', code: 'PERMISSION_DENIED' };
  }

  const existingTarget = await getExistingDirectoryHandle(parentHandle, cleanName);
  if (existingTarget) {
    return { renamed: false, reason: `A local folder named "${cleanName}" already exists`, code: 'TARGET_EXISTS' };
  }

  const sourceHandle = record.handle;
  if (!(await ensureReadWritePermission(sourceHandle))) {
    return { renamed: false, reason: 'Permission denied for source local folder', code: 'PERMISSION_DENIED' };
  }

  const targetHandle = await parentHandle.getDirectoryHandle(cleanName, { create: true });

  try {
    await copyDirectoryContents(sourceHandle, targetHandle);
    await parentHandle.removeEntry(oldName, { recursive: true });
    await rebindFolderSubtree({ ...folder, name: cleanName }, targetHandle, parentHandle);
    return { renamed: true };
  } catch (error) {
    try {
      await parentHandle.removeEntry(cleanName, { recursive: true });
    } catch {
      // Best-effort cleanup of partially-created target directory.
    }
    throw error;
  }
};
