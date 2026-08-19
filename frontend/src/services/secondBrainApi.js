import { authFetch } from '@/utils/authSession';
import { workspaceApi } from '@/services/workspaceApi';

async function request(path, options = {}) {
  const res = await authFetch(path, options);

  if (!res.ok) {
    let detail = 'Request failed';

    try {
      const data = await res.json();
      detail = data?.detail || JSON.stringify(data);
    } catch {}

    throw new Error(detail);
  }

  return res.json();
}

export const secondBrainApi = {
  listNotes() {
    return request('/api/second-brain/notes');
  },
deleteNote(noteId) {
  return request(`/api/second-brain/notes/${noteId}`, {
    method: 'DELETE',
  });
},
  createNoteFromUpload(file, { title, sourceFileId } = {}) {
    const formData = new FormData();

    formData.append('file', file);

    if (title) {
      formData.append('title', title);
    }

    if (sourceFileId) {
      formData.append('source_file_id', sourceFileId);
    }

    return request('/api/second-brain/notes/from-upload', {
      method: 'POST',
      body: formData,
    });
  },

  addTags(noteId, tags) {
    return request(`/api/second-brain/notes/${noteId}/tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags }),
    });
  },

  removeTag(noteId, tagName) {
    return request(
      `/api/second-brain/notes/${noteId}/tags/${encodeURIComponent(tagName)}`,
      {
        method: 'DELETE',
      }
    );
  },

  addBacklink(noteId, targetNoteId, context) {
    return request(`/api/second-brain/notes/${noteId}/backlinks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target_note_id: targetNoteId,
        context,
      }),
    });
  },

  removeBacklink(noteId, targetNoteId) {
    return request(
      `/api/second-brain/notes/${noteId}/backlinks/${targetNoteId}`,
      {
        method: 'DELETE',
      }
    );
  },
};


// ---------------------------------------------------------------------------
// Workspace helper
// ---------------------------------------------------------------------------

let cachedFolderId = null;

export async function ensureSecondBrainFolder() {
  if (cachedFolderId) {
    return cachedFolderId;
  }

  const { folders } = await workspaceApi.getFolders();

  const existing = folders.find(
    (folder) => folder.name === 'Second Brain'
  );

  if (existing) {
    cachedFolderId = existing.id;
    return cachedFolderId;
  }

  const { folder } = await workspaceApi.createFolder('Second Brain');

  cachedFolderId = folder.id;
  return cachedFolderId;
}