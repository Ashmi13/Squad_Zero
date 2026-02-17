import axios from 'axios';

const API_BASE_URL = '';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const uploadPDF = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const generateNote = async (pdfId, userId, instruction) => {
    const response = await api.post('/generate-note', {
        pdf_id: pdfId,
        user_id: userId,
        instruction,
    });
    return response.data;
};

export const refineText = async (pdfId, selectedText, instruction) => {
    const response = await api.post('/refine-text', {
        pdf_id: pdfId,
        selected_text: selectedText,
        instruction,
    });
    return response.data;
};

export const getFolders = async (userId) => {
    const response = await api.get('/folders', {
        params: { user_id: userId },
    });
    return response.data;
};

export const createFolder = async (userId, name) => {
    const response = await api.post('/folders', {
        user_id: userId,
        name,
    });
    return response.data;
};

export const saveNoteToFolder = async (noteId, folderId) => {
    const response = await api.put(`/notes/${noteId}/folder`, {
        folder_id: folderId,
    });
    return response.data;
};

export default api;
