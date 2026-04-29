import React, { useMemo, useState } from 'react';
import { Bookmark, Highlighter, MessageSquare, Send, Sparkles, Tag, X, Download, Trash2 } from 'lucide-react';
import { Document, Packer, Paragraph } from 'docx';
import { jsPDF } from 'jspdf';
import ReactMarkdown from 'react-markdown';
import { config } from '@/config/env';
import { authFetch } from '@/utils/authSession';

const apiBaseUrl = config.apiBaseUrl || '';

const SummaryPanel = ({ title, summary, onClose, panelLabel = 'GENERATED SUMMARY', onDelete = null }) => {
  const [selectedText, setSelectedText] = useState('');
  const [tags, setTags] = useState([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState('');

  const markdownSummary = useMemo(() => String(summary || ''), [summary]);

  const downloadSummary = (format) => {
    const cleanTitle = String(title || 'summary').replace(/\.[^/.]+$/, '');
    const content = String(summary || '').trim();

    if (!content) return;

    if (format === 'txt') {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${cleanTitle}.txt`;
      link.click();
      window.URL.revokeObjectURL(url);
      return;
    }

    if (format === 'docx') {
      const lines = content.split('\n').map((line) => new Paragraph({ text: line || ' ' }));
      const doc = new Document({ sections: [{ children: lines }] });
      Packer.toBlob(doc).then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${cleanTitle}.docx`;
        link.click();
        window.URL.revokeObjectURL(url);
      });
      return;
    }

    if (format === 'pdf') {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      pdf.setFontSize(11);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const maxWidth = pageWidth - margin * 2;
      const lines = pdf.splitTextToSize(content, maxWidth);
      let cursorY = margin;

      lines.forEach((line) => {
        if (cursorY > pageHeight - margin) {
          pdf.addPage();
          cursorY = margin;
        }
        pdf.text(line, margin, cursorY);
        cursorY += 6;
      });

      pdf.save(`${cleanTitle}.pdf`);
    }
  };

  const handleSelection = () => {
    const selection = window.getSelection();
    const text = selection ? String(selection.toString() || '').trim() : '';
    setSelectedText(text);
  };

  const handleAddTag = () => {
    if (!selectedText) return;
    setTags((prev) => {
      if (prev.some((tag) => tag.text === selectedText)) {
        return prev;
      }
      return [...prev, { id: Date.now(), text: selectedText }];
    });
  };

  const handleAsk = async () => {
    const query = question.trim();
    if (!query) return;

    setIsAsking(true);
    setAskError('');
    setAnswer('');

    try {
      const response = await authFetch('/api/v1/pdf/ask-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: query,
          context: summary,
          highlighted_text: selectedText || null,
        }),
      });

      if (!response.ok) {
        let detail = 'Failed to answer question';
        try {
          const payload = await response.json();
          detail = payload?.detail || detail;
        } catch {
          // ignore parsing
        }
        throw new Error(detail);
      }

      const data = await response.json();
      setAnswer(data.answer || 'No answer returned.');
    } catch (error) {
      setAskError(error.message || 'Failed to answer question');
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'linear-gradient(180deg, #ffffff 0%, #f7f8ff 100%)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid #e8eaf4' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6b7280', fontWeight: 700 }}>
            <Sparkles size={14} /> {panelLabel}
          </div>
          <h3 style={{ margin: '6px 0 0', fontSize: 20, color: '#111827' }}>{title || 'Summary'}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => downloadSummary('txt')} style={{ border: '1px solid #dbe2f2', background: '#fff', cursor: 'pointer', color: '#111827', borderRadius: 10, padding: '8px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> TXT
          </button>
          <button onClick={() => downloadSummary('docx')} style={{ border: '1px solid #dbe2f2', background: '#fff', cursor: 'pointer', color: '#111827', borderRadius: 10, padding: '8px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> DOC
          </button>
          <button onClick={() => downloadSummary('pdf')} style={{ border: '1px solid #dbe2f2', background: '#fff', cursor: 'pointer', color: '#111827', borderRadius: 10, padding: '8px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> PDF
          </button>
          {onDelete ? (
            <button onClick={onDelete} style={{ border: '1px solid #fecaca', background: '#fff1f2', cursor: 'pointer', color: '#b91c1c', borderRadius: 10, padding: '8px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={14} /> Delete
            </button>
          ) : null}
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr', gap: 16, padding: 16, minHeight: 0, flex: 1 }}>
        <div style={{ minHeight: 0, overflow: 'auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 18, boxShadow: '0 8px 24px rgba(17,24,39,0.05)' }} onMouseUp={handleSelection}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
            <button onClick={handleAddTag} disabled={!selectedText} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #d9dcef', background: selectedText ? '#eef2ff' : '#f4f5f9', color: '#4f46e5', padding: '8px 12px', borderRadius: 10, cursor: selectedText ? 'pointer' : 'not-allowed' }}>
              <Tag size={14} /> Tag Selection
            </button>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 13 }}>
              <Highlighter size={14} /> Highlight text, then tag or ask about it.
            </div>
          </div>

          <div style={{ fontSize: 14, lineHeight: 1.7, color: '#1f2937' }}>
            {markdownSummary ? (
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 style={{ fontSize: 24, margin: '8px 0 12px', color: '#111827' }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontSize: 20, margin: '14px 0 10px', color: '#1f2937' }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: 17, margin: '12px 0 8px', color: '#334155' }}>{children}</h3>,
                  p: ({ children }) => <p style={{ margin: '0 0 10px', color: '#1f2937' }}>{children}</p>,
                  ul: ({ children }) => <ul style={{ margin: '0 0 12px 0', paddingLeft: 20 }}>{children}</ul>,
                  li: ({ children }) => <li style={{ marginBottom: 6, color: '#1f2937' }}>{children}</li>,
                  strong: ({ children }) => <strong style={{ color: '#111827' }}>{children}</strong>,
                  blockquote: ({ children }) => (
                    <blockquote style={{ margin: '8px 0', padding: '8px 12px', borderLeft: '3px solid #6366f1', background: '#eef2ff', borderRadius: 8 }}>
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {markdownSummary}
              </ReactMarkdown>
            ) : (
              <div style={{ color: '#6b7280' }}>No summary available.</div>
            )}
          </div>
        </div>

        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 14, boxShadow: '0 8px 24px rgba(17,24,39,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontWeight: 700, color: '#111827' }}>
              <MessageSquare size={16} /> Ask about selected text
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10, minHeight: 34 }}>
              {selectedText ? `Selected: ${selectedText.slice(0, 120)}${selectedText.length > 120 ? '...' : ''}` : 'Select any sentence or paragraph in the text to ask a question.'}
            </div>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask something like: Explain this in simple words"
              rows={4}
              style={{ width: '100%', resize: 'vertical', borderRadius: 12, border: '1px solid #d7dbe7', padding: 12, fontSize: 14, outline: 'none' }}
            />
            <button
              onClick={handleAsk}
              disabled={isAsking || !question.trim()}
              style={{ marginTop: 10, width: '100%', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8, background: isAsking ? '#a5b4fc' : '#4f46e5', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: 12, cursor: isAsking ? 'not-allowed' : 'pointer', fontWeight: 700 }}
            >
              <Send size={14} /> {isAsking ? 'Asking...' : 'Ask Question'}
            </button>
            {askError && <div style={{ marginTop: 10, color: '#b91c1c', fontSize: 13 }}>{askError}</div>}
            {answer && <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e5e7eb', fontSize: 13, lineHeight: 1.6, color: '#111827' }}>{answer}</div>}
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 14, boxShadow: '0 8px 24px rgba(17,24,39,0.05)', flex: 1, minHeight: 0, overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontWeight: 700, color: '#111827' }}>
              <Bookmark size={16} /> Tags
            </div>
            {tags.length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: 13 }}>No tags yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tags.map((tag) => (
                  <div key={tag.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 12, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: '#111827' }}>{tag.text}</div>
                    <button onClick={() => setTags((prev) => prev.filter((item) => item.id !== tag.id))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryPanel;
