import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Search, ZoomIn, ZoomOut, RefreshCw, Hash, Link2, FileText, X, Info, Upload } from 'lucide-react';
import { secondBrainApi, ensureSecondBrainFolder } from '@/services/secondBrainApi';
import { workspaceApi } from '@/services/workspaceApi';
import ConfirmDialog from '../components/common/ConfirmDialog';

// demo notes used until the real notes API is connected after M3 merges
// replace this with: GET /api/v1/notes/ -> { id, title, content, folder, updated_at }
const DEMO_NOTES = [
  {
    id: 'n1', title: 'Intro to Machine Learning', folder: 'Computer Science', updatedAt: '2025-01-20',
    content: 'Machine learning is a subset of AI. Covers supervised, unsupervised learning. #ml #ai #algorithms\n[[Neural Networks]] [[Data Science Basics]]',
  },
  {
    id: 'n2', title: 'Neural Networks', folder: 'Computer Science', updatedAt: '2025-01-21',
    content: 'Deep learning uses layered architectures. Backpropagation & gradient descent. #ml #deeplearning #ai\n[[Intro to Machine Learning]] [[Calculus Fundamentals]]',
  },
  {
    id: 'n3', title: 'Data Science Basics', folder: 'Computer Science', updatedAt: '2025-01-18',
    content: 'Statistics, visualisation, data wrangling. Pandas, NumPy, Matplotlib. #datascience #statistics #python\n[[Python Programming]] [[Statistics Review]]',
  },
  {
    id: 'n4', title: 'Calculus Fundamentals', folder: 'Mathematics', updatedAt: '2025-01-15',
    content: 'Derivatives, integrals, limits — backbone of ML and engineering. #math #calculus\n[[Neural Networks]] [[Physics Mechanics]]',
  },
  {
    id: 'n5', title: 'Statistics Review', folder: 'Mathematics', updatedAt: '2025-01-22',
    content: 'Probability distributions, hypothesis testing, regression. #statistics #math #probability\n[[Data Science Basics]] [[Research Methods]]',
  },
  {
    id: 'n6', title: 'Python Programming', folder: 'Programming', updatedAt: '2025-01-19',
    content: 'OOP, functional patterns, scientific computing libraries. #python #programming\n[[Data Science Basics]] [[Algorithms & Data Structures]]',
  },
  {
    id: 'n7', title: 'Algorithms & Data Structures', folder: 'Computer Science', updatedAt: '2025-01-17',
    content: 'Arrays, trees, graphs, complexity analysis. #algorithms #cs #programming\n[[Intro to Machine Learning]] [[Python Programming]]',
  },
  {
    id: 'n8', title: 'Research Methods', folder: 'General', updatedAt: '2025-01-14',
    content: 'Qualitative and quantitative research design, ethics. #research #methodology\n[[Statistics Review]]',
  },
  {
    id: 'n9', title: 'Physics Mechanics', folder: 'Science', updatedAt: '2025-01-12',
    content: "Newton's laws, kinematics, energy conservation. #physics #mechanics\n[[Calculus Fundamentals]]",
  },
  {
    id: 'n10', title: 'Database Systems', folder: 'Computer Science', updatedAt: '2025-01-23',
    content: 'Relational algebra, SQL, indexing, transactions, ACID. #databases #cs #sql\n[[Python Programming]] [[Algorithms & Data Structures]]',
  },
];

const FALLBACK_DEMO_NOTES = DEMO_NOTES.slice(0, 2);

function apiNoteToGraphNote(n) {
  const tagLine = n.tags?.length
    ? n.tags.map(t => `#${t}`).join(' ')
    : '';

  const linkLine = n.outgoing_links?.length
    ? n.outgoing_links.map(l => `[[${l.to_title}]]`).join(' ')
    : '';

  const cleanContent = (n.content || '')
    .replace(/\[\[[^\]]+\]\]/g, '')
    .trim();

  return {
    id: n.id,
    title: n.title,
    color: n.color || DEFAULT_COLOR,
    folder: 'Second Brain',
    updatedAt: (n.updated_at || '').slice(0, 10),
    content: [cleanContent, tagLine, linkLine]
      .filter(Boolean)
      .join('\n'),
  };
}
// color per note — used for node color and edge gradients
const NOTE_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16',
];
const DEFAULT_COLOR = '#6366f1';
const getColor = (node) => node?.color || DEFAULT_COLOR;

