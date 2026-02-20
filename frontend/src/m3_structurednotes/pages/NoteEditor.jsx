
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import {
    Share2, Search, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
    Bold, Italic, Underline, List, Link as LinkIcon, Mic,
    Wand2, Settings, PenTool, Loader2, X, MousePointerClick, ArrowUpDown, Highlighter, Clock, ArrowUpDown as ArrowUpDownIcon
} from 'lucide-react';
import styles from './NoteEditor.module.css';
import SaveModal from '../components/SaveModal';
import RefineModal from '../components/RefineModal';
import Sidebar from '../../components/Sidebar';
import { generateNote, refineText, updateNote, createNote } from '../api';


// --- CONFIGURATION ---
// Set to TRUE for full AI features (Final)
// Set to FALSE for manual-only mode (Interim Demo)
const ENABLE_AI = false;

const NoteEditor = () => {
    const { noteId } = useParams();
    const navigate = useNavigate();

    const [content, setContent] = useState('');
    const [lineHeight, setLineHeight] = useState('1.5'); // Default spacing
    const [pdfId, setPdfId] = useState('');
    const [pdfUrl, setPdfUrl] = useState(''); // New state for PDF URL
    const [currentNoteId, setCurrentNoteId] = useState(noteId);
    const [userId, setUserId] = useState('test_user');

    const [showSaveModal, setShowSaveModal] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(75);

    // Selection & Refinement
    const [selection, setSelection] = useState(null);
    const [refinementResult, setRefinementResult] = useState(null);

    // Context Menu
    const [contextMenu, setContextMenu] = useState(null);
    const [tempSelection, setTempSelection] = useState(null);

    const chatInputRef = useRef(null);
    const editorRef = useRef(null); // Ref for the textarea

    useEffect(() => {
        const savedNote = localStorage.getItem('currentNote');
        if (savedNote) {
            const parsed = JSON.parse(savedNote);
            setContent(parsed.content);
            setPdfId(parsed.pdfId);
            setPdfUrl(parsed.pdfUrl || ''); // Load URL
            if (!currentNoteId) setCurrentNoteId(parsed.noteId);
        } else {
            // For Interim Mode: Initialize empty if no note found
            if (!ENABLE_AI) {
                setContent('');
            }
        }
    }, [noteId]);

    // --- Toolbar Functions ---
    const handleToolbarAction = (action, value = null) => {
        const textarea = editorRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);
        let newText = content;
        let newCursorPos = end;

        const insertFormat = (prefix, suffix) => {
            newText = content.substring(0, start) + prefix + selectedText + suffix + content.substring(end);
            newCursorPos = start + prefix.length + selectedText.length + suffix.length;
            if (selectedText.length === 0) {
                newCursorPos = start + prefix.length; // Place cursor inside if no selection
            }
        };

        switch (action) {
            case 'bold': insertFormat('<strong>', '</strong>'); break;
            case 'italic': insertFormat('<em>', '</em>'); break;
            case 'underline':
                insertFormat('<u>', '</u>');
                break;
            case 'list':
                if (selectedText.length > 0) {
                    const lines = selectedText.split('\n');
                    const listed = lines.map(line => `- ${line}`).join('\n');
                    newText = content.substring(0, start) + listed + content.substring(end);
                    newCursorPos = start + listed.length;
                } else {
                    newText = content.substring(0, start) + '\n- ' + content.substring(end);
                    newCursorPos = start + 3;
                }
                break;
            case 'link':
                insertFormat('[', '](url)');
                if (selectedText.length === 0) newCursorPos -= 1;
                break;
            default: break;
        }

        setContent(newText);

        localStorage.setItem('currentNote', JSON.stringify({
            content: newText,
            pdfId,
            noteId: currentNoteId
        }));

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    const handleExport = () => {
        setIsProcessing(true);
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.onload = () => {
            const element = document.getElementById('export-content');

            const opt = {
                margin: 10,
                filename: 'note.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // @ts-ignore
            window.html2pdf().set(opt).from(element).save().then(() => {
                setIsProcessing(false);
                alert("PDF Downloaded! 📥");
            });
        };
        document.body.appendChild(script);
    };

    const handleEditorSelect = (e) => {
        const textarea = e.target;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start !== end) {
            const selectedText = content.substring(start, end);
            setTempSelection({ text: selectedText, start, end });
        } else {
            setTempSelection(null);
        }
    };

    const handleContextMenu = (e) => {
        if (!ENABLE_AI) return;
        e.preventDefault();
        if (tempSelection) {
            setContextMenu({ x: e.clientX, y: e.clientY });
        }
    };

    const closeContextMenu = () => {
        setContextMenu(null);
    };

    const lockSelection = () => {
        setSelection(tempSelection);
        setContextMenu(null);
    };

    const clearSelection = () => {
        setSelection(null);
        setTempSelection(null);
    };

    const handleChatSubmit = async () => {
        if (!chatInput.trim()) return;
        setIsProcessing(true);

        try {
            if (selection) {
                const result = await refineText(selection.text, chatInput);
                setRefinementResult({
                    original: selection.text,
                    refined: result,
                    isFullNote: false
                });
            }
        } catch (error) {
            console.error("Error in chat submit:", error);
            alert("Failed to process request.");
        } finally {
            setIsProcessing(false);
            setChatInput('');
        }
    };

    const applyRefinement = (refinedText) => {
        if (!selection || !editorRef.current) return;

        const before = content.substring(0, selection.start);
        const after = content.substring(selection.end);
        const newContent = before + refinedText + after;

        setContent(newContent);
        setRefinementResult(null);
        clearSelection();

        localStorage.setItem('currentNote', JSON.stringify({
            content: newContent,
            pdfId,
            noteId: currentNoteId
        }));
    };

    const [leftView, setLeftView] = useState('preview'); // 'pdf' | 'preview'

    return (
        <div className={styles.editorContainer}>
            <div
                id="export-content"
                style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    width: '210mm',
                    padding: '20mm',
                    backgroundColor: 'white',
                    color: 'black',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '12pt',
                    zIndex: -1000,
                    opacity: 0,
                    pointerEvents: 'none'
                }}
            >
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                    {content}
                </ReactMarkdown>
            </div>

            <Sidebar onSelectFolder={null} selectedFolderId={null} />

            <div className={styles.mainContent} style={{ marginLeft: '320px', width: 'calc(100% - 320px)' }}>
                <div className={styles.container} onClick={closeContextMenu}>
                    <div className={styles.header}>
                        <div className={styles.brand}>
                            <div className={styles.logoBox}>N</div>
                            <span>NeuraNote</span>

                            <div className={styles.viewToggleGroup}>
                                <button
                                    className={`${styles.viewToggleBtn} ${leftView === 'pdf' ? styles.active : ''}`}
                                    onClick={() => setLeftView('pdf')}
                                >
                                    PDF Source
                                </button>
                                <button
                                    className={`${styles.viewToggleBtn} ${leftView === 'preview' ? styles.active : ''}`}
                                    onClick={() => setLeftView('preview')}
                                >
                                    Live Preview
                                </button>
                            </div>
                        </div>

                        <div className={styles.headerActions}>
                            <div className={styles.actionGroup}>
                                <div className={styles.saveStatus}>
                                    {isProcessing ? (
                                        <><Loader2 size={14} className={styles.spin} /> Processing...</>
                                    ) : (
                                        <><Clock size={14} /> Saved</>
                                    )}
                                </div>
                                <div className={styles.actionGroup}>
                                    <button className={styles.textBtn} onClick={handleExport} disabled={isProcessing}>
                                        {isProcessing ? '...' : 'Export'}
                                    </button>
                                    <button className={styles.primaryBtn} onClick={() => setShowSaveModal(true)}>Save</button>
                                </div>
                            </div>
                            <div className={styles.zoomControls}>
                                <button className={styles.iconBtn} onClick={() => setZoomLevel(z => Math.max(z - 10, 25))}><ZoomOut size={16} /></button>
                                <span className={styles.zoomLevel}>{zoomLevel}%</span>
                                <button className={styles.iconBtn} onClick={() => setZoomLevel(z => Math.min(z + 10, 200))}><ZoomIn size={16} /></button>
                            </div>
                        </div>
                    </div>

                    <div className={styles.mainArea}>
                        <div className={styles.pdfContent}>
                            {leftView === 'pdf' ? (
                                <div className={styles.markdownWrapper} style={{ height: '100%' }}>
                                    {pdfUrl ? (
                                        <iframe
                                            src={`http://localhost:8000${pdfUrl}`}
                                            className={styles.pdfFrame}
                                            title="PDF Viewer"
                                            style={{ width: '100%', height: '100%', border: 'none' }}
                                        />
                                    ) : (
                                        <div className={styles.emptyState}>No PDF loaded.</div>
                                    )}
                                </div>
                            ) : (
                                <div className={styles.markdownWrapper} style={{
                                    height: '100%',
                                    overflowY: 'auto',
                                    padding: '40px 50px',
                                    backgroundColor: 'white',
                                    fontSize: `${zoomLevel / 100 * 15}px`,
                                    borderRight: '1px solid #EAEAEA'
                                }}>
                                    <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                                        {content || "Start typing in the editor to see the preview..."}
                                    </ReactMarkdown>
                                </div>
                            )}

                            {ENABLE_AI && selection && (
                                <div className={styles.selectionIndicator}>
                                    <span className={styles.selectionLabel}>Targeting:</span>
                                    <span className={styles.selectionText}>"{selection.text.substring(0, 30)}..."</span>
                                    <button className={styles.clearSelectionBtn} onClick={clearSelection}><X size={12} /></button>
                                </div>
                            )}

                            {ENABLE_AI && (
                                <div className={styles.bottomBarContainer}>
                                    <div className={styles.bottomBar}>
                                        <div className={styles.inputWrapper}>
                                            <input
                                                ref={chatInputRef}
                                                type="text"
                                                placeholder={selection ? "Refine tagged text..." : "Instructions to regenerate..."}
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                                                disabled={isProcessing}
                                            />
                                            <button className={styles.iconBtn}><Mic size={18} /></button>
                                        </div>
                                        <button className={styles.sendBtn} onClick={handleChatSubmit} disabled={isProcessing}>
                                            {isProcessing ? <Loader2 size={18} className={styles.spin} /> : 'Send'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={styles.rightPanel}>
                            <div className={styles.editorToolbar}>
                                <div className={styles.formatGroup}>
                                    <button className={styles.formatBtn} onMouseDown={(e) => { e.preventDefault(); handleToolbarAction('bold'); }} title="Bold"><Bold size={18} /></button>
                                    <button className={styles.formatBtn} onMouseDown={(e) => { e.preventDefault(); handleToolbarAction('italic'); }} title="Italic"><Italic size={18} /></button>
                                    <button className={styles.formatBtn} onMouseDown={(e) => { e.preventDefault(); handleToolbarAction('underline'); }} title="Underline"><Underline size={18} /></button>

                                    <div className={styles.divider}></div>
                                    <button className={styles.formatBtn} onMouseDown={(e) => { e.preventDefault(); handleToolbarAction('list'); }} title="List"><List size={18} /></button>
                                    <button className={styles.formatBtn} onMouseDown={(e) => { e.preventDefault(); handleToolbarAction('link'); }} title="Link"><LinkIcon size={18} /></button>

                                    <div className={styles.divider}></div>
                                    <div className={styles.spacingWrapper} title="Line Spacing">
                                        <ArrowUpDownIcon size={16} className={styles.spacingIcon} />
                                        <select
                                            className={styles.spacingSelect}
                                            value={lineHeight}
                                            onChange={(e) => setLineHeight(e.target.value)}
                                        >
                                            <option value="1.0">1.0</option>
                                            <option value="1.15">1.15</option>
                                            <option value="1.5">1.5</option>
                                            <option value="2.0">2.0</option>
                                            <option value="2.5">2.5</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.editorContainer}>
                                <textarea
                                    ref={editorRef}
                                    className={styles.editorInput}
                                    style={{ lineHeight: lineHeight }}
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    onSelect={handleEditorSelect}
                                    onContextMenu={handleContextMenu}
                                    placeholder="Start typing your note here..."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {ENABLE_AI && contextMenu && (
                    <div
                        className={styles.contextMenu}
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <button onClick={lockSelection}>
                            <Wand2 size={14} /> Refine with AI
                        </button>
                        <button onClick={closeContextMenu}>
                            <X size={14} /> Cancel
                        </button>
                    </div>
                )}

                {showSaveModal && (
                    <SaveModal
                        noteId={currentNoteId}
                        onClose={() => setShowSaveModal(false)}
                        onSave={async () => {
                            try {
                                if (currentNoteId) {
                                    let result = await updateNote(currentNoteId, content);
                                    if (result && result.status === 'error' || result === false) {
                                        await createNote("test_user", "Untitled Note", content, pdfId);
                                    }
                                    alert("Note saved successfully! ✅");
                                }
                            } catch (err) {
                                console.error("Failed to save note content", err);
                                alert("Error saving note.");
                            }
                            setShowSaveModal(false);
                        }}
                    />
                )}

                {ENABLE_AI && refinementResult && (
                    <RefineModal
                        originalText={refinementResult.isFullNote ? "Full Note" : refinementResult.original}
                        refinedText={refinementResult.refined}
                        onClose={() => setRefinementResult(null)}
                        onApply={applyRefinement}
                    />
                )}
            </div>
        </div>
    );
};

export default NoteEditor;
