import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import UploadSection from '../components/UploadSection';
import FolderGrid from '../components/FolderGrid';
import RecentFiles from '../components/RecentFiles';
import styles from '../App.module.css'; // Reusing App styles for now

const Dashboard = () => {
    // We can add state here for the file list to update after upload
    return (
        <div className={styles.app}>
            <Sidebar />
            <main className={styles.mainContent}>
                <Header />
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
                    <RecentFiles />
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
