import React, { useState, useRef, useEffect } from 'react';
import styles from './NoteEditor.module.css';

export default function RefineModal({ isOpen, onClose, selectedText, onMerge, pdfId }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loopNumber, setLoopNumber] = useState(1);
  const [allowOutside, setAllowOutside] = useState(false);
  const [showOutsidePrompt, setShowOutsidePrompt] = useState(false);
  const chatRef = useRef(null);
  const conversationHistoryRef = useRef([]);

  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      setLoopNumber(1);
      setAllowOutside(false);
      setShowOutsidePrompt(false);
      conversationHistoryRef.current = [];
    }
  }, [isOpen, selectedText]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, showOutsidePrompt]);

  if (!isOpen) return null;

  const sendMessage = async (textOverride = null) => {
    const text = textOverride || inputText;
    if (!text.trim()) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    conversationHistoryRef.current.push(userMsg);
    setInputText('');
    setIsTyping(true);
    setShowOutsidePrompt(false);

    try {
      const res = await fetch('http://localhost:8000/api/m3/refine-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf_id: pdfId,
          selected_text: selectedText,
          instruction: text,
          loop_number: loopNumber,
          allow_outside: allowOutside,
          conversation_history: conversationHistoryRef.current
        })
      });
      const data = await res.json();
      
      const aiMsg = { role: 'assistant', content: data.refined_content };
      setMessages(prev => [...prev, aiMsg]);
      conversationHistoryRef.current.push(aiMsg);
      
      setLoopNumber(data.loop_number + 1);
      if (data.should_ask_outside) {
        setShowOutsidePrompt(true);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, an error occurred.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleOutsideChoice = (choice) => {
    if (choice === 'yes') {
      setAllowOutside(true);
    } else {
      setAllowOutside(false);
    }
    setShowOutsidePrompt(false);
  };

  const quickChips = [
    "Code example", "Simplify", "Exam tip", "Mistakes", "Compare", "Step by step"
  ];

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.refineModal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <span className={styles.tagLabel}>Tagged section {allowOutside ? '· web' : '· materials'}</span>
            <div className={styles.taggedTextBox}>
              {selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText}
            </div>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose}>✕</button>
        </div>
        
        <div className={styles.chatArea} ref={chatRef}>
          {messages.length === 0 && (
            <div className={styles.chatEmpty}>What would you like to do with this section?</div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={msg.role === 'user' ? styles.msgUser : styles.msgAiContainer}>
              <div className={msg.role === 'user' ? styles.bubbleUser : styles.bubbleAi}>
                {msg.content}
              </div>
              {msg.role === 'assistant' && (
                <div className={styles.mergePrompt}>
                  <p>Happy with this? Where should it go?</p>
                  <div className={styles.mergeButtons}>
                    <button onClick={() => onMerge(msg.content, 'replace')}>Insert at tagged position</button>
                    <button onClick={() => onMerge(msg.content, 'append')}>Add to bottom of note</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {isTyping && <div className={styles.typingIndicator}>Typing...</div>}
          
          {showOutsidePrompt && (
            <div className={styles.outsideCard}>
              <p>You have asked multiple questions. Should I search beyond your materials?</p>
              <div className={styles.outsideButtons}>
                <button onClick={() => handleOutsideChoice('yes')}>Yes, search outside</button>
                <button onClick={() => handleOutsideChoice('no')}>No, stay in materials</button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.inputSection}>
          <div className={styles.quickChips}>
            {quickChips.map(chip => (
              <button key={chip} onClick={() => sendMessage(chip)} className={styles.chipBtn}>
                {chip}
              </button>
            ))}
          </div>
          <div className={styles.inputRow}>
            <input 
              type="text" 
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask a question or give an instruction..."
              className={styles.chatInput}
            />
            <button onClick={() => sendMessage()} className={styles.sendBtn}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
