-- Drop tables if exist (for fresh setup)
DROP TABLE IF EXISTS quiz_attempts CASCADE;
DROP TABLE IF EXISTS answer_options CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;

-- Create quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    note_id INTEGER,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_questions INTEGER,
    time_limit INTEGER,
    difficulty VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_content TEXT
);

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
    question_id SERIAL PRIMARY KEY,
    quiz_id INTEGER REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    code_snippet TEXT,
    difficulty VARCHAR(50),
    question_type VARCHAR(50) DEFAULT 'multiple_choice'
);

-- Create answer_options table
CREATE TABLE IF NOT EXISTS answer_options (
    option_id SERIAL PRIMARY KEY,
    question_id INTEGER REFERENCES questions(question_id) ON DELETE CASCADE,
    option_letter VARCHAR(20) NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE
);

-- Create quiz_attempts table
CREATE TABLE IF NOT EXISTS quiz_attempts (
    attempt_id SERIAL PRIMARY KEY,
    quiz_id INTEGER REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    score_percentage NUMERIC(5, 2),
    correct_answers INTEGER,
    total_questions INTEGER,
    time_taken INTEGER,
    attempt_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    answers_json TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_quizzes_user_id ON quizzes(user_id);
CREATE INDEX idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX idx_answer_options_question_id ON answer_options(question_id);
CREATE INDEX idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
