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
                setUploadStatus('Generating Note... (This may take a minute)');

                // 2. Generate Note
                const USER_ID = "test_user"; // Replace with real auth
                const noteResult = await generateNote(uploadResult.pdf_id, USER_ID, "Summarize this document.");
                console.log("Note result:", noteResult);

                // 3. Navigate to Editor
                // Store note in local storage for the editor to pick up (since we don't have getNote endpoint yet)
                localStorage.setItem('currentNote', JSON.stringify({
                    content: noteResult.content,
                    pdfId: uploadResult.pdf_id,
                    noteId: noteResult.note_id
                }));

                navigate(`/editor/${noteResult.note_id}`);
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
