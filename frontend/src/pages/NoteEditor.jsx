
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import {
    Share2, Search, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
    Bold, Italic, Underline, List, Link as LinkIcon, Mic,
    Wand2, Settings, PenTool, Loader2, X, MousePointerClick, ArrowUpDown
} from 'lucide-react';
import styles from './NoteEditor.module.css';
import SaveModal from '../components/SaveModal';
import RefineModal from '../components/RefineModal';
import { generateNote, refineText } from '../api';


// --- CONFIGURATION ---
// Set to TRUE for full AI features (Final)
// Set to FALSE for manual-only mode (Interim Demo)
const ENABLE_AI = true;

const NoteEditor = () => {
    const { noteId } = useParams();
    const navigate = useNavigate();

    const [content, setContent] = useState('');
    const [lineHeight, setLineHeight] = useState('1.5'); // Default spacing
    const [pdfId, setPdfId] = useState('');
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
            if (!currentNoteId) setCurrentNoteId(parsed.noteId);
        } else {
            // For Interim Mode: Initialize empty if no note found
            if (!ENABLE_AI) {
                setContent('');
            }
        }
    }, [noteId]);

    // --- Toolbar Functions ---
    const insertFormat = (startTag, endTag = startTag) => {
        if (!editorRef.current) return;

        const textarea = editorRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = content.substring(start, end);
        const before = content.substring(0, start);
        const after = content.substring(end);

        const newContent = before + startTag + text + endTag + after;
        setContent(newContent);

        // Update persistent storage
        localStorage.setItem('currentNote', JSON.stringify({
            content: newContent,
            pdfId,
            noteId: currentNoteId
        }));

        // Restore focus/selection (optional adjustment)
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + startTag.length, end + startTag.length);
        }, 0);
    };

    const handleToolbarAction = (action) => {
        switch (action) {
            case 'bold': insertFormat('**'); break;
            case 'italic': insertFormat('*'); break;
            // Underline not standard markdown, using HTML or ignoring. Let's use HTML <u> for now or ignore.
            case 'underline': insertFormat('<u>', '</u>'); break;
            case 'list': insertFormat('\n- '); break;
            case 'link': insertFormat('[', '](url)'); break;
            default: break;
        }
    };


    // --- Selection Handlers ---
    const handleEditorSelect = (e) => {
        // Only enable selection for refinement if AI is enabled
        if (!ENABLE_AI) return;

        // We use onSelect or onMouseUp to capture selection info from Textarea
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;

        if (start !== end) {
            const selectedText = content.substring(start, end);
            setTempSelection({
                text: selectedText,
                start,
                end
            });
        } else {
            // Maybe clear? keeping simple for now
        }
    };

    const handleContextMenu = (e) => {
        if (!ENABLE_AI) return; // Native context menu in manual mode

        e.preventDefault();
        if (tempSelection) {
            setContextMenu({ x: e.pageX, y: e.pageY });
        }
    };

    const closeContextMenu = () => {
        setContextMenu(null);
    };

    const lockSelection = () => {
        if (!tempSelection) return;

        const textToMark = tempSelection.text;
        const before = content.substring(0, tempSelection.start);
        const after = content.substring(tempSelection.end);

        const markedContent = `${before} <mark>${textToMark}</mark>${after} `;

        setContent(markedContent);
        setSelection({ ...tempSelection, text: textToMark }); // Locked
        setContextMenu(null);
        setTempSelection(null);

        if (chatInputRef.current) {
            chatInputRef.current.focus();
        }
    };

    const clearSelection = () => {
        if (selection) {
            const cleanContent = content.replace(/<mark>(.*?)<\/mark>/g, '$1');
            setContent(cleanContent);
        }
        setSelection(null);
        setTempSelection(null);
    };

    const handleChatSubmit = async () => {
        if (!chatInput.trim() || !pdfId) return;

        setIsProcessing(true);
        try {
            if (selection) {
                // Refine tagged text
                const result = await refineText(pdfId, selection.text, chatInput);
                setRefinementResult({
                    original: selection.text,
                    refined: result.refined_content
                });
            } else {
                // Regenerate
                const result = await generateNote(pdfId, userId, chatInput);
                setRefinementResult({
                    original: content.substring(0, 200) + "...",
                    refined: result.content,
                    isFullNote: true
                });
            }
            setChatInput('');
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const applyRefinement = () => {
        if (!refinementResult) return;

        let newContent = content;
        if (refinementResult.isFullNote) {
            newContent = refinementResult.refined;
        } else {
            // Replace markup
            const target = `< mark > ${refinementResult.original}</mark > `;
            newContent = content.replace(target, refinementResult.refined);
            if (newContent === content) {
                newContent = content.replace(refinementResult.original, refinementResult.refined);
            }
        }

        setContent(newContent);
        localStorage.setItem('currentNote', JSON.stringify({
            content: newContent,
            pdfId,
            noteId: currentNoteId
        }));
        setRefinementResult(null);
        setSelection(null);
    };

    return (
        <div className={styles.container} onClick={closeContextMenu}>
            {/* HEADER */}
            <header className={styles.header}>
                <div className={styles.brand}>
                    <div className={styles.logoBox}>N</div>
                    <span>Neura Note</span>
                </div>
                <div className={styles.headerActions}>
                    <div className={styles.headerSetting}>
                        <Settings size={16} />
                        <span>Settings</span>
                    </div>
                    <img src="https://via.placeholder.com/32" className={styles.avatar} alt="User" />
                </div>
            </header>

            <div className={styles.mainArea}>
                {/* LEFT PANEL: PREVIEW (FINAL VIEW) */}
                <div className={styles.leftPanel}>
                    <div className={styles.pdfToolbar}>
                        <div className={styles.pdfControls}>
                            <span style={{ fontWeight: 600, color: '#333' }}>
                                {ENABLE_AI ? "Final Preview" : "PDF Viewer"}
                            </span>
                        </div>
                        <div className={styles.zoomControls}>
                            <button className={styles.iconBtn} onClick={() => setZoomLevel(z => Math.max(z - 10, 25))}><ZoomOut size={16} /></button>
                            <span className={styles.zoomLevel}>{zoomLevel}%</span>
                            <button className={styles.iconBtn} onClick={() => setZoomLevel(z => Math.min(z + 10, 200))}><ZoomIn size={16} /></button>
                        </div>
                    </div>

                    <div className={styles.pdfContent}>
                        <div className={styles.markdownWrapper} style={{ fontSize: `${zoomLevel / 100 * 15} px` }}>
                            {content ? (
                                <ReactMarkdown rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
                            ) : (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%',
                                    color: '#999'
                                }}>
                                    {ENABLE_AI ? (
                                        <p>Preview will appear here...</p>
                                    ) : (
                                        <>
                                            <p style={{ marginBottom: '1rem' }}>PDF Document would be displayed here.</p>
                                            <div style={{ width: '200px', height: '280px', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
                                                PDF Placeholder
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selection Indicator on Left too? Maybe not needed since highlight is in editor */}
                        {ENABLE_AI && selection && (
                            <div className={styles.selectionIndicator}>
                                <span className={styles.selectionLabel}>Targeting:</span>
                                <span className={styles.selectionText}>"{selection.text.substring(0, 30)}..."</span>
                                <button className={styles.clearSelectionBtn} onClick={clearSelection}><X size={12} /></button>
                            </div>
                        )}

                        {/* Bottom Bar attached to Left Panel (Context) */}
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
                </div>

                {/* RIGHT PANEL: EDITOR (WORKING AREA) */}
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
                                <ArrowUpDown size={16} className={styles.spacingIcon} />
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
                        <div className={styles.actionGroup}>
                            <button className={styles.textBtn}>Export</button>
                            <button className={styles.primaryBtn} onClick={() => setShowSaveModal(true)}>Save</button>
                        </div>
                    </div>

                    <div className={styles.editorContainer}>
                        <textarea
                            ref={editorRef}
                            className={styles.editorInput}
                            style={{ lineHeight: lineHeight }}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            onSelect={handleEditorSelect} // Capture selection
                            onContextMenu={handleContextMenu}
                            placeholder="Start typing your note here..."
                        />
                    </div>
                </div>
            </div>

            {/* Custom Context Menu */}
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
                    onSave={() => {
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
    );
};

export default NoteEditor;

