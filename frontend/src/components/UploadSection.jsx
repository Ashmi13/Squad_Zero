import React, { useState } from 'react';
import { CloudUpload, FolderOpen, Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './UploadSection.module.css';
import { uploadPDF, generateNote } from '../api';

const UploadSection = () => {
    const navigate = useNavigate();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(''); // 'uploading', 'processing', 'generating'

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setIsUploading(true);
            setUploadStatus('Uploading PDF...');

            // 1. Upload
            const uploadResult = await uploadPDF(file);
            console.log("Upload result:", uploadResult);

            if (uploadResult.pdf_id) {
                // SKIP AI GENERATION for Interim Manual Mode
                // Use the text extracted directly by the backend

                const noteId = Date.now().toString(); // Generate a temp ID for the session

                // Clean up the extracted text: 
                // PDF extraction often adds newlines at the end of every line (hard wrapping).
                let rawText = uploadResult.extracted_text || "";

                // 1. Unify line endings to \n
                let cleanText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

                // 2. Join lines that are likely part of the same paragraph:
                // Replace "word\nword" with "word word".
                // Keep "word\n\nword" as TWO newlines (paragraph break).
                cleanText = cleanText.replace(/([^\n])\n(?=[^\n])/g, '$1 ');

                // Store note in local storage for the editor
                localStorage.setItem('currentNote', JSON.stringify({
                    content: cleanText,
                    pdfId: uploadResult.pdf_id,
                    pdfUrl: uploadResult.pdf_url, // Store the URL for the viewer
                    noteId: noteId,
                    filename: uploadResult.filename
                }));

                navigate(`/editor/${noteId}`);
            }

        } catch (error) {
            console.error("Error flow:", error);
            alert("Failed to process file. Check console for details.");
            setUploadStatus('');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.uploadArea}>
                <div className={styles.cloudIconContainer}>
                    {isUploading ? <Loader2 size={32} color="white" className={styles.spinner} /> : <CloudUpload size={32} color="white" />}
                </div>

                <h2>{isUploading ? uploadStatus : "Upload Your Study Materials"}</h2>
                <p>Drag and drop your files here, or click to browse. Supports PDF, DOCX, PPT, and more.</p>

                <div className={styles.buttons}>
                    <label className={styles.chooseFilesBtn}>
                        <input
                            type="file"
                            accept=".pdf" // Limit to PDF for now as backend supports PDF
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            disabled={isUploading}
                        />
                        {isUploading ? <Loader2 size={16} className={styles.spinner} /> : <Plus size={16} />}
                        {isUploading ? "Processing..." : "Choose Files"}
                    </label>

                    <button className={styles.browseFoldersBtn} disabled={isUploading}>
                        <FolderOpen size={16} />
                        Browse Folders
                    </button>
                </div>

                <div className={styles.maxSize}>Maximum file size: 50MB</div>
            </div>
        </div>
    );
};

export default UploadSection;
