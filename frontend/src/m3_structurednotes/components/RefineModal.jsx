import React, { useState } from 'react';
import { Check, X, ArrowRight, Send, Loader2 } from 'lucide-react';
import styles from './RefineModal.module.css';

const RefineModal = ({ originalText, initialRefinedText, onClose, onApply, pdfId, refineTextApi, currentInstruction }) => {
    const [currentRefined, setCurrentRefined] = useState(initialRefinedText);
    const [history, setHistory] = useState([{ prompt: currentInstruction, result: initialRefinedText }]);
    const [followUp, setFollowUp] = useState('');
    const [isRefining, setIsRefining] = useState(false);

    const handleFollowUp = async () => {
        if (!followUp.trim()) return;
        setIsRefining(true);
        try {
            const result = await refineTextApi(pdfId, currentRefined, followUp);
            const newRefined = result.refined_text?.refined_content || result.refined_content;
            if (newRefined) {
                setCurrentRefined(newRefined);
                setHistory([...history, { prompt: followUp, result: newRefined }]);
                setFollowUp('');
            }
        } catch (e) {
            alert("Error trying to refine further.");
        } finally {
            setIsRefining(false);
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h3>Refinement Result</h3>
                    <button className={styles.closeBtn} onClick={onClose}>×</button>
                </div>

                <div className={styles.comparison}>
                    <div className={styles.original}>
                        <h4>Original</h4>
                        <div className={styles.textBlock}>{originalText}</div>
                    </div>

                    <div className={styles.arrow}>
                        <ArrowRight size={24} />
                    </div>

                    <div className={styles.refined}>
                        <h4>Refined ({history.length} Iterations)</h4>
                        <div className={styles.textBlock}>{currentRefined}</div>
                    </div>
                </div>

                <div className={styles.followUpContainer}>
                    <div className={styles.followUpLabel}>Not satisfied? Ask AI to tweak it again:</div>
                    <div className={styles.followUpInputArea}>
                        <input
                            type="text"
                            placeholder="e.g. Make it shorter, use bullet points, simplify terms..."
                            className={styles.followUpInput}
                            value={followUp}
                            onChange={e => setFollowUp(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleFollowUp()}
                            disabled={isRefining}
                        />
                        <button className={styles.followUpBtn} onClick={handleFollowUp} disabled={isRefining || !followUp.trim()}>
                            {isRefining ? <Loader2 size={16} className={styles.spin} /> : <Send size={16} />}
                            Rewrite
                        </button>
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.discardBtn} onClick={onClose}>
                        <X size={16} /> Discard
                    </button>
                    <button className={styles.applyBtn} onClick={() => onApply(currentRefined, history)}>
                        <Check size={16} /> Replace Original
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RefineModal;
