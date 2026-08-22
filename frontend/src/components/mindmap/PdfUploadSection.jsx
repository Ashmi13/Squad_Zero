import React, { useState } from 'react';
import axios from 'axios';
import { getAccessToken } from '../../utils/tokenStorage';
import {
  Paper,
  TextField,
  Button,
  Typography,
  Stack,
  Alert,
  Box,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Cloud } from 'lucide-react';
import mindmapService from '../../services/mindmapService';

const PdfUploadSection = ({ onMindmapCreated }) => {
  const theme = useTheme();
  const [dragActive, setDragActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    file: null,
  });

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.');
      setFormData((prev) => ({ ...prev, file: null }));
      return;
    }
    setError(null);
    setFormData((prev) => ({
      ...prev,
      file: file,
      // Prefill title with filename without extension if title is empty
      title: prev.title ? prev.title : file.name.replace(/\.[^/.]+$/, ''),
    }));
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const json = e.dataTransfer.getData('neuranote-quiz-file') || e.dataTransfer.getData('application/json');
    if (json) {
      try {
        const dragData = JSON.parse(json);
        if (dragData.fileId) {
          setIsLoading(true);
          setError(null);
          try {
            const token = getAccessToken();
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            
            const response = await fetch(`/api/v1/workspace/files/${dragData.fileId}/content`, {
              headers
            });
            if (!response.ok) {
              throw new Error(`Failed to fetch file content: ${response.statusText}`);
            }
            const mimeType = response.headers.get('Content-Type') || 'application/pdf';
            const blob = await response.blob();
            
            let filename = dragData.fileName || 'file';
            const extFromUrl = dragData.fileUrl ? '.' + dragData.fileUrl.split('.').pop().toLowerCase() : '';
            if (extFromUrl && extFromUrl === '.pdf' && !filename.toLowerCase().endsWith('.pdf')) {
              filename += '.pdf';
            } else if (mimeType.includes('pdf') && !filename.toLowerCase().endsWith('.pdf')) {
              filename += '.pdf';
            }
            const fileObj = new File([blob], filename, { type: mimeType });
            handleFile(fileObj);
          } catch (err) {
            setError('Failed to load workspace file for mind map generation.');
            console.error(err);
          } finally {
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('[Drop] Failed parsing drag data:', err);
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.file) {
      setError('Please select or drop a PDF file first.');
      return;
    }
    if (!formData.title.trim()) {
      setError('Please enter a title for your mind map.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await mindmapService.generateFromPdf(
        formData.file,
        formData.title,
        formData.description
      );
      if (response.data && response.data.mindmap_id) {
        onMindmapCreated(response.data.mindmap_id);
      } else {
        throw new Error('Failed to retrieve mind map ID from server.');
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to generate mind map.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Paper
        elevation={4}
        sx={{
          py: 8,
          px: 4,
          textAlign: 'center',
          background: `linear-gradient(135deg, ${theme.palette.background.paper} 30%, ${
            theme.palette.mode === 'dark' ? '#1e1b4b' : '#f0f4ff'
          } 100%)`,
          borderRadius: 3,
        }}
      >
        <Stack spacing={3} alignItems="center">
          <CircularProgress size={60} thickness={4} color="primary" />
          <Typography variant="h5" fontWeight="600">
            Generating your mind map...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
            Our AI is reading your PDF and structuring a non-redundant mind map layout. This may take up to a minute depending on document size.
          </Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={4}
      sx={{
        py: 6,
        px: 4,
        background: `linear-gradient(135deg, ${theme.palette.background.paper} 40%, ${
          theme.palette.mode === 'dark' ? '#111827' : '#fafafa'
        } 100%)`,
        borderRadius: 3,
        maxWidth: 600,
        margin: '0 auto',
      }}
    >
      <Stack spacing={4}>
        <Box textAlign="center">
          <Typography variant="h4" fontWeight="700" gutterBottom>
            Create a Mind Map
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Upload your study notes, textbooks, or reference PDFs, and our AI will build an interactive mind map to visualize key concepts.
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <Stack spacing={3}>
            {/* Drag & Drop Zone */}
            <Box
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              sx={{
                border: '2px dashed',
                borderColor: dragActive ? 'primary.main' : 'divider',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: dragActive
                  ? theme.palette.mode === 'dark'
                    ? '#312e81'
                    : '#e0e7ff'
                  : 'transparent',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: theme.palette.mode === 'dark' ? '#1e1b4b' : '#f0f4ff',
                },
              }}
              onClick={() => document.getElementById('file-upload-input').click()}
            >
              <input
                id="file-upload-input"
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <Stack spacing={2} alignItems="center">
                <Cloud size={48} color={theme.palette.primary.main} style={{ opacity: 0.8 }} />
                {formData.file ? (
                  <Box>
                    <Typography variant="subtitle1" fontWeight="600" color="primary">
                      File Selected
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {formData.file.name} ({Math.round(formData.file.size / 1024)} KB)
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="subtitle1" fontWeight="600">
                      Drag & Drop your PDF here
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      or click to browse local files
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>

            <TextField
              label="Mind Map Title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              fullWidth
              required
              disabled={isLoading}
            />

            <TextField
              label="Description (Optional)"
              name="description"
              value={formData.description}
              onChange={handleChange}
              multiline
              rows={3}
              fullWidth
              disabled={isLoading}
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disabled={isLoading || !formData.file}
              sx={{ py: 1.5, fontWeight: 'bold' }}
            >
              Generate Mind Map
            </Button>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
};

export default PdfUploadSection;
