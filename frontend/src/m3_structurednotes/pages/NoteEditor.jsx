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
  const sectionPageMapRef = useRef(new Map())

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

    console.log(
      '[Load] Content length:', noteContent.length
    )
    console.log(
      '[Load] First 200 chars:',
      noteContent.substring(0, 200)
    )

    // Step 1: Clean backend artifacts
    let cleaned = noteContent
      .replace(/End_of_Notes/g, '')
      .replace(/END_SECTION/g, '')
      .replace(/^```markdown\s*/gm, '')
      .replace(/^```\s*$/gm, '')
      .trim()

    // Step 2: Detect if content is HTML or markdown
    const hasHtmlTags = /<(h[1-6]|div|ul|ol|li|strong|em|p|pre|code|blockquote)\b/i.test(
      cleaned
    )

    let html = ''

    if (hasHtmlTags) {
      // Content already has HTML — use directly
      // But still process any remaining markdown
      // inside text nodes
      html = cleaned

      // Convert any remaining **bold** to <strong>
      html = html.replace(
        /\*\*([^*]+)\*\*/g,
        '<strong>$1</strong>'
      )
      // Convert any remaining *italic* to <em>
      html = html.replace(
        /(?<!\*)\*([^*]+)\*(?!\*)/g,
        '<em>$1</em>'
      )

      console.log('[Load] Content detected as HTML')

    } else {
      // Pure markdown — convert with marked
      try {
        html = marked(cleaned, {
          breaks: true,
          gfm: true,
          headerIds: false,
          mangle: false
        })
        console.log('[Load] Content converted from markdown')
      } catch (err) {
        console.error('[Load] marked() failed:', err)
        // Manual fallback conversion
        html = cleaned
          .replace(/^## (.+)$/gm,
            '<h2>$1</h2>')
          .replace(/^### (.+)$/gm,
            '<h3>$1</h3>')
          .replace(/^# (.+)$/gm,
            '<h1>$1</h1>')
          .replace(/\*\*([^*]+)\*\*/g,
            '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g,
            '<em>$1</em>')
          .replace(/^- (.+)$/gm,
            '<li>$1</li>')
          .replace(/(<li>.*<\/li>\n?)+/gs,
            '<ul>$&</ul>')
          .replace(/\n\n/g, '</p><p>')
        html = '<p>' + html + '</p>'
      }
    }

    // Step 3: Post-process to ensure bullets are on separate lines
    const postProcess = (htmlStr) => {
      // Split by lines
      const lines = htmlStr.split('\n')
      const result = []
      let inList = false

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()

        // Check if this line starts with a bullet
        // that was NOT already inside an li tag
        const isBulletLine = (
          trimmed.startsWith('- ') ||
          trimmed.startsWith('* ')
        ) && !trimmed.startsWith('<')

        if (isBulletLine) {
          if (!inList) {
            result.push('<ul>')
            inList = true
          }
          const content = trimmed.substring(2)
          result.push(`<li>${content}</li>`)
        } else {
          if (inList && trimmed !== '') {
            // Check if next bullet continues list
            const nextLine = lines[i + 1]?.trim() || ''
            const nextIsBullet = (
              nextLine.startsWith('- ') ||
              nextLine.startsWith('* ')
            ) && !nextLine.startsWith('<')

            if (!nextIsBullet) {
              result.push('</ul>')
              inList = false
            }
          }
          if (trimmed !== '' || !inList) {
            result.push(line)
          }
        }
      }

      if (inList) result.push('</ul>')
      return result.join('\n')
    }

    // Apply post-processing after markdown/HTML detection
    html = postProcess(html)

    console.log(
      '[Load] Final HTML length:', html.length
    )
    console.log(
      '[Load] HTML preview:',
      html.substring(0, 200)
    )

    // Set into editor
    setEditorContent(html)
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = html

        // Count block elements to verify rendering
        const lists = editorRef.current
            .querySelectorAll('ul, ol')
        const items = editorRef.current
            .querySelectorAll('li')
        const headings = editorRef.current
            .querySelectorAll('h2, h3')

        console.log('[Render] Lists:', lists.length)
        console.log('[Render] Bullets:', items.length)
        console.log('[Render] Headings:', headings.length)

        if (items.length === 0) {
          console.warn(
            '[Render] WARNING: No li elements found.',
            'Content may not be rendering as bullets.'
          )
          console.log(
            '[Render] HTML preview:',
            html.substring(0, 500)
          )
        }

        // Build section-to-page mapping from HTML
        // Parse data attributes before they might
        // get stripped by contentEditable
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = html

        const sections = tempDiv.querySelectorAll(
          '[data-page]'
        )
        console.log(
          '[Map] Building section map from',
          sections.length, 'sections'
        )

        const newMap = new Map()
        sections.forEach(section => {
          const heading = section.querySelector('h2')
          if (heading) {
            const headingText = heading.textContent
              .replace('📌', '')
              .trim()
            newMap.set(headingText, {
              page: parseInt(section.dataset.page) || 1,
              docId: section.dataset.doc || ''
            })
            console.log(
              '[Map] Mapped:', headingText,
              '-> page', section.dataset.page
            )
          }
        })
        sectionPageMapRef.current = newMap
        console.log(
          '[Map] Total mappings:', newMap.size
        )
      }
    }, 150)
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

  // FIX 1 — Search bar highlighting
  const SEARCH_HIGHLIGHT_CLASS = 'search-hl'

  const clearSearchHighlights = () => {
    const editor = editorRef.current
    if (!editor) return
    const marks = editor.querySelectorAll(`mark.${SEARCH_HIGHLIGHT_CLASS}`)
    marks.forEach(mark => {
      const text = document.createTextNode(mark.textContent)
      mark.replaceWith(text)
    })
    editor.normalize()
  }

  const doSearch = (term) => {
    clearSearchHighlights()
    matchPositions.current = []
    setMatchCount(0)
    setCurrentMatch(0)

    if (!term || term.trim().length < 2) return

    const editor = editorRef.current
    if (!editor) return

    const termLower = term.toLowerCase()
    const positions = []

    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (node.parentElement?.tagName === 'MARK') return NodeFilter.FILTER_REJECT
          if (!node.textContent.trim()) return NodeFilter.FILTER_SKIP
          return NodeFilter.FILTER_ACCEPT
        }
      }
    )

    const textNodes = []
    let node
    while ((node = walker.nextNode())) {
      textNodes.push(node)
    }

    textNodes.forEach(textNode => {
      const text = textNode.textContent
      const textLower = text.toLowerCase()
      let startIdx = 0

      while (true) {
        const idx = textLower.indexOf(termLower, startIdx)
        if (idx === -1) break

        const range = document.createRange()
        range.setStart(textNode, idx)
        range.setEnd(textNode, idx + term.length)

        const mark = document.createElement('mark')
        mark.className = SEARCH_HIGHLIGHT_CLASS
        
        try {
          range.surroundContents(mark)
          positions.push(mark)
          // Since surroundContents split the text node, we need to stop searching this specific text node
          // and rely on the next iterations or normalize. For simplicity in this implementation,
          // we break and the user can re-search if needed, or we just move index.
          break 
        } catch (e) {
          startIdx = idx + 1
        }
      }
    })

    matchPositions.current = positions
    setMatchCount(positions.length)

    if (positions.length > 0) {
      setCurrentMatch(1)
      scrollToMatch(positions[0])
      highlightCurrentMatch(0)
    }
  }

  const highlightCurrentMatch = (index) => {
    const positions = matchPositions.current
    positions.forEach(mark => {
      mark.style.backgroundColor = '#FFD700'
      mark.style.outline = 'none'
    })
    if (positions[index]) {
      positions[index].style.backgroundColor = '#FF8C00'
      positions[index].style.outline = '2px solid #FF6B00'
    }
  }

  const scrollToMatch = (markEl) => {
    if (!markEl) return
    markEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const nextMatch = () => {
    const positions = matchPositions.current
    if (positions.length === 0) return
    const next = currentMatch % positions.length
    setCurrentMatch(next + 1)
    scrollToMatch(positions[next])
    highlightCurrentMatch(next)
  }

  const prevMatch = () => {
    const positions = matchPositions.current
    if (positions.length === 0) return
    const prev = (currentMatch - 2 + positions.length) % positions.length
    setCurrentMatch(prev + 1)
    scrollToMatch(positions[prev])
    highlightCurrentMatch(prev)
  }

  // FIX 4 — Clean search marks before save/download
  const getCleanHtml = () => {
    const editor = editorRef.current
    if (!editor) return editorContent
    const clone = editor.cloneNode(true)
    const marks = clone.querySelectorAll('mark.search-hl, mark.search-hl-current')
    marks.forEach(mark => {
      const text = document.createTextNode(mark.textContent)
      mark.replaceWith(text)
    })
    return clone.innerHTML
  }

  // FIX 3C — Robust handleEditorClick
  const handleEditorClick = (e) => {
    const target = e.target

    // Find the nearest h2 heading
    // by walking up the DOM tree
    let el = target
    let headingText = null

    // Check if clicked element IS a heading
    if (el.tagName === 'H2') {
      headingText = el.textContent
        .replace('📌', '').trim()
    }

    // Or find nearest h2 parent
    if (!headingText) {
      const h2 = el.closest('h2')
      if (h2) {
        headingText = h2.textContent
          .replace('📌', '').trim()
      }
    }

    // Or find the section div containing click
    if (!headingText) {
      // Walk up looking for any element with h2
      let parent = el.parentElement
      for (let i = 0; i < 6; i++) {
        if (!parent) break
        const h2 = parent.querySelector('h2')
        if (h2) {
          headingText = h2.textContent
            .replace('📌', '').trim()
          break
        }
        parent = parent.parentElement
      }
    }

    if (!headingText) return

    console.log('[Click] Heading clicked:', headingText)

    // Look up page number from our map
    const mapping = sectionPageMapRef.current.get(
      headingText
    )

    if (!mapping) {
      console.log(
        '[Click] No mapping for:', headingText
      )
      console.log(
        '[Click] Available mappings:',
        Array.from(sectionPageMapRef.current.keys())
      )
      return
    }

    console.log(
      '[Click] Jump to page:', mapping.page,
      'doc:', mapping.docId
    )

    handleSourceJump(mapping.page, mapping.docId)
  }

  const handleSourceJump = (pageNum, docId) => {
    // Ensure source panel is open
    setSourceVisible(true)

    // Find the right file
    let targetFile = activeFile
    if (docId && sourceFiles.length > 0) {
      const found = sourceFiles.find(
        f => f.pdf_id === docId
      )
      if (found) {
        targetFile = found
        setActiveFile(found)
      }
    } else if (sourceFiles.length > 0) {
      targetFile = sourceFiles[0]
      setActiveFile(sourceFiles[0])
    }

    if (!targetFile) {
      showToast('No source file loaded')
      return
    }

    const baseUrl = getFullPdfUrl(targetFile)
    if (!baseUrl) {
      showToast('Cannot find source file URL')
      return
    }

    const pageUrl = baseUrl + '#page=' + pageNum

    // Force iframe navigation
    const setIframeSrc = () => {
      const iframe = document.querySelector(
        '.source-iframe'
      )
      if (iframe) {
        iframe.src = ''
        requestAnimationFrame(() => {
          iframe.src = pageUrl
          console.log('[Jump] iframe src:', pageUrl)
        })
      } else {
        console.warn('[Jump] iframe not found')
      }
    }

    // Small delay to let source panel open first
    setTimeout(setIframeSrc, 400)

    showToast(`↗ Jumped to page ${pageNum}`)
  }

  const downloadMd = () => {
    const editor = editorRef.current

    // Clone and clean search marks
    let content = ''
    if (editor) {
      const clone = editor.cloneNode(true)
      const marks = clone.querySelectorAll('mark')
      marks.forEach(mark => {
        const text = document.createTextNode(
          mark.textContent
        )
        mark.replaceWith(text)
      })
      content = clone.innerText || clone.textContent
    }

    if (!content || content.trim().length < 10) {
      content = noteContent || noteTitle ||
          'Study Notes'
    }

    const blob = new Blob([content], {
      type: 'text/plain;charset=utf-8'
    })
    const url = URL.createObjectURL(blob)
    const filename = (noteTitle || 'Study_Notes')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 60) + '.md'

    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()

    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 200)

    showToast('Downloaded as .md successfully')
  }

  const downloadPdf = () => {
    const editor = editorRef.current
    if (!editor) {
      showToast('No content to download')
      return
    }

    // Clone and clean the editor content
    const clone = editor.cloneNode(true)
    clone.querySelectorAll('mark').forEach(m => {
      m.replaceWith(
        document.createTextNode(m.textContent)
      )
    })

    const bodyHtml = clone.innerHTML

    if (!bodyHtml || bodyHtml.trim().length < 20) {
      showToast('Generate a note first')
      return
    }

    const printHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${noteTitle || 'Study Notes'}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Arial, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 28px;
  color: #1a1523;
  line-height: 1.75;
  font-size: 14px;
}
h1 {
  font-size: 22px;
  font-weight: 700;
  border-bottom: 3px solid #7C3AED;
  padding-bottom: 10px;
  margin-bottom: 20px;
}
h2 {
  font-size: 17px;
  font-weight: 700;
  color: #3C3489;
  margin-top: 28px;
  margin-bottom: 12px;
  padding-bottom: 5px;
  border-bottom: 1px solid #EDE9FE;
}
h3 { font-size: 14px; font-weight: 600;
     margin-top: 16px; margin-bottom: 8px; }
