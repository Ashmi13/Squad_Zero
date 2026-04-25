
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { marked } from 'marked';
import {
    Share2, Search, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
    Bold, Italic, Underline, List, Link as LinkIcon, Mic,
    Wand2, Settings, PenTool, Loader2, X, MousePointerClick, ArrowUpDown, Highlighter, Clock, ArrowUpDown as ArrowUpDownIcon
} from 'lucide-react';
import styles from './NoteEditor.module.css';
import SaveModal from '../components/SaveModal';
import RefineModal from '../components/RefineModal';
import { generateNote, refineText, updateNote, createNote, summarizePrompts } from '../api';


// --- CONFIGURATION ---
// Set to TRUE for full AI features (Final)
// Set to FALSE for manual-only mode (Interim Demo)
const ENABLE_AI = false;

// --- MERMAID RENDERER ---
const Mermaid = ({ chart }) => {
    useEffect(() => {
        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'loose',
            fontFamily: 'Inter, sans-serif',
        });

        // Timeout ensures the DOM is ready before Mermaid tries to render SVG
        setTimeout(() => {
            mermaid.contentLoaded();
        }, 100);
    }, [chart]);

    return (
        <div className="mermaid" style={{ display: 'flex', justifyContent: 'center', margin: '20px 0', border: '1px solid #f1f3f5', borderRadius: '12px', padding: '20px', backgroundColor: '#fafbfc' }}>
            {chart}
        </div>
    );
};

