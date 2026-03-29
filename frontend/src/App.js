import React from 'react';
import QuizPage from './components/quiz/QuizPage';
import './App.css';

function App() {
  return (
    <div className="App">
      <QuizPage userId={1} noteId={null} />
    </div>
  );
}

export default App;
