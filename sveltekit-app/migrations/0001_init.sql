-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  image_key TEXT,
  created_at INTEGER NOT NULL
);

-- Create index on created_at for efficient sorting
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);

-- Insert some sample data for testing
INSERT INTO notes (id, text, image_key, created_at) VALUES
  ('sample-1', 'Welcome to Kiokun Notes! This is a sample note.', NULL, strftime('%s', 'now') * 1000),
  ('sample-2', 'You can add notes with images using the form above.', NULL, strftime('%s', 'now') * 1000 - 1000);

