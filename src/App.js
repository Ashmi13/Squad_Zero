import React from 'react';
import QuizPage from './components/quiz/QuizPage';
import './App.css';

function App() {
  const userId = 1;
  const noteId = null;

  return (
    <div className="App">
      <QuizPage userId={userId} noteId={noteId} />
    </div>
  );
}

export default App;
