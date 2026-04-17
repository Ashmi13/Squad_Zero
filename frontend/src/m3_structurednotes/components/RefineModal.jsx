import React from 'react';
import { Check, X, ArrowRight } from 'lucide-react';
import styles from './RefineModal.module.css';

const RefineModal = ({ originalText, refinedText, onClose, onApply }) => {
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
                        <h4>Refined</h4>
                        <div className={styles.textBlock}>{refinedText}</div>
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.discardBtn} onClick={onClose}>
                        <X size={16} /> Discard
                    </button>
                    <button className={styles.applyBtn} onClick={onApply}>
                        <Check size={16} /> Replace Original
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RefineModal;