// parse notes into graph nodes and edges
// extracts #tags and [[backlinks]] from note content
// also creates edges between notes that share 2+ tags
function parseGraph(notes) {
  const parsed = notes.map(note => ({
    ...note,
    tags:      [...new Set((note.content.match(/#(\w+)/g)           || []).map(t => t.slice(1)))],
    backlinks: [...new Set((note.content.match(/\[\[([^\]]+)\]\]/g) || []).map(b => b.slice(2, -2)))],
  }));

  // map title -> id so we can resolve backlinks
  const titleMap = {};
  parsed.forEach(n => { titleMap[n.title.toLowerCase()] = n.id; });

  // place nodes in a circle initially so the simulation has a clean start
  const nodes = parsed.map((note, i) => {
    const angle = (i / parsed.length) * Math.PI * 2;
    const r     = 200;
    return {
      id: note.id, title: note.title, color: note.color, folder: note.folder,
      updatedAt: note.updatedAt, tags: note.tags,
      backlinks: note.backlinks, content: note.content,
      x: Math.cos(angle) * r, y: Math.sin(angle) * r,
      vx: 0, vy: 0,
      radius: 9 + Math.min(note.tags.length * 2.5, 10), // bigger = more tags
      pinned: false,
    };
  });

  const edges   = [];
  const edgeSet = new Set();

  // edges from [[backlink]] references
  parsed.forEach(note => {
    note.backlinks.forEach(link => {
      const targetId = titleMap[link.toLowerCase()];
      if (!targetId || targetId === note.id) return;
      const key = [note.id, targetId].sort().join('||');
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: note.id, target: targetId, type: 'backlink' });
      }
    });
  });

  // edges from shared tags (notes with 2+ tags in common get connected)
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const shared = parsed[i].tags.filter(t => parsed[j].tags.includes(t));
      if (shared.length < 2) continue;
      const key = [parsed[i].id, parsed[j].id].sort().join('||');
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: parsed[i].id, target: parsed[j].id, type: 'tag', sharedTags: shared });
      }
    }
  }

  const allTags = [...new Set(parsed.flatMap(n => n.tags))].sort();
  return { nodes, edges, allTags };
}

