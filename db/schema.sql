-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

-- User Settings Table
CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    categories_seeded INTEGER DEFAULT 0,
    error_reason_mode TEXT DEFAULT 'multi',
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Subjects Table (Dimension 1: 科目)
CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT 'default',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chapters Table (Dimension 4: 章節, parent = subject_id)
CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT 'default',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- Units Table (Dimension 5: 單元, parent = chapter_id)
CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT 'default',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

-- Categories Table (Dimensions 2 & 3: 熟悉度 familiarity, 錯因 error_reason)
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    dimension TEXT NOT NULL, -- 'familiarity' | 'error_reason'
    parent_id TEXT,
    name TEXT NOT NULL,
    color TEXT DEFAULT 'default',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Templates Table (Mistake Form Field Templates)
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    fields TEXT NOT NULL, -- JSON string mapping questionFields and answerFields
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Prompt Templates Table (Copy-on-Write Custom AI Prompt Templates)
CREATE TABLE IF NOT EXISTS prompt_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    base_key TEXT, -- Optional built-in template key if overriding a default template
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Mistakes Table
CREATE TABLE IF NOT EXISTS mistakes (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    subject_id TEXT,
    chapter_id TEXT,
    unit_id TEXT,
    familiarity_id TEXT,
    error_reason_ids TEXT DEFAULT '[]', -- JSON array of stable category IDs
    tags TEXT DEFAULT '[]', -- JSON array of custom tag strings
    mistake_date TEXT, -- YYYY-MM-DD
    template_id TEXT NOT NULL,
    title TEXT NOT NULL,
    data TEXT NOT NULL, -- JSON string mapping questionData and answerData
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
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
