-- Migration: Add jyutping_search column for Cantonese Jyutping search
-- This enables searching Chinese words by Cantonese pronunciation (Jyutping)
-- Example: searching "din nou" will find "電腦" (din6 nou5)
-- Example: searching "jat" will find "一" (jat1)

-- Drop the old FTS5 table (FTS5 doesn't support ALTER TABLE ADD COLUMN)
DROP TABLE IF EXISTS dictionary_search;

-- Create new FTS5 virtual table with jyutping_search column
CREATE VIRTUAL TABLE IF NOT EXISTS dictionary_search USING fts5(
  word,              -- The dictionary word/character (e.g., "地図", "好", "学习")
  language,          -- 'chinese', 'japanese', or 'korean'
  definition,        -- The English definition text
  pronunciation,     -- Pinyin for Chinese, kana for Japanese, IPA for Korean
  reading_search,    -- Searchable romanization: romaji for Japanese, tone-stripped pinyin for Chinese, romanized Korean
  jyutping_search,   -- Searchable Cantonese Jyutping (tone-stripped, Chinese words only)
  is_common,         -- Boolean: 1 for common words, 0 for uncommon (helps with ranking)
  tokenize = 'porter unicode61'  -- Porter stemming + Unicode support for better English search
);

-- Note: After running this migration, you need to re-import the search index CSV:
-- wrangler d1 execute kiokun-dictionary --remote --command=".mode csv" --command=".import output_search_index.csv dictionary_search"

