import React, { useState, useRef, useEffect } 
  from 'react'
import axios from 'axios'

const API_BASE = 'http://127.0.0.1:8000/api/m3'

export default function RefineModal({
  selectedText,
  pdfId,
  noteContent,
  onClose,
  onInsert,
  onAppend
}) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loopNumber, setLoopNumber] = useState(1)
  const [allowOutside, setAllowOutside] = 
      useState(false)
  const [showOutsidePrompt, setShowOutsidePrompt] =
      useState(false)
  const historyRef = useRef([])
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ 
      behavior: 'smooth' 
    })
  }, [messages])

  const send = async (text) => {
    if (!text?.trim() || loading) return
    setLoading(true)

    const userMsg = { role: 'user', text }
    setMessages(prev => [...prev, userMsg])
    historyRef.current.push({
      role: 'user', content: text
    })

    try {
      const storedPdfId = 
          localStorage.getItem('currentPdfId') || ''
      const filesRaw = 
          localStorage.getItem('currentNoteFiles')
      let bestPdfId = pdfId || storedPdfId
      if (!bestPdfId && filesRaw) {
        try {
          const files = JSON.parse(filesRaw)
          if (files?.[0]?.pdf_id) {
            bestPdfId = files[0].pdf_id
          }
        } catch {}
      }

      console.log('[Refine] pdf_id:', bestPdfId)

      const response = await axios.post(
        `${API_BASE}/refine-text`,
        {
          pdf_id: bestPdfId,
          selected_text: selectedText ||
              'general note content',
          instruction: text,
          loop_number: loopNumber,
          allow_outside: allowOutside,
          conversation_history: historyRef.current
        }
      )

      console.log('[Refine] response:', 
        response.data)

      const aiText =
        response.data?.refined_content ||
        response.data?.content ||
        response.data?.result ||
        response.data?.text ||
        'Could not get a response. Please try again.'

      const aiMsg = { role: 'ai', text: aiText }
      setMessages(prev => [...prev, aiMsg])
      historyRef.current.push({
        role: 'assistant', content: aiText
      })
      setLoopNumber(prev => prev + 1)

      if (loopNumber >= 2 && !allowOutside) {
        setShowOutsidePrompt(true)
      }

    } catch (err) {
      console.error('[Refine] FULL ERROR:', err)
      console.error('[Refine] Status:', err?.response?.status)
      console.error('[Refine] Response data:', err?.response?.data)
      console.error('[Refine] Message:', err?.message)
      
      const errorDetail = 
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Unknown error'
      
      setMessages(prev => [...prev, {
        role: 'ai',
        text: `Error: ${errorDetail}. Check browser console for details.`
      }])
    } finally {
      setLoading(false)
    }
  }

  const chips = [
    'Explain deeper',
    'Give example',
    'Simplify',
    'Exam tip',
    'Common mistakes'
  ]

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: '460px',
        maxHeight: '80vh',
        background: '#ffffff',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }}>

        {/* HEADER */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: '1px solid #F0EEF8',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#7C3AED',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              marginBottom: '6px'
            }}>
              AI Study Assistant
            </div>
            <div style={{
              fontSize: '12px',
              color: '#5F5E5A',
              background: '#F5F3FF',
              padding: '8px 12px',
              borderRadius: '8px',
              borderLeft: '3px solid #7C3AED',
              lineHeight: 1.5,
              maxHeight: '52px',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}>
              {selectedText || 'General question'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: '1px solid #E5E3DD',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#888',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {/* CHAT AREA */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minHeight: '200px',
          maxHeight: '320px'
        }}>

          {messages.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              color: '#A0A0A0',
              fontSize: '13px'
            }}>
              Ask a question about the selected text
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user'
                  ? 'flex-end'
                  : 'flex-start',
              gap: '4px'
            }}>
              <div style={{
                fontSize: '10px',
                fontWeight: 600,
                color: msg.role === 'user'
                    ? '#7C3AED'
                    : '#5F5E5A',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                paddingLeft: msg.role === 'ai'
                    ? '2px' : '0',
                paddingRight: msg.role === 'user'
                    ? '2px' : '0'
              }}>
                {msg.role === 'user'
                  ? 'You'
                  : `NotesGPT · ${
                      allowOutside
                        ? 'web'
                        : 'materials'
                    }`
                }
              </div>
              <div style={{
                maxWidth: '88%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user'
                  ? '16px 16px 4px 16px'
                  : '16px 16px 16px 4px',
                background: msg.role === 'user'
                  ? '#7C3AED'
                  : '#F4F3EE',
                color: msg.role === 'user'
                  ? '#ffffff'
                  : '#1a1523',
                fontSize: '13px',
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {msg.text}
              </div>

              {/* Insert buttons after AI messages */}
              {msg.role === 'ai' && i > 0 && (
                <div style={{
                  display: 'flex',
                  marginTop: '4px',
                  padding: '8px 12px',
                  background: '#F0FDF4',
                  borderRadius: '10px',
                  border: '1px solid #86EFAC',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <span style={{
                    fontSize: '11px',
                    color: '#166534',
                    flex: 1,
                    minWidth: '80px'
                  }}>
                    Add to your note?
                  </span>
                  <button
                    onClick={() => {
                      onInsert(msg.text)
                      onClose()
                    }}
                    style={{
                      background: '#16A34A',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '5px 12px',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Insert here
                  </button>
                  <button
                    onClick={() => {
                      onAppend(msg.text)
                      onClose()
                    }}
                    style={{
                      background: 'none',
                      color: '#166534',
                      border: '1px solid #86EFAC',
                      borderRadius: '8px',
                      padding: '5px 12px',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Add to bottom
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Outside search prompt */}
          {showOutsidePrompt && (
            <div style={{
              background: '#FFFBEB',
              border: '1px solid #FCD34D',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '12px',
              color: '#92400E'
            }}>
              <div style={{ marginBottom: '8px' }}>
                Want deeper answers from outside 
                your materials?
              </div>
              <div style={{
                display: 'flex',
                gap: '6px'
              }}>
                <button
                  onClick={() => {
                    setAllowOutside(true)
                    setShowOutsidePrompt(false)
                  }}
                  style={{
                    background: '#7C3AED',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '5px 14px',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Yes, search wider
                </button>
                <button
                  onClick={() =>
                    setShowOutsidePrompt(false)
                  }
                  style={{
                    background: 'none',
                    color: '#92400E',
                    border: '1px solid #FCD34D',
                    borderRadius: '8px',
                    padding: '5px 14px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Stay in materials
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#888',
              fontSize: '12px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#7C3AED',
                animation: 'pulse 1s infinite'
              }} />
              NotesGPT is thinking...
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* QUICK CHIPS */}
        <div style={{
          padding: '8px 20px 4px',
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          borderTop: '1px solid #F0EEF8'
        }}>
          {chips.map(chip => (
            <button
              key={chip}
              onClick={() => {
                send(chip)
              }}
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '20px',
                background: '#F5F3FF',
                border: '1px solid #DDD8F8',
                cursor: 'pointer',
                color: '#5B21B6',
                fontWeight: 500,
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => {
                e.target.style.background = '#EDE9FE'
              }}
              onMouseLeave={e => {
                e.target.style.background = '#F5F3FF'
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* INPUT ROW */}
        <div style={{
          padding: '12px 20px 16px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !loading) {
                send(input)
                setInput('')
              }
            }}
            placeholder="Ask about this section..."
            style={{
              flex: 1,
              fontSize: '13px',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1.5px solid #E5E3DD',
              background: '#FAFAF9',
              outline: 'none',
              color: '#1a1523',
              transition: 'border-color 0.15s'
            }}
            onFocus={e => {
              e.target.style.borderColor = '#7C3AED'
            }}
            onBlur={e => {
              e.target.style.borderColor = '#E5E3DD'
            }}
          />
          <button
            onClick={() => {
              if (input.trim()) {
                send(input)
                setInput('')
              }
            }}
            disabled={loading || !input.trim()}
            style={{
              padding: '10px 18px',
              background: loading || !input.trim()
                  ? '#C4B5FD'
                  : '#7C3AED',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              cursor: loading || !input.trim()
                  ? 'not-allowed'
                  : 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap'
            }}
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>

      </div>
    </div>
  )
}
