# Hanzi Quiz

Terminal-based Anki-style quiz game for learning Chinese characters through component recognition.

## Features

**Two modes:**
- **CLI Mode** (`npm start`) - One question at a time, saves state, returns to shell
- **Interactive Mode** (`npm run play`) - Continuous quiz with instant feedback and color-coded results

**Five types of randomized questions** that test your understanding of Chinese character composition:

1. **Character → Component Glosses** - Given 禎, answer "to show + chaste"
2. **Character Gloss → Component Characters** - Given "auspicious", answer "示 + 貞"
3. **Component Characters → Character Gloss** - Given "示 + 貞", answer "auspicious"
4. **Component Glosses → Character** - Given "to show + chaste", answer 禎
5. **Character → Real Word** - Given a character, identify which word is real (all options contain the same character!)

## Installation

```bash
npm install
```

## Usage

### Interactive Mode (Recommended)
Continuous quiz with instant feedback:
```bash
npm run play
```

Features:
- ✅ Instant color-coded feedback (green for correct, red for wrong)
- ✅ Automatic progression to next question
- ✅ Shows full explanation after each answer
- ✅ Clean, formatted display
- ✅ Press Ctrl+C to exit

### CLI Mode
One question at a time, saves state:
```bash
npm start
```

Example output:
```
❓ Question: Component Glosses → Character Gloss

Given these component glosses in order: to show + chaste

What is the gloss of the character they form?

  1. brave
  2. auspicious
  3. girl
  4. surname
  5. the roaring of the wind
  6. a clear sound

Answer with: npm start -- --answer <number>
```

### Answer the question:
```bash
npm start -- --answer 3
```

Example output:
```
📝 Your answer: 2. auspicious
✅ Correct answer: 2. auspicious

🎉 Correct!

The character is: 禎 (auspicious)
Components: 示 + 貞
Component glosses: to show + chaste

Generate next question with: npm start
```

## How it works

1. Run `npm start` to generate a random question
2. The question is saved to `.quiz-state.json` (gitignored)
3. Answer with `npm start -- --answer <1-6>`
4. Get immediate feedback and explanation
5. Generate the next question

## Data

Uses pre-generated JSON files from the main kiokun-data project:
- `ids_forward.json` - Character decomposition data (27,160 entries)
- `character_words.json` - Character-to-word mappings (13,331 characters)
- `word_index.json` - Word validation index (383,918 words)
- `character_glosses.json` - Character glosses/meanings (22,125 characters)

## Future Enhancements

- Track statistics (correct/incorrect answers)
- Spaced repetition algorithm
- Difficulty levels
- Web interface (SvelteKit)
- Progress tracking
- Daily challenges

