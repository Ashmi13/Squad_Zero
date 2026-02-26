import React, { useState } from 'react';
import { CloudUpload, FolderOpen, Plus, Loader2, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './UploadSection.module.css';
import { uploadPDF, createNote } from '../api';

const UploadSection = () => {
    const navigate = useNavigate();
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(''); // 'uploading', 'processing', 'generating'

    const handleFileUpload = async (e) => {
        const files = e.target.files; // FileList
        if (!files || files.length === 0) return;

        try {
            setIsUploading(true);
            setUploadStatus(`Processing ${files.length} file(s)...`);

            // 1. Upload All Files
            const uploadResult = await uploadPDF(files);
            console.log("Upload result:", uploadResult);

            if (uploadResult.pdf_id) {
                let rawText = uploadResult.extracted_text || "";

                // Clean text
                let cleanText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                cleanText = cleanText.replace(/([^\n])\n(?=[^\n])/g, '$1 ');

                const title = uploadResult.filename || "Untitled Note";
                const userId = "test_user";

                // 2. CREATE NOTE IN DB IMMEDIATELY
                const createResult = await createNote(userId, title, cleanText, uploadResult.pdf_id);
                console.log("Initial Note Created in DB:", createResult);
                const noteId = createResult.note_id;

                localStorage.setItem('currentNote', JSON.stringify({
                    content: cleanText,
                    pdfId: uploadResult.pdf_id, // Primary source for viewer
                    pdfUrl: uploadResult.pdf_url,
                    noteId: noteId,
                    filename: title,
                    isPptx: uploadResult.pdf_url.toLowerCase().endsWith('.pptx')
                }));

                navigate(`/editor/${noteId}`);
            }

        } catch (error) {
            console.error("Error flow:", error);
            alert("Failed to process files. Check console for details.");
            setUploadStatus('');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className={styles.wrapper}>
            {/* Member 3: Structured Note Generation (Sole Focus) */}
            <div className={`${styles.uploadCard} ${styles.cardPurple}`} style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 40px' }}>
                <div className={styles.iconCirclePurple} style={{ width: '80px', height: '80px', marginBottom: '24px' }}>
                    <FileText size={40} color="white" />
                </div>
                <h2 className={styles.textPurple} style={{ fontSize: '28px', marginBottom: '12px' }}>Generate Structured Note</h2>
                <p style={{ fontSize: '16px', color: '#666', marginBottom: '40px' }}>
                    Upload your study materials (PDF or PowerPoint) to generate an AI-organized study guide.
                    <br />
                    Select multiple files to create a comprehensive note.
                </p>

                <div className={styles.buttonRow} style={{ justifyContent: 'center' }}>
                    <label className={styles.btnPurple} style={{ padding: '16px 32px', fontSize: '18px' }}>
                        <Plus size={24} />
                        <input
                            type="file"
                            accept=".pdf,.pptx"
                            multiple // Enable multiple file selection
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            disabled={isUploading}
                        />
                        {isUploading ? "Processing..." : "Select Study Materials"}
                    </label>
                </div>
                <div className={styles.maxSize} style={{ marginTop: '20px' }}>
                    Supports PDF & PowerPoint • Max 50MB per file
                </div>
            </div>
        </div>
    );
};

export default UploadSection;
