/**
 * FileViewer Component - View and interact with uploaded files
 * 
 * CHANGES MADE:
 * - Added "Extract Text" button to extract text from PDF and create extracted text file
 * - Added "Generate Summary" button to create an AI-powered summary of PDF content
 * - Added Download buttons (PDF, DOCX, TXT formats) for extracted text and summary files
 * - Added proper error handling and loading states
 * - Supports viewing nested files (extracted text, summary under parent PDF)
 * - Integrated with backend API for PDF processing
 * 
 * FIX #1: Delete File Functionality
 * - Added handleDeleteFile function to delete currently open files
 * - Shows confirmation dialog before deletion (window.confirm)
 * - Supports deleting PDF files while viewing them in preview
 * - Supports deleting extracted text and summary files
 * - When file is deleted, calls onFileDeleted callback to close the preview
 * - File deletion is reflected in UI immediately
 * - Updates localStorage after deletion
 * - Displays success message when file is deleted
 * - Added Delete button for both text files and PDF previews
 * - Preview automatically closes when the viewed file is deleted
 * 
 * WHY DELETE WASN'T WORKING IN PREVIEW BEFORE:
 * - No delete button was available in the preview panel
 * - No mechanism to close preview after deletion
 * - File state wasn't properly synchronized after deletion
 * 
 * HOW DELETE WORKS IN PREVIEW NOW:
 * 1. User clicks "Delete File" button in preview panel
 * 2. Confirmation dialog asks to confirm deletion
 * 3. If confirmed:
 *    - File is removed from parent component's state via onFilesUpdate
 *    - File is removed from localStorage
 *    - Preview automatically closes via onFileDeleted callback
 *    - Success message is shown
 * 4. User returns to file list with file no longer visible
 */

import React, { useEffect, useState } from 'react';
import { FileText, X, Download, Loader, AlertCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph } from 'docx';
import { authFetch } from '@/utils/authSession';
import { workspaceApi } from '@/services/workspaceApi';
import { config } from '@/config/env';
import { ensureReadWritePermission, getFolderHandleBinding, removeFileFromLocalFolder } from '@/utils/localFsSync';
import SummaryPanel from './SummaryPanel';

const API_BASE = config.apiBaseUrl || '';
const apiUrl = (path) => `${API_BASE}${path}`;

const addChildFileToTree = (items, parentId, childFile) => {
  return (items || []).map((item) => {
    if (item.id === parentId) {
      return { ...item, children: [...(item.children || []), childFile] };
    }
    if (item.children?.length) {
      return { ...item, children: addChildFileToTree(item.children, parentId, childFile) };
    }
    return item;
  });
};

const removeFileFromTree = (items, targetId) => {
  return (items || [])
    .filter((item) => item.id !== targetId)
    .map((item) => {
      if (item.children?.length) {
        return { ...item, children: removeFileFromTree(item.children, targetId) };
      }
      return item;
    });
};

const removeFileFromAnyFolder = (filesMap, targetId) => {
  const updated = { ...(filesMap || {}) };
  Object.keys(updated).forEach((folderKey) => {
    updated[folderKey] = removeFileFromTree(updated[folderKey], targetId);
  });
  return updated;
};

const updateParentInAnyFolder = (filesMap, parentId, updater) => {
  const updated = { ...(filesMap || {}) };
  Object.keys(updated).forEach((folderKey) => {
    const tree = updated[folderKey] || [];
    let touched = false;
    const walk = (nodes) => (nodes || []).map((node) => {
      if (String(node.id) === String(parentId)) {
        touched = true;
        return updater(node);
      }
      if (node.children?.length) {
        return { ...node, children: walk(node.children) };
      }
      return node;
    });
    const nextTree = walk(tree);
    if (touched) {
      updated[folderKey] = nextTree;
    }
  });
  return updated;
};

