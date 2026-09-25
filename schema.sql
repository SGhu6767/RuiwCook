CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    money REAL NOT NULL DEFAULT 80,
    ingredients TEXT NOT NULL DEFAULT '{}',
    storage TEXT NOT NULL DEFAULT '[]',
    cooked INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    github_id TEXT,
    public_id TEXT,
    nickname TEXT,
    avatar TEXT,
    bio TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
ON sessions(expires_at);
