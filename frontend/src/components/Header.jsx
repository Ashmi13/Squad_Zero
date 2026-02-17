import React from 'react';
import { Search, Bell, Settings } from 'lucide-react';
import styles from './Header.module.css';

const Header = () => {
    return (
        <div className={styles.header}>
            <div className={styles.titleSection}>
                <h1>Dashboard</h1>
                <p>Manage your study materials and documents</p>
            </div>

            <div className={styles.actions}>
                <div className={styles.searchContainer}>
                    <Search size={18} className={styles.searchIcon} />
                    <input type="text" placeholder="Search files..." className={styles.searchInput} />
                </div>

                <button className={styles.iconButton}>
                    <Bell size={20} />
                    <div className={styles.notificationDot}></div>
                </button>

                <button className={styles.iconButton}>
                    <Settings size={20} />
                </button>
            </div>
        </div>
    );
};

export default Header;
