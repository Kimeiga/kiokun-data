-- Dictionary entries table
CREATE TABLE IF NOT EXISTS dictionary_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL, -- JSON blob of the entire entry
  created_at INTEGER DEFAULT (unixepoch())
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_word ON dictionary_entries(word);

-- Optional: Separate table for search/analytics
CREATE TABLE IF NOT EXISTS word_metadata (
  word TEXT PRIMARY KEY,
  has_chinese BOOLEAN DEFAULT 0,
  has_japanese BOOLEAN DEFAULT 0,
  character_count INTEGER,
  last_accessed INTEGER
);

