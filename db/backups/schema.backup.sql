-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

-- Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chapters Table
CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- Templates Table
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    fields TEXT NOT NULL, -- JSON string mapping questionFields and answerFields
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Mistakes Table
CREATE TABLE IF NOT EXISTS mistakes (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    title TEXT NOT NULL,
    data TEXT NOT NULL, -- JSON string mapping questionData and answerData
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

-- Images Table (Stored in D1 database)
CREATE TABLE IF NOT EXISTS images (
    key TEXT PRIMARY KEY,
    data BLOB NOT NULL,
    mime_type TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
