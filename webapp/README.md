# Kiokun Dictionary Webapp

A simple web application to test the learner-focused dictionary data structure.

## Features

- **Character-based routing**: Visit `/的` to see the character 的
- **Responsive design**: Works on desktop and mobile
- **Tabbed interface**: Separate Chinese, Japanese, and Cross-linguistic insights
- **Frequency-based prioritization**: Primary meanings shown first
- **Multi-reading detection**: Special handling for complex characters

## Quick Start

1. **Start the server**:
   ```bash
   cd webapp
   python3 server.py
   ```

2. **Open your browser** and visit:
   - http://localhost:8000
   - http://localhost:8000/的 (character 的)
   - http://localhost:8000/和 (character 和)
   - http://localhost:8000/空 (character 空)

## How it works

1. **Routing**: The server serves `index.html` for all character paths
2. **Data loading**: JavaScript fetches JSON from `../output_dictionary/{character}.json`
3. **Rendering**: The app analyzes the JSON structure and renders learner-focused UI

## Testing Characters

Try these characters that have multiple readings in both languages:
- **的** - 4 Chinese readings, 2 Japanese readings
- **和** - 6 Chinese readings, 1+ Japanese readings  
- **空** - 2 Chinese readings, 2 Japanese readings
- **仇** - 3 Chinese readings, 3 Japanese readings
- **比** - 4 Chinese readings, 1+ Japanese readings

## Data Structure

The app expects JSON files in this format:
```json
{
  "word": "的",
  "unified": {
    "representations": {
      "chinese_pinyin": ["de", "dì", "dí", "dī"],
      "japanese_kana": [{"text": "てき", "common": true}]
    },
    "definitions": [
      {
        "text": "possessive particle",
        "source_language": "chinese",
        "chinese_fields": {"pinyin": "de"}
      }
    ],
    "statistics": {
      "chinese": {"hsk_level": 1}
    }
  },
  "japanese_specific_entries": [
    {
      "kana": [{"text": "まと"}],
      "definitions": [{"text": "target"}]
    }
  ]
}
```

## Architecture

- **Frontend**: Vanilla HTML/CSS/JavaScript (no frameworks)
- **Backend**: Simple Python HTTP server
- **Data**: JSON files from the dictionary merger
- **Routing**: Client-side routing with History API

## Development

The webapp is designed to be minimal and self-contained:
- No build process required
- No external dependencies
- Works with existing JSON output from the dictionary merger
- Easy to modify and extend

## Next Steps

This prototype demonstrates:
1. ✅ Learner-focused data presentation
2. ✅ Multi-reading character handling  
3. ✅ Frequency-based prioritization
4. ✅ Cross-linguistic insights
5. ✅ Responsive design

Future enhancements could include:
- Audio pronunciation
- Stroke order animations
- Example sentences
- Related character suggestions
- Search functionality
- Bookmarking/favorites
