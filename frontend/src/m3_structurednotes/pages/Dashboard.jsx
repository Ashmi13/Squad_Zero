import React, { useState } from 'react';

import UploadSection from '../components/UploadSection';
import FolderGrid from '../components/FolderGrid';
import RecentFiles from '../components/RecentFiles';
import styles from '../../App.module.css'; // Reusing App styles for now

const Dashboard = () => {
    // Member 3: Multi-Select State
    const [selectedNotes, setSelectedNotes] = useState(new Set());
    const [showActionToolbar, setShowActionToolbar] = useState(false);

    const toggleNoteSelection = (noteId) => {
        const newSelection = new Set(selectedNotes);
        if (newSelection.has(noteId)) {
            newSelection.delete(noteId);
        } else {
            newSelection.add(noteId);
        }
        setSelectedNotes(newSelection);
        setShowActionToolbar(newSelection.size > 0);
    };

    const clearSelection = () => {
        setSelectedNotes(new Set());
        setShowActionToolbar(false);
    };

    // Mock Actions for Member 3
    const handleMultiAction = (action) => {
        const count = selectedNotes.size;
        let message = "";
        switch (action) {
            case 'summarize':
                message = `Summarizing ${count} notes: \n- Calculus Notes\n- Quantum Physics\n\n(Mock Summary Generated)`;
                break;
            case 'tag':
                message = `Generated tags for ${count} notes: \n#science #physics #study_material`;
                break;
            case 'related':
                message = `Found 3 related notes for the selected items.`;
                break;
            default: break;
        }
        alert(message); // Simple alert for interim demo
        clearSelection();
    };

    return (
        <div className={styles.app}>
            <main className={styles.mainContent}>

                <UploadSection />

                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                        <h2>Your Files & Folders</h2>
                        <p>24 items • Last updated today</p>
                    </div>
                    <div className={styles.sectionControls}>
                        <button className={styles.controlBtn}>? Grid</button>
                        <button className={styles.controlBtn}>≡ List</button>
                        <select className={styles.sortSelect}>
                            <option>Sort by: Date</option>
                        </select>
                    </div>
                </div>

                <div className={styles.contentGrid}>
                    <FolderGrid />
                    <RecentFiles
                        selectedNotes={selectedNotes}
                        onToggleSelection={toggleNoteSelection}
                    />
                </div>

                {/* Member 3: Multi-Note Action Toolbar */}
                {showActionToolbar && (
                    <div style={{
                        position: 'fixed',
                        bottom: '30px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#1B1D21',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                        zIndex: 1000
                    }}>
                        <span style={{ fontWeight: 600 }}>{selectedNotes.size} selected</span>
                        <div style={{ width: '1px', height: '20px', backgroundColor: '#333' }}></div>

                        <button onClick={() => handleMultiAction('summarize')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ✨ Summarize
                        </button>
                        <button onClick={() => handleMultiAction('tag')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🏷️ Tag
                        </button>
                        <button onClick={() => handleMultiAction('related')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🔗 Find Related
                        </button>

                        <div style={{ width: '1px', height: '20px', backgroundColor: '#333' }}></div>
                        <button onClick={clearSelection} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}>
                            Cancel
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
