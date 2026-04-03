import React from 'react';
import QuizPage from './components/quiz/QuizPage';
import './App.css';

function App() {
  // userId is a hardcoded number (1) for now.
  // When auth is integrated, replace this with the real user ID from your auth context.
  const userId = 1;

  return (
    <div className="App">
      <QuizPage userId={userId} noteId={null} />
    </div>
  );
}

export default App;
