// frontend/src/pages/SecondBrainPage.jsx
// NeuraNote — Second Brain (Member 5 / Anoj)
// Obsidian-style force-directed graph with spring physics

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Search, ZoomIn, ZoomOut, RefreshCw, Hash, Link2, FileText, X, Info } from 'lucide-react';

// ─── DEMO NOTES ─────────────────────────────────────────────────────────────
// TODO (post-merge): replace with real API call to M3 notes endpoint
// GET /api/v1/notes/ — should return { id, title, content, folder, updated_at }
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

// ─── FOLDER → COLOR MAP ─────────────────────────────────────────────────────
const FOLDER_COLORS = {
  'Computer Science': '#6366f1',
  'Mathematics':      '#10b981',
  'Programming':      '#f59e0b',
  'Science':          '#06b6d4',
  'General':          '#8b5cf6',
};
const DEFAULT_COLOR = '#6366f1';
const getColor = (folder) => FOLDER_COLORS[folder] || DEFAULT_COLOR;

// ─── PARSE #tags AND [[backlinks]] FROM NOTE CONTENT ────────────────────────
function parseGraph(notes) {
  const parsed = notes.map(note => ({
    ...note,
    tags:      [...new Set((note.content.match(/#(\w+)/g)          || []).map(t => t.slice(1)))],
    backlinks: [...new Set((note.content.match(/\[\[([^\]]+)\]\]/g) || []).map(b => b.slice(2, -2)))],
  }));

  const titleMap = {};
  parsed.forEach(n => { titleMap[n.title.toLowerCase()] = n.id; });

  // Initial positions in a circle
  const nodes = parsed.map((note, i) => {
    const angle = (i / parsed.length) * Math.PI * 2;
    const r     = 200;
    return {
      id:        note.id,
      title:     note.title,
      folder:    note.folder,
      updatedAt: note.updatedAt,
      tags:      note.tags,
      backlinks: note.backlinks,
      content:   note.content,
      x:  Math.cos(angle) * r,
      y:  Math.sin(angle) * r,
      vx: 0, vy: 0,
      radius: 9 + Math.min(note.tags.length * 2.5, 10), // size ∝ tag count
      pinned: false,
    };
  });

  const edges   = [];
  const edgeSet = new Set();

  // Backlink edges
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

  // Shared-tag edges (≥2 tags in common)
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

// ─── STYLES ─────────────────────────────────────────────────────────────────
const S = {
  page: {
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column',
    background: '#0b0f19', overflow: 'hidden', fontFamily: 'system-ui, sans-serif',
    backgroundImage: 'radial-gradient(circle at 15% 50%, rgba(99,102,241,0.06) 0%, transparent 30%), radial-gradient(circle at 85% 30%, rgba(16,185,129,0.04) 0%, transparent 30%)',
  },
  topBar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: '#111827', flexShrink: 0,
  },
  title: { color: '#e5e7eb', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', marginRight: 8 },
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
  searchInput: {
    background: 'none', border: 'none', outline: 'none',
    color: '#e5e7eb', fontSize: 13, width: '100%',
  },
  iconBtn: {
    width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer', color: '#9ca3af', transition: 'all 0.15s',
  },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  sidebar: {
    width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    background: '#0d1117', overflow: 'hidden',
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
  noteTitle: { color: '#d1d5db', fontSize: 12, fontWeight: 500, marginBottom: 2, lineHeight: 1.3 },
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
    width: 260, flexShrink: 0, padding: 16,
    borderLeft: '1px solid rgba(255,255,255,0.06)',
    background: '#0d1117', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14,
  },
  infoRow: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  infoLabel: { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4b5563', minWidth: 60 },
  infoVal: { fontSize: 12, color: '#9ca3af', lineHeight: 1.5 },
  hint: {
    position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: '6px 14px', fontSize: 11, color: '#6b7280',
    display: 'flex', gap: 16, backdropFilter: 'blur(8px)', pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function SecondBrainPage() {
  const canvasRef    = useRef(null);
  const simRef       = useRef(null);   // { nodes, edges, idMap }
  const rafRef       = useRef(null);
  const stateRef     = useRef({        // mutable render state (avoids re-renders)
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

  // ── Build graph on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const g = parseGraph(DEMO_NOTES);
    // Build id→node map
    g.idMap = {};
    g.nodes.forEach(n => { g.idMap[n.id] = n; });
    simRef.current = g;
    setGraphData(g);
  }, []);

  // ── Canvas physics + render loop ──────────────────────────────────────────
  useEffect(() => {
    if (!graphData) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Resize canvas to CSS size
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      // Centre nodes on first run
      if (stateRef.current.frameCount === 0) {
        const cx = canvas.width  / 2;
        const cy = canvas.height / 2;
        simRef.current.nodes.forEach(n => { n.x += cx; n.y += cy; });
        stateRef.current.panX = 0;
        stateRef.current.panY = 0;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ── Physics constants (tuned for jelly feel) ──────────────────────────
    const REPULSION    = 5500;
    const SPRING_K     = 0.028;   // spring stiffness
    const SPRING_LEN   = 170;    // natural edge length (px in world space)
    const DAMPING      = 0.80;   // <1 → oscillation → jelly!
    const GRAVITY      = 0.0005; // weak pull to canvas centre

    const simulate = () => {
      const { nodes, edges } = simRef.current;
      const cx = canvas.width  / 2;
      const cy = canvas.height / 2;

      // Reset accumulated forces
      nodes.forEach(n => { n.fx = 0; n.fy = 0; });

      // Repulsion (all pairs)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const ni = nodes[i], nj = nodes[j];
          const dx = nj.x - ni.x;
          const dy = nj.y - ni.y;
          const dist2 = dx * dx + dy * dy || 0.001;
          const dist  = Math.sqrt(dist2);
          const f     = REPULSION / dist2;
          const fx    = (dx / dist) * f;
          const fy    = (dy / dist) * f;
          ni.fx -= fx; ni.fy -= fy;
          nj.fx += fx; nj.fy += fy;
        }
      }

      // Spring attraction along edges (creates the jelly pull)
      edges.forEach(e => {
        const src = simRef.current.idMap[e.source];
        const tgt = simRef.current.idMap[e.target];
        if (!src || !tgt) return;
        const dx      = tgt.x - src.x;
        const dy      = tgt.y - src.y;
        const dist    = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const stretch = dist - SPRING_LEN;
        const f       = stretch * SPRING_K;
        const fx      = (dx / dist) * f;
        const fy      = (dy / dist) * f;
        src.fx += fx; src.fy += fy;
        tgt.fx -= fx; tgt.fy -= fy;
      });

      // Gravity to centre
      nodes.forEach(n => {
        n.fx += (cx - n.x) * GRAVITY;
        n.fy += (cy - n.y) * GRAVITY;
      });

      // Integrate
      nodes.forEach(n => {
        if (n.pinned) return;
        n.vx = (n.vx + n.fx) * DAMPING;
        n.vy = (n.vy + n.fy) * DAMPING;
        n.x += n.vx;
        n.y += n.vy;
      });
    };

    // ── Render ────────────────────────────────────────────────────────────
    const draw = () => {
      const { zoom, panX, panY, hoveredId, selectedId, filterTag, searchQuery: sq } = stateRef.current;
      const { nodes, edges } = simRef.current;
      const W = canvas.width, H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, W, H);

      // Dot grid
      ctx.fillStyle = 'rgba(255,255,255,0.022)';
      const gSize = 36 * zoom;
      const offX  = ((panX % gSize) + gSize) % gSize;
      const offY  = ((panY % gSize) + gSize) % gSize;
      for (let x = offX; x < W; x += gSize) {
        for (let y = offY; y < H; y += gSize) {
          ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
        }
      }

      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);

      // Determine dim set (filter by tag or search)
      const dimmedIds = new Set();
      if (filterTag || sq) {
        nodes.forEach(n => {
          const matchTag    = filterTag ? n.tags.includes(filterTag) : true;
          const matchSearch = sq ? n.title.toLowerCase().includes(sq.toLowerCase()) : true;
          if (!matchTag || !matchSearch) dimmedIds.add(n.id);
        });
      }
      const isDimmed = (id) => dimmedIds.has(id);

      // ── Draw edges ──────────────────────────────────────────────────────
      edges.forEach(e => {
        const src = simRef.current.idMap[e.source];
        const tgt = simRef.current.idMap[e.target];
        if (!src || !tgt) return;

        const srcDim = isDimmed(src.id);
        const tgtDim = isDimmed(tgt.id);
        const highlighted = selectedId && (src.id === selectedId || tgt.id === selectedId);
        const dimEdge = (srcDim || tgtDim) && !highlighted;

        if (dimEdge) return; // hide edges to/from dimmed nodes

        const sc = getColor(src.folder);
        const tc = getColor(tgt.folder);
        const alpha = highlighted ? 'cc' : e.type === 'backlink' ? '50' : '28';

        const grad = ctx.createLinearGradient(src.x, src.y, tgt.x, tgt.y);
        grad.addColorStop(0, sc + alpha);
        grad.addColorStop(1, tc + alpha);

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth   = (highlighted ? 2.5 : e.type === 'backlink' ? 1.5 : 1) / zoom;
        if (highlighted) { ctx.shadowBlur = 10 / zoom; ctx.shadowColor = sc; }
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // ── Draw nodes ──────────────────────────────────────────────────────
      nodes.forEach(n => {
        const color      = getColor(n.folder);
        const isSelected = n.id === selectedId;
        const isHovered  = n.id === hoveredId;
        const dimmed     = isDimmed(n.id) && !isSelected;
        const alpha      = dimmed ? 0.2 : 1;
        const r          = n.radius * (isSelected ? 1.35 : isHovered ? 1.18 : 1);

        ctx.globalAlpha = alpha;

        // Outer glow (selected / hovered)
        if (isSelected || isHovered) {
          const glowR = r * 3;
          const grd = ctx.createRadialGradient(n.x, n.y, r * 0.5, n.x, n.y, glowR);
          grd.addColorStop(0, color + (isSelected ? '55' : '30'));
          grd.addColorStop(1, color + '00');
          ctx.beginPath(); ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = grd; ctx.fill();
        }

        // Node fill (radial gradient for 3D feel)
        const nodeGrd = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.35, 0, n.x, n.y, r);
        nodeGrd.addColorStop(0, color + 'ff');
        nodeGrd.addColorStop(1, color + '88');
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle   = nodeGrd;
        ctx.shadowBlur  = isSelected ? 22 / zoom : isHovered ? 12 / zoom : 6 / zoom;
        ctx.shadowColor = color;
        ctx.fill();
        ctx.shadowBlur  = 0;

        // Border ring
        ctx.strokeStyle = isSelected ? '#ffffff' : color + '70';
        ctx.lineWidth   = (isSelected ? 2 : 1) / zoom;
        ctx.stroke();

        // Label
        const fs = Math.max(8.5, 11 / zoom);
        ctx.font      = `${isSelected ? 600 : 400} ${fs}px system-ui, sans-serif`;
        ctx.fillStyle = dimmed ? '#2d3748' : isSelected ? '#f9fafb' : '#64748b';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;
        const label = n.title.length > 20 ? n.title.slice(0, 18) + '…' : n.title;
        ctx.fillText(label, n.x, n.y + r + 13 / zoom);

        ctx.globalAlpha = 1;
      });

      ctx.restore();
    };

    // ── Animation loop ────────────────────────────────────────────────────
    const loop = () => {
      const s = stateRef.current;
      // Run physics until stable (~300 frames), or while dragging
      if (s.frameCount < 320 || s.isDraggingNode) simulate();
      s.frameCount++;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    // ── Mouse helpers ─────────────────────────────────────────────────────
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const screenToWorld = (sx, sy) => {
      const s = stateRef.current;
      return { x: (sx - s.panX) / s.zoom, y: (sy - s.panY) / s.zoom };
    };
    const nodeAt = (sx, sy) => {
      const w = screenToWorld(sx, sy);
      return simRef.current.nodes.find(n => {
        const dx = n.x - w.x, dy = n.y - w.y;
        return Math.sqrt(dx * dx + dy * dy) <= n.radius + 6;
      }) || null;
    };

    // ── Mouse events ──────────────────────────────────────────────────────
    const onMouseDown = (e) => {
      const pos  = getPos(e);
      const node = nodeAt(pos.x, pos.y);
      const s    = stateRef.current;
      s.mouseDownPos = pos;
      if (node) {
        s.isDraggingNode = true;
        s.dragNode       = node;
        node.pinned      = true;
        // Reset velocity so we get clean jelly when released
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
        s.dragNode.x  = w.x;
        s.dragNode.y  = w.y;
        s.dragNode.vx = 0;
        s.dragNode.vy = 0;
        // Keep physics alive while dragging
        s.frameCount = 0;
      } else if (s.isPanning) {
        s.panX    += pos.x - s.lastPanX;
        s.panY    += pos.y - s.lastPanY;
        s.lastPanX = pos.x;
        s.lastPanY = pos.y;
      }

      const hovered = nodeAt(pos.x, pos.y);
      s.hoveredId   = hovered ? hovered.id : null;
      canvas.style.cursor = hovered ? 'pointer' : s.isPanning ? 'grabbing' : 'grab';
    };

    const onMouseUp = (e) => {
      const pos = getPos(e);
      const s   = stateRef.current;

      // Click detection (moved < 5px)
      if (s.mouseDownPos) {
        const dx = Math.abs(pos.x - s.mouseDownPos.x);
        const dy = Math.abs(pos.y - s.mouseDownPos.y);
        if (dx < 5 && dy < 5) {
          const node     = nodeAt(pos.x, pos.y);
          s.selectedId   = node ? node.id : null;
          setSelectedNode(node || null);
        }
      }

      // RELEASE pinned node → jelly springs kick in
      if (s.dragNode) {
        s.dragNode.pinned = false;
        // Give a tiny kick so spring overshoot is visible
        s.dragNode.vx = 0; s.dragNode.vy = 0;
        s.dragNode    = null;
        s.frameCount  = 0; // restart physics
      }
      s.isDraggingNode = false;
      s.isPanning      = false;
      s.mouseDownPos   = null;
      canvas.style.cursor = 'grab';
    };

    const onWheel = (e) => {
      e.preventDefault();
      const pos   = getPos(e);
      const s     = stateRef.current;
      const delta = e.deltaY > 0 ? 0.88 : 1.12;
      const nz    = Math.max(0.15, Math.min(5, s.zoom * delta));
      // Zoom toward mouse position
      s.panX = pos.x - (pos.x - s.panX) * (nz / s.zoom);
      s.panY = pos.y - (pos.y - s.panY) * (nz / s.zoom);
      s.zoom = nz;
      setZoomDisplay(Math.round(nz * 100));
    };

    canvas.addEventListener('mousedown',  onMouseDown);
    canvas.addEventListener('mousemove',  onMouseMove);
    canvas.addEventListener('mouseup',    onMouseUp);
    canvas.addEventListener('wheel',      onWheel, { passive: false });
    canvas.style.cursor = 'grab';

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('mousedown',  onMouseDown);
      canvas.removeEventListener('mousemove',  onMouseMove);
      canvas.removeEventListener('mouseup',    onMouseUp);
      canvas.removeEventListener('wheel',      onWheel);
    };
  }, [graphData]);

  // ── Sync filter/search into stateRef ─────────────────────────────────────
  useEffect(() => { stateRef.current.filterTag   = activeTag;    }, [activeTag]);
  useEffect(() => { stateRef.current.searchQuery = searchQuery;  }, [searchQuery]);

  // ── Zoom buttons (modify stateRef directly) ───────────────────────────────
  const zoomIn  = useCallback(() => {
    const s  = stateRef.current;
    const nz = Math.min(5, s.zoom * 1.2);
    s.zoom = nz; setZoomDisplay(Math.round(nz * 100));
  }, []);
  const zoomOut = useCallback(() => {
    const s  = stateRef.current;
    const nz = Math.max(0.15, s.zoom * 0.83);
    s.zoom = nz; setZoomDisplay(Math.round(nz * 100));
  }, []);
  const resetView = useCallback(() => {
    const s = stateRef.current;
    s.zoom  = 1; s.panX = 0; s.panY = 0;
    setZoomDisplay(100);
    // Re-centre nodes
    if (!canvasRef.current || !simRef.current) return;
    const cx = canvasRef.current.width  / 2;
    const cy = canvasRef.current.height / 2;
    // Compute centroid
    const ns = simRef.current.nodes;
    const avgX = ns.reduce((a, n) => a + n.x, 0) / ns.length;
    const avgY = ns.reduce((a, n) => a + n.y, 0) / ns.length;
    ns.forEach(n => { n.x += cx - avgX; n.y += cy - avgY; });
  }, []);

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

  // ── Derived list for sidebar ──────────────────────────────────────────────
  const filteredNotes = graphData
    ? graphData.nodes.filter(n => {
        const matchTag    = activeTag    ? n.tags.includes(activeTag)                         : true;
        const matchSearch = searchQuery  ? n.title.toLowerCase().includes(searchQuery.toLowerCase()) : true;
        return matchTag && matchSearch;
      })
    : [];

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* ── Top Bar ── */}
      <div style={S.topBar}>
        <span style={S.title}>⬡ Second Brain</span>
        <span style={S.badge}>{graphData?.nodes.length || 0} notes</span>
        <span style={{ ...S.badge, background: 'rgba(16,185,129,0.1)', color: '#34d399', borderColor: 'rgba(16,185,129,0.25)' }}>
          {graphData?.edges.length || 0} connections
        </span>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={S.searchWrap}>
          <Search size={13} color="#4b5563" />
          <input
            style={S.searchInput}
            placeholder="Search notes…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <X size={12} color="#4b5563" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
          )}
        </div>

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={S.iconBtn} onClick={zoomOut}  title="Zoom out"><ZoomOut  size={14} /></div>
          <span style={{ color: '#4b5563', fontSize: 11, minWidth: 36, textAlign: 'center' }}>{zoomDisplay}%</span>
          <div style={S.iconBtn} onClick={zoomIn}   title="Zoom in" ><ZoomIn   size={14} /></div>
          <div style={S.iconBtn} onClick={resetView} title="Reset view"><RefreshCw size={13} /></div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={S.body}>

        {/* ── Left Sidebar ── */}
        <div style={S.sidebar}>
          {/* Tags filter */}
          <div style={S.sidebarSection}>
            <span style={S.sidebarLabel}><Hash size={9} style={{ display:'inline', marginRight:4 }} />Tags</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {graphData?.allTags.map(tag => (
                <span
                  key={tag}
                  style={S.tagChip(activeTag === tag)}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Note list */}
          <div style={{ ...S.sidebarSection, flex: 1, overflowY: 'auto', paddingBottom: 14 }}>
            <span style={{ ...S.sidebarLabel, marginTop: 12, display: 'block' }}>
              <FileText size={9} style={{ display:'inline', marginRight:4 }} />
              Notes ({filteredNotes.length})
            </span>
            {filteredNotes.map(n => (
              <div
                key={n.id}
                style={S.noteItem(selectedNode?.id === n.id)}
                onClick={() => focusNode(n)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: getColor(n.folder), flexShrink: 0 }} />
                  <div style={S.noteTitle}>{n.title}</div>
                </div>
                <div style={{ ...S.noteFolder, paddingLeft: 13 }}>{n.folder} · {n.tags.slice(0,2).map(t=>'#'+t).join(' ')}</div>
              </div>
            ))}
            {filteredNotes.length === 0 && (
              <div style={{ color: '#374151', fontSize: 12, textAlign: 'center', paddingTop: 20 }}>No notes match</div>
            )}
          </div>

          {/* Legend */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={S.sidebarLabel}>Folders</span>
            {Object.entries(FOLDER_COLORS).map(([folder, color]) => (
              <div key={folder} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
                <span style={{ fontSize: 11, color: '#4b5563' }}>{folder}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Canvas ── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
          {/* Hint bar */}
          <div style={S.hint}>
            <span>🖱 Drag node — watch it jelly</span>
            <span>· Scroll to zoom</span>
            <span>· Click to select</span>
            <span>· Drag background to pan</span>
          </div>
        </div>

        {/* ── Right Panel (selected node) ── */}
        {selectedNode ? (
          <div style={S.rightPanel}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: getColor(selectedNode.folder), boxShadow: `0 0 8px ${getColor(selectedNode.folder)}` }} />
                <span style={{ color: '#e5e7eb', fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{selectedNode.title}</span>
              </div>
              <X size={14} color="#4b5563" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => { setSelectedNode(null); stateRef.current.selectedId = null; }} />
            </div>

            <div>
              <div style={S.infoRow}>
                <span style={S.infoLabel}>Folder</span>
                <span style={S.infoVal}>{selectedNode.folder}</span>
              </div>
              <div style={S.infoRow}>
                <span style={S.infoLabel}>Updated</span>
                <span style={S.infoVal}>{selectedNode.updatedAt}</span>
              </div>
              <div style={S.infoRow}>
                <span style={S.infoLabel}>Links</span>
                <span style={S.infoVal}>{selectedNode.backlinks.length} backlinks</span>
              </div>
            </div>

            {/* Tags */}
            {selectedNode.tags.length > 0 && (
              <div>
                <span style={{ ...S.sidebarLabel, display: 'block', marginBottom: 8 }}>
                  <Hash size={9} style={{ display:'inline', marginRight:4 }} />Tags
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {selectedNode.tags.map(t => (
                    <span key={t} style={S.tagChip(activeTag === t)} onClick={() => setActiveTag(activeTag === t ? null : t)}>
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Backlinks */}
            {selectedNode.backlinks.length > 0 && (
              <div>
                <span style={{ ...S.sidebarLabel, display: 'block', marginBottom: 8 }}>
                  <Link2 size={9} style={{ display:'inline', marginRight:4 }} />Backlinks
                </span>
                {selectedNode.backlinks.map(link => {
                  const linked = graphData?.nodes.find(n => n.title.toLowerCase() === link.toLowerCase());
                  return (
                    <div
                      key={link}
                      style={{ ...S.noteItem(false), cursor: linked ? 'pointer' : 'default', marginBottom: 4 }}
                      onClick={() => linked && focusNode(linked)}
                    >
                      <div style={{ ...S.noteTitle, color: linked ? '#818cf8' : '#374151' }}>
                        {linked ? '→ ' : '⚠ '}{link}
                      </div>
                      {linked && <div style={S.noteFolder}>{linked.folder}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Connected notes */}
            <div>
              <span style={{ ...S.sidebarLabel, display: 'block', marginBottom: 8 }}>Connected</span>
              {graphData?.edges
                .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                .map(e => {
                  const otherId = e.source === selectedNode.id ? e.target : e.source;
                  const other   = simRef.current?.idMap[otherId];
                  if (!other) return null;
                  return (
                    <div
                      key={otherId}
                      style={{ ...S.noteItem(false), marginBottom: 4, cursor: 'pointer' }}
                      onClick={() => focusNode(other)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: getColor(other.folder) }} />
                        <span style={S.noteTitle}>{other.title}</span>
                      </div>
                      <div style={{ ...S.noteFolder, paddingLeft: 12 }}>
                        {e.type === 'backlink' ? '🔗 backlink' : `#️⃣ ${e.sharedTags?.join(', ')}`}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          <div style={{ ...S.rightPanel, alignItems: 'center', justifyContent: 'center', opacity: 0.35 }}>
            <Info size={28} color="#4b5563" />
            <span style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', marginTop: 8 }}>
              Click a node to see<br />note details & connections
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
