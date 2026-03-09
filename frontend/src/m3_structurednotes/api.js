import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Upload PDF (Supports multiple files)
export const uploadPDF = async (files) => {
    const formData = new FormData();

    // Check if input is an array (FileList or Array) or single file
    if (files instanceof FileList || Array.isArray(files)) {
        Array.from(files).forEach(file => {
            formData.append('files', file); // FastAPI expects 'files' for List[UploadFile]
        });
    } else {
        formData.append('files', files); // Fallback for single file
    }

    try {
        const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error uploading PDF:", error);
        throw error;
    }
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

export const updateNote = async (noteId, content) => {
    const response = await api.put(`/notes/${noteId}`, {
        content: content,
    });
    return response.data;
};

export const createNote = async (userId, title, content, pdfId) => {
    const response = await api.post('/notes', {
        user_id: userId,
        title,
        content,
        pdf_id: pdfId
    });
    return response.data;
};

export const getNotes = async (userId, folderId = null) => {
    const params = { user_id: userId };
    if (folderId) params.folder_id = folderId;

    const response = await api.get('/notes', {
        params: params,
    });
    return response.data;
};

export default api;
