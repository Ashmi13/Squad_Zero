-- NeuraNote Quiz — canonical schema
-- Matches SQLAlchemy models in backend/models/quizmodels.py exactly.
-- Run this for a fresh install; run migrate_user_id_bigint.sql on existing DBs.

DROP TABLE IF EXISTS quiz_attempts CASCADE;
DROP TABLE IF EXISTS answer_options CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;

CREATE TABLE quizzes (
    quiz_id         SERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL,          -- 63-bit int from Supabase UUID
    note_id         INTEGER,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    total_questions INTEGER,
    time_limit      INTEGER,
    difficulty      VARCHAR(50),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    source_content  TEXT
);

CREATE TABLE questions (
    question_id     SERIAL PRIMARY KEY,
    quiz_id         INTEGER REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_text   TEXT NOT NULL,
    code_snippet    TEXT,
    difficulty      VARCHAR(50),
    question_type   VARCHAR(50) DEFAULT 'multiple_choice',
    expected_answer TEXT                      -- AI answer for short_answer scoring
);

CREATE TABLE answer_options (
    option_id     SERIAL PRIMARY KEY,
    question_id   INTEGER REFERENCES questions(question_id) ON DELETE CASCADE,
    option_letter VARCHAR(20) NOT NULL,
    option_text   TEXT NOT NULL,
    is_correct    BOOLEAN DEFAULT FALSE
);

CREATE TABLE quiz_attempts (
    attempt_id       SERIAL PRIMARY KEY,
    quiz_id          INTEGER REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
    user_id          BIGINT NOT NULL,         -- 63-bit int from Supabase UUID
    score_percentage NUMERIC(5, 2),
    correct_answers  INTEGER,
    total_questions  INTEGER,
    time_taken       INTEGER,
    attempt_date     TIMESTAMPTZ DEFAULT NOW(),
    answers_json     TEXT                     -- JSON string (not native JSON column)
);

CREATE INDEX idx_quizzes_user_id            ON quizzes(user_id);
CREATE INDEX idx_questions_quiz_id          ON questions(quiz_id);
CREATE INDEX idx_answer_options_question_id ON answer_options(question_id);
CREATE INDEX idx_quiz_attempts_user_id      ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz_id      ON quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempts_date         ON quiz_attempts(attempt_date);
