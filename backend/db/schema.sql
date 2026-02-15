-- Quiz Tables

CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    note_id INTEGER,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_questions INTEGER NOT NULL,
    time_limit INTEGER,
    difficulty VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
    question_id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    code_snippet TEXT,
    difficulty VARCHAR(50),
    question_type VARCHAR(50) DEFAULT 'multiple_choice'
);

CREATE TABLE IF NOT EXISTS answer_options (
    option_id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    option_letter VARCHAR(1) NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    attempt_id SERIAL PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(quiz_id),
    user_id INTEGER NOT NULL,
    score_percentage FLOAT,
    correct_answers INTEGER,
    total_questions INTEGER,
    time_taken INTEGER,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quizzes_user ON quizzes(user_id);
CREATE INDEX idx_questions_quiz ON questions(quiz_id);
CREATE INDEX idx_options_question ON answer_options(question_id);
CREATE INDEX idx_attempts_user ON quiz_attempts(user_id);
CREATE INDEX idx_attempts_quiz ON quiz_attempts(quiz_id);
