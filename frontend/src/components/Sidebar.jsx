import React, { useState } from 'react';
import {
  LayoutDashboard, Folder, Clock, Star, Trash2, Calendar, Settings, LogOut,
  Home, Edit3, BrainCircuit, CheckSquare, ChevronRight, ChevronDown, Plus
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeRail, setActiveRail] = useState('home');
  const [expandedFolders, setExpandedFolders] = useState({
    'software-eng': true,
    'algorithms': true
  });

  const toggleFolder = (id) => {
    setExpandedFolders(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const IconRail = () => (
    <div className={styles.iconRail}>
      <div className={styles.railLogo}>
        <img src="https://via.placeholder.com/32/6C5DD3/FFFFFF?text=N" alt="Logo" style={{ borderRadius: '8px' }} />
      </div>

      <div className={styles.railActions}>
        <RailItem id="home" icon={Home} active={location.pathname === '/' || activeRail === 'home'} onClick={() => navigate('/')} />
        <RailItem id="edit" icon={Edit3} active={location.pathname.includes('/editor')} />
        <RailItem id="brain" icon={BrainCircuit} />
        <RailItem id="tasks" icon={CheckSquare} />
      </div>

      <div className={styles.railFooter}>
        <div className={styles.avatar}>
          <img src="https://via.placeholder.com/32" alt="Profile" />
        </div>
        <Settings size={20} className={styles.railIcon} />
      </div>
    </div>
  );

  const RailItem = ({ id, icon: Icon, active, onClick }) => (
    <div
      className={`${styles.railItem} ${active ? styles.activeRail : ''}`}
      onClick={() => { setActiveRail(id); onClick && onClick(); }}
    >
      <Icon size={24} strokeWidth={1.5} />
    </div>
  );

  const NavPanel = () => (
    <div className={styles.navPanel}>
      <div className={styles.panelHeader}>
        <h3>Notebooks</h3>
        <button className={styles.addBtn}><Plus size={16} /></button>
      </div>

      <div className={styles.fileTree}>
        <TreeNode
          id="software-eng"
          label="Software Engineering"
          depth={0}
          expanded={expandedFolders['software-eng']}
          onToggle={() => toggleFolder('software-eng')}
        >
          <TreeNode
            id="algorithms"
            label="Algorithms"
            depth={1}
            expanded={expandedFolders['algorithms']}
            onToggle={() => toggleFolder('algorithms')}
          >
            <FileNode label="Lecture Notes" depth={2} type="doc" />
            <FileNode label="PDF Slides" depth={2} type="pdf" />
            <FileNode label="Tori.cz" depth={2} type="doc" />
          </TreeNode>
          <FileNode label="Assets" depth={1} type="folder" />
          <FileNode label="Module 3 Notes" depth={1} type="doc" />
        </TreeNode>

        <TreeNode id="data-design" label="Data Design" depth={0} />
        <TreeNode id="program-brain" label="Program Brain" depth={0} />
      </div>

      <div className={styles.storageWidget}>
        <div className={styles.storageText}>
          <strong>Storage</strong>
          <span>78%</span>
        </div>
        <div className={styles.storageBar}>
          <div className={styles.storageFill} style={{ width: '78%' }}></div>
        </div>
        <div className={styles.upgradeBtn}>Upgrade Plan</div>
      </div>
    </div>
  );

  const TreeNode = ({ id, label, depth, expanded, onToggle, children }) => (
    <div className={styles.treeNode}>
      <div
        className={styles.nodeLabel}
        style={{ paddingLeft: `${depth * 15}px` }}
        onClick={onToggle}
      >
        {children ? (
          expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        ) : <span style={{ width: 14 }}></span>}
        <span className={styles.folderIcon}>📁</span>
        {label}
      </div>
      {expanded && children && <div className={styles.nodeChildren}>{children}</div>}
    </div>
  );

  const FileNode = ({ label, depth, type }) => (
    <div className={styles.fileNode} style={{ paddingLeft: `${depth * 15 + 20}px` }}>
      <span className={styles.fileIcon}>{type === 'pdf' ? '🔴' : 'Vkd'}</span>
      {label}
    </div>
  );

  return (
    <div className={styles.sidebarContainer}>
      <IconRail />
      <NavPanel />
    </div>
  );
};

export default Sidebar;
