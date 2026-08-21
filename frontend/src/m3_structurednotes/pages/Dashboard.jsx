import React from 'react';
import UploadSection from '../components/UploadSection';
import styles from './Dashboard.module.css';

const Dashboard = () => {
    return (
        <div className={styles.app}>
            <main className={styles.mainContent}>
                <UploadSection />
            </main>
        </div>
    );
};

export default Dashboard;
