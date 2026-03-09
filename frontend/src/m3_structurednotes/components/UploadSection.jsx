import React, { useState, useRef } from 'react';
import { CloudUpload, FolderOpen, Plus, Loader2, FileText, X, File, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './UploadSection.module.css';
import { uploadPDF, createNote } from '../api';

const UploadSection = () => {
    const navigate = useNavigate();
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Filter out duplicates based on name and size
        const newFiles = files.filter(file =>
            !selectedFiles.some(f => f.name === file.name && f.size === file.size)
        );

        setSelectedFiles(prev => [...prev, ...newFiles]);
        // Reset input so the same file can be selected again if removed
        e.target.value = '';
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const clearAll = () => {
        setSelectedFiles([]);
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) return;

        try {
            setIsUploading(true);
            setUploadStatus(`Uploading ${selectedFiles.length} file(s)...`);

            // 1. Upload All Files
            const uploadResult = await uploadPDF(selectedFiles);
            console.log("Upload result:", uploadResult);

            if (uploadResult.pdf_id) {
                setUploadStatus("Processing & Generating Note...");

                let rawText = uploadResult.extracted_text || "";

                // Clean text
                let cleanText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                cleanText = cleanText.replace(/([^\n])\n(?=[^\n])/g, '$1 ');

                const title = uploadResult.filename || (selectedFiles.length > 1 ? `Combined Note (${selectedFiles.length} files)` : selectedFiles[0].name);
                const userId = "test_user";

                // 2. CREATE NOTE IN DB
                const createResult = await createNote(userId, title, cleanText, uploadResult.pdf_id);
                console.log("Initial Note Created in DB:", createResult);
                const noteId = createResult.note_id;

                localStorage.setItem('currentNote', JSON.stringify({
                    content: cleanText,
                    pdfId: uploadResult.pdf_id,
                    pdfUrl: uploadResult.pdf_url,
                    noteId: noteId,
                    filename: title,
                    isPptx: uploadResult.pdf_url.toLowerCase().endsWith('.pptx') || selectedFiles.some(f => f.name.toLowerCase().endsWith('.pptx'))
                }));

                navigate(`/editor/${noteId}`);
            }

        } catch (error) {
            console.error("Error flow:", error);
            alert("Failed to process files. Please try again.");
            setUploadStatus('');
        } finally {
            setIsUploading(false);
        }
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className={styles.wrapper}>
            <div className={`${styles.uploadCard} ${styles.cardPurple}`} style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                <div className={styles.iconCirclePurple}>
                    <FileText size={40} color="white" />
                </div>
                <h2 className={styles.textPurple} style={{ fontSize: '28px', marginBottom: '12px' }}>Study Material Hub</h2>
                <p style={{ fontSize: '16px', color: '#666', marginBottom: '30px' }}>
                    Upload PDFs or PowerPoints to generate your AI-organized study guide.
                    <br />
                    Select multiple source files to combine them into one comprehensive note.
                </p>

                {/* File Selection Area */}
                <div
                    className={styles.dropZone}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Plus size={32} className={styles.addIcon} />
                    <span>Click to add files (PDF, PPTX)</span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.pptx"
                        multiple
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                        disabled={isUploading}
                    />
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                    <div className={styles.fileListContainer}>
                        <div className={styles.fileListHeader}>
                            <span>{selectedFiles.length} file(s) selected</span>
                            <button className={styles.clearBtn} onClick={clearAll} disabled={isUploading}>Clear All</button>
                        </div>
                        <div className={styles.fileList}>
                            {selectedFiles.map((file, index) => (
                                <div key={`${file.name}-${index}`} className={styles.fileItem}>
                                    <div className={styles.fileInfo}>
                                        <File size={18} className={styles.fileIcon} />
                                        <div className={styles.fileDetails}>
                                            <span className={styles.fileName}>{file.name}</span>
                                            <span className={styles.fileSize}>{formatSize(file.size)}</span>
                                        </div>
                                    </div>
                                    <button
                                        className={styles.removeFileBtn}
                                        onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                                        disabled={isUploading}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className={styles.buttonRow} style={{ marginTop: '30px' }}>
                    <button
                        className={styles.btnPurple}
                        onClick={handleUpload}
                        disabled={isUploading || selectedFiles.length === 0}
                        style={{ padding: '16px 48px', fontSize: '18px', width: '100%' }}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 size={24} className={styles.spinner} />
                                {uploadStatus}
                            </>
                        ) : (
                            <>
                                <CloudUpload size={24} />
                                {selectedFiles.length > 0 ? `Upload & Generate Note` : 'Select Files First'}
                            </>
                        )}
                    </button>
                </div>

                <div className={styles.maxSize} style={{ marginTop: '20px' }}>
                    Supports PDF & PowerPoint • Recommended total size under 100MB
                </div>
            </div>
        </div>
    );
};

export default UploadSection;

