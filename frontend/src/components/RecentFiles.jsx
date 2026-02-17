import React from 'react';
import { FileText, MoreVertical, Download } from 'lucide-react';
import styles from './RecentFiles.module.css';

const RecentFiles = () => {
    const files = [
        {
            name: 'Calculus Notes.pdf',
            size: '2.4 MB',
            date: 'Today at 10:30 AM',
            type: 'pdf',
            status: 'Processed',
            color: '#FF5252'
        },
        {
            name: 'Essay Draft.docx',
            size: '1.8 MB',
            date: 'Today at 9:15 AM',
            type: 'word',
            status: 'Generating',
            color: '#448AFF'
        },
        {
            name: 'Presentation.pptx',
            size: '5.2 MB',
            date: 'Yesterday',
            type: 'ppt',
            status: 'Processed',
            color: '#FFAB40'
        },
        {
            name: 'Quantum Physics.pdf',
            size: '3.7 MB',
            date: 'Yesterday',
            type: 'pdf',
            status: 'Processed',
            color: '#FF5252'
        },
    ];

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3>Recent Files</h3>
                <div className={styles.controls}>
                    {/* Add controls like "Sort by: Date" if needed */}
                </div>
            </div>

            <div className={styles.grid}>
                {files.map((file, index) => (
                    <div key={index} className={styles.card}>
                        <div className={styles.cardTop}>
                            <div
                                className={styles.iconContainer}
                                style={{ backgroundColor: `${file.color}15`, color: file.color }}
                            >
                                <FileText size={24} />
                                <span className={styles.fileExt}>{file.type.toUpperCase()}</span>
                            </div>

                            <div className={`${styles.statusBadge} ${styles[file.status.toLowerCase()]}`}>
                                {file.status === 'Generating' && <span className={styles.spinner}></span>}
                                {file.status}
                            </div>
                        </div>

                        <div className={styles.fileInfo}>
                            <h4>{file.name}</h4>
                            <p>{file.size} • {file.date}</p>
                        </div>

                        <div className={styles.actions}>
                            <button className={styles.downloadBtn}>
                                <Download size={14} />
                                Download
                            </button>
                            <button className={styles.menuBtn}>
                                <MoreVertical size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RecentFiles;