// FIX #1: Enhanced FileViewer to support deleting currently open files
const FileViewer = ({ selectedFile, onClose, onFilesUpdate, currentFolder, currentFolderId, onFileDeleted, onSelectGeneratedFile }) => {
  // CHANGED: Added state management for Extract Text and Generate Summary operations
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const [extractedText, setExtractedText] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewContent, setPreviewContent] = useState('');
  const [localObjectUrl, setLocalObjectUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [assetReady, setAssetReady] = useState(false);

  if (!selectedFile) {
    return (
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '12px',
        color: '#ccc', fontSize: '14px',
        backgroundColor: '#f9f9f9',
      }}>
        <FileText size={48} color="#ddd" />
        <p>Click a file to view it here</p>
      </div>
    );
  }

  const normalizedType = String(selectedFile.type || selectedFile.file_type || '').toUpperCase();
  const normalizedMime = String(selectedFile.mimeType || selectedFile.mime_type || '').toLowerCase();
  const lowerName = String(selectedFile.name || '').toLowerCase();
  const lowerOriginalFilename = String(selectedFile.originalFilename || selectedFile.original_filename || '').toLowerCase();
  const resolvedContent =
    selectedFile.content ||
    selectedFile.file_content ||
    selectedFile.text ||
    selectedFile.summary ||
    selectedFile.extractedText ||
    '';
  const resolvedContentIsDataUrl = typeof resolvedContent === 'string' && resolvedContent.startsWith('data:');
  const effectiveContent = resolvedContentIsDataUrl ? (previewContent || '') : (resolvedContent || previewContent);
  const effectiveFileUrl = selectedFile.fileUrl || selectedFile.storage_url || previewUrl || (resolvedContentIsDataUrl ? resolvedContent : null);
  const isGeneratedTextFile =
    normalizedType === 'TXT' ||
    normalizedMime.startsWith('text/') ||
    /extract(ed)? text|summary/i.test(lowerName);
  const isPdfFile =
    normalizedType === 'PDF' ||
    normalizedMime === 'application/pdf' ||
    lowerName.endsWith('.pdf') ||
    lowerOriginalFilename.endsWith('.pdf') ||
    String(effectiveFileUrl || '').startsWith('data:application/pdf') ||
    !!selectedFile.isParentPDF;
  const isTextFile = isGeneratedTextFile || !!effectiveContent;
  const isSummaryFile = !isPdfFile && (/summary/i.test(lowerName) || !!selectedFile.isSummary);
  const isImageFile = (selectedFile.mimeType || '').startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(selectedFile.name || '');

  useEffect(() => {
    setAssetReady(false);
  }, [selectedFile?.id, effectiveFileUrl]);

  useEffect(() => {
    if (!selectedFile?.id) return undefined;

    workspaceApi.markFileAccess(selectedFile.id).catch(() => {
      // Best-effort tracking only.
    });

    return undefined;
  }, [selectedFile?.id]);

  useEffect(() => {
    return () => {
      if (localObjectUrl) {
        URL.revokeObjectURL(localObjectUrl);
      }
    };
  }, [localObjectUrl]);

  useEffect(() => {
    let disposed = false;

    setPreviewUrl(null);
    setPreviewContent('');
    setPreviewLoading(false);

    const shouldAttemptLocalBinaryFallback =
      !isGeneratedTextFile &&
      !String(selectedFile?.mimeType || selectedFile?.mime_type || '').toLowerCase().startsWith('text/');

    // Only call getFilePreview when we genuinely have nothing to show.
    // - Files with plain text inline content → show immediately, no round-trip needed
    // - Files with a non-Supabase URL (e.g. local object URL) → already usable
    // - Files stored in Supabase (storage_url) OR with no content → fetch fresh signed URL
    const hasInlineTextContent = !!(resolvedContent && !resolvedContentIsDataUrl);
    const hasLocalUrl = !!(selectedFile?.fileUrl && !String(selectedFile.fileUrl || '').includes('supabase.co'));

    // Skip API call if we already have displayable content/url
    if (hasInlineTextContent || hasLocalUrl) {
      return () => {
        disposed = true;
      };
    }

    // Need to call the backend preview endpoint
    const shouldRefreshPreview = !!selectedFile?.id;
    if (!shouldRefreshPreview) {
      return () => {
        disposed = true;
      };
    }

    setPreviewLoading(true);

    const tryLocalPreview = async () => {
      const folderId = selectedFile?.folderId;
      if (!folderId) return false;

      const record = await getFolderHandleBinding(folderId);
      if (!record?.handle) return false;
      const granted = await ensureReadWritePermission(record.handle);
      if (!granted) return false;

      const fileNames = [
        selectedFile?.originalFilename,
        selectedFile?.original_filename,
        selectedFile?.name,
      ].filter(Boolean);

      const normalizeBase = (value) => String(value || '').trim().toLowerCase().replace(/\.[^./\\]+$/, '');
      const wantedBaseNames = Array.from(new Set(fileNames.map(normalizeBase).filter(Boolean)));

      for (const candidate of fileNames) {
        try {
          const fileHandle = await record.handle.getFileHandle(candidate, { create: false });
          const file = await fileHandle.getFile();
          const objectUrl = URL.createObjectURL(file);
          if (!disposed) {
            if (localObjectUrl) {
              URL.revokeObjectURL(localObjectUrl);
            }
            setLocalObjectUrl(objectUrl);
            setPreviewUrl(objectUrl);
          }
          return true;
        } catch {
          // Try next candidate filename.
        }
      }

      // Legacy fallback: match by basename when DB record name does not include extension.
      if (wantedBaseNames.length) {
        // eslint-disable-next-line no-restricted-syntax
        for await (const [entryName, entryHandle] of record.handle.entries()) {
          if (entryHandle.kind !== 'file') continue;
          const entryBase = normalizeBase(entryName);
          if (!wantedBaseNames.includes(entryBase)) continue;

          try {
            const file = await entryHandle.getFile();
            const objectUrl = URL.createObjectURL(file);
            if (!disposed) {
              if (localObjectUrl) {
                URL.revokeObjectURL(localObjectUrl);
              }
              setLocalObjectUrl(objectUrl);
              setPreviewUrl(objectUrl);
            }
            return true;
          } catch {
            // Continue searching for a matching entry.
          }
        }
      }

      return false;
    };

    workspaceApi.getFilePreview(selectedFile.id)
      .then((data) => {
        if (disposed) return;
        const preview = data?.preview || {};
        // preview.preview_url: signed/public URL for PDFs and stored files
        // preview.content: inline text content for text files
        if (preview.preview_url) {
          setPreviewUrl(preview.preview_url);
        } else if (preview.content) {
          // Text content returned — display as text
          const content = preview.content;
          if (typeof content === 'string' && content.startsWith('data:')) {
            // Decode data URL to display as text
            try {
              const base64 = content.split(',')[1];
              setPreviewContent(atob(base64));
            } catch {
              setPreviewContent(content);
            }
          } else {
            setPreviewContent(content);
          }
        }
      })
      .catch(async () => {
        // Fall back to local machine binding only for binary assets like PDFs.
        // For generated text files, local fallback can incorrectly resolve to the parent PDF.
        if (shouldAttemptLocalBinaryFallback) {
          await tryLocalPreview();
        }
      })
      .finally(() => {
        if (!disposed) {
          setPreviewLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [selectedFile?.id, selectedFile?.fileUrl, selectedFile?.type, selectedFile?.file_type, selectedFile?.mimeType, selectedFile?.mime_type, selectedFile?.name, selectedFile?.originalFilename, selectedFile?.original_filename, resolvedContent]);

  /**
   * BACKEND INTEGRATION #1: Extract Text from PDF
   * 
   * CONNECTION FLOW:
   * 1. User clicks "Extract Text" button in FileViewer
   * 2. handleExtractText() is called
   * 3. Frontend converts PDF (stored as data URL) to Blob format
   * 4. Frontend sends Blob to BACKEND API: POST http://localhost:8000/api/v1/pdf/extract-text
   * 5. Backend receives PDF file and processes it:
   *    - File arrives in routes/pdf.py at /extract-text endpoint
   *    - pdf_reader.extract_text_from_pdf() uses PyMuPDF (fitz) to read the PDF
   *    - Extracts all text from every page in the PDF
   * 6. Backend returns JSON: { status: "success", text: "extracted text...", filename: "..." }
   * 7. Frontend receives the extracted text and creates a new file in the file list
   * 
   * FILES INVOLVED:
   * - FRONTEND: frontend/src/components/filemanager/FileViewer.jsx (this file)
   * - BACKEND ROUTE: backend/routes/pdf.py (receives and handles PDF extraction)
   * - BACKEND SERVICE: backend/app/services/pdf_reader.py (does the actual text extraction)
   */
  const handleExtractText = async () => {
    if (!effectiveFileUrl) {
      setExtractError('No file content available');
      return;
    }

    const resolvedFolderId = selectedFile.folderId || selectedFile.folder_id || currentFolderId || '';
    const resolvedSourceName = selectedFile.originalFilename || selectedFile.original_filename || selectedFile.name || '';

    setIsExtracting(true);
    setExtractError(null);

    try {
      // Step 1: Convert PDF from data URL to Blob
      // The PDF is stored as a data URL (base64 string)
      // We need to convert it to a Blob to send to the backend
      const response = await fetch(effectiveFileUrl);
      const blob = await response.blob();
      
      // Step 2: Create FormData (multipart/form-data) to send file to backend
      const formData = new FormData();
      formData.append('file', blob, `${selectedFile.name}.pdf`);
      formData.append('source_file_id', selectedFile.id);
      formData.append('folder_id', resolvedFolderId);
      formData.append('source_file_name', resolvedSourceName);

      // Step 3: Send PDF to backend API endpoint
      // Backend URL: http://localhost:8000/api/v1/pdf/extract-text
      // This is defined in backend/routes/pdf.py
      const extractResponse = await authFetch('/api/v1/pdf/extract-text', {
        method: 'POST',
        headers: {},
        body: formData,
      });

      if (!extractResponse.ok) {
        let detail = 'Failed to extract text from PDF';
        try {
          const payload = await extractResponse.json();
          detail = payload?.detail || payload?.message || detail;
        } catch {
          // ignore parsing errors
        }
        throw new Error(detail);
      }

      // Step 4: Backend returns extracted text
      const data = await extractResponse.json();
      const extractedTextContent = data.text;  // The actual text from the PDF
      setExtractedText(extractedTextContent);
      const savedExtractedFile = data.file || {
        id: Date.now(),
        name: `${selectedFile.name} - Extracted Text`,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        type: 'TXT',
        content: extractedTextContent,
        isExtractedText: true,
        parentFileId: selectedFile.id,
      };

      const extractedChildFile = {
        ...savedExtractedFile,
        name: savedExtractedFile.name || `${selectedFile.name} - Extracted Text`,
        content: extractedTextContent,
        type: 'TXT',
        mimeType: 'text/plain',
        isExtractedText: true,
        parentFileId: selectedFile.id,
        fileUrl: data.file?.storage_url || null,
        folderId: selectedFile.folderId || selectedFile.folder_id || currentFolderId || null,
        folderName: selectedFile.folderName || selectedFile.folder_name || currentFolder || null,
        backendFile: true,
      };

      // Update parent file's children array
      onFilesUpdate((prevFiles) => {
        return updateParentInAnyFolder(prevFiles, selectedFile.id, (parentNode) => ({
          ...parentNode,
          children: [
            ...(parentNode.children || []),
            extractedChildFile,
          ],
        }));
      });

      if (typeof onSelectGeneratedFile === 'function') {
        onSelectGeneratedFile(extractedChildFile);
      }

      window.dispatchEvent(new Event('neuranote:files-updated'));

      alert('Text extracted successfully! New file created under the PDF.');
    } catch (error) {
      setExtractError(error.message || 'Error extracting text');
    } finally {
      setIsExtracting(false);
    }
  };

  /**
   * BACKEND INTEGRATION #2: Generate Summary from Text
   * 
   * CONNECTION FLOW:
   * 1. User clicks "Generate Summary" button in FileViewer
   * 2. handleGenerateSummary() is called
   * 3. If text not extracted yet, first extracts text from PDF (calls handleExtractText logic)
   * 4. Frontend sends extracted text to BACKEND API: POST http://localhost:8000/api/v1/pdf/generate-summary
   * 5. Backend receives text and processes it:
   *    - Request arrives in routes/pdf.py at /generate-summary endpoint
   *    - openai_service.generate_summary() is called with the extracted text
   *    - OpenAI API (gpt-3.5-turbo model) generates an AI-powered summary
   *    - OpenAI returns summarized content
   * 6. Backend returns JSON: { status: "success", summary: "AI-generated summary..." }
   * 7. Frontend receives the summary and creates a new file in the file list
   * 
   * FILES INVOLVED:
   * - FRONTEND: frontend/src/components/filemanager/FileViewer.jsx (this file)
   * - BACKEND ROUTE: backend/routes/pdf.py (receives and handles summary generation)
   * - BACKEND SERVICE: backend/app/services/openai_service.py (calls OpenAI API)
   * - EXTERNAL: OpenAI API (gpt-3.5-turbo model) - requires OPENAI_API_KEY in .env
   */
  const handleGenerateSummary = async () => {
    if (!extractedText && !effectiveFileUrl && !effectiveContent) {
      setExtractError('No content available to summarize');
      return;
    }

    const resolvedFolderId = selectedFile.folderId || selectedFile.folder_id || currentFolderId || '';
    const resolvedSourceName = selectedFile.originalFilename || selectedFile.original_filename || selectedFile.name || '';

    setIsSummarizing(true);
    setExtractError(null);

    try {
      // Step 1: Get text to summarize (either already extracted or extract now)
      let textToSummarize = extractedText || effectiveContent;
      
      if (!textToSummarize) {
        // If we don't have extracted text yet, extract it first
        const response = await fetch(effectiveFileUrl);
        const blob = await response.blob();
        const formData = new FormData();
        formData.append('file', blob, `${selectedFile.name}.pdf`);
        formData.append('source_file_id', selectedFile.id);
        formData.append('folder_id', resolvedFolderId);
        formData.append('source_file_name', resolvedSourceName);

        const extractResponse = await authFetch('/api/v1/pdf/extract-text', {
          method: 'POST',
          headers: {},
          body: formData,
        });

        if (!extractResponse.ok) {
          let detail = 'Failed to extract text';
          try {
            const payload = await extractResponse.json();
            detail = payload?.detail || payload?.message || detail;
          } catch {
            // ignore parsing errors
          }
          throw new Error(detail);
        }
        const data = await extractResponse.json();
        textToSummarize = data.text;
      }

      // Step 2: Send extracted text to backend API endpoint
      // Backend URL: http://localhost:8000/api/v1/pdf/generate-summary
      // This is defined in backend/routes/pdf.py
      const summaryResponse = await authFetch('/api/v1/pdf/generate-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textToSummarize,
          source_file_id: selectedFile.id,
          folder_id: resolvedFolderId,
          source_file_name: resolvedSourceName,
        }),
      });

      if (!summaryResponse.ok) {
        let detail = 'Failed to generate summary';
        try {
          const payload = await summaryResponse.json();
          detail = payload?.detail || payload?.message || detail;
        } catch {
          // ignore parsing errors
        }
        throw new Error(detail);
      }

      // Step 3: Backend returns AI-generated summary
      const summaryData = await summaryResponse.json();
      const summaryText = summaryData.summary;  // The AI-generated summary
      const savedSummaryFile = summaryData.file || {
        id: Date.now() + 1,
        name: `${selectedFile.name} - Summary`,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        type: 'TXT',
        content: summaryText,
        isSummary: true,
        parentFileId: selectedFile.id,
      };

      const summaryChildFile = {
        ...savedSummaryFile,
        name: savedSummaryFile.name || `${selectedFile.name} - Summary`,
        content: summaryText,
        type: 'TXT',
        mimeType: 'text/plain',
        isSummary: true,
        parentFileId: selectedFile.id,
        fileUrl: summaryData.file?.storage_url || null,
        folderId: selectedFile.folderId || selectedFile.folder_id || currentFolderId || null,
        folderName: selectedFile.folderName || selectedFile.folder_name || currentFolder || null,
        backendFile: true,
      };

      // Update parent file's children array
      onFilesUpdate((prevFiles) => {
        return updateParentInAnyFolder(prevFiles, selectedFile.id, (parentNode) => ({
          ...parentNode,
          children: [
            ...(parentNode.children || []),
            summaryChildFile,
          ],
        }));
      });

      if (typeof onSelectGeneratedFile === 'function') {
        onSelectGeneratedFile(summaryChildFile);
      }

      window.dispatchEvent(new Event('neuranote:files-updated'));

      alert('Summary generated successfully! New file created under the PDF.');
    } catch (error) {
      setExtractError(error.message || 'Error generating summary');
    } finally {
      setIsSummarizing(false);
    }
  };

  // CHANGED: Function to download file in different formats
  // FIX #1: Function to delete currently open file with confirmation
  const handleDeleteFile = async () => {
    if (!window.confirm(`Delete "${selectedFile.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      if (selectedFile.backendFile && selectedFile.id) {
        await workspaceApi.deleteFile(selectedFile.id);
      }

      const resolvedFolder = {
        id: selectedFile.folderId || selectedFile.folder_id || currentFolderId || null,
        name: selectedFile.name,
        originalFilename: selectedFile.originalFilename || selectedFile.original_filename || null,
        original_filename: selectedFile.originalFilename || selectedFile.original_filename || null,
      };
      await removeFileFromLocalFolder(
        resolvedFolder,
        selectedFile.originalFilename || selectedFile.original_filename || selectedFile.name,
      );

      // Call parent component's delete handler through onFilesUpdate
      onFilesUpdate((prevFiles) => {
        return removeFileFromAnyFolder(prevFiles, selectedFile.id);
      });
      
      // Notify parent that file was deleted and close the preview
      if (onFileDeleted) {
        onFileDeleted();
      } else {
        onClose();
      }
      window.dispatchEvent(new Event('neuranote:files-updated'));
      
      alert(`File "${selectedFile.name}" deleted successfully.`);
    } catch (error) {
      alert('Error deleting file: ' + error.message);
    }
  };

  const handleDownload = (format) => {
    const content = resolvedContent || 'File content';
    const baseName = String(selectedFile.name || 'download').replace(/\.(txt|pdf|docx?)$/i, '');
    let filename = baseName;

    if (format === 'pdf') {
      // Use jsPDF to create a proper PDF document
      try {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        // Set font and add content
        pdf.setFont('Arial', 'normal');
        pdf.setFontSize(10);

        // Split text into pages (A4 page height is ~277mm, usable space ~250mm with margins)
        const pageHeight = pdf.internal.pageSize.getHeight();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 10;
        const maxWidth = pageWidth - 2 * margin;
        const lineHeight = 5;

        // Split content into lines that fit the page width
        const lines = pdf.splitTextToSize(content, maxWidth);

        let currentY = margin;
        lines.forEach((line) => {
          if (currentY + lineHeight > pageHeight - margin) {
            // Add new page if we exceed page height
            pdf.addPage();
            currentY = margin;
          }
          pdf.text(line, margin, currentY);
          currentY += lineHeight;
        });

        pdf.save(filename + '.pdf');
        console.log('PDF downloaded successfully');
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF: ' + error.message);
      }
    } else if (format === 'docx') {
      // Use docx library to create a proper DOCX document
      try {
        // Split content into paragraphs
        const paragraphs = content.split('\n').map(line => 
          new Paragraph({
            text: line || ' ', // Empty lines should have a space to render properly
          })
        );

        const doc = new Document({
          sections: [{
            properties: {},
            children: paragraphs
          }]
        });

        // Generate and download DOCX
        Packer.toBlob(doc).then(blob => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename + '.docx';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          console.log('DOCX downloaded successfully');
        });
      } catch (error) {
        console.error('Error generating DOCX:', error);
        alert('Error generating DOCX: ' + error.message);
      }
    } else {
      // TXT download
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename + '.txt';
      link.click();
      window.URL.revokeObjectURL(url);
    }
  };

  const renderPdfActions = () => (
    <div style={{
      padding: '16px 20px',
      backgroundColor: 'white',
      borderTop: '1px solid #eee',
      display: 'flex',
      gap: '12px',
      justifyContent: 'center',
      flexWrap: 'wrap',
    }}>
      {extractError ? (
        <div style={{ width: '100%', color: '#c62828', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <AlertCircle size={16} />
          {extractError}
        </div>
      ) : null}

      <button
        onClick={handleExtractText}
        disabled={isExtracting}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: isExtracting ? '#ccc' : '#6C5DD3',
          color: 'white',
          border: 'none', padding: '10px 20px', borderRadius: '8px',
          cursor: isExtracting ? 'not-allowed' : 'pointer',
          fontSize: '14px', fontWeight: '600',
        }}
      >
        {isExtracting ? (
          <>
            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Extracting...
          </>
        ) : (
          <>
            <FileText size={16} />
            Extract Text
          </>
        )}
      </button>

      <button
        onClick={handleGenerateSummary}
        disabled={isSummarizing}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: isSummarizing ? '#ccc' : '#28a745',
          color: 'white',
          border: 'none', padding: '10px 20px', borderRadius: '8px',
          cursor: isSummarizing ? 'not-allowed' : 'pointer',
          fontSize: '14px', fontWeight: '600',
        }}
      >
        {isSummarizing ? (
          <>
            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Summarizing...
          </>
        ) : (
          <>
            <FileText size={16} />
            Summary
          </>
        )}
      </button>

      <button
        onClick={handleDeleteFile}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: '#e74c3c',
          color: 'white',
          border: 'none', padding: '10px 20px', borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px', fontWeight: '600',
        }}
      >
        Delete
      </button>
    </div>
  );

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f9f9f9',
      overflow: 'hidden',
    }}>

      {/* Viewer header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px',
        backgroundColor: 'white',
        borderBottom: '1px solid #eee',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={18} color="#6C5DD3" />
          <span style={{ fontWeight: '600', fontSize: '15px', color: '#1a1a2e' }}>
            {selectedFile.name}
          </span>
          <span style={{
            backgroundColor: '#f0eeff', color: '#6C5DD3',
            padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600'
          }}>
            {selectedFile.type}
          </span>
        </div>
        <X
          size={18}
          color="#aaa"
          style={{ cursor: 'pointer' }}
          onClick={onClose}
        />
      </div>

      {/* CHANGED: Show extracted text or PDF preview */}
      {!isPdfFile && isTextFile && effectiveContent ? (
        <SummaryPanel
          title={selectedFile.name}
          summary={effectiveContent}
          panelLabel={isSummaryFile ? 'GENERATED SUMMARY' : 'EXTRACTED TEXT'}
          onDelete={handleDeleteFile}
          onClose={onClose}
        />
      ) : effectiveFileUrl ? (
        <>
          {/* CHANGED: PDF/image preview with fileUrl */}
          {isImageFile ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', backgroundColor: '#111827' }}>
              {(previewLoading || !assetReady) ? <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading preview...</div> : null}
              <img
                src={effectiveFileUrl}
                alt={selectedFile.name}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                onLoad={() => setAssetReady(true)}
                onError={() => setAssetReady(true)}
              />
            </div>
          ) : (
            <div style={{ position: 'relative', flex: 1, width: '100%' }}>
              {(previewLoading || !assetReady) ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13, background: '#f8fafc', zIndex: 1 }}>
                  Loading preview...
                </div>
              ) : null}
              <iframe
                src={effectiveFileUrl}
                style={{
                  flex: 1,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
                title={selectedFile.name}
                onLoad={() => setAssetReady(true)}
              />
            </div>
          )}

          {isPdfFile ? renderPdfActions() : null}
        </>
      ) : (
        <>
          <div style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '12px', color: '#aaa', fontSize: '14px'
          }}>
            <FileText size={48} color="#ddd" />
            <p>File preview not available</p>
            <p style={{ fontSize: '12px' }}>Re-upload the file to view it</p>
          </div>
          {isPdfFile ? renderPdfActions() : null}
        </>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default FileViewer;