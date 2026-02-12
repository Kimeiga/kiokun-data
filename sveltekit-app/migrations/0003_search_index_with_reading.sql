-- Migration: Add reading_search column for romaji/pinyin search
-- This enables searching Japanese words by romaji and Chinese words by pinyin
-- Example: searching "zenkoku" will find "全国" (ぜんこく)
-- Example: searching "zhongguo" will find "中國" (zhōngguó)

-- Drop the old FTS5 table (FTS5 doesn't support ALTER TABLE ADD COLUMN)
DROP TABLE IF EXISTS dictionary_search;

-- Create new FTS5 virtual table with reading_search column
CREATE VIRTUAL TABLE IF NOT EXISTS dictionary_search USING fts5(
  word,              -- The dictionary word/character (e.g., "地図", "好", "学习")
  language,          -- 'chinese' or 'japanese'
  definition,        -- The English definition text
  pronunciation,     -- Pinyin for Chinese, kana for Japanese
  reading_search,    -- Searchable romanization: romaji for Japanese, tone-stripped pinyin for Chinese
  is_common,         -- Boolean: 1 for common words, 0 for uncommon (helps with ranking)
  tokenize = 'porter unicode61'  -- Porter stemming + Unicode support for better English search
);

-- Note: After running this migration, you need to re-import the search index CSV:
-- wrangler d1 execute kiokun-notes-db --remote --command=".mode csv" --command=".import output_search_index.csv dictionary_search"

