import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  CornerDownLeft,
  FileDown,
  FileText,
  Folder,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  Save,
  Underline,
  Undo2,
  X,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { workspaceApi } from '@/services/workspaceApi';
import { getFolderHandleBinding, saveFileToLocalFolder } from '@/utils/localFsSync';

const DRAFT_KEY = 'manual-note-draft-v1';
const DEFAULT_TITLE = 'Untitled Note';
const DEFAULT_HTML = '<h1>Untitled Note</h1><p>Start typing your note here...</p>';

const sanitizeFileName = (value) => String(value || DEFAULT_TITLE)
  .trim()
  .replace(/[\\/:*?"<>|]+/g, '-')
  .replace(/\s+/g, ' ')
  .slice(0, 120) || DEFAULT_TITLE;

const extractPlainText = (html) => {
  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(html || '', 'text/html');
  return (documentFragment.body.innerText || documentFragment.body.textContent || '').trim();
};

const collectPdfBlocks = (node, blocks = []) => {
  if (!node) return blocks;

  const nodeType = node.nodeType;
  if (nodeType === Node.TEXT_NODE) {
    const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) blocks.push({ type: 'text', text });
    return blocks;
  }

  if (nodeType !== Node.ELEMENT_NODE) {
    return blocks;
  }

  const tagName = node.tagName.toUpperCase();
  if (tagName === 'BR') {
    blocks.push({ type: 'break' });
    return blocks;
  }

  if (tagName === 'UL' || tagName === 'OL') {
    const items = Array.from(node.children || []).filter((child) => child.tagName && child.tagName.toUpperCase() === 'LI');
    items.forEach((item, index) => {
      const content = extractPlainText(item.innerHTML || item.textContent || '');
      if (!content) return;
      blocks.push({
        type: 'list-item',
        ordered: tagName === 'OL',
        index: index + 1,
        text: content,
      });
    });
    return blocks;
  }

  if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P'].includes(tagName)) {
    const text = extractPlainText(node.innerHTML || node.textContent || '');
    if (text) {
      blocks.push({ type: 'block', tag: tagName.toLowerCase(), text });
    }
    return blocks;
  }

  if (tagName === 'DIV') {
    Array.from(node.childNodes || []).forEach((child) => collectPdfBlocks(child, blocks));
    return blocks;
  }

  Array.from(node.childNodes || []).forEach((child) => collectPdfBlocks(child, blocks));
  return blocks;
};

const createPdfBlobFromHtml = async (title, html) => {
  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(html || '', 'text/html');
  const blocks = collectPdfBlocks(documentFragment.body, []);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const left = 16;
  const right = 16;
  const top = 18;
  const bottom = 18;
  const maxWidth = pageWidth - left - right;

  let cursorY = top;

  const ensureSpace = (lineHeight) => {
    if (cursorY + lineHeight > pageHeight - bottom) {
      pdf.addPage();
      cursorY = top;
    }
  };

  const writeLine = (text, fontSize, style = 'normal', spacingAfter = 2) => {
    const clean = String(text || '').trim();
    if (!clean) return;

    pdf.setFont('helvetica', style);
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(clean, maxWidth);
    const lineHeight = Math.max(5, fontSize * 0.55);

    lines.forEach((line) => {
      ensureSpace(lineHeight);
      pdf.text(line, left, cursorY);
      cursorY += lineHeight;
    });

    cursorY += spacingAfter;
  };

  writeLine(title || DEFAULT_TITLE, 20, 'bold', 6);

  blocks.forEach((block) => {
    if (block.type === 'break') {
      cursorY += 4;
      return;
    }

    if (block.type === 'list-item') {
      const prefix = block.ordered ? `${block.index}. ` : '• ';
      writeLine(`${prefix}${block.text}`, 12, 'normal', 1.5);
      return;
    }

    if (block.type === 'block') {
      if (block.tag === 'h1') {
        cursorY += 2;
        writeLine(block.text, 18, 'bold', 3);
        return;
      }
      if (block.tag === 'h2') {
        cursorY += 1.5;
        writeLine(block.text, 15, 'bold', 2.5);
        return;
      }
      if (block.tag === 'h3') {
        writeLine(block.text, 13.5, 'bold', 2);
        return;
      }
      writeLine(block.text, 12, 'normal', 2);
    }
  });

  return pdf.output('blob');
};

const flattenFolders = (nodes, depth = 0, output = []) => {
  (nodes || []).forEach((folder) => {
    if (!folder?.id) return;
    output.push({
      id: folder.id,
      name: folder.name || 'Untitled Folder',
      depth,
    });
    if (Array.isArray(folder.children) && folder.children.length > 0) {
      flattenFolders(folder.children, depth + 1, output);
    }
  });
  return output;
};