const NoteEditor = () => {
    const { noteId } = useParams();
    const navigate = useNavigate();

    const [content, setContent] = useState('');
    const [lineHeight, setLineHeight] = useState('1.5');

    // Support Multiple Documents for the right panel
    const [documents, setDocuments] = useState([]);
    const [activeDocIndex, setActiveDocIndex] = useState(0);
    const [sourceMdContent, setSourceMdContent] = useState("");

    const activeDoc = documents[activeDocIndex] || null;
    const pdfId = activeDoc?.pdfId || '';
    const pdfUrl = activeDoc?.url || '';
    const isPptx = activeDoc?.isPptx || false;

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

    // Resizable split screen
    const [leftPanelWidth, setLeftPanelWidth] = useState(50); // percentage
    const [isResizing, setIsResizing] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState("English");
    const [searchText, setSearchText] = useState('');

    const chatInputRef = useRef(null);
    const quillRef = useRef(null); // Ref for ReactQuill

    const [rightView, setRightView] = useState('pdf'); // 'pdf' | 'preview'

    useEffect(() => {
        const savedNote = localStorage.getItem('currentNote');

        if (savedNote) {
            const parsed = JSON.parse(savedNote);
            let loadedContent = parsed.content;
            if (loadedContent && !loadedContent.includes('<p>') && !loadedContent.includes('<h1>')) {
                loadedContent = marked.parse(loadedContent);
            }
            setContent(loadedContent);
            if (!currentNoteId) setCurrentNoteId(parsed.noteId);

            const absolutePdfUrl = parsed.pdfUrl?.startsWith('/')
                ? `http://127.0.0.1:8000${parsed.pdfUrl}`
                : parsed.pdfUrl;

            // Load the actual uploaded document into the viewer
            setDocuments([
                { id: 1, name: parsed.filename || "Uploaded Document.pdf", url: absolutePdfUrl, pdfId: parsed.pdfId },
                { id: 2, name: "Neural Networks Intro (Mock).pdf", url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", pdfId: "mock-123" },
            ]);

            // If it's a markdown source, fetch the content to display
            if (absolutePdfUrl && absolutePdfUrl.toLowerCase().endsWith('.md')) {
                fetch(absolutePdfUrl)
                    .then(res => res.text())
                    .then(text => setSourceMdContent(text))
                    .catch(err => console.error("Error fetching source MD:", err));
            }
        } else {
            if (!ENABLE_AI) setContent('');
            // Fallback mocks if navigating directly without a real upload
            setDocuments([
                { id: 1, name: "Neural Networks Intro.pdf", url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", pdfId: "pdf-123" },
                { id: 2, name: "Advanced ML Vectors.pdf", url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", pdfId: "pdf-456" }
            ]);
        }
    }, [noteId]);

    // Custom toolbar modules for Quill to disable default toolbar
    const modules = {
        toolbar: false,
    };

    // Resizing Logic
    const startResizing = (e) => {
        setIsResizing(true);
        document.body.style.cursor = 'col-resize';
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;

            // Calculate width as percentage of the window (adjust for Sidebar)
            const sidebarWidth = 320;
            const availableWidth = window.innerWidth - sidebarWidth;
            const newLeftWidth = ((e.clientX - sidebarWidth) / availableWidth) * 100;

            // Constrain width
            if (newLeftWidth > 20 && newLeftWidth < 80) {
                setLeftPanelWidth(newLeftWidth);
            }
        };

        const stopResizing = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', stopResizing);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing]);

    // --- Toolbar Functions ---
    const handleToolbarAction = (action, value) => {
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();
        const currentFormats = editor.getFormat();

        switch (action) {
            case 'bold': editor.format('bold', !currentFormats.bold); break;
            case 'italic': editor.format('italic', !currentFormats.italic); break;
            case 'underline': editor.format('underline', !currentFormats.underline); break;
            case 'highlight': editor.format('background', value === 'transparent' ? false : value || 'yellow'); break;
            case 'list': editor.format('list', currentFormats.list === 'bullet' ? false : 'bullet'); break;
            case 'link':
                const range = editor.getSelection();
                if (range) {
                    const url = prompt('Enter link URL:');
                    if (url) editor.format('link', url);
                } else {
                    alert('Select text first to add a link');
                }
                break;
            default: break;
        }

        // Delay to allow quill to update its internal HTML before saving sync
        setTimeout(() => {
            const newText = editor.root.innerHTML;
            setContent(newText);
            localStorage.setItem('currentNote', JSON.stringify({
                content: newText,
                pdfId,
                noteId: currentNoteId
            }));
        }, 100);
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

    const handleQuillChangeSelection = (range, source, editor) => {
        if (range && range.length > 0) {
            const selectedText = editor.getText(range.index, range.length);
            setTempSelection({ text: selectedText, start: range.index, length: range.length, range });
        } else {
            setTempSelection(null);
        }
    };

    const handleContextMenu = (e) => {
        // Allow context menu if AI is enabled OR if there is a selection to refine
        if (!ENABLE_AI && !tempSelection) return;

        e.preventDefault();
        if (tempSelection) {
            setContextMenu({ x: e.clientX, y: e.clientY });
        }
    };

    const closeContextMenu = () => {
        setContextMenu(null);
    };

    const lockSelection = () => {
        if (!quillRef.current || !tempSelection) return;
        setSelection(tempSelection);
        setContextMenu(null);

        // Apply visual highlight to the selection natively using Quill formatting
        const editor = quillRef.current.getEditor();
        editor.formatText(tempSelection.start, tempSelection.length, 'background', '#FFF176');
    };

    const clearSelection = () => {
        if (selection && quillRef.current) {
            const editor = quillRef.current.getEditor();
            // Remove highlighting
            editor.formatText(selection.start, selection.length, 'background', false);
        }
        setSelection(null);
        setTempSelection(null);
    };

    const handleSearch = () => {
        if (!quillRef.current || !searchText.trim()) return;
        const editor = quillRef.current.getEditor();
        const text = editor.getText().toLowerCase();

        let query = searchText.toLowerCase();
        let startIndex = 0;

        // If there's an existing selection, start searching *after* it
        if (selection && selection.length > 0) {
            startIndex = selection.start + selection.length;
        }

        let index = text.indexOf(query, startIndex);

        // Wrap around if not found
        if (index === -1 && startIndex > 0) {
            index = text.indexOf(query, 0);
        }

        if (index !== -1) {
            editor.setSelection(index, query.length);
        } else {
            alert("No matches found in document.");
        }
    };

    const handleChatSubmit = async () => {
        if (!chatInput.trim()) return;
        setIsProcessing(true);

        try {
            if (selection) {
                const result = await refineText(pdfId, selection.text, chatInput);
                // Handle all possible backend response shapes
                const rawResult = result.refined_text || result;
                const refinedStr = rawResult?.refined_content
                    || rawResult?.refined_text
                    || (rawResult?.error ? `Error: ${rawResult.error}` : null)
                    || "Error: Failed to synthesize.";
                setRefinementResult({
                    original: selection.text,
                    refined: refinedStr,
                    instruction: chatInput,
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

    /* handleScroll removed as we're switching to a unified page wrapper structure */

    const applyRefinement = async (finalRefinedText, history = [], insertionType = 'replace') => {
        if (!selection || !quillRef.current) return;

        // Snap current selection before clearing so the modal forces shut instantly!
        const currentSelection = { ...selection };
        setRefinementResult(null); // Closes Modal!
        clearSelection();

        let metaTopic = refinementResult?.instruction || 'Refined Update';
        let metaDescription = '';
        if (history && history.length > 0) {
            const prompts = history.map(h => h.prompt);
            try {
                const summaryResponse = await summarizePrompts(prompts, currentSelection.text);
                const combined = summaryResponse.topic || '';
                const parts = combined.split('||');
                metaTopic = parts[0]?.trim() || prompts.join(' → ');
                metaDescription = parts[1]?.trim() || '';
            } catch (e) {
                metaTopic = prompts.join(' → ');
                metaDescription = '';
            }
        }

        const editor = quillRef.current.getEditor();
        let combinedHtml = "";

        if (insertionType === 'insert') {
            // Keep original text, append elegantly framed box right below
            // We use blockquote so Quill doesn't strip the container layout!
            combinedHtml = `
                <blockquote>
                    <strong style="color: #6C5DD3; font-size: 13px;">✨ AI Refined: ${metaTopic}</strong>
                    ${metaDescription ? `<br/><em style="color: #888; font-size: 12px;">${metaDescription}</em>` : ''}
                </blockquote>
                ${marked.parse(finalRefinedText).split('</p>').map(p => p.trim() ? `<blockquote>${p}</p></blockquote>` : '').join('')}
                <p><br></p>
            `;
            // Insert a newline after selection and paste the box
            editor.insertText(currentSelection.start + currentSelection.length, '\n');
            editor.clipboard.dangerouslyPasteHTML(currentSelection.start + currentSelection.length + 1, combinedHtml);
        } else {
            // Seamlessly replace the original text inline
            combinedHtml = marked.parse(finalRefinedText);
            editor.deleteText(currentSelection.start, currentSelection.length);
            editor.clipboard.dangerouslyPasteHTML(currentSelection.start, combinedHtml);
        }

        const newContent = editor.root.innerHTML;
        setContent(newContent);
        setRefinementResult(null);
        clearSelection();

        localStorage.setItem('currentNote', JSON.stringify({
            content: newContent,
            pdfId,
            noteId: currentNoteId
        }));
    };

    return (
        <div className={styles.pageContainer} onClick={closeContextMenu}>
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
                <div
                    className="ql-editor"
                    style={{ padding: 0, overflow: 'visible', color: 'black' }}
                    dangerouslySetInnerHTML={{ __html: content }}
                />
            </div>

            <div className={styles.header}>
                <div className={styles.brand}>
                    <div className={styles.logoBox}>N</div>
                    <span>NeuraNote</span>
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
                            <button className={styles.headerBtn} onClick={handleExport} disabled={isProcessing} style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer' }}>
                                {isProcessing ? '...' : 'Download PDF'}
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

            <div className={`${styles.mainArea} ${isResizing ? styles.isResizing : ''}`}>
                {/* EDITOR PANEL (NOW LEFT) */}
                <div className={styles.leftPanel} style={{ width: `${leftPanelWidth}%`, flexShrink: 0, background: '#F8F9FA' }}>
                    <div className={styles.editorToolbar}>
                        <div className={styles.formatGroup}>
                            <button className={styles.formatBtn} onMouseDown={(e) => { e.preventDefault(); handleToolbarAction('bold'); }} title="Bold"><Bold size={18} /></button>
                            <button className={styles.formatBtn} onMouseDown={(e) => { e.preventDefault(); handleToolbarAction('italic'); }} title="Italic"><Italic size={18} /></button>
                            <button className={styles.formatBtn} onMouseDown={(e) => { e.preventDefault(); handleToolbarAction('underline'); }} title="Underline"><Underline size={18} /></button>

                            <div className={styles.spacingWrapper} title="Highlight Color">
                                <Highlighter size={16} className={styles.spacingIcon} />
                                <select
                                    className={styles.spacingSelect}
                                    onChange={(e) => {
                                        handleToolbarAction('highlight', e.target.value);
                                        e.target.value = '';
                                    }}
                                >
                                    <option value="">Highlight...</option>
                                    <option value="#FFF176">Yellow</option>
                                    <option value="#A5D6A7">Green</option>
                                    <option value="#90CAF9">Blue</option>
                                    <option value="#F48FB1">Pink</option>
                                    <option value="#FFCC80">Orange</option>
                                    <option value="transparent">Clear</option>
                                </select>
                            </div>

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
                            <div style={{ marginLeft: "10px", display: "flex", alignItems: "center", background: "white", borderRadius: "6px", border: "1px solid #EAEAEA", padding: "4px 8px" }}>
                                <input
                                    type="text"
                                    placeholder="Find text..."
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    style={{ border: 'none', outline: 'none', fontSize: '13px', width: '130px', background: "transparent" }}
                                />
                                <div onClick={handleSearch} style={{ cursor: "pointer", color: "#8E9297", display: "flex", alignItems: "center" }}>
                                    <Search size={14} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.editorContainer}>
                        <div className={styles.editorPage} style={{ lineHeight: lineHeight }} onContextMenu={handleContextMenu}>
                            <ReactQuill
                                ref={quillRef}
                                theme="snow"
                                modules={modules}
                                value={content}
                                onChange={setContent}
                                onChangeSelection={handleQuillChangeSelection}
                                className={styles.editorQuill}
                                placeholder="Start typing your note here..."
                            />
                        </div>
                    </div>

                    {selection && (
                        <div className={styles.selectionIndicator}>
                            <span className={styles.selectionLabel}>Tagged:</span>
                            <span className={styles.selectionText}>"{selection.text.substring(0, 50)}..."</span>
                            <button className={styles.clearSelectionBtn} onClick={clearSelection}><X size={12} /></button>
                        </div>
                    )}

                    {(ENABLE_AI || selection) && (
                        <div className={styles.bottomBarContainer}>
                            <div className={styles.bottomBar}>
                                <div className={styles.inputWrapper}>
                                    <input
                                        ref={chatInputRef}
                                        type="text"
                                        placeholder={selection ? "Refine tagged text..." : "Instructions to AI (Summarize, expand, format)..."}
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                                        disabled={isProcessing}
                                    />
                                    <button className={styles.iconBtn}><Mic size={18} /></button>
                                </div>
                                <button className={styles.sendBtn} onClick={handleChatSubmit} disabled={isProcessing}>
                                    {isProcessing ? <Loader2 size={18} className={styles.spin} /> : 'Refine'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Divider Line */}
                <div
                    className={`${styles.resizer} ${isResizing ? styles.isResizing : ''}`}
                    onMouseDown={startResizing}
                />

                {/* PDF / PREVIEW PANEL (NOW RIGHT) */}
                <div className={styles.rightPanel} style={{ flex: 1, pointerEvents: isResizing ? 'none' : 'auto' }}>
                    <div className={styles.pdfToolbar}>

                        {/* NEW DOCUMENT SELECTOR */}
                        <select
                            className={styles.docSelector}
                            value={activeDocIndex}
                            onChange={(e) => setActiveDocIndex(Number(e.target.value))}
                        >
                            {documents.map((doc, idx) => (
                                <option key={idx} value={idx}>{doc.name}</option>
                            ))}
                        </select>

                        <div className={styles.viewToggleGroup} style={{ marginLeft: 0 }}>
                            <button
                                className={`${styles.viewToggleBtn} ${rightView === 'pdf' ? styles.active : ''}`}
                                onClick={() => setRightView('pdf')}
                            >
                                {isPptx ? 'PowerPoint View' : 'PDF Source'}
                            </button>
                            <button
                                className={`${styles.viewToggleBtn} ${rightView === 'preview' ? styles.active : ''}`}
                                onClick={() => setRightView('preview')}
                            >
                                Live Preview
                            </button>
                        </div>
                    </div>
                    <div className={styles.pdfContent}>
                        {rightView === 'pdf' ? (
                            <div className={styles.markdownWrapper} style={{ height: '100%' }}>
                                {pdfUrl ? (
                                    isPptx ? (
                                        <div className={styles.emptyState} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            <div>PowerPoint files cannot be previewed directly.</div>
                                            <a
                                                href={pdfUrl}
                                                download
                                                className={styles.primaryBtn}
                                                style={{ textDecoration: 'none', textAlign: 'center' }}
                                            >
                                                Download Slides
                                            </a>
                                        </div>
                                    ) : pdfUrl.toLowerCase().endsWith('.md') ? (
                                        <div style={{ padding: '20px', overflowY: 'auto', height: '100%', background: 'white' }}>
                                            <div dangerouslySetInnerHTML={{ __html: marked.parse(sourceMdContent || "# Loading Source...") }} />
                                        </div>
                                    ) : (
                                        <iframe
                                            src={pdfUrl}
                                            className={styles.pdfFrame}
                                            title="PDF Viewer"
                                        />
                                    )
                                ) : (
                                    <div className={styles.emptyState}>No source file loaded.</div>
                                )}
                            </div>
                        ) : (
                            <div className={styles.markdownWrapper} style={{
                                height: '100%',
                                overflowY: 'auto',
                                fontSize: `${zoomLevel / 100 * 15}px`,
                            }}>
                                <div
                                    className={styles.markdownContent}
                                    style={{ padding: 0, overflow: 'visible', minHeight: 'auto' }}
                                    dangerouslySetInnerHTML={{ __html: content || "Start typing in the editor to see the preview..." }}
                                />
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {contextMenu && (
                <div
                    className={styles.contextMenu}
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button onClick={lockSelection}>
                        <Wand2 size={14} /> Tag & Refine Selection
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
                    onSave={async (title) => {
                        try {
                            const noteTitle = title || "Untitled Note";
                            if (currentNoteId) {
                                // Update existing note
                                await updateNote(currentNoteId, content);
                                alert(`Note "${noteTitle}" updated in PostgreSQL! ✅`);
                            } else {
                                // Handle creating a brand new note for the demo
                                const result = await createNote("test_user", noteTitle, content, pdfId);
                                if (result && result.note_id) {
                                    setCurrentNoteId(result.note_id);
                                    // Also update localStorage so it persists on refresh
                                    const currentNote = JSON.parse(localStorage.getItem('currentNote') || '{}');
                                    currentNote.noteId = result.note_id;
                                    localStorage.setItem('currentNote', JSON.stringify(currentNote));

                                    alert(`Note "${noteTitle}" created and saved to PostgreSQL! ✅`);
                                }
                            }
                        } catch (err) {
                            console.error("Failed to save to DB", err);
                            alert("Error saving to PostgreSQL.");
                        }
                        setShowSaveModal(false);
                    }}
                />
            )}

            {refinementResult && (
                <RefineModal
                    originalText={refinementResult.isFullNote ? "Full Note" : refinementResult.original}
                    initialRefinedText={refinementResult.refined}
                    currentInstruction={refinementResult.instruction}
                    pdfId={pdfId}
                    refineTextApi={refineText}
                    onClose={() => setRefinementResult(null)}
                    onApply={(finalRefinedText, history, insertionType) => applyRefinement(finalRefinedText, history, insertionType)}
                />
            )}
        </div>
    );
};

export default NoteEditor;
