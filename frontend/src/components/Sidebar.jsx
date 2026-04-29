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
  const [isDragging, setIsDragging] = useState(false);
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

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Check if multiple files or folder uploaded
    if (files.length > 1) {
       const userConfirmed = window.confirm(`You uploaded ${files.length} multiple files. Do you want to combine them to create novel ideas and generate a structured note?`);
       if (!userConfirmed) return;
    }

    try {
      // Create FormData to upload
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      
      alert(`Uploading ${files.length} file(s) for structured note generation...`);
      
      // Call standard backend upload (simulated for UI)
      // fetch('http://localhost:8000/api/v1/m3/upload', { ... })
      
      alert('Generating structured note with deep fresh algorithm (including Image Extraction if present)... This note will be automatically saved to this folder view.');
      
      // Auto redirect to Editor logically
      navigate('/notes/editor/demo-note');

    } catch (err) {
      console.error(err);
    }
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
    <div 
      className={`${styles.navPanel} ${isDragging ? styles.dragOver : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {isDragging && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          border: '2px dashed #6366f1',
          zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(2px)'
        }}>
          <p style={{ color: '#6366f1', fontWeight: 'bold' }}>Drop MD/TXT/PDF to Generate Note</p>
        </div>
      )}
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
