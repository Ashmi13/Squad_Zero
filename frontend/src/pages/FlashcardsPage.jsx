import React from 'react';

const FlashcardsPage = () => {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8f9fc',
        color: '#1f2430',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e7e9f2',
          borderRadius: '14px',
          padding: '28px',
          maxWidth: '540px',
          boxShadow: '0 8px 24px rgba(17, 24, 39, 0.06)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '24px', lineHeight: 1.2 }}>Flashcards</h2>
        <p style={{ margin: '10px 0 0 0', color: '#5f667a', fontSize: '14px', lineHeight: 1.5 }}>
          Flashcard module is now accessible from the side rail. Integrate your existing flashcard logic here.
        </p>
      </div>
    </div>
  );
};

export default FlashcardsPage;