// all styles in one object to keep the JSX clean
const S = {
  page: {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    background: '#0b0f19', overflow: 'hidden', fontFamily: 'system-ui, sans-serif',
    backgroundImage: 'radial-gradient(circle at 15% 50%, rgba(99,102,241,0.06) 0%, transparent 30%), radial-gradient(circle at 85% 30%, rgba(16,185,129,0.04) 0%, transparent 30%)',
  },
  topBar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: '#111827', flexShrink: 0,
  },
  title:  { color: '#e5e7eb', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', marginRight: 8 },
  badge: {
    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
    background: 'rgba(99,102,241,0.12)', color: '#818cf8',
    border: '1px solid rgba(99,102,241,0.25)',
  },
  searchWrap: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: '5px 10px', flex: 1, maxWidth: 280,
  },
  searchInput: { background: 'none', border: 'none', outline: 'none', color: '#e5e7eb', fontSize: 13, width: '100%' },
  iconBtn: {
    width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer', color: '#9ca3af', transition: 'all 0.15s',
  },
  body:    { flex: 1, display: 'flex', overflow: 'hidden' },
  sidebar: {
    width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
    borderRight: '1px solid rgba(255,255,255,0.06)', background: '#0d1117', overflow: 'hidden',
  },
  sidebarSection: { padding: '14px 14px 0' },
  sidebarLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: '#4b5563', marginBottom: 8, display: 'block',
  },
  noteItem: (active) => ({
    padding: '7px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 3,
    background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
    border: `1px solid ${active ? 'rgba(99,102,241,0.25)' : 'transparent'}`,
    borderLeft: `3px solid ${active ? '#6366f1' : 'transparent'}`,
    transition: 'all 0.15s',
  }),
  noteTitle:  { color: '#d1d5db', fontSize: 12, fontWeight: 500, marginBottom: 2, lineHeight: 1.3 },
  noteFolder: { color: '#4b5563', fontSize: 10 },
  tagChip: (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: 3,
    padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: 'pointer',
    background: active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
    color: active ? '#818cf8' : '#6b7280',
    border: `1px solid ${active ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.06)'}`,
    transition: 'all 0.15s', margin: '0 3px 5px 0',
  }),
  rightPanel: {
  width: 280,
  boxSizing: 'border-box',
  flexShrink: 0,
  padding: 16,
  borderLeft: '1px solid rgba(255,255,255,0.06)',
  background: '#0d1117',
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
},
  infoRow:   { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  infoLabel: { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4b5563', minWidth: 60 },
  infoVal:   { fontSize: 12, color: '#9ca3af', lineHeight: 1.5 },
  hint: {
    position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: '6px 14px', fontSize: 11, color: '#6b7280',
    display: 'flex', gap: 16, backdropFilter: 'blur(8px)', pointerEvents: 'none', whiteSpace: 'nowrap',
  },
};

function NoteDropZone({ onNoteAdded }) {
  const [isOver, setIsOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const handleFile = async (file, sourceFileId) => {
    setBusy(true);
    setStatus(`Adding "${file.name}"...`);
    try {
      await secondBrainApi.createNoteFromUpload(file, { title: file.name, sourceFileId });

      if (!sourceFileId) {
        try {
          const folderId = await ensureSecondBrainFolder();
          await workspaceApi.uploadFile(folderId, file);
        } catch (workspaceErr) {
          console.warn('Workspace save skipped (note was still created):', workspaceErr);
          setStatus(`"${file.name}" added. (Workspace save skipped.)`);
          setTimeout(() => setStatus(''), 4000);
          await onNoteAdded();
          setBusy(false);
          return;
        }
      }

      setStatus(`"${file.name}" added.`);
      setTimeout(() => setStatus(''), 3000);
      await onNoteAdded();
    } catch (err) {
      setStatus(`Failed: ${err.message}`);
      setTimeout(() => setStatus(''), 4000);
    } finally {
      setBusy(false);
    }
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setIsOver(false);

    const treeData = e.dataTransfer.getData('application/json');
    if (treeData) {
      try {
        const { fileId, fileName } = JSON.parse(treeData);
        setStatus('Fetching file from workspace...');
        const { preview } = await workspaceApi.getFilePreview(fileId);
        const url = preview?.url;
        if (!url) throw new Error('No preview URL — file may not exist in workspace yet.');
        const resp = await fetch(url);
        const blob = await resp.blob();
        const file = new File([blob], fileName, { type: blob.type });
        await handleFile(file, fileId);
      } catch (err) {
        setStatus(`Failed: ${err.message}`);
        setTimeout(() => setStatus(''), 4000);
      }
      return;
    }

    if (e.dataTransfer.files?.length) {
      for (const file of e.dataTransfer.files) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['pdf', 'txt', 'md'].includes(ext)) continue;
        await handleFile(file, null);
      }
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={onDrop}
      style={{
        margin: '0 14px 10px', padding: '14px 10px', borderRadius: 10,
        border: `1.5px dashed ${isOver ? '#818cf8' : 'rgba(255,255,255,0.15)'}`,
        background: isOver ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        color: '#6b7280', fontSize: 11.5, textAlign: 'center', transition: 'all 0.15s',
      }}
    >
      <Upload size={16} color={isOver ? '#818cf8' : '#4b5563'} />
      <span>{busy ? status || 'Working...' : 'Drop PDF/TXT/MD here'}</span>
      {!busy && status && (
        <span style={{ color: status.startsWith('Failed') ? '#f87171' : '#34d399' }}>{status}</span>
      )}
    </div>
  );
}

function ManualTagBacklinkForm({ note, allNotes, onUpdated }) {
  const [tagInput, setTagInput] = useState('');
  const [linkTarget, setLinkTarget] = useState('');

  const submitTag = async () => {
    if (!tagInput.trim()) return;
    await secondBrainApi.addTags(note.id, tagInput.split(',').map(t => t.trim()).filter(Boolean));
    setTagInput('');
    onUpdated();
  };

  const submitLink = async () => {
    if (!linkTarget) return;
    await secondBrainApi.addBacklink(note.id, linkTarget);
    setLinkTarget('');
    onUpdated();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={S.sidebarLabel}>Add tag / backlink</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="tag1, tag2"
          style={{ flex: 1, fontSize: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 6px', color: '#e5e7eb' }}
        />
        <button onClick={submitTag} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer' }}>Add</button>
      </div>
     <div
  style={{
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 44px',
    gap: 4,
    width: '100%',
  }}
>
  <select
    value={linkTarget}
    onChange={(e) => setLinkTarget(e.target.value)}
    style={{
      width: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
      fontSize: 11,
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 6,
      color: '#e5e7eb',
      padding: '4px 6px',
    }}
  >
   <option
  value=""
  style={{
    background: '#111827',
    color: '#e5e7eb',
  }}
>
  Link to note...
</option>

    {allNotes
      .filter(n => n.id !== note.id)
      .map(n => (
        <option
  key={n.id}
  value={n.id}
  style={{
    background: '#111827',
    color: '#e5e7eb',
  }}
>
  {n.title}
</option>
      ))}
  </select>

  <button
    onClick={submitLink}
    style={{
      width: 44,
      minWidth: 44,
      padding: '4px 0',
      borderRadius: 6,
      border: 'none',
      background: '#6366f1',
      color: '#fff',
      cursor: 'pointer',
      fontSize: 11,
    }}
  >
    Link
  </button>
</div>
    </div>
  );
}

export default function SecondBrainPage() {
  const canvasRef = useRef(null);
  const simRef    = useRef(null);  // holds { nodes, edges, idMap } for the physics sim
  const rafRef    = useRef(null);  // animation frame handle so we can cancel on cleanup

  // all render/interaction state lives here to avoid re-renders on every frame
  const stateRef = useRef({
    zoom: 1, panX: 0, panY: 0,
    hoveredId: null, selectedId: null,
    isDraggingNode: false, dragNode: null,
    isPanning: false, lastPanX: 0, lastPanY: 0,
    mouseDownPos: null, frameCount: 0,
    filterTag: null, searchQuery: '',
  });

  const [graphData,    setGraphData]    = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeTag,    setActiveTag]    = useState(null);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [zoomDisplay,  setZoomDisplay]  = useState(100);

  // ── confirm dialog for tag/backlink removal ──
  const [confirm, setConfirm] = useState({
    open: false,
    type: 'danger',
    title: '',
    message: '',
    confirmLabel: 'Remove',
    onConfirm: () => {},
  });
  const closeConfirm = () => setConfirm(prev => ({ ...prev, open: false }));
  const openConfirm = (opts) => setConfirm({ open: true, cancelLabel: 'Cancel', ...opts, onCancel: closeConfirm });

  const loadGraphFrom = (notesArray) => {
    const g = parseGraph(notesArray);
    g.idMap = {};
    g.nodes.forEach(n => { g.idMap[n.id] = n; });
    simRef.current = g;
    setGraphData(g);
  };

  const refetchNotes = async () => {
    try {
      const apiNotes = await secondBrainApi.listNotes();
      loadGraphFrom(apiNotes?.length ? apiNotes.map(apiNoteToGraphNote) : FALLBACK_DEMO_NOTES);
    } catch (err) {
      console.warn('Second Brain notes fetch failed:', err);
    }
  };

  // fetch real notes on first render, falling back to 2 demo notes if empty/failed
  useEffect(() => {
    (async () => {
      try {
        const apiNotes = await secondBrainApi.listNotes();
        loadGraphFrom(apiNotes?.length ? apiNotes.map(apiNoteToGraphNote) : FALLBACK_DEMO_NOTES);
      } catch (err) {
        console.warn('Second Brain notes fetch failed, using demo notes:', err);
        loadGraphFrom(FALLBACK_DEMO_NOTES);
      }
    })();
  }, []);

  // main physics + render loop — runs once graphData is ready
  useEffect(() => {
    if (!graphData) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // keep canvas pixel size in sync with its CSS size
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      if (stateRef.current.frameCount === 0) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        simRef.current.nodes.forEach(n => { n.x += cx; n.y += cy; });
        stateRef.current.panX = 0;
        stateRef.current.panY = 0;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // physics constants — tuned to give a "jelly" bouncy feel
    const REPULSION  = 5500;
    const SPRING_K   = 0.028;
    const SPRING_LEN = 170;
    const DAMPING    = 0.80;
    const GRAVITY    = 0.0005;

    // one step of the force-directed simulation
    const simulate = () => {
      const { nodes, edges } = simRef.current;
      const cx = canvas.width  / 2;
      const cy = canvas.height / 2;

      nodes.forEach(n => { n.fx = 0; n.fy = 0; });

      // push every pair of nodes apart (repulsion)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const ni = nodes[i], nj = nodes[j];
          const dx = nj.x - ni.x, dy = nj.y - ni.y;
          const dist2 = dx * dx + dy * dy || 0.001;
          const dist  = Math.sqrt(dist2);
          const f  = REPULSION / dist2;
          const fx = (dx / dist) * f, fy = (dy / dist) * f;
          ni.fx -= fx; ni.fy -= fy;
          nj.fx += fx; nj.fy += fy;
        }
      }

      // pull connected nodes toward each other (spring attraction)
      edges.forEach(e => {
        const src = simRef.current.idMap[e.source];
        const tgt = simRef.current.idMap[e.target];
        if (!src || !tgt) return;
        const dx = tgt.x - src.x, dy = tgt.y - src.y;
        const dist    = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const stretch = dist - SPRING_LEN;
        const f  = stretch * SPRING_K;
        const fx = (dx / dist) * f, fy = (dy / dist) * f;
        src.fx += fx; src.fy += fy;
        tgt.fx -= fx; tgt.fy -= fy;
      });

      // weak pull toward canvas center so nodes don't drift offscreen
      nodes.forEach(n => {
        n.fx += (cx - n.x) * GRAVITY;
        n.fy += (cy - n.y) * GRAVITY;
      });

      // integrate forces into velocity and position
      nodes.forEach(n => {
        if (n.pinned) { n.vx = 0; n.vy = 0; return; }
        n.vx += n.fx; n.vy += n.fy;
        n.vx *= DAMPING; n.vy *= DAMPING;
        n.x   += n.vx;   n.y   += n.vy;
      });
    };

    const draw = () => {
      const ctx2 = ctx;
      const { zoom, panX, panY, hoveredId, selectedId, filterTag, searchQuery: sq } = stateRef.current;
      const { nodes, edges } = simRef.current;

      // clear canvas
      ctx2.setTransform(1, 0, 0, 1, 0, 0);
      ctx2.clearRect(0, 0, canvas.width, canvas.height);
      ctx2.translate(panX, panY);
      ctx2.scale(zoom, zoom);

      // dimmed ids — nodes not matching the active filter/search
      const dimmedIds = new Set();
      if (filterTag || sq) {
        nodes.forEach(n => {
          const matchTag    = filterTag ? n.tags.includes(filterTag)                           : true;
          const matchSearch = sq        ? n.title.toLowerCase().includes(sq.toLowerCase())     : true;
          if (!matchTag || !matchSearch) dimmedIds.add(n.id);
        });
      }
      const isDimmed = (id) => dimmedIds.has(id);

      // draw edges
      edges.forEach(e => {
        const src = simRef.current.idMap[e.source];
        const tgt = simRef.current.idMap[e.target];
        if (!src || !tgt) return;
        const highlighted = selectedId && (src.id === selectedId || tgt.id === selectedId);
        if ((isDimmed(src.id) || isDimmed(tgt.id)) && !highlighted) return;

        const sc    = getColor(src);
        const tc    = getColor(tgt);
        const alpha = highlighted ? 'cc' : e.type === 'backlink' ? '50' : '28';
        const grad  = ctx2.createLinearGradient(src.x, src.y, tgt.x, tgt.y);
        grad.addColorStop(0, sc + alpha);
        grad.addColorStop(1, tc + alpha);

        ctx2.beginPath();
        ctx2.moveTo(src.x, src.y);
        ctx2.lineTo(tgt.x, tgt.y);
        ctx2.strokeStyle = grad;
        ctx2.lineWidth   = (highlighted ? 2.5 : e.type === 'backlink' ? 1.5 : 1) / zoom;
        if (highlighted) { ctx2.shadowBlur = 10 / zoom; ctx2.shadowColor = sc; }
        ctx2.stroke();
        ctx2.shadowBlur = 0;
      });

      // draw nodes
      nodes.forEach(n => {
        const color      = getColor(n);
        const isSelected = n.id === selectedId;
        const isHovered  = n.id === hoveredId;
        const dimmed     = isDimmed(n.id) && !isSelected;
        const r          = n.radius * (isSelected ? 1.35 : isHovered ? 1.18 : 1);

        ctx2.globalAlpha = dimmed ? 0.2 : 1;

        // glow ring around selected or hovered nodes
        if (isSelected || isHovered) {
          const glowR = r * 3;
          const grd   = ctx2.createRadialGradient(n.x, n.y, r * 0.5, n.x, n.y, glowR);
          grd.addColorStop(0, color + (isSelected ? '55' : '30'));
          grd.addColorStop(1, color + '00');
          ctx2.beginPath(); ctx2.arc(n.x, n.y, glowR, 0, Math.PI * 2);
          ctx2.fillStyle = grd; ctx2.fill();
        }

        // node circle with radial gradient for a 3D look
        const nodeGrd = ctx2.createRadialGradient(n.x - r * 0.3, n.y - r * 0.35, 0, n.x, n.y, r);
        nodeGrd.addColorStop(0, color + 'ff');
        nodeGrd.addColorStop(1, color + '88');
        ctx2.beginPath(); ctx2.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx2.fillStyle  = nodeGrd;
        ctx2.shadowBlur = isSelected ? 22 / zoom : isHovered ? 12 / zoom : 6 / zoom;
        ctx2.shadowColor = color;
        ctx2.fill();
        ctx2.shadowBlur = 0;

        // border ring
        ctx2.strokeStyle = isSelected ? '#ffffff' : color + '70';
        ctx2.lineWidth   = (isSelected ? 2 : 1) / zoom;
        ctx2.stroke();

        // label below node
        const fs  = Math.max(8.5, 11 / zoom);
        ctx2.font      = `${isSelected ? 600 : 400} ${fs}px system-ui, sans-serif`;
        ctx2.fillStyle = dimmed ? '#2d3748' : isSelected ? '#f9fafb' : '#64748b';
        ctx2.textAlign = 'center';
        const label = n.title.length > 20 ? n.title.slice(0, 18) + '\u2026' : n.title;
        ctx2.fillText(label, n.x, n.y + r + 13 / zoom);

        ctx2.globalAlpha = 1;
      });
    };

    // run physics for first 320 frames to let layout settle, then only on drag
    const loop = () => {
      const s = stateRef.current;
      if (s.frameCount < 320 || s.isDraggingNode) simulate();
      s.frameCount++;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    // convert screen coords to canvas coords
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const screenToWorld = (sx, sy) => {
      const s = stateRef.current;
      return { x: (sx - s.panX) / s.zoom, y: (sy - s.panY) / s.zoom };
    };

    // find which node (if any) is under the cursor
    const nodeAt = (sx, sy) => {
      const w = screenToWorld(sx, sy);
      return simRef.current.nodes.find(n => {
        const dx = n.x - w.x, dy = n.y - w.y;
        return Math.sqrt(dx * dx + dy * dy) <= n.radius + 6;
      }) || null;
    };

    const onMouseDown = (e) => {
      const pos  = getPos(e);
      const node = nodeAt(pos.x, pos.y);
      const s    = stateRef.current;
      s.mouseDownPos = pos;
      if (node) {
        // start dragging this node — pin it so physics won't move it
        s.isDraggingNode = true;
        s.dragNode       = node;
        node.pinned      = true;
        node.vx = 0; node.vy = 0;
      } else {
        s.isPanning = true;
        s.lastPanX  = pos.x;
        s.lastPanY  = pos.y;
      }
    };

    const onMouseMove = (e) => {
      const pos = getPos(e);
      const s   = stateRef.current;
      if (s.isDraggingNode && s.dragNode) {
        const w = screenToWorld(pos.x, pos.y);
        s.dragNode.x  = w.x; s.dragNode.y  = w.y;
        s.dragNode.vx = 0;   s.dragNode.vy = 0;
        s.frameCount  = 0;   // restart physics so jelly reacts
      } else if (s.isPanning) {
        s.panX    += pos.x - s.lastPanX;
        s.panY    += pos.y - s.lastPanY;
        s.lastPanX = pos.x;
        s.lastPanY = pos.y;
      }
      const hovered = nodeAt(pos.x, pos.y);
      s.hoveredId = hovered ? hovered.id : null;
      canvas.style.cursor = hovered ? 'pointer' : s.isPanning ? 'grabbing' : 'grab';
    };

    const onMouseUp = (e) => {
      const pos = getPos(e);
      const s   = stateRef.current;
      // if the mouse barely moved it was a click, not a drag
      const dist = s.mouseDownPos
        ? Math.hypot(pos.x - s.mouseDownPos.x, pos.y - s.mouseDownPos.y)
        : 999;

      if (s.isDraggingNode && s.dragNode) {
        // unpin so physics takes over again
        s.dragNode.pinned = false;
        s.frameCount      = 0;
      } else if (s.isPanning) {
        // nothing extra needed
      } else if (dist < 5) {
        // it was a click — select the node under cursor
        const node = nodeAt(pos.x, pos.y);
        if (node) {
          s.selectedId = node.id;
          setSelectedNode(node);
        } else {
          s.selectedId = null;
          setSelectedNode(null);
        }
      }
      s.isDraggingNode = false;
      s.dragNode       = null;
      s.isPanning      = false;
      canvas.style.cursor = 'grab';
    };

    const onWheel = (e) => {
      e.preventDefault();
      const pos   = getPos(e);
      const s     = stateRef.current;
      const delta = e.deltaY < 0 ? 1.12 : 0.88;
      const nz    = Math.max(0.15, Math.min(5, s.zoom * delta));
      // zoom toward the mouse position
      s.panX = pos.x - (pos.x - s.panX) * (nz / s.zoom);
      s.panY = pos.y - (pos.y - s.panY) * (nz / s.zoom);
      s.zoom = nz;
      setZoomDisplay(Math.round(nz * 100));
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup',   onMouseUp);
    canvas.addEventListener('wheel',     onWheel, { passive: false });
    canvas.style.cursor = 'grab';

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup',   onMouseUp);
      canvas.removeEventListener('wheel',     onWheel);
    };
  }, [graphData]);

  // keep filter/search in stateRef so the canvas loop can read them without re-mounting
  useEffect(() => { stateRef.current.filterTag   = activeTag;   }, [activeTag]);
  useEffect(() => { stateRef.current.searchQuery = searchQuery; }, [searchQuery]);

  const zoomIn = useCallback(() => {
    const s = stateRef.current;
    const nz = Math.min(5, s.zoom * 1.2);
    s.zoom = nz; setZoomDisplay(Math.round(nz * 100));
  }, []);

  const zoomOut = useCallback(() => {
    const s = stateRef.current;
    const nz = Math.max(0.15, s.zoom * 0.83);
    s.zoom = nz; setZoomDisplay(Math.round(nz * 100));
  }, []);

  const resetView = useCallback(() => {
    const s = stateRef.current;
    s.zoom = 1; s.panX = 0; s.panY = 0;
    setZoomDisplay(100);
    if (!canvasRef.current || !simRef.current) return;
    const cx = canvasRef.current.width  / 2;
    const cy = canvasRef.current.height / 2;
    const ns = simRef.current.nodes;
    const avgX = ns.reduce((a, n) => a + n.x, 0) / ns.length;
    const avgY = ns.reduce((a, n) => a + n.y, 0) / ns.length;
    // shift all nodes so their centroid lands at canvas center
    ns.forEach(n => { n.x += cx - avgX; n.y += cy - avgY; });
  }, []);

  // pan and select a node when clicked in the sidebar
  const focusNode = useCallback((node) => {
    if (!canvasRef.current) return;
    const s  = stateRef.current;
    const cx = canvasRef.current.width  / 2;
    const cy = canvasRef.current.height / 2;
    s.panX       = cx - node.x * s.zoom;
    s.panY       = cy - node.y * s.zoom;
    s.selectedId = node.id;
    setSelectedNode(node);
  }, []);

  // sidebar note list filtered by active tag and search
  const filteredNotes = graphData
    ? graphData.nodes.filter(n => {
        const matchTag    = activeTag    ? n.tags.includes(activeTag)                              : true;
        const matchSearch = searchQuery  ? n.title.toLowerCase().includes(searchQuery.toLowerCase()) : true;
        return matchTag && matchSearch;
      })
    : [];

  return (
    <div style={S.page}>

      {/* top bar — title, note/connection counts, search, zoom controls */}
      <div style={S.topBar}>
        <span style={S.title}>Second Brain</span>
        <span style={S.badge}>{graphData?.nodes.length || 0} notes</span>
        <span style={{ ...S.badge, background: 'rgba(16,185,129,0.1)', color: '#34d399', borderColor: 'rgba(16,185,129,0.25)' }}>
          {graphData?.edges.length || 0} connections
        </span>
        <div style={{ flex: 1 }} />
        <div style={S.searchWrap}>
          <Search size={13} color="#4b5563" />
          <input
            style={S.searchInput}
            placeholder="Search notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <X size={12} color="#4b5563" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={S.iconBtn} onClick={zoomOut}   title="Zoom out"><ZoomOut   size={14} /></div>
          <span style={{ color: '#4b5563', fontSize: 11, minWidth: 36, textAlign: 'center' }}>{zoomDisplay}%</span>
          <div style={S.iconBtn} onClick={zoomIn}    title="Zoom in" ><ZoomIn    size={14} /></div>
          <div style={S.iconBtn} onClick={resetView} title="Reset"   ><RefreshCw size={13} /></div>
        </div>
      </div>

      <div style={S.body}>

        {/* left sidebar — tag filter and note list */}
        <div style={S.sidebar}>
          <div style={S.sidebarSection}>
            <span style={S.sidebarLabel}>Tags</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {graphData?.allTags.map(tag => (
                <span key={tag} style={S.tagChip(activeTag === tag)}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}>
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          <NoteDropZone onNoteAdded={refetchNotes} />

          <div style={{ ...S.sidebarSection, flex: 1, overflowY: 'auto', paddingBottom: 14 }}>
            <span style={{ ...S.sidebarLabel, marginTop: 12, display: 'block' }}>
              Notes ({filteredNotes.length})
            </span>
            {filteredNotes.map(n => (
              <div key={n.id} style={S.noteItem(selectedNode?.id === n.id)} onClick={() => focusNode(n)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: getColor(n), flexShrink: 0 }} />
                  <div style={S.noteTitle}>{n.title}</div>
                </div>
                <div style={{ ...S.noteFolder, paddingLeft: 13 }}>
                  {n.folder} · {n.tags.slice(0, 2).map(t => '#' + t).join(' ')}
                </div>
              </div>
            ))}
            {filteredNotes.length === 0 && (
              <div style={{ color: '#374151', fontSize: 12, textAlign: 'center', paddingTop: 20 }}>No notes match</div>
            )}
          </div>

          {/* note color palette — available colors */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={S.sidebarLabel}>Note Colors</span>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
              {NOTE_COLORS.map(c => (
                <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, boxShadow: `0 0 4px ${c}` }} />
              ))}
            </div>
          </div>
        </div>

        {/* canvas — the physics graph renders here */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          <div style={S.hint}>
            <span>Drag node to move</span>
            <span>· Scroll to zoom</span>
            <span>· Click to select</span>
            <span>· Drag background to pan</span>
          </div>
        </div>

        {/* right panel — details for the selected node */}
        {selectedNode ? (
          <div style={S.rightPanel}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{ color: '#e5e7eb', fontWeight: 700, fontSize: 14, lineHeight: 1.4, flex: 1 }}>
                  {selectedNode.title}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
  <button
    type="button"
    title="Delete note"
    onClick={(e) => {
      e.stopPropagation();

      openConfirm({
        title: `Delete "${selectedNode.title}"?`,
        message: `Are you sure you want to permanently delete this note?`,
        type: 'danger',
        confirmLabel: 'Delete Note',
        onConfirm: async () => {
          closeConfirm();

          try {
            await secondBrainApi.deleteNote(selectedNode.id);

            stateRef.current.selectedId = null;
            setSelectedNode(null);

            await refetchNotes();
          } catch (err) {
            console.error('Failed to delete note:', err);
          }
        },
      });
    }}
    style={{
      width: 28,
      height: 28,
      border: '1px solid rgba(248,113,113,0.2)',
      background: 'rgba(248,113,113,0.06)',
      color: '#f87171',
      borderRadius: 6,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    🗑
  </button>

  <X
    size={14}
    color="#4b5563"
    style={{ cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
    onClick={() => {
      stateRef.current.selectedId = null;
      setSelectedNode(null);
    }}
  />
</div>
              </div>
              <div style={S.infoRow}>
                <span style={S.infoLabel}>Folder</span>
                <span style={{ ...S.infoVal, color: getColor(selectedNode) }}>{selectedNode.folder}</span>
              </div>
              <div style={S.infoRow}>
                <span style={S.infoLabel}>Updated</span>
                <span style={S.infoVal}>{selectedNode.updatedAt}</span>
              </div>

              {/* ── note color picker ── */}
              <div>
                <span style={S.sidebarLabel}>Note Color</span>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                  {NOTE_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={async () => {
                        try {
                          await secondBrainApi.updateNote(selectedNode.id, { color: c });
                          // Update local graph node color
                          const g = simRef.current;
                          if (g?.idMap?.[selectedNode.id]) {
                            g.idMap[selectedNode.id].color = c;
                          }
                          // Update sidebar node color in graphData
                          setGraphData(prev => {
                            if (!prev) return prev;
                            return {
                              ...prev,
                              nodes: prev.nodes.map(n =>
                                n.id === selectedNode.id ? { ...n, color: c } : n
                              ),
                            };
                          });
                          setSelectedNode(prev => ({ ...prev, color: c }));
                        } catch (err) {
                          console.error('Failed to update color:', err);
                        }
                      }}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        border: `2px solid ${getColor(selectedNode) === c ? '#fff' : 'transparent'}`,
                        background: c,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        outline: 'none',
                        boxShadow: getColor(selectedNode) === c ? `0 0 8px ${c}` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* tags on the selected note */}
           {selectedNode.tags.length > 0 && (
  <div>
    <span style={S.sidebarLabel}>Tags</span>

    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {selectedNode.tags.map(t => (
        <span
          key={t}
          style={{
            ...S.tagChip(false),
            margin: '0 4px 4px 0',
            cursor: 'default',
            paddingRight: 5,
          }}
        >
          #{t}

          <button
            type="button"
            title={`Remove #${t}`}
            onClick={async (e) => {
              e.stopPropagation();

              openConfirm({
                title: `Remove tag #${t}?`,
                message: `Are you sure you want to remove #${t} from "${selectedNode.title}"?`,
                type: 'warning',
                confirmLabel: 'Remove Tag',
                onConfirm: async () => {
                  closeConfirm();
                  try {
                    await secondBrainApi.removeTag(selectedNode.id, t);
                    await refetchNotes();
                  } catch (err) {
                    console.error('Failed to remove tag:', err);
                  }
                },
              });
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#6b7280',
              cursor: 'pointer',
              padding: 0,
              marginLeft: 3,
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  </div>
)}

            {/* notes this one links to */}
           {selectedNode.backlinks.length > 0 && (
  <div>
    <span style={S.sidebarLabel}>Links to</span>

    {selectedNode.backlinks.map(link => {
      const target = graphData?.nodes.find(
        n => n.title.toLowerCase() === link.toLowerCase()
      );

      return (
        <div
          key={link}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            marginBottom: 6,
            minWidth: 0,
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (target) focusNode(target);
            }}
            title={`Open ${link}`}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              background: 'transparent',
              color: '#6366f1',
              fontSize: 12,
              textAlign: 'left',
              padding: 0,
              cursor: target ? 'pointer' : 'default',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {link}
          </button>

          <button
            type="button"
            title={`Unlink ${link}`}
            onClick={async (e) => {
              e.stopPropagation();

              if (!target) return;

              openConfirm({
                title: `Remove link to "${link}"?`,
                message: `Are you sure you want to remove the link from "${selectedNode.title}" to "${link}"?`,
                type: 'warning',
                confirmLabel: 'Remove Link',
                onConfirm: async () => {
                  closeConfirm();
                  try {
                    await secondBrainApi.removeBacklink(
                      selectedNode.id,
                      target.id
                    );
                    await refetchNotes();
                  } catch (err) {
                    console.error('Failed to unlink note:', err);
                  }
                },
              });
            }}
            style={{
              flexShrink: 0,
              width: 24,
              height: 24,
              border: '1px solid rgba(248,113,113,0.2)',
              background: 'rgba(248,113,113,0.06)',
              color: '#f87171',
              borderRadius: 5,
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      );
    })}
  </div>
)}

            <ManualTagBacklinkForm note={selectedNode} allNotes={graphData?.nodes || []} onUpdated={refetchNotes} />

            {/* note content preview */}
            <div>
              <span style={S.sidebarLabel}>Content</span>
              <span style={S.sidebarLabel}>Content</span>
              <p style={{ ...S.infoVal, fontSize: 11, lineHeight: 1.6 }}>
                {selectedNode.content.replace(/\[\[.*?\]\]/g, '').replace(/#\w+/g, '').trim().slice(0, 200)}
                {selectedNode.content.length > 200 ? '...' : ''}
              </p>
            </div>
          </div>
        ) : (
          // placeholder when nothing is selected
          <div style={{ ...S.rightPanel, alignItems: 'center', justifyContent: 'center' }}>
            <Info size={20} color="#1f2937" />
            <span style={{ color: '#1f2937', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
              Click a node to see details
            </span>
          </div>
        )}

      </div>

      {/* ── confirmation dialog ── */}
      <ConfirmDialog
        isOpen={confirm.open}
        title={confirm.title}
        message={confirm.message}
        type={confirm.type}
        confirmLabel={confirm.confirmLabel}
        cancelLabel={confirm.cancelLabel}
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />
    </div>
  );
}