p { margin-bottom: 10px; }
ul { list-style: disc; padding-left: 20px;
     margin-bottom: 12px; }
ol { list-style: decimal; padding-left: 20px;
     margin-bottom: 12px; }
li { margin-bottom: 8px; }
strong, b { font-weight: 700; }
code { background: #f3f0ff; padding: 2px 5px;
       border-radius: 3px; font-size: 12px;
       font-family: Consolas, monospace; }
pre { background: #1e1e2e; color: #cdd6f4;
      padding: 14px; border-radius: 8px;
      font-size: 12px; white-space: pre-wrap;
      margin: 12px 0; }
blockquote { border-left: 4px solid #7C3AED;
             padding-left: 14px; color: #5F5E5A;
             margin: 12px 0; font-style: italic; }
hr { border: none; border-top: 1px solid #EDE9FE;
     margin: 20px 0; }
* { -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important; }
@page { margin: 18mm; }
</style>
</head>
<body>
<h1>${noteTitle || 'Structured Study Notes'}</h1>
${bodyHtml}
</body>
</html>`

    // Use hidden iframe to avoid popup blocks
    let frame = document.getElementById('pdf-print-frame')

    if (!frame) {
      frame = document.createElement('iframe')
      frame.id = 'pdf-print-frame'
      frame.style.cssText = `
        position: fixed;
        width: 0;
        height: 0;
        border: none;
        left: -9999px;
        top: -9999px;
      `
      document.body.appendChild(frame)
    }

    const frameDoc = frame.contentDocument ||
        frame.contentWindow?.document

    if (!frameDoc) {
      showToast('Cannot create print frame')
      return
    }

    frameDoc.open()
    frameDoc.write(printHtml)
    frameDoc.close()

    showToast(
      'Opening print dialog — select Save as PDF'
    )

    setTimeout(() => {
      try {
        frame.contentWindow.focus()
        frame.contentWindow.print()
      } catch (err) {
        console.error('[PDF] Print failed:', err)
        showToast('Print failed — try again')
      }
    }, 600)
  }

  const saveNote = async () => {
    if (!selectedFolder) {
      setShowSaveModal(true)
      return
    }
    setIsSaving(true)
    try {
      const html = getCleanHtml()
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
      const html = getCleanHtml()
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
    if (!id) {
      console.warn('[URL] No pdf_id in file:', file)
      return ''
    }

    // Always use the confirmed working route
    const url = `http://127.0.0.1:8000/api/m3/documents/${id}.pdf`
    console.log('[URL] PDF URL:', url)
    return url
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
          <input
            type="text"
            value={searchTerm}
            placeholder="Search in note..."
            onChange={e => {
              setSearchTerm(e.target.value)
              doSearch(e.target.value)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') nextMatch()
              if (e.key === 'Escape') {
                setSearchTerm('')
                clearSearchHighlights()
                setMatchCount(0)
                setCurrentMatch(0)
              }
            }}
            style={{
              fontSize: '12px', padding: '4px 8px', width: '140px', borderRadius: '6px',
              border: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)',
              color: 'var(--color-text-primary)', outline: 'none'
            }}
          />
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
      overflow-y: auto !important;
      padding: 24px 40px;
      font-size: 14px;
      line-height: 1.8;
      outline: none;
      color: var(--color-text-primary);
      min-height: 0;
      word-wrap: break-word;
    }

    /* Force ALL elements to display as block */
    .note-editor-body * {
      max-width: 100%;
    }

    .note-editor-body h1 {
      display: block !important;
      font-size: 22px;
      font-weight: 600;
      margin: 0 0 16px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #7C3AED;
    }

    .note-editor-body h2 {
      display: block !important;
      font-size: 17px;
      font-weight: 600;
      color: #3C3489;
      margin: 28px 0 14px 0;
      padding-bottom: 6px;
      border-bottom: 1px solid #EDE9FE;
      cursor: pointer;
      transition: color 0.15s;
    }

    .note-editor-body h2:hover {
      color: #7C3AED;
    }

    .note-editor-body h2:hover::after {
      content: " ↗";
      font-size: 12px;
      font-weight: 400;
      color: #7C3AED;
    }

    .note-editor-body h3 {
      display: block !important;
      font-size: 15px;
      font-weight: 600;
      margin: 18px 0 8px 0;
    }

    .note-editor-body p {
      display: block !important;
      margin: 0 0 12px 0;
    }

    .note-editor-body ul {
      display: block !important;
      list-style: none !important;
      padding: 0 !important;
      margin: 0 0 16px 0 !important;
    }

    .note-editor-body ol {
      display: block !important;
      list-style: decimal !important;
      padding-left: 22px !important;
      margin: 0 0 16px 0 !important;
    }

    .note-editor-body li {
      display: block !important;
      margin-bottom: 12px !important;
      padding: 8px 12px 8px 14px !important;
      border-left: 3px solid #EDE9FE !important;
      border-radius: 0 6px 6px 0 !important;
      line-height: 1.75 !important;
      transition: border-color 0.15s,
                  background 0.15s;
    }

    .note-editor-body li:hover {
      border-left-color: #7C3AED !important;
      background: rgba(124,58,237,0.04) !important;
    }

    .note-editor-body strong,
    .note-editor-body b {
      font-weight: 700 !important;
    }

    .note-editor-body em,
    .note-editor-body i {
      font-style: italic !important;
    }

    .note-editor-body code {
      background: #f3f0ff;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      font-family: 'Courier New', Consolas,
        monospace;
      color: #3C3489;
    }

    .note-editor-body pre {
      display: block !important;
      background: #1e1e2e;
      color: #cdd6f4;
      padding: 16px;
      border-radius: 8px;
      font-size: 12px;
      font-family: 'Courier New', monospace;
      overflow-x: auto;
      white-space: pre-wrap;
      margin: 14px 0;
    }

    .note-editor-body blockquote {
      display: block !important;
      border-left: 4px solid #7C3AED;
      padding-left: 16px;
      color: #6B6780;
      margin: 12px 0;
      font-style: italic;
    }

    .note-editor-body hr {
      display: block !important;
      border: none;
      border-top: 1px solid #EDE9FE;
      margin: 20px 0;
    }

    .note-editor-body table {
      display: table !important;
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 13px;
    }

    .note-editor-body th {
      background: #EDE9FE;
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      border: 1px solid #AFA9EC;
    }

    .note-editor-body td {
      padding: 7px 12px;
      border: 1px solid #EDE9FE;
    }

    .note-editor-body tr:nth-child(even) td {
      background: #FAFAF9;
    }

    .note-editor-body img {
      display: block !important;
      max-width: 100%;
      border-radius: 8px;
      margin: 12px 0;
      border: 1px solid #EDE9FE;
    }

    .note-editor-body mark.search-hl {
      background-color: #FFD700 !important;
      color: #000 !important;
      border-radius: 2px;
      padding: 0 1px;
    }

    .note-editor-body .note-section {
      display: block !important;
      margin-bottom: 20px;
    }
  `}</style>
            
            <div
    ref={editorRef}
    className="note-editor-body"
    contentEditable={true}
    suppressContentEditableWarning={true}
    onClick={handleEditorClick}
    onInput={e => {
      setEditorContent(e.currentTarget.innerHTML)
    }}
    style={{
      flex: 1,
      overflowY: 'auto',
      minHeight: 0
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
                <iframe
                  className="source-iframe"
                  key={activeFile.pdf_id}
                  src={getFullPdfUrl(activeFile)}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                  title={activeFile.filename || 'Source'}
                  onLoad={(e) => {
                    console.log(
                      '[iframe] Loaded:',
                      e.target.src
                    )
                  }}
                  onError={(e) => {
                    console.error(
                      '[iframe] Failed to load:',
                      e.target.src
                    )
                  }}
                />
              ) : (
                <div style={{
                  padding: '20px',
                  fontSize: '13px',
                  color: 'var(--color-text-secondary)',
                  textAlign: 'center',
                  marginTop: '40px'
                }}>
                  No source file loaded.
                  Generate a note first.
                </div>
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

      <iframe
        id="print-frame"
        style={{
          position: 'fixed',
          right: '0',
          bottom: '0',
          width: '0',
          height: '0',
          border: 'none',
          visibility: 'hidden'
        }}
        title="print"
      />
    </div>
  )
}
