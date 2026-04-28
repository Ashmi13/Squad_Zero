import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { marked } from 'marked'
import RefineModal from '../components/RefineModal'

const API_BASE = 'http://127.0.0.1:8000/api/m3'

export default function NoteEditor() {
  const { noteId } = useParams()
  const navigate = useNavigate()
  
  // Safety check — if this logs, component mounted
  useEffect(() => {
    console.log('[NoteEditor] Component mounted')
    console.log('[NoteEditor] noteId:', noteId)
  }, [noteId])

  const editorRef = useRef(null)
  const [editorContent, setEditorContent] = useState('')

  const contentLoadedRef = useRef(false)
  const isDragging = useRef(false)
  const workspaceRef = useRef(null)
  const matchPositions = useRef([])

  const [noteTitle, setNoteTitle] = useState('Structured Study Notes')
  const [noteContent, setNoteContent] = useState('')
  const [sourceFiles, setSourceFiles] = useState([])
  const [activeFile, setActiveFile] = useState(null)
  const [sourceVisible, setSourceVisible] = useState(false)
  const [editorWidth, setEditorWidth] = useState(50)
  const [searchTerm, setSearchTerm] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [currentMatch, setCurrentMatch] = useState(0)
  const [lineSpacing, setLineSpacing] = useState('1.5')
  const [showTOC, setShowTOC] = useState(false)
  const [tocItems, setTocItems] = useState([])
  const [folders, setFolders] = useState([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [toast, setToast] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // FIX 5 — Refine state
  const [showRefineModal, setShowRefineModal] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [refineInput, setRefineInput] = useState('')
  const savedRangeRef = useRef(null)

  // FIX 6 — Context menu state
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 })

  // Close context menu on click elsewhere
  useEffect(() => {
    const close = () => setContextMenu({ visible: false })
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  // Load note on mount
  useEffect(() => {
    if (!noteId) return

    axios.get(`${API_BASE}/notes/${noteId}`)
      .then(res => {
        const data = res.data
        setNoteTitle(data.title || 'Structured Study Notes')
        const content = data.content || ''
        setNoteContent(content)
      })
      .catch(err => {
        console.error('Failed to load note')
      })

    // After note loading code, add:
    const filesRaw = localStorage.getItem('currentNoteFiles')
    console.log('[Source] Raw localStorage:', filesRaw)
    if (filesRaw) {
      try {
        const files = JSON.parse(filesRaw)
        files.forEach((f, i) => {
          console.log(`[Source] File ${i}:`, {
            pdf_id: f.pdf_id,
            filename: f.filename,
            pdf_url: f.pdf_url
          })
        })
        if (Array.isArray(files) && files.length > 0) {
          setSourceFiles(files)
          setActiveFile(files[0])
        }
      } catch(e) {
        console.error('[Source] parse error')
      }
    }

    // Folder loading
    try {
      const storedFolders = localStorage.getItem('neuranote_folders')
      if (storedFolders) {
        setFolders(JSON.parse(storedFolders))
      }
    } catch (e) {
      console.error('Failed to load folders')
    }
  }, [noteId])

  // Load content into editor when noteContent changes
  useEffect(() => {
    if (!noteContent) return
    if (contentLoadedRef.current) return
    contentLoadedRef.current = true

    console.log('[Editor] Raw noteContent length:', noteContent.length)
    console.log('[Editor] First 100 chars:', noteContent.substring(0, 100))

    // Clean backend artifacts
    let cleaned = noteContent
      .replace(/End_of_Notes/g, '')
      .replace(/END_SECTION/g, '')
      .replace(/^```markdown\s*/gm, '')
      .replace(/^```\s*/gm, '')
      .trim()

    // Convert bullet markers to proper markdown
    cleaned = cleaned
      .replace(/^\* •/gm, '-')
      .replace(/^\* /gm, '- ')
      .replace(/^• /gm, '- ')

    console.log('[Editor] Cleaned length:', cleaned.length)

    // Convert markdown to HTML
    let html
    try {
      html = marked(cleaned, {
        breaks: true,
        gfm: true
      })
      console.log('[Editor] HTML generated, length:', html.length)
    } catch (err) {
      console.error('[Editor] marked() failed:', err.message)
      // Fallback: basic conversion
      html = cleaned
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$&</ul>')
        .replace(/\n\n/g, '</p><p>')
        html = '<p>' + html + '</p>'
    }

    // Set both state and direct DOM
    setEditorContent(html)
    
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = html
        console.log('[Editor] Content set in DOM')
      }
    }, 100)
  }, [noteContent])

  // FIX 1 — applyHeading
  const applyHeading = (level) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) 
      return
    
    const range = selection.getRangeAt(0)
    
    // Find the block element containing cursor
    let node = range.commonAncestorContainer
    if (node.nodeType === 3) node = node.parentNode
    
    // Get the text content
    const text = selection.toString() || node.textContent || ''
    
    // Create new heading
    const heading = document.createElement(`h${level}`)
    heading.textContent = text
    
    // Replace current selection or block
    if (selection.toString()) {
      range.deleteContents()
      range.insertNode(heading)
    } else {
      node.replaceWith(heading)
    }
    
    // Move cursor after heading
    const newRange = document.createRange()
    newRange.setStartAfter(heading)
    newRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(newRange)
    
    // Trigger content update
    setEditorContent(editor.innerHTML)
  }

  const applyInlineFormat = (command) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand(command, false, null)
    setEditorContent(editor.innerHTML)
  }

  // Fallback format function for ul/ol
  const applyFormat = (command, value = null) => {
    if (editorRef.current) {
      editorRef.current.focus()
    }
    document.execCommand(command, false, value)
  }

  // FIX 2 — applyHighlight
  const applyHighlight = (color) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !selection.toString()) {
      showToast('Select text first to highlight')
      return
    }
    
    const success = document.execCommand('hiliteColor', false, color)
    
    if (!success) {
      const range = selection.getRangeAt(0)
      const mark = document.createElement('mark')
      mark.style.backgroundColor = color
      mark.style.borderRadius = '2px'
      mark.style.padding = '1px 2px'
      try {
        range.surroundContents(mark)
      } catch {
        const fragment = range.extractContents()
        mark.appendChild(fragment)
        range.insertNode(mark)
      }
    }
    
    setEditorContent(editor.innerHTML)
    showToast('Highlight applied')
  }

  const removeHighlight = () => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand('hiliteColor', false, 'transparent')
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const marks = editor.querySelectorAll('mark')
      marks.forEach(mark => {
        if (range.intersectsNode(mark)) {
          mark.replaceWith(document.createTextNode(mark.textContent))
        }
      })
    }
    setEditorContent(editor.innerHTML)
    showToast('Highlight removed')
  }

  // FIX 5 — Refine functions
  const handleRefineClick = () => {
    const selection = window.getSelection()
    // Save cursor/selection range BEFORE modal opens
    if (selection && selection.rangeCount > 0) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange()
    }
    const text = selection?.toString().trim() || ''

    if (text.length >= 3) {
      setSelectedText(text)
    } else if (refineInput.trim().length >= 3) {
      setSelectedText(refineInput.trim())
    } else {
      showToast('Select text in note or type a question')
      return
    }
    setShowRefineModal(true)
  }

  const insertRefinedContent = (content) => {
    const editor = editorRef.current
    if (!editor) return

    let html = ''
    try {
      html = marked(content, { breaks: true })
    } catch {
      html = content.replace(/\n/g, '<br>')
    }

    const block = document.createElement('div')
    block.style.cssText = `
      border: 1.5px solid #A78BFA;
      border-radius: 8px;
      padding: 10px 14px;
      margin: 12px 0;
      background: #F5F3FF;
    `
    const label = document.createElement('div')
    label.style.cssText = `
      font-size: 10px;
      font-weight: 600;
      color: #7C3AED;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    `
    label.textContent = '✨ Refined'
    block.appendChild(label)
    const contentDiv = document.createElement('div')
    contentDiv.innerHTML = html
    block.appendChild(contentDiv)

    if (savedRangeRef.current) {
      try {
        editor.focus()
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(savedRangeRef.current)
        const range = savedRangeRef.current
        range.collapse(false)
        range.insertNode(block)
        const newRange = document.createRange()
        newRange.setStartAfter(block)
        newRange.collapse(true)
        selection.removeAllRanges()
        selection.addRange(newRange)
        savedRangeRef.current = null
      } catch {
        editor.appendChild(block)
      }
    } else {
      editor.appendChild(block)
    }

    block.scrollIntoView({ behavior: 'smooth' })
    setEditorContent(editor.innerHTML)
    showToast('Inserted into note ✓')
  }

  const appendRefinedContent = (content) => {
    const editor = editorRef.current
    if (!editor) return

    let html = ''
    try {
      html = marked(content, { breaks: true })
    } catch {
      html = content.replace(/\n/g, '<br>')
    }

    const block = document.createElement('div')
    block.style.cssText = `
      border: 1.5px solid #A78BFA;
      border-radius: 8px;
      padding: 10px 14px;
      margin: 12px 0;
      background: #F5F3FF;
    `
    block.innerHTML = `
      <div style="font-size:10px;font-weight:600;
        color:#7C3AED;text-transform:uppercase;
        letter-spacing:0.5px;margin-bottom:6px">
        ✨ Refined
      </div>
      ${html}
    `
    editor.appendChild(block)
    block.scrollIntoView({ behavior: 'smooth' })
    setEditorContent(editor.innerHTML)
    showToast('Added to bottom ✓')
  }

  const getEditorText = () => editorRef.current?.innerText || editorContent
  const getEditorHtml = () => editorRef.current?.innerHTML || editorContent

  // Draggable divider
  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current || !workspaceRef.current) return
      const rect = workspaceRef.current.getBoundingClientRect()
      let pct = ((e.clientX - rect.left) / rect.width) * 100
      pct = Math.max(25, Math.min(75, pct))
      setEditorWidth(pct)
    }
    const onUp = () => {
      isDragging.current = false
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const applyLineSpacing = (value) => {
    if (editorRef.current) editorRef.current.style.lineHeight = value
    setLineSpacing(value)
  }

  const doSearch = (term) => {
    if (!editorRef.current) return
    if (!term) {
      matchPositions.current = []
      setMatchCount(0)
      setCurrentMatch(0)
      return
    }
    const text = editorRef.current?.innerText.toLowerCase() || ''
    const lower = term.toLowerCase()
    const positions = []
    let start = 0
    while (start < text.length) {
      const idx = text.indexOf(lower, start)
      if (idx === -1) break
      positions.push(idx)
      start = idx + 1
    }
    matchPositions.current = positions
    setMatchCount(positions.length)
    if (positions.length > 0) setCurrentMatch(1)
  }

  const nextMatch = () => {
    const positions = matchPositions.current
    if (positions.length === 0) return
    const next = currentMatch % positions.length
    setCurrentMatch(next + 1)
  }

  const prevMatch = () => {
    const positions = matchPositions.current
    if (positions.length === 0) return
    const prev = (currentMatch - 2 + positions.length) % positions.length
    setCurrentMatch(prev + 1)
  }

  const downloadMd = () => {
    let content = getEditorText()
    if (!content || content.trim().length < 5) content = noteContent || '# ' + noteTitle
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = noteTitle.replace(/[^\w]/g, '_') + '.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('Downloaded successfully')
  }

  // FIX 4 — Download PDF
  const downloadPdf = () => {
    const html = editorRef.current?.innerHTML || editorContent
    
    if (!html || html.trim().length < 10) {
      showToast('No content to download')
      return
    }
    
    const fullHtml = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${noteTitle}</title>
<style>
body{font-family:-apple-system,sans-serif;
     max-width:800px;margin:40px auto;
     padding:20px;color:#1a1523;
     line-height:1.7;font-size:14px}
h1{font-size:22px;font-weight:600;
   border-bottom:2px solid #7C3AED;
   padding-bottom:8px;margin-bottom:20px}
h2{font-size:17px;font-weight:600;
   color:#3C3489;margin-top:28px;
   margin-bottom:12px}
h3{font-size:14px;font-weight:600;
   margin-top:16px;margin-bottom:8px}
li{margin-bottom:8px}
ul{padding-left:20px}
strong{font-weight:600}
code{background:#f3f0ff;padding:2px 5px;
     border-radius:3px;font-size:12px;
     font-family:monospace}
pre{background:#1e1e2e;color:#cdd6f4;
    padding:14px;border-radius:8px;
    font-size:12px;font-family:monospace}
mark{border-radius:2px;padding:1px 2px}
@media print{
  body{margin:20px}
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  mark,
  [style*="background-color"],
  [style*="background:"] {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  div[style*="border: 1.5px solid #A78BFA"] {
    border: 1.5px solid #A78BFA !important;
    background: #F5F3FF !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
</style>
</head>
<body>
<h1>${noteTitle}</h1>
${html}
</body></html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(fullHtml)
      win.document.close()
      win.focus()
      setTimeout(() => {
        win.print()
      }, 1000)
      return
    }
    
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = noteTitle.replace(/[^\w\s]/g, '').replace(/\s+/g, '_') + '.html'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('Downloaded as HTML — open in browser and print to PDF')
  }

  const saveNote = async () => {
    if (!selectedFolder) {
      setShowSaveModal(true)
      return
    }
    setIsSaving(true)
    try {
      const html = getEditorHtml()
      await axios.put(`${API_BASE}/notes/${noteId}`, { content: html })
      await axios.put(`${API_BASE}/notes/${noteId}/folder`, { folder_id: selectedFolder.id })
      showToast('Saved to ' + selectedFolder.name)
    } catch (e) {
      showToast('Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  const confirmSave = async (folder) => {
    setSelectedFolder(folder)
    setShowSaveModal(false)
    setIsSaving(true)
    try {
      const html = getEditorHtml()
      await axios.put(`${API_BASE}/notes/${noteId}`, { content: html })
      await axios.put(`${API_BASE}/notes/${noteId}/folder`, { folder_id: folder.id })
      showToast('Saved to ' + folder.name)
    } catch (e) {
      showToast('Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  // FIX 3B — PDF URL helper
  const getFullPdfUrl = (file) => {
    if (!file) return ''
    const id = file.pdf_id || ''
    if (!id) return ''
    return `http://127.0.0.1:8000/api/m3/documents/${id}.pdf`
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'var(--color-background-primary)', fontFamily: 'var(--font-sans)'
    }}>
      {/* TOP BAR */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
        borderBottom: '0.5px solid var(--color-border-tertiary)',
        background: 'var(--color-background-secondary)', flexShrink: 0
      }}>
        <span style={{
          flex: 1, fontSize: '13px', fontWeight: '500',
          color: 'var(--color-text-primary)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {noteTitle}
        </span>
        <button
          onClick={() => setSourceVisible(v => !v)}
          style={{
            fontSize: '11px', padding: '4px 10px', borderRadius: '6px',
            border: '0.5px solid var(--color-border-tertiary)',
            background: sourceVisible ? '#EDE9FE' : 'var(--color-background-primary)',
            color: sourceVisible ? '#3C3489' : 'var(--color-text-secondary)',
            cursor: 'pointer'
          }}
        >
          {sourceVisible ? 'Hide Source' : 'Split View'}
        </button>
        <button onClick={downloadMd} style={{
          fontSize: '11px', padding: '4px 10px', borderRadius: '6px',
          border: '0.5px solid var(--color-border-tertiary)',
          background: 'var(--color-background-primary)', color: 'var(--color-text-secondary)',
          cursor: 'pointer'
        }}>.md</button>
        <button onClick={downloadPdf} style={{
          fontSize: '11px', padding: '4px 10px', borderRadius: '6px',
          border: '0.5px solid var(--color-border-tertiary)',
          background: 'var(--color-background-primary)', color: 'var(--color-text-secondary)',
          cursor: 'pointer'
        }}>PDF</button>
        <button onClick={saveNote} style={{
          fontSize: '11px', padding: '4px 14px', borderRadius: '6px',
          border: 'none', background: '#7C3AED', color: '#fff',
          cursor: 'pointer', fontWeight: '500'
        }}>{isSaving ? 'Saving…' : 'Save Note'}</button>
      </div>

      {/* FORMAT TOOLBAR */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '2px', padding: '5px 12px',
        borderBottom: '0.5px solid var(--color-border-tertiary)', flexShrink: 0, flexWrap: 'wrap'
      }}>
        {[
          { label: 'B', style: { fontWeight: 700 }, action: () => applyInlineFormat('bold') },
          { label: 'I', style: { fontStyle: 'italic' }, action: () => applyInlineFormat('italic') },
          { label: 'U', style: { textDecoration: 'underline' }, action: () => applyInlineFormat('underline') },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action} style={{
            width: '28px', height: '28px', borderRadius: '5px', border: 'none',
            background: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-secondary)',
            ...btn.style
          }}>{btn.label}</button>
        ))}
        <div style={{ width: '0.5px', height: '16px', background: 'var(--color-border-tertiary)', margin: '0 3px' }} />
        <button onClick={() => applyHeading(2)} style={{
          padding: '2px 6px', borderRadius: '5px', border: 'none', background: 'none',
          cursor: 'pointer', fontSize: '10px', color: 'var(--color-text-secondary)'
        }}>H2</button>
        <button onClick={() => applyHeading(3)} style={{
          padding: '2px 6px', borderRadius: '5px', border: 'none', background: 'none',
          cursor: 'pointer', fontSize: '10px', color: 'var(--color-text-secondary)'
        }}>H3</button>
        <div style={{ width: '0.5px', height: '16px', background: 'var(--color-border-tertiary)', margin: '0 3px' }} />
        <button onClick={() => applyFormat('insertUnorderedList')} style={{
          width: '28px', height: '28px', borderRadius: '5px', border: 'none', background: 'none',
          cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-secondary)'
        }}>≡</button>
        <div style={{ width: '0.5px', height: '16px', background: 'var(--color-border-tertiary)', margin: '0 3px' }} />
        <span style={{
          fontSize: '10px',
          color: 'var(--color-text-tertiary)',
          marginRight: '2px'
        }}>HL:</span>
        {[
          { color: '#FFF9C4', label: 'Y', title: 'Yellow highlight' },
          { color: '#DCFCE7', label: 'G', title: 'Green highlight' },
          { color: '#FCE7F3', label: 'P', title: 'Pink highlight' },
          { color: '#DBEAFE', label: 'B', title: 'Blue highlight' },
        ].map(({ color, label, title }) => (
          <button
            key={color}
            onClick={() => applyHighlight(color)}
            title={title}
            style={{
              width: '22px', height: '22px', borderRadius: '4px',
              border: '1px solid rgba(0,0,0,0.15)', background: color,
              cursor: 'pointer', fontSize: '9px', fontWeight: '600',
              color: '#555', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0
            }}
          >{label}</button>
        ))}
        <button
          onClick={removeHighlight}
          title="Remove highlight"
          style={{
            fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
            border: '0.5px solid var(--color-border-tertiary)',
            background: 'none', cursor: 'pointer',
            color: 'var(--color-text-secondary)'
          }}
        >✕HL</button>
        <div style={{ width: '0.5px', height: '16px', background: 'var(--color-border-tertiary)', margin: '0 3px' }} />
        <select value={lineSpacing} onChange={e => applyLineSpacing(e.target.value)} style={{
          fontSize: '11px', padding: '3px 5px', borderRadius: '5px',
          border: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-primary)',
          color: 'var(--color-text-secondary)', cursor: 'pointer'
        }}>
          <option value="1.2">1.2</option><option value="1.5">1.5</option><option value="1.8">1.8</option>
          <option value="2.0">2.0</option><option value="2.5">2.5</option>
        </select>
        <button onClick={() => {
          const text = getEditorText()
          const items = text.split('\n').filter(l => l.trim().startsWith('##') || l.trim().startsWith('#'))
            .map(l => l.replace(/^#+\s*/, '').trim()).filter(Boolean)
          setTocItems(items)
          setShowTOC(v => !v)
        }} style={{
          fontSize: '11px', padding: '4px 8px', borderRadius: '5px',
          border: '0.5px solid var(--color-border-tertiary)',
          background: showTOC ? '#EDE9FE' : 'var(--color-background-primary)',
          color: showTOC ? '#3C3489' : 'var(--color-text-secondary)', cursor: 'pointer'
        }}>≡ Contents</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="text" value={searchTerm} placeholder="Find…" onChange={e => { setSearchTerm(e.target.value); doSearch(e.target.value) }} onKeyDown={e => { if (e.key === 'Enter') nextMatch() }} style={{
            fontSize: '12px', padding: '4px 8px', width: '140px', borderRadius: '6px',
            border: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)',
            color: 'var(--color-text-primary)', outline: 'none'
          }} />
          {matchCount > 0 && <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{currentMatch}/{matchCount}</span>}
          {matchCount > 1 && (
            <>
              <button onClick={prevMatch} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-secondary)' }}>∧</button>
              <button onClick={nextMatch} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-secondary)' }}>∨</button>
            </>
          )}
        </div>
      </div>

      {/* WORKSPACE */}
      <div ref={workspaceRef} style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* EDITOR */}
        <div style={{ width: sourceVisible ? `${editorWidth}%` : '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {showTOC && (
            <div style={{
              position: 'absolute', top: '8px', left: '8px', background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-tertiary)', borderRadius: '8px', padding: '10px',
              zIndex: 10, minWidth: '200px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contents</div>
              {tocItems.map((item, i) => (
                <div key={i} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '5px', cursor: 'pointer', color: 'var(--color-text-primary)' }} onClick={() => setShowTOC(false)}>{item}</div>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <style>{`
              .note-editor-body {
                flex: 1;
                overflow-y: auto;
                padding: 24px 40px;
                font-size: 14px;
                line-height: 1.7;
                outline: none;
                min-height: 0;
              }
              .note-editor-body h1 {
                font-size: 22px;
                font-weight: 600;
                margin: 0 0 16px;
                color: #1a1523;
              }
              .note-editor-body h2 {
                font-size: 17px;
                font-weight: 600;
                color: #3C3489;
                margin: 24px 0 10px;
                padding-bottom: 5px;
                border-bottom: 1px solid #EDE9FE;
              }
              .note-editor-body h3 {
                font-size: 14px;
                font-weight: 600;
                margin: 16px 0 8px;
                color: #1a1523;
              }
              .note-editor-body ul {
                list-style: none;
                padding: 0;
                margin: 0 0 12px;
              }
              .note-editor-body li {
                margin-bottom: 8px;
                padding: 7px 12px;
                border-left: 2.5px solid #EDE9FE;
                border-radius: 0 6px 6px 0;
                background: #FAFAF9;
                cursor: pointer;
                transition: all 0.15s;
              }
              .note-editor-body li:hover {
                border-left-color: #7C3AED;
                background: #EDE9FE;
              }
              .note-editor-body strong {
                font-weight: 600;
                color: #1a1523;
              }
              .note-editor-body code {
                background: #f3f0ff;
                padding: 2px 5px;
                border-radius: 3px;
                font-size: 12px;
                font-family: monospace;
              }
              .note-editor-body pre {
                background: #1e1e2e;
                color: #cdd6f4;
                padding: 14px;
                border-radius: 8px;
                font-size: 12px;
                font-family: monospace;
                overflow-x: auto;
                margin: 12px 0;
              }
              .note-editor-body blockquote {
                border-left: 3px solid #7C3AED;
                padding-left: 14px;
                color: #6B6780;
                font-style: italic;
                margin: 12px 0;
              }
              .note-editor-body ol {
                list-style: decimal;
                padding-left: 24px;
                margin-bottom: 12px;
              }
              .note-editor-body ol li {
                margin-bottom: 8px;
                padding: 6px 10px;
                border-left: 2.5px solid #EDE9FE;
                border-radius: 0 6px 6px 0;
                background: none;
              }
              .note-editor-body p {
                margin-bottom: 10px;
              }
            `}</style>
            
            <div
              ref={editorRef}
              className="note-editor-body"
              contentEditable={true}
              suppressContentEditableWarning={true}
              onInput={(e) => setEditorContent(e.currentTarget.innerHTML)}
              onContextMenu={(e) => {
                const selection = window.getSelection()
                const text = selection ? selection.toString().trim() : ''
                if (text.length >= 3) {
                  e.preventDefault()
                  setContextMenu({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    text: text
                  })
                }
              }}
            />
          </div>

          {/* REFINE BAR */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
            borderTop: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', flexShrink: 0
          }}>
            <input
              value={refineInput}
              onChange={e => setRefineInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRefineClick() }}
              placeholder="Select text in note then click Refine, or ask a question..."
              style={{
                flex: 1, fontSize: '13px', padding: '8px 14px', borderRadius: '24px',
                border: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-primary)',
                color: 'var(--color-text-primary)', outline: 'none'
              }}
            />
            <button
              onClick={handleRefineClick}
              style={{
                padding: '8px 20px', borderRadius: '24px', background: '#7C3AED', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500
              }}>
              Refine
            </button>
          </div>
        </div>

        {/* DIVIDER */}
        {sourceVisible && (
          <div
            onMouseDown={() => {
              isDragging.current = true
              document.body.style.cursor = 'col-resize'
              document.body.style.userSelect = 'none'
            }}
            onDoubleClick={() => {
              setEditorWidth(prev => prev < 60 ? 70 : 50)
            }}
            style={{
              width: '6px', flexShrink: 0, cursor: 'col-resize', background: 'var(--color-border-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#7C3AED'}
            onMouseLeave={e => { if (!isDragging.current) e.currentTarget.style.background = 'var(--color-border-tertiary)' }}
          >
            <div style={{ width: '2px', height: '32px', background: 'rgba(255,255,255,0.4)', borderRadius: '2px' }} />
          </div>
        )}

        {/* SOURCE PANEL */}
        {sourceVisible && (
          <div style={{
          width: `${100 - editorWidth}%`, flexShrink: 0, display: 'flex', flexDirection: 'column',
            borderLeft: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)'
          }}>
            <div style={{
              padding: '8px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)',
              background: 'var(--color-background-primary)', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <select
                value={activeFile?.pdf_url || ''}
                onChange={e => {
                  const file = sourceFiles.find(f => f.pdf_url === e.target.value)
                  if (file) setActiveFile(file)
                }}
                style={{
                  flex: 1, fontSize: '12px', padding: '4px 8px', borderRadius: '5px',
                  border: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-primary)'
                }}
              >
                {sourceFiles.length === 0 && <option value="">No source files</option>}
                {sourceFiles.map(f => (
                  <option key={f.pdf_id} value={f.pdf_url}>{f.filename}</option>
                ))}
              </select>
              <button onClick={() => setSourceVisible(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--color-text-secondary)' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {activeFile ? (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{
                    fontSize: '10px',
                    color: '#888',
                    padding: '4px 12px',
                    background: '#f5f5f5'
                  }}>
                    Loading: {getFullPdfUrl(activeFile)}
                  </div>
                  <iframe
                    key={activeFile.pdf_id}
                    src={getFullPdfUrl(activeFile)}
                    style={{
                      width: '100%',
                      flex: 1,
                      border: 'none'
                    }}
                    title={activeFile.filename}
                    onLoad={() => console.log(
                      '[iframe] Loaded:',
                      getFullPdfUrl(activeFile)
                    )}
                    onError={() => console.error(
                      '[iframe] Failed:',
                      getFullPdfUrl(activeFile)
                    )}
                  />
                </div>
              ) : (
                <div style={{ padding: '20px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>No source file selected</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CONTEXT MENU */}
      {contextMenu.visible && (
        <div
          style={{
            position: 'fixed', top: contextMenu.y, left: contextMenu.x,
            background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: '8px', padding: '4px', zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '180px'
          }}
          onMouseLeave={() => setContextMenu({ visible: false, x: 0, y: 0 })}
        >
          {[
            {
              label: '✦ Refine this section', action: () => {
                setSelectedText(contextMenu.text || '')
                setShowRefineModal(true)
                setContextMenu({ visible: false })
              }
            },
            {
              label: '🟡 Highlight yellow', action: () => {
                applyHighlight('#FFF9C4')
                setContextMenu({ visible: false })
              }
            },
            {
              label: '🟢 Highlight green', action: () => {
                applyHighlight('#DCFCE7')
                setContextMenu({ visible: false })
              }
            },
            {
              label: '🩷 Highlight pink', action: () => {
                applyHighlight('#FCE7F3')
                setContextMenu({ visible: false })
              }
            },
            {
              label: '✕ Remove highlight', action: () => {
                removeHighlight()
                setContextMenu({ visible: false })
              }
            },
          ].map((item, i) => (
            <div
              key={i} onClick={item.action}
              style={{
                padding: '7px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px',
                color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-background-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}

      {/* SAVE MODAL */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ width: '340px', background: 'var(--color-background-primary)', borderRadius: '12px', border: '0.5px solid var(--color-border-tertiary)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>Save to folder</div>
            {folders.length === 0 && <div style={{ padding: '20px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>No folders found. Create a folder in the notebook first.</div>}
            {folders.map(folder => (
              <div key={folder.id} onClick={() => confirmSave(folder)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', cursor: 'pointer', borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: '13px', color: 'var(--color-text-primary)' }} onMouseEnter={e => e.currentTarget.style.background = '#EDE9FE'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <span>📁</span><span>{folder.name}</span>
              </div>
            ))}
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSaveModal(false)} style={{ padding: '6px 16px', borderRadius: '6px', border: '0.5px solid var(--color-border-tertiary)', background: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-secondary)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* REFINE MODAL */}
      {showRefineModal && (
        <RefineModal
          selectedText={selectedText}
          pdfId={sourceFiles[0]?.pdf_id || ''}
          noteContent={editorContent}
          onClose={() => setShowRefineModal(false)}
          onInsert={(content) => insertRefinedContent(content)}
          onAppend={(content) => appendRefinedContent(content)}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1D9E75', color: '#fff', padding: '8px 20px', borderRadius: '20px', fontSize: '13px', fontWeight: 500, zIndex: 200, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