const hasKnownLocalFolderBinding = async (folderId) => {
  if (!folderId) return false;
  try {
    const binding = await getFolderHandleBinding(folderId);
    return Boolean(binding?.handle);
  } catch {
    return false;
  }
};

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const FolderPickerModal = ({
  actionLabel,
  folders,
  loading,
  selectedFolderId,
  onSelectFolder,
  onClose,
  onConfirm,
}) => {
  const renderFolders = (items) => (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((folder) => {
        const isSelected = String(folder.id) === String(selectedFolderId);

        return (
          <button
            key={folder.id}
            type="button"
            onClick={() => onSelectFolder(folder.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 14,
              border: isSelected ? '1px solid #4f46e5' : '1px solid #e5e7eb',
              background: isSelected ? '#eef2ff' : '#fff',
              cursor: 'pointer',
              marginLeft: `${folder.depth * 14}px`,
            }}
          >
            <Folder size={16} color={isSelected ? '#4338ca' : '#64748b'} />
            <span style={{ flex: 1, color: '#111827', fontWeight: 600 }}>{folder.name}</span>
            {isSelected ? <ChevronDown size={16} color="#4338ca" /> : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15, 23, 42, 0.58)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(720px, 100%)', background: '#fff', borderRadius: 24, overflow: 'hidden', boxShadow: '0 30px 80px rgba(15, 23, 42, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #e5e7eb' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#64748b', fontWeight: 800 }}>{actionLabel}</div>
            <h3 style={{ margin: '6px 0 0', fontSize: 20, color: '#0f172a' }}>Choose a folder</h3>
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 6, borderRadius: 10 }}>
            <X size={18} color="#64748b" />
          </button>
        </div>

        <div style={{ padding: 22, maxHeight: '62vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '24px 0', color: '#64748b' }}>Loading folders...</div>
          ) : folders.length === 0 ? (
            <div style={{ padding: '24px 0', color: '#64748b' }}>No folders found. Create a folder first in Files.</div>
          ) : (
            renderFolders(folders)
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: 22, borderTop: '1px solid #e5e7eb', background: '#f8fafc' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ border: '1px solid #d1d5db', background: '#fff', color: '#111827', padding: '11px 16px', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!selectedFolderId}
            style={{ border: 'none', background: selectedFolderId ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : '#cbd5e1', color: '#fff', padding: '11px 16px', borderRadius: 12, fontWeight: 800, cursor: selectedFolderId ? 'pointer' : 'not-allowed' }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

const ManualNoteEditor = () => {
  const navigate = useNavigate();
  const editorRef = useRef(null);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [htmlContent, setHtmlContent] = useState(DEFAULT_HTML);
  const [fontSize, setFontSize] = useState('16px');
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready to write.');
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderAction, setFolderAction] = useState('pdf');
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState('');

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
      if (draft.title) setTitle(draft.title);
      if (draft.htmlContent) setHtmlContent(draft.htmlContent);
    } catch {
      // Ignore draft parsing issues and start fresh.
    }
  }, []);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== htmlContent) {
      editorRef.current.innerHTML = htmlContent;
    }
  }, [htmlContent]);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, htmlContent }));
  }, [title, htmlContent]);

  const loadFolders = async () => {
    setFoldersLoading(true);
    try {
      const data = await workspaceApi.getFolders();
      const tree = Array.isArray(data?.folders) ? data.folders : [];
      setFolders(flattenFolders(tree));
    } catch (error) {
      console.error('Failed to load folders', error);
      setFolders([]);
    } finally {
      setFoldersLoading(false);
    }
  };

  const openFolderPicker = async (action) => {
    setFolderAction(action);
    setSelectedFolderId('');
    setFolderPickerOpen(true);
    await loadFolders();
  };

  const syncEditor = () => {
    if (!editorRef.current) return;
    const nextHtml = editorRef.current.innerHTML;
    setHtmlContent(nextHtml);
  };

  const runCommand = (command, value = null) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    document.execCommand(command, false, value);
    syncEditor();
  };

  const handleInsertLineBreak = () => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    document.execCommand('insertLineBreak');
    syncEditor();
  };

  const saveFileToFolder = async (folderId, folderName, kind) => {
    const safeTitle = sanitizeFileName(title);
    setBusy(true);

    try {
      if (kind === 'pdf') {
        setStatusMessage('Generating PDF...');
        const pdfBlob = await createPdfBlobFromHtml(safeTitle, editorRef.current?.innerHTML || htmlContent);
        const pdfFile = new File([pdfBlob], `${safeTitle}.pdf`, { type: 'application/pdf' });
        setStatusMessage('Uploading PDF to the selected folder...');
        await workspaceApi.uploadFile(folderId, pdfFile);
        try {
          const forcePickerFirst = !(await hasKnownLocalFolderBinding(folderId));
          await saveFileToLocalFolder({ id: folderId, name: folderName }, pdfFile, { forcePickerFirst });
        } catch (localSaveError) {
          console.warn('Manual note local PDF sync skipped:', localSaveError);
        }
        downloadBlob(pdfBlob, `${safeTitle}.pdf`);
        setStatusMessage(`Saved PDF to ${folderName} and downloaded locally.`);
      } else {
        const plainText = extractPlainText(editorRef.current?.innerHTML || htmlContent);
        if (!plainText) {
          throw new Error('There is no text to extract.');
        }

        setStatusMessage('Preparing extracted text...');
        const textBlob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
        const textFile = new File([textBlob], `${safeTitle} - Extracted Text.txt`, { type: 'text/plain' });
        setStatusMessage('Uploading extracted text to the selected folder...');
        await workspaceApi.uploadFile(folderId, textFile);
        try {
          const forcePickerFirst = !(await hasKnownLocalFolderBinding(folderId));
          await saveFileToLocalFolder({ id: folderId, name: folderName }, textFile, { forcePickerFirst });
        } catch (localSaveError) {
          console.warn('Manual note local text sync skipped:', localSaveError);
        }
        downloadBlob(textBlob, `${safeTitle} - Extracted Text.txt`);
        setStatusMessage(`Saved extracted text to ${folderName} and downloaded locally.`);
      }

      window.dispatchEvent(new Event('neuranote:files-updated'));

      setFolderPickerOpen(false);
      setSelectedFolderId('');
    } catch (error) {
      console.error(error);
      setStatusMessage(error.message || 'Failed to save note.');
      alert(error.message || 'Failed to save note.');
    } finally {
      setBusy(false);
    }
  };

  const toolbarButtonStyle = useMemo(() => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #dbe2f2',
    background: '#fff',
    color: '#0f172a',
    padding: '9px 12px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13,
  }), []);

  const editorStyles = {
    minHeight: 'calc(100vh - 240px)',
    padding: '26px 28px',
    borderRadius: 24,
    border: '1px solid #e5e7eb',
    background: '#fff',
    boxShadow: '0 20px 50px rgba(15, 23, 42, 0.06)',
    outline: 'none',
    lineHeight: 1.7,
    fontSize,
    color: '#111827',
    overflowY: 'auto',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top left, rgba(79,70,229,0.10), transparent 32%), linear-gradient(180deg, #f8fbff 0%, #eef3ff 100%)', padding: 24 }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', display: 'grid', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#64748b', fontWeight: 800 }}>Manual Note Workspace</div>
            <h1 style={{ margin: '8px 0 6px', fontSize: 34, lineHeight: 1.1, color: '#0f172a', letterSpacing: '-0.04em' }}>Create a note by hand, then save it where you want it.</h1>
            <p style={{ margin: 0, color: '#64748b', maxWidth: 860, lineHeight: 1.6 }}>
              Write freely, format like a rich text editor, and export the result as a PDF or extracted text file into any existing folder.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/files')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid #dbe2f2',
              background: '#fff',
              color: '#0f172a',
              padding: '11px 16px',
              borderRadius: 14,
              cursor: 'pointer',
              fontWeight: 800,
              boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
            }}
          >
            Back to Files
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 16, alignItems: 'center' }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Note Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Note"
              style={{ border: '1px solid #dbe2f2', borderRadius: 14, padding: '14px 16px', fontSize: 16, outline: 'none', background: '#fff', color: '#111827' }}
            />
          </label>

          <div style={{ alignSelf: 'end', display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => openFolderPicker('pdf')}
              disabled={busy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                border: 'none',
                background: busy ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: '#fff',
                padding: '13px 16px',
                borderRadius: 14,
                fontWeight: 800,
                cursor: busy ? 'not-allowed' : 'pointer',
                boxShadow: '0 14px 26px rgba(79,70,229,0.24)',
              }}
            >
              <FileDown size={16} /> Save as PDF
            </button>
            <button
              type="button"
              onClick={() => openFolderPicker('extract')}
              disabled={busy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid #dbe2f2',
                background: '#fff',
                color: '#0f172a',
                padding: '13px 16px',
                borderRadius: 14,
                fontWeight: 800,
                cursor: busy ? 'not-allowed' : 'pointer',
                boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
              }}
            >
              <FileText size={16} /> Extract Text
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 14, borderRadius: 20, background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 16px 32px rgba(15,23,42,0.05)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingRight: 10, borderRight: '1px solid #e5e7eb' }}>
            <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} style={{ ...toolbarButtonStyle, minWidth: 110, paddingRight: 8 }}>
              <option value="14px">Font 14</option>
              <option value="16px">Font 16</option>
              <option value="18px">Font 18</option>
              <option value="20px">Font 20</option>
              <option value="24px">Font 24</option>
            </select>
            <button type="button" title="Heading 1" onMouseDown={(e) => { e.preventDefault(); runCommand('formatBlock', 'h1'); }} style={toolbarButtonStyle}><Heading1 size={16} /> H1</button>
            <button type="button" title="Heading 2" onMouseDown={(e) => { e.preventDefault(); runCommand('formatBlock', 'h2'); }} style={toolbarButtonStyle}><Heading2 size={16} /> H2</button>
            <button type="button" title="Paragraph" onMouseDown={(e) => { e.preventDefault(); runCommand('formatBlock', 'p'); }} style={toolbarButtonStyle}><Pilcrow size={16} /> P</button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingRight: 10, borderRight: '1px solid #e5e7eb' }}>
            <button type="button" title="Bold" onMouseDown={(e) => { e.preventDefault(); runCommand('bold'); }} style={toolbarButtonStyle}><Bold size={16} /> Bold</button>
            <button type="button" title="Italic" onMouseDown={(e) => { e.preventDefault(); runCommand('italic'); }} style={toolbarButtonStyle}><Italic size={16} /> Italic</button>
            <button type="button" title="Underline" onMouseDown={(e) => { e.preventDefault(); runCommand('underline'); }} style={toolbarButtonStyle}><Underline size={16} /> Underline</button>
            <button type="button" title="Highlight" onMouseDown={(e) => { e.preventDefault(); runCommand('hiliteColor', '#fff59d'); }} style={toolbarButtonStyle}><Highlighter size={16} /> Highlight</button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingRight: 10, borderRight: '1px solid #e5e7eb' }}>
            <button type="button" title="Bullet List" onMouseDown={(e) => { e.preventDefault(); runCommand('insertUnorderedList'); }} style={toolbarButtonStyle}><List size={16} /> Bullets</button>
            <button type="button" title="Numbered List" onMouseDown={(e) => { e.preventDefault(); runCommand('insertOrderedList'); }} style={toolbarButtonStyle}><ListOrdered size={16} /> Numbers</button>
            <button type="button" title="Line Break" onMouseDown={(e) => { e.preventDefault(); handleInsertLineBreak(); }} style={toolbarButtonStyle}><CornerDownLeft size={16} /> Line Break</button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingRight: 10, borderRight: '1px solid #e5e7eb' }}>
            <button type="button" title="Align Left" onMouseDown={(e) => { e.preventDefault(); runCommand('justifyLeft'); }} style={toolbarButtonStyle}><AlignLeft size={16} /> Left</button>
            <button type="button" title="Align Center" onMouseDown={(e) => { e.preventDefault(); runCommand('justifyCenter'); }} style={toolbarButtonStyle}><AlignCenter size={16} /> Center</button>
            <button type="button" title="Align Right" onMouseDown={(e) => { e.preventDefault(); runCommand('justifyRight'); }} style={toolbarButtonStyle}><AlignRight size={16} /> Right</button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" title="Undo" onMouseDown={(e) => { e.preventDefault(); runCommand('undo'); }} style={toolbarButtonStyle}><Undo2 size={16} /> Undo</button>
            <button type="button" title="Redo" onMouseDown={(e) => { e.preventDefault(); runCommand('redo'); }} style={toolbarButtonStyle}><Redo2 size={16} /> Redo</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncEditor}
            style={editorStyles}
            spellCheck
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', color: '#64748b', fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Save size={14} /> {statusMessage}
            </div>
            <div>Current font size: {fontSize}</div>
          </div>
        </div>
      </div>

      {folderPickerOpen ? (
        <FolderPickerModal
          actionLabel={folderAction === 'pdf' ? 'Save as PDF' : 'Extract Text'}
          folders={folders}
          loading={foldersLoading}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          onClose={() => setFolderPickerOpen(false)}
          onConfirm={() => {
            const selected = folders.find((folder) => String(folder.id) === String(selectedFolderId));
            if (!selected) return;
            saveFileToFolder(selected.id, selected.name, folderAction);
          }}
        />
      ) : null}
    </div>
  );
};

export default ManualNoteEditor;