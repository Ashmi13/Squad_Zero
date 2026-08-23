import React, { useState, useEffect } from 'react';
import { FileText, MoreVertical, Download, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './RecentFiles.module.css';
import { getNotes } from '../api';

const normalizeNotesPayload = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') {
        if (Array.isArray(payload.notes)) return payload.notes;
        if (Array.isArray(payload.data)) return payload.data;
    }
    return [];
};

const RecentFiles = ({ selectedNotes, onToggleSelection, folderId }) => {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const USER_ID = "test_user";

    useEffect(() => {
        fetchNotes();
    }, [folderId]); // Re-fetch when folder changes

    const fetchNotes = async () => {
        try {
            setLoading(true);
            const data = await getNotes(USER_ID, folderId);
            const notes = normalizeNotesPayload(data);
            // Transform backend data to UI format
            const formattedFiles = notes.map(note => ({
                id: note.note_id || note.id,
                name: note.title || 'Untitled Note',
                size: '2.4 MB', // Mock size as we don't store it yet
                date: new Date(note.created_date || note.created_at || Date.now()).toLocaleString(),
                type: 'ai', // Distinction for icon
                status: 'Processed',
                color: '#6C5DD3'
            })).filter((file) => Boolean(file.id));
            setFiles(formattedFiles);
        } catch (error) {
            console.error("Failed to fetch notes", error);
            setFiles([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3>Recent Files</h3>
                <div className={styles.controls}>
                    {/* Add controls like "Sort by: Date" if needed */}
                </div>
            </div>

            {loading ? <p>Loading notes...</p> : (
                <div className={styles.grid}>
                    {files.length === 0 ? <p>No notes found. Create one above!</p> : files.map((file) => {
                        const isSelected = selectedNotes?.has(file.id);
                        return (
                            <div
                                key={file.id}
                                className={`${styles.card} ${isSelected ? styles.selected : ''}`}
                                onClick={(e) => {
                                    // Navigate to note unless clicking selection
                                    navigate(`/editor/${file.id}`);
                                }}
                                style={{
                                    border: isSelected ? '2px solid #2F6CF6' : '1px solid #eee',
                                    cursor: 'pointer',
                                    position: 'relative'
                                }}
                            >
                                {/* Selection Checkbox */}
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleSelection && onToggleSelection(file.id);
                                    }}
                                    style={{
                                        position: 'absolute',
                                        top: '10px',
                                        right: '10px',
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        border: isSelected ? 'none' : '2px solid #ddd',
                                        backgroundColor: isSelected ? '#2F6CF6' : 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        zIndex: 5
                                    }}>
                                    {isSelected && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
                                </div>

                                <div className={styles.cardTop}>
                                    <div
                                        className={styles.iconContainer}
                                        style={{ backgroundColor: `${file.color}15`, color: file.color }}
                                    >
                                        <FileText size={24} />
                                        <span className={styles.fileExt}>AI</span>
                                    </div>

                                    <div className={`${styles.statusBadge} ${styles.processed}`}>
                                        Ready
                                    </div>
                                </div>

                                <div className={styles.fileInfo}>
                                    <h4>{file.name}</h4>
                                    <p>{file.size} • {file.date}</p>
                                </div>

                                <div className={styles.actions}>
                                    <button className={styles.downloadBtn} onClick={(e) => e.stopPropagation()}>
                                        <Download size={14} />
                                        Download
                                    </button>
                                    <button className={styles.menuBtn} onClick={(e) => e.stopPropagation()}>
                                        <MoreVertical size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default RecentFiles;
