# Game Concepts

This folder contains various game prototypes and experiments built using the dictionary data.

## Projects

### Card Games

#### `card-game/`
Main card game implementation - a 4-player Crazy Eights game using Chinese/Japanese characters.
- **Tech**: SvelteKit, Svelte 5
- **Features**: Full game logic, animations, AI players
- **Status**: Active development

#### `card-game-prototype/`
Early prototype version of the card game.
- **Tech**: Vanilla JS/HTML
- **Status**: Prototype/archived

#### `kanji-card-game/`
Alternative card game variant focusing on kanji.
- **Tech**: SvelteKit
- **Status**: Experimental

### Kanji/Hanzi Games

#### `kanji-game/`
Terminal-based game where players combine character components to form larger characters.
- **Tech**: TypeScript (Node.js terminal)
- **Features**: IDS-based character composition, scoring system
- **Status**: Prototype

#### `kanji-game-web/`
Web version of the terminal kanji game.
- **Tech**: SvelteKit
- **Status**: Experimental

### Quiz Applications

#### `hanzi-quiz/`
Terminal-based quiz for testing Chinese character knowledge.
- **Tech**: TypeScript (Node.js terminal)
- **Features**: 4 question types mixing characters and glosses
- **Status**: Prototype

#### `hanzi-quiz-web/`
Web version of the hanzi quiz with interactive UI.
- **Tech**: SvelteKit
- **Features**: Continuous play, color-coded feedback
- **Status**: Experimental

## Common Technologies

All web-based projects use:
- **SvelteKit** - Framework
- **Svelte 5** - UI library with runes syntax
- **TypeScript** - Type safety
- **Vite** - Build tool

## Data Sources

These games use data from:
- `output_dictionary/` - Optimized dictionary JSON files
- `data/ids/` - IDS (Ideographic Description Sequence) data for character decomposition
- MakeMeAHanzi - Stroke order and character structure data

## Purpose

These projects serve as:
1. **Learning tools** - Interactive ways to study Chinese/Japanese characters
2. **Experiments** - Testing different approaches to gamification
3. **Prototypes** - Exploring what works before building production versions
4. **Reference** - Examples of how to use the dictionary data in applications

## Notes

- Most projects are in experimental/prototype stage
- `card-game/` is the most actively developed
- Terminal versions were created first, then ported to web
- Some projects may have overlapping functionality as different approaches were explored

