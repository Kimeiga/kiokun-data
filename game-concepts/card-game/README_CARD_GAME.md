# Card Game - Svelte 5 + SvelteKit + Svelte Motion

A 4-player Crazy Eights card game built with Svelte 5, SvelteKit, and Svelte Motion featuring smooth animations, drag-and-drop interactions, and AI opponents.

## Features

### Core Gameplay
- **4-Player Crazy Eights**: Full implementation of Crazy Eights rules with 3 AI opponents
- **Turn-Based Gameplay**: Sequential player turns with automatic AI play
- **Card Eligibility**: Can only play cards matching suit or rank of discard pile
- **Win Detection**: Game ends when a player runs out of cards

### Animations & Interactions
- **Hand Management**: Cards displayed in a fan layout at the bottom of the screen
- **Hover Effects**: Cards raise and brighten when hovered
- **Drag & Drop**: Drag cards from your hand to the discard pile or reorder within hand
- **Click to Select**: Click a card to select it, then click the discard pile to play
- **Card Flip Animation**: Cards flip from face-down to face-up during dealing and drawing
- **Staggered Dealing**: Cards fly from deck to each player's hand with 100ms stagger
- **AI Card Animations**: AI players' cards animate when playing and drawing
- **Hand Reordering**: Drag cards within your hand to reorder them (⚠️ see known issues)
- **Smooth Transitions**: All card movements use CSS transitions for natural motion

## How to Play

### Crazy Eights Rules
1. Each player starts with 7 cards
2. On your turn, play a card that matches the suit OR rank of the top discard pile card
3. If you can't play, draw a card from the deck
4. First player to run out of cards wins

### Controls
1. **Hover** over cards in your hand to see them better
2. **Drag** a card to the discard pile to play it
3. **Drag** cards within your hand to reorder them
4. **Click** the deck to draw a card (if you can't play)
5. AI players automatically play after a 1-second delay

## Project Structure

```
card-game/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── Card.svelte          # Individual card component with flip animation
│   │   │   ├── Hand.svelte          # Hand management with fan layout and drag
│   │   │   └── DiscardPile.svelte   # Discard pile with stack visualization
│   │   └── types.ts                 # Card types and deck utilities
│   └── routes/
│       └── +page.svelte             # Main game page
```

## Running the Project

### Prerequisites

You need **Node.js 20.19+** or **22.12+** to run this project with the current SvelteKit version.

### Option 1: Using Node.js (Recommended)

If you have Node 20.19+ or 22.12+:

```bash
cd card-game
npm install
npm run dev
```

### Option 2: Using Bun (if Node version is incompatible)

If you're using Bun and have an older Node version, you may encounter compatibility issues. You have two options:

**A. Upgrade Node.js** (Recommended)
- Install Node 20.19+ or 22.12+ using nvm, fnm, or your preferred Node version manager

**B. Downgrade SvelteKit dependencies** (Temporary workaround)

Edit `package.json` and change these versions:

```json
{
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "vite": "^6.0.0"
  }
}
```

Then run:
```bash
cd card-game
bun install
bun run dev
```

## Technologies Used

- **Svelte 5**: Latest version with runes ($state, $derived, $effect)
- **SvelteKit**: Full-stack framework for Svelte
- **Svelte Motion**: Animation library (Svelte port of Framer Motion)
- **TypeScript**: Type safety throughout the codebase

## Key Implementation Details

### Svelte 5 Runes

The project uses Svelte 5's new runes system:

- `$state`: For reactive state (deck, hand, discardPile)
- `$derived`: For computed values (topCard, cardColor)
- `$effect`: For side effects (game initialization)

### Svelte Motion

Animations are powered by Svelte Motion:

- **Motion component**: Wraps cards for smooth transitions
- **Spring physics**: Natural, physics-based animations
- **Layout animations**: Cards automatically animate to new positions

### Drag & Drop Implementation

The drag system is custom-built using pointer events:

1. **Pointer Down**: Captures the card and calculates offset
2. **Pointer Move**: Updates card position with inertia
3. **Pointer Up**: Checks if dropped on discard pile
4. **Space Making**: Other cards shift to make room during drag

### Card Flip Animation

Cards use CSS 3D transforms for flip animation:

- `transform-style: preserve-3d` on container
- `backface-visibility: hidden` on faces
- `rotateY(180deg)` for flip effect

## Future Enhancements

Completed features:
- [x] Game rules (Crazy Eights - matching suits or ranks)
- [x] Multiple players (4 players: 1 human + 3 AI)
- [x] Staggered dealing animation
- [x] AI card playing and drawing animations
- [x] Hand reordering via drag-and-drop

Potential features to add:
- [ ] Score tracking across multiple rounds
- [ ] Sound effects
- [ ] Mobile touch optimization
- [ ] Keyboard controls
- [ ] Undo/redo functionality
- [ ] Different card game modes (Solitaire, Poker, etc.)
- [ ] Multiplayer over network

## Known Issues

### 🔴 Hand Reordering Animation Glitch
**Status**: Partially solved - cards reorder correctly but sometimes teleport to deck on release.

**Symptom**: When dragging a card within your hand to reorder it, sometimes on release the card will teleport to the deck position instead of smoothly animating to its new position in the hand.

**Workaround**: Try dragging again - it doesn't happen every time.

**For developers**: See [HAND_REORDERING_PROBLEM.md](./HAND_REORDERING_PROBLEM.md) for detailed analysis, attempted solutions, and debugging steps.

## Documentation

- **[HAND_REORDERING_PROBLEM.md](./HAND_REORDERING_PROBLEM.md)** - Comprehensive analysis of the hand reordering animation issue
- **[DRAG_DROP_LESSONS.md](./DRAG_DROP_LESSONS.md)** - General drag-and-drop patterns and lessons learned
- **[README.md](./README.md)** - Quick start guide

## Troubleshooting

### "Cannot find base config file" warning

This is normal on first run. Run `npm run prepare` or `bun run prepare` to generate the SvelteKit config.

### Node version errors

Make sure you're using Node 20.19+ or 22.12+. Check with:
```bash
node --version
```

### Svelte Motion not working

Make sure svelte-motion is installed:
```bash
npm install svelte-motion
# or
bun add svelte-motion
```

## License

MIT

