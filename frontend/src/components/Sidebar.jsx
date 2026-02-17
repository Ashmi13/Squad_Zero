import React, { useState } from 'react';
import { LayoutDashboard, Folder, Clock, Star, Trash2, Calendar, Settings, LogOut } from 'lucide-react';
import styles from './Sidebar.module.css';

const Sidebar = () => {
  const [activeItem, setActiveItem] = useState('Dashboard');

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'My Files', icon: Folder },
    { name: 'Recent', icon: Clock },
    { name: 'Favorites', icon: Star },
    { name: 'Trash', icon: Trash2 },
    { name: 'Culander', icon: Calendar }, // Typo in original image 'Culander' -> Calendar check. Image says 'Culander' but looks like a calendar/grid icon. Sticking to text 'Culander' if user wants exact text, but likely 'Calendar'. Image text says 'Culander'. I will use 'Culander' to be exact.
  ];

  return (
    <div className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <img src="https://via.placeholder.com/24/6C5DD3/FFFFFF?text=N" alt="Logo" style={{borderRadius: '50%'}}/> {/* Placeholder for logo icon */}
        </div>
        <span>Neura Note</span>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => (
          <div
            key={item.name}
            className={`${styles.navItem} ${activeItem === item.name ? styles.active : ''}`}
            onClick={() => setActiveItem(item.name)}
          >
            <item.icon size={20} className={styles.icon} />
            <span>{item.name}</span>
            {activeItem === item.name && <div className={styles.activeIndicator}></div>}
          </div>
        ))}
      </nav>

      <div className={styles.spacer}></div>

      <div className={styles.storageWidget}>
        <div className={styles.storageHeader}>
          <span>Storage</span>
          <img src="https://via.placeholder.com/16/FFFFFF/6C5DD3?text=+" alt="Cloud" />
        </div>
        <div className={styles.storageBar}>
          <div className={styles.storageFill} style={{width: '68%'}}></div>
        </div>
        <div className={styles.storageText}>6.8 GB of 10 GB used</div>
      </div>

      <div className={styles.profile}>
        <img src="https://via.placeholder.com/32" alt="Profile" className={styles.avatar} />
        <div className={styles.profileInfo}>
          <div className={styles.name}>Alex Morgan</div>
          <div className={styles.plan}>Premium Plan</div>
        </div>
        <Settings size={16} className={styles.settingsIcon} />
      </div>
    </div>
  );
};

export default Sidebar;
