import React from 'react';
import UploadSection from '../components/UploadSection';

const Dashboard = () => {
    return (
        <div style={{ 
            height: '100vh',
            overflowY: 'auto',
            backgroundColor: '#f8f9fa', 
            padding: '60px 20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start'
        }}>
            <div style={{ width: '100%', maxWidth: '900px' }}>
                <UploadSection />
            </div>
        </div>
    );
};

export default Dashboard;
