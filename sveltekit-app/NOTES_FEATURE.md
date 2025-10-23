# Notes Feature

## Overview

The Notes feature allows users to add personal notes to character pages with full Markdown support.

## Key Features

### 1. One Note Per User Per Character
- Each user can have **exactly one note** per character
- Notes are automatically saved/updated (upsert behavior)
- Database enforces uniqueness with a constraint

### 2. Markdown Support
- Full GitHub Flavored Markdown (GFM) support
- Supported formatting:
  - **Bold** (`**text**`)
  - *Italic* (`*text*`)
  - [Links](url) (`[text](url)`)
  - Images (`![alt](url)`)
  - Lists (ordered and unordered)
  - Code blocks (`` `code` `` and ` ```code``` `)
  - Blockquotes (`> quote`)
  - Headings (`# H1`, `## H2`, `### H3`)

### 3. Write/Preview Tabs
- **Write tab**: Edit your note with markdown syntax
- **Preview tab**: See how your note will look when rendered
- Real-time preview of markdown formatting

### 4. Security
- Markdown is sanitized with DOMPurify to prevent XSS attacks
- Only safe HTML tags are allowed in rendered output

## User Interface

### Your Note Section
- Shows your personal note for the character
- Edit and Delete buttons in the top-right
- Markdown is rendered with proper styling

### Community Notes Section
- Shows notes from other users
- Admin notes are highlighted with a blue badge
- Read-only view of other users' notes

## Technical Implementation

### Database Schema
```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id),
  character TEXT NOT NULL,
  noteText TEXT NOT NULL,  -- Markdown content
  isAdmin INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  UNIQUE(userId, character)  -- One note per user per character
);
```

### API Endpoints

#### GET /api/notes/[character]
Returns all notes for a character, ordered by:
1. Admin notes first
2. Then by creation date (newest first)

#### POST /api/notes/[character]
Creates or updates a note (upsert):
- If user already has a note for this character → update it
- If user doesn't have a note → create new one

#### DELETE /api/notes/[character]
Deletes the user's note for this character.

### Libraries Used
- **marked**: Markdown parser (converts markdown to HTML)
- **dompurify**: HTML sanitizer (prevents XSS attacks)

## Usage Example

### Writing a Note
```markdown
# My Study Notes for 地図

This character means **map** or **atlas**.

## Etymology
- 地 (earth/ground)
- 図 (diagram/drawing)

## Example Sentences
1. 地図を見る (look at a map)
2. 世界地図 (world map)

## Useful Links
- [Jisho Entry](https://jisho.org/search/地図)

![Map Icon](https://example.com/map-icon.png)
```

### Rendered Output
The above markdown will be rendered with:
- Proper heading hierarchy
- Bold text for emphasis
- Numbered lists
- Clickable links
- Embedded images

## Future Enhancements

### Image Uploads (Not Yet Implemented)
To add image upload support:

1. **Enable R2 Bucket** in `wrangler.toml`:
```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "kiokun-images"
```

2. **Add Image Upload UI**:
- File input in the editor
- Upload to R2 on selection
- Insert markdown image syntax automatically

3. **Update API**:
- Add image upload endpoint
- Store image keys in database
- Generate presigned URLs for display

### Other Potential Features
- **Rich text editor**: WYSIWYG editor option
- **Note templates**: Pre-made templates for common note types
- **Note sharing**: Share notes with specific users
- **Note export**: Export notes as PDF or markdown files
- **Note search**: Search across all your notes
- **Note tags**: Categorize notes with tags

## Styling

The markdown content is styled with:
- Proper typography (headings, paragraphs, lists)
- Code syntax highlighting
- Responsive images
- Themed colors (adapts to light/dark mode)
- Consistent spacing and layout

All styles use CSS variables for automatic dark mode support.

## Migration

To apply the database migration:

**Local:**
```bash
npx wrangler d1 migrations apply kiokun-notes-db --local
```

**Production:**
```bash
# Remove duplicate notes first
npx wrangler d1 execute kiokun-notes-db --remote --command="DELETE FROM notes WHERE id NOT IN (SELECT MIN(id) FROM notes GROUP BY userId, character);"

# Add unique constraint
npx wrangler d1 execute kiokun-notes-db --remote --command="CREATE UNIQUE INDEX IF NOT EXISTS notes_userId_character_unique ON notes (userId, character);"
```

