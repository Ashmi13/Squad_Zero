import React, { useState, useEffect } from 'react';
import { Folder, Plus, Check } from 'lucide-react';
import styles from './SaveModal.module.css';
import { getFolders, createFolder, saveNoteToFolder } from '../api';

const SaveModal = ({ noteId, onClose, onSave }) => {
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newFolderName, setNewFolderName] = useState('');
    const [selectedFolderId, setSelectedFolderId] = useState(null);
    const [noteTitle, setNoteTitle] = useState('Untitled Note');
    const USER_ID = "test_user"; // Replace with real user context

    // Initial folders - mock until backend is connected or if fails
    const initialFolders = [
        { id: '44b24a92-5d5e-424b-8e3c-a21f32e104c4', name: 'AI', color: '#448AFF' },
        { id: 'dcb09c95-30ab-458c-8209-4d84c32c124c', name: 'Physics', color: '#B39DDB' },
        { id: 'f07b6768-05ab-41fd-a72a-e932820c580d', name: 'Chemistry', color: '#00E676' },
        { id: 'e93301ce-6997-48a9-ab3c-f37734b28924', name: 'Biology', color: '#FFAB40' }
    ];

    useEffect(() => {
        fetchFolders();
    }, []);

    const fetchFolders = async () => {
        try {
            setLoading(true);
            const data = await getFolders(USER_ID);
            // Merge with initial mock folders if backend returns empty (for demo)
            setFolders(data.length > 0 ? data : initialFolders);
        } catch (error) {
            console.error("Failed to fetch folders", error);
            setFolders(initialFolders);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            const newFolder = await createFolder(USER_ID, newFolderName);
            setFolders([newFolder, ...folders]);
            setNewFolderName('');
            setSelectedFolderId(newFolder.id);
        } catch (error) {
            console.error("Failed to create folder", error);
        }
    };

    const handleSave = async () => {
        // If we need to actually update the note's folder in backend
        if (selectedFolderId) {
            try {
                // Assume we have a noteId from the editor (which might handle the first save)
                // If the note isn't saved to DB yet, we might need to do that first.
                // But generateNote saves it. So we have noteId.
                if (noteId) {
                    await saveNoteToFolder(noteId, selectedFolderId);
                }
                onSave(noteTitle); // Pass title back
            } catch (error) {
                console.error("Failed to save to folder", error);
                alert("Failed to save. Note might stay in 'Recent'.");
                onSave(noteTitle); // Close and save with title anyway
            }
        } else {
            alert("Please select a folder.");
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h3>Save to Folder</h3>
                    <button className={styles.closeBtn} onClick={onClose}>×</button>
                </div>

                <div className={styles.body}>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Note Title</label>
                        <input
                            type="text"
                            placeholder="Enter note title..."
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.divider}></div>

                    <label className={styles.label}>Select Folder</label>
                    <div className={styles.createSection}>
                        <input
                            type="text"
                            placeholder="New Folder Name"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            className={styles.input}
                        />
                        <button className={styles.createBtn} onClick={handleCreateFolder}>
                            <Plus size={16} /> Create
                        </button>
                    </div>

                    <div className={styles.folderList}>
                        {loading ? <p>Loading folders...</p> : (
                            folders.map((folder) => (
                                <div
                                    key={folder.id}
                                    className={`${styles.folderItem} ${selectedFolderId === folder.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedFolderId(folder.id)}
                                >
                                    <div className={styles.folderIcon}>
                                        <Folder size={18} fill={selectedFolderId === folder.id ? "white" : "currentColor"} />
                                    </div>
                                    <span>{folder.name}</span>
                                    {selectedFolderId === folder.id && <Check size={16} className={styles.checkIcon} />}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                    <button className={styles.confirmBtn} onClick={handleSave}>Save Here</button>
                </div>
            </div>
        </div>
    );
};

export default SaveModal;
