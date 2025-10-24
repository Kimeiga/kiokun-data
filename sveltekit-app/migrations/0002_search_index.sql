-- Create FTS5 virtual table for full-text search of dictionary definitions
-- This enables fast searching across all Chinese and Japanese word definitions

CREATE VIRTUAL TABLE IF NOT EXISTS dictionary_search USING fts5(
  word,              -- The dictionary word/character (e.g., "地図", "好", "学习")
  language,          -- 'chinese' or 'japanese'
  definition,        -- The English definition text
  pronunciation,     -- Pinyin for Chinese, kana for Japanese
  is_common,         -- Boolean: 1 for common words, 0 for uncommon (helps with ranking)
  tokenize = 'porter unicode61'  -- Porter stemming + Unicode support for better English search
);

-- Create index on word for fast exact lookups
-- Note: FTS5 tables don't support traditional indexes, but we can query efficiently by word

