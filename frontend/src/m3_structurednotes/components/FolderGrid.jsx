import React from 'react';
import { Folder, MoreVertical } from 'lucide-react';
import styles from './FolderGrid.module.css';

const FolderGrid = () => {
    const folders = [
        { name: 'AI', files: 12, size: '145 MB', color: '#448AFF', bgColor: '#E3F2FD' },
        { name: 'Physics', files: 8, size: '98 MB', color: '#B39DDB', bgColor: '#F3E5F5' }, // Adjusted purple
        { name: 'Chemistry', files: 15, size: '201 MB', color: '#00E676', bgColor: '#E8F5E9' },
        { name: 'Biology', files: 10, size: '167 MB', color: '#FFAB40', bgColor: '#FFF3E0' },
    ];

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3>Folders</h3>
                <div className={styles.controls}>
                    {/* Add controls if needed, e.g. View All */}
                </div>
            </div>

            <div className={styles.grid}>
                {folders.map((folder) => (
                    <div key={folder.name} className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div
                                className={styles.iconContainer}
                                style={{ backgroundColor: folder.color }}
                            >
                                <Folder size={20} color="white" fill="white" />
                            </div>
                            <button className={styles.menuBtn}>
                                <MoreVertical size={16} color="var(--secondary)" />
                            </button>
                        </div>

                        <div className={styles.cardBody}>
                            <h4>{folder.name}</h4>
                            <p>{folder.files} files • {folder.size}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FolderGrid;
