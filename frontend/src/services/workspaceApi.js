import { config } from '@/config/env';
import { authFetch, getValidAccessToken, clearAuthAndRedirect } from '@/utils/authSession';

const API_BASE = config.apiBaseUrl || '';

async function request(path, options = {}) {
  const res = await authFetch(path, options);

  if (!res.ok) {
    let detail = 'Request failed';
    try {
      const data = await res.json();
      detail = data?.detail || JSON.stringify(data);
    } catch {
      // ignore json parsing errors
    }
    throw new Error(detail);
  }

  return res.json();
}

export const workspaceApi = {
  getFolders() {
    return request('/api/v1/workspace/folders');
  },

  createFolder(name, parentFolderId = null) {
    return request('/api/v1/workspace/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parent_folder_id: parentFolderId }),
    });
  },

  renameFolder(folderId, name) {
    return request(`/api/v1/workspace/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  },

  deleteFolder(folderId) {
    return request(`/api/v1/workspace/folders/${folderId}`, {
      method: 'DELETE',
    });
  },

  getFiles(folderId = null) {
    const query = folderId ? `?folder_id=${encodeURIComponent(folderId)}` : '';
    return request(`/api/v1/workspace/files${query}`);
  },

  async getRecentFiles(limit = 5) {
    try {
      const res = await request(`/api/v1/workspace/files/recent?limit=${encodeURIComponent(limit)}`);
      
      // Optionally sync with local history for immediate client-side feedback
      const historyJson = localStorage.getItem('neuranote_file_history');
      if (historyJson && res && res.files) {
        const localHistory = JSON.parse(historyJson);
        res.files = res.files.map(f => {
          if (localHistory[f.id]) {
             // Use local timestamp if it's newer
             const localTime = new Date(localHistory[f.id]);
             const serverTime = new Date(f.recent_timestamp || f.created_at);
             if (localTime > serverTime) {
                return { ...f, recent_timestamp: localHistory[f.id] };
             }
          }
          return f;
        });
        res.files.sort((a, b) => new Date(b.recent_timestamp || b.created_at) - new Date(a.recent_timestamp || a.created_at));
      }
      return res;
    } catch (err) {
      console.error("Failed to fetch recent files", err);
      throw err;
    }
  },

  markFileAccess(fileId) {
    try {
      const historyJson = localStorage.getItem('neuranote_file_history');
      const history = historyJson ? JSON.parse(historyJson) : {};
      history[fileId] = new Date().toISOString();
      localStorage.setItem('neuranote_file_history', JSON.stringify(history));
    } catch (e) {
      console.error("Failed to save local file history", e);
    }
    
    return request(`/api/v1/workspace/files/${fileId}/access`, {
      method: 'PATCH',
    });
  },

  getFilePreview(fileId, expiresIn = 3600) {
    return request(`/api/v1/workspace/files/${fileId}/preview?expires_in=${encodeURIComponent(expiresIn)}`);
  },

  uploadFile(folderId, file, onProgress) {
    const formData = new FormData();
    formData.append('folder_id', folderId);
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const sendUpload = async () => {
        const token = await getValidAccessToken();
        if (!token) {
          clearAuthAndRedirect();
          return;
        }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/api/v1/workspace/files/upload`);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && typeof onProgress === 'function') {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          let payload = null;
          try {
            payload = JSON.parse(xhr.responseText || '{}');
          } catch {
            payload = {};
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(payload);
            return;
          }

          if (xhr.status === 401) {
            reject(new Error(payload?.detail || 'Invalid or expired token'));
            return;
          }

          reject(new Error(payload?.detail || 'Upload failed'));
        };

        xhr.onerror = () => {
          reject(new Error('Upload failed'));
        };

        xhr.send(formData);
      };

      sendUpload().catch(reject);
    });
  },

  moveFile(fileId, folderId) {
    return request(`/api/v1/workspace/files/${fileId}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId }),
    });
  },

  renameFile(fileId, name) {
    return request(`/api/v1/workspace/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  },

  deleteFile(fileId) {
    return request(`/api/v1/workspace/files/${fileId}`, {
      method: 'DELETE',
    });
  },

  searchFiles(query = '', fileType = null, limit = 20) {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (fileType) params.append('file_type', fileType);
    params.append('limit', limit);
    
    return request(`/api/v1/workspace/files/search?${params.toString()}`);
  },

  exportFileToModule(fileId, moduleName, moduleRefId = null) {
    const formData = new FormData();
    formData.append('module_name', moduleName);
    if (moduleRefId) {
      formData.append('module_ref_id', moduleRefId);
    }

    return request(`/api/v1/workspace/files/${fileId}/export-to-module`, {
      method: 'POST',
      body: formData,
    });
  },

  recordFocusSession(payload) {
    return request('/api/v1/productivity/focus-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  getProductivityDashboard() {
    return request('/api/v1/productivity/dashboard');
  },
};
