import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const mindmapService = {
  generateFromPdf(file, title, description = '') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', description);

    return axios.post(`${API_URL}/api/mindmaps/generate`, formData, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  getMindmap(mindmapId) {
    return axios.get(`${API_URL}/api/mindmaps/${mindmapId}`, {
      headers: getAuthHeaders(),
    });
  },

  listMindmaps(skip = 0, limit = 10) {
    return axios.get(`${API_URL}/api/mindmaps`, {
      params: { skip, limit },
      headers: getAuthHeaders(),
    });
  },

  createNode(mindmapId, nodeData) {
    return axios.post(`${API_URL}/api/mindmaps/${mindmapId}/nodes`, nodeData, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
  },

  updateNode(nodeId, nodeData) {
    return axios.put(`${API_URL}/api/mindmaps/nodes/${nodeId}`, nodeData, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
  },

  deleteNode(nodeId) {
    return axios.delete(`${API_URL}/api/mindmaps/nodes/${nodeId}`, {
      headers: getAuthHeaders(),
    });
  },

  deleteMindmap(mindmapId) {
    return axios.delete(`${API_URL}/api/mindmaps/${mindmapId}`, {
      headers: getAuthHeaders(),
    });
  },

  getUsageStats(userId) {
    return axios.get(`${API_URL}/api/mindmaps/${userId}/stats`, {
      headers: getAuthHeaders(),
    });
  },
};

export default mindmapService;
