import React, { useState, useRef, useEffect } from 'react';
import { CloudUpload, FolderOpen, Plus, Loader2, FileText, X, File, CheckCircle2, ChevronRight, ChevronDown, Folder } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './UploadSection.module.css';
import { uploadPDF, createNote, generateNote } from '../api';

const UploadSection = () => {
    const navigate = useNavigate();
    const [selectedFiles, setSelectedFiles] = useState([]); // Real File objects
    const [notebookNotes, setNotebookNotes] = useState([]); // { name, content, type } from localStorage
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState("English");
    const [ordering, setOrdering] = useState("ai");
    const [folders, setFolders] = useState([]);
    const [filesByFolder, setFilesByFolder] = useState({});
    const [expandedFolders, setExpandedFolders] = useState({});
    
    const fileInputRef = useRef(null);

    // Load Member 2's data from localStorage + Mock Data for testing
    useEffect(() => {
        let savedFolders = localStorage.getItem('neuranote_folders');
        let savedFiles = localStorage.getItem('neuranote_files');
        
        // --- INJECT MOCK DATA FOR TESTING ---
        if (!savedFolders || JSON.parse(savedFolders).length === 0) {
            const mockFolders = [
                { id: 'f1', name: 'Software Engineering' },
                { id: 'f2', name: 'Artificial Intelligence' }
            ];
            const mockFiles = {
                'Software Engineering': [
                    { id: 'n1', name: 'Agile Methodologies', type: 'MD' },
                    { id: 'n2', name: 'Design Patterns', type: 'MD' }
                ],
                'Artificial Intelligence': [
                    { id: 'n3', name: 'Neural Networks 101', type: 'MD' },
                    { id: 'n4', name: 'Backpropagation Logic', type: 'TXT' }
                ]
            };
            localStorage.setItem('neuranote_folders', JSON.stringify(mockFolders));
            localStorage.setItem('neuranote_files', JSON.stringify(mockFiles));
            savedFolders = JSON.stringify(mockFolders);
            savedFiles = JSON.stringify(mockFiles);
        }
        // ------------------------------------

        if (savedFolders) setFolders(JSON.parse(savedFolders));
        if (savedFiles) setFilesByFolder(JSON.parse(savedFiles));
    }, []);

    const toggleFolder = (folderName) => {
        setExpandedFolders(prev => ({ ...prev, [folderName]: !prev[folderName] }));
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        addFilesToSelection(files);
        e.target.value = '';
    };

    const addFilesToSelection = (files) => {
        const MAX_SIZE_MB = 25;
        const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
        
        let validFiles = [];
        let oversizedFiles = [];

        files.forEach(file => {
            if (file.size > MAX_SIZE_BYTES) {
                oversizedFiles.push(file.name);
            } else {
                validFiles.push(file);
            }
        });

        if (oversizedFiles.length > 0) {
            alert(`The following files exceed the 25MB limit:\n- ${oversizedFiles.join('\n- ')}`);
        }

        const newFiles = validFiles.filter(file =>
            !selectedFiles.some(f => f.name === file.name && f.size === file.size)
        );

        setSelectedFiles(prev => [...prev, ...newFiles]);
    };

    const handleNotebookNoteSelect = (note) => {
        // Here we simulate picking a note from localStorage
        // Since we don't have the real content access easily without a specific key,
        // we'll assume for this demo we add it to a "Notebook selection" list
        if (!notebookNotes.some(n => n.id === note.id)) {
            setNotebookNotes(prev => [...prev, note]);
        }
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const removeNotebookNote = (index) => {
        setNotebookNotes(prev => prev.filter((_, i) => i !== index));
    };

    const clearAll = () => {
        setSelectedFiles([]);
        setNotebookNotes([]);
    };

    // --- Drag and Drop Logic ---
    const handleDragStart = (e, file) => {
        e.dataTransfer.setData("application/json", JSON.stringify(file));
        e.dataTransfer.effectAllowed = "copy";
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add(styles.dropZoneActive);
    };

    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove(styles.dropZoneActive);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove(styles.dropZoneActive);
        
        const jsonData = e.dataTransfer.getData("application/json");
        if (jsonData) {
            const note = JSON.parse(jsonData);
            handleNotebookNoteSelect(note);
        } else if (e.dataTransfer.files.length > 0) {
            addFilesToSelection(Array.from(e.dataTransfer.files));
        }
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0 && notebookNotes.length === 0) return;

        try {
            setIsUploading(true);
            setUploadStatus(`Uploading ${selectedFiles.length + notebookNotes.length} file(s)...`);

            let combinedFiles = [...selectedFiles];
            for (const note of notebookNotes) {
                const mockContent = `Content for ${note.name}:\nThis is a detailed analysis of ${note.name.toLowerCase()} retrieved from your internal notebooks.`;
                const blob = new Blob([mockContent], { type: 'text/markdown' });
                const virtualFile = new File([blob], `${note.name}.md`, { type: 'text/markdown' });
                combinedFiles.push(virtualFile);
            }

            const uploadResult = await uploadPDF(combinedFiles);
            const successfulFiles = uploadResult.uploaded_files.filter(f => !f.error);
            if (successfulFiles.length === 0) throw new Error("All files failed");
            
            const allPdfIds = successfulFiles.map(f => f.pdf_id);
            const primaryFile = successfulFiles[0];

            setUploadStatus("Generating structured note...");
            const generatedContent = await generateNote(
                allPdfIds, "test_user", "", selectedLanguage, ordering);

            const title = selectedFiles.length + notebookNotes.length > 1
                ? "Combined Note — " + (selectedFiles.length + notebookNotes.length) + " Documents"
                : (selectedFiles[0]?.name || notebookNotes[0]?.name);

            setUploadStatus("Saving to database...");
            const createResult = await createNote(
                "test_user", title, generatedContent, primaryFile.pdf_id);

            localStorage.setItem('currentNote', JSON.stringify({
                content: generatedContent,
                pdfId: primaryFile.pdf_id,
                pdfUrl: "http://127.0.0.1:8000" + primaryFile.pdf_url,
                noteId: createResult.note_id,
                filename: title,
                allFiles: successfulFiles
            }));

            navigate("/notes/editor/" + createResult.note_id);
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
            <div className={`${styles.uploadCard} ${styles.cardPurple}`} style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
                <div className={styles.iconCirclePurple}>
                    <FileText size={32} color="white" />
                </div>
                <h2 className={styles.textPurple} style={{ fontSize: '24px', marginBottom: '8px' }}>Smart Material Synthesizer</h2>
                <p style={{ fontSize: '14px', color: '#666', marginBottom: '25px' }}>
                    Combine local PDFs and previous notebook notes into one structured study guide.
                </p>

                <div className={styles.mainGrid}>
                    {/* LEFT: Notebook Explorer */}
                    <div className={styles.explorerSection}>
                        <div className={styles.sectionHeader}>
                            <FolderOpen size={18} />
                            <span>My Notebooks</span>
                        </div>
                        <div className={styles.treeContainer}>
                            {folders.length === 0 ? (
                                <div className={styles.emptyTree}>No folders found</div>
                            ) : (
                                folders.map(folder => (
                                    <div key={folder.id} className={styles.folderNode}>
                                        <div className={styles.folderRow} onClick={() => toggleFolder(folder.name)}>
                                            {expandedFolders[folder.name] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            <Folder size={14} className={styles.folderIcon} />
                                            <span>{folder.name}</span>
                                        </div>
                                        {expandedFolders[folder.name] && (
                                            <div className={styles.fileNodes}>
                                                {(filesByFolder[folder.name] || []).map(file => (
                                                    <div 
                                                        key={file.id} 
                                                        className={styles.fileRow}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, file)}
                                                        onClick={() => handleNotebookNoteSelect(file)}
                                                    >
                                                        <FileText size={12} className={styles.fileIconSmall} />
                                                        <span>{file.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                        <p className={styles.hintText}>💡 Drag notes to the right to add them!</p>
                    </div>

                    {/* RIGHT: Selection & DropZone */}
                    <div className={styles.actionSection}>
                        <div
                            className={styles.dropZone}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <CloudUpload size={32} className={styles.addIcon} />
                            <span>Drop Local Files or Notebook Notes here</span>
                            <p style={{fontSize: '11px', color: '#999'}}>PDF, PPTX, MD, TXT supported</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.pptx,.md,.txt"
                                multiple
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                                disabled={isUploading}
                            />
                        </div>

                        {/* Combined Selection List */}
                        {(selectedFiles.length > 0 || notebookNotes.length > 0) && (
                            <div className={styles.fileListContainer}>
                                <div className={styles.fileListHeader}>
                                    <span>Selected: {selectedFiles.length + notebookNotes.length} Items</span>
                                    <button className={styles.clearBtn} onClick={clearAll} disabled={isUploading}>Clear All</button>
                                </div>
                                <div className={styles.fileList}>
                                    {/* Local Files */}
                                    {selectedFiles.map((file, index) => (
                                        <div key={`local-${index}`} className={styles.fileItem}>
                                            <div className={styles.fileInfo}>
                                                <File size={16} className={styles.fileIcon} />
                                                <div className={styles.fileDetails}>
                                                    <span className={styles.fileName}>{file.name}</span>
                                                    <span className={styles.fileSize}>Local • {formatSize(file.size)}</span>
                                                </div>
                                            </div>
                                            <button className={styles.removeFileBtn} onClick={() => removeFile(index)} disabled={isUploading}><X size={14}/></button>
                                        </div>
                                    ))}
                                    {/* Notebook Notes */}
                                    {notebookNotes.map((note, index) => (
                                        <div key={`note-${index}`} className={`${styles.fileItem} ${styles.notebookItem}`}>
                                            <div className={styles.fileInfo}>
                                                <CheckCircle2 size={16} className={styles.checkIcon} />
                                                <div className={styles.fileDetails}>
                                                    <span className={styles.fileName}>{note.name}</span>
                                                    <span className={styles.fileSize}>From Notebook • {note.type || 'MD'}</span>
                                                </div>
                                            </div>
                                            <button className={styles.removeFileBtn} onClick={() => removeNotebookNote(index)} disabled={isUploading}><X size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#4a4a4a' }}>Target Language:</span>
                    <select 
                        value={selectedLanguage} 
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        disabled={isUploading}
                        className={styles.languageSelect}
                    >
                        <option value="English">English</option>
                        <option value="Sinhala">Sinhala</option>
                        <option value="Tamil">Tamil</option>
                    </select>
                </div>

                <div style={{ marginTop: '25px', width: '100%' }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#4a4a4a', marginBottom: '12px', textAlign: 'center' }}>Note Structure:</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                        {[
                            { value: 'topic', label: '🗂️ By Topic', desc: 'Group similar ideas' },
                            { value: 'importance', label: '⚡ By Importance', desc: 'Critical points first' },
                            { value: 'chronological', label: '📖 Step by Step', desc: 'Logical flow' },
                            { value: 'ai', label: '🤖 Let AI Decide', desc: 'Best structure' }
                        ].map((opt) => (
                            <div 
                                key={opt.value}
                                onClick={() => !isUploading && setOrdering(opt.value)}
                                style={{
                                    padding: '12px',
                                    borderRadius: '10px',
                                    border: `2px solid ${ordering === opt.value ? '#9B51E0' : '#e0d7f7'}`,
                                    backgroundColor: ordering === opt.value ? '#f9f5ff' : 'white',
                                    cursor: isUploading ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    textAlign: 'center'
                                }}
                            >
                                <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '4px' }}>{opt.label}</div>
                                <div style={{ fontSize: '10px', color: '#888' }}>{opt.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.buttonRow} style={{ marginTop: '25px', width: '100%', maxWidth: '400px' }}>
                    <button
                        className={styles.btnPurple}
                        onClick={handleUpload}
                        disabled={isUploading || (selectedFiles.length === 0 && notebookNotes.length === 0)}
                        style={{ padding: '14px 40px', fontSize: '16px', width: '100%', borderRadius: '12px' }}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 size={20} className={styles.spinner} />
                                {uploadStatus}
                            </>
                        ) : (
                            <>
                                <CloudUpload size={20} />
                                Generate Synthesized Note
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UploadSection;

