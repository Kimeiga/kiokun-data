# Card Game - Svelte 5 + SvelteKit + Svelte Motion

A card game built with Svelte 5, SvelteKit, and Svelte Motion featuring smooth animations and drag-and-drop interactions.

## Features

- **Hand Management**: Cards displayed in a fan layout at the bottom of the screen
- **Hover Effects**: Cards raise and brighten when hovered
- **Drag & Drop**: Drag cards from your hand to the discard pile
- **Click to Select**: Click a card to select it, then click the discard pile to play
- **Card Flip Animation**: New cards flip from face-down to face-up when drawn
- **Automatic Space-Making**: Cards in hand automatically rearrange to make space when dragging
- **Smooth Animations**: All interactions use spring physics for natural movement

## How to Play

1. **Hover** over cards in your hand to see them better
2. **Click** a card to select it, then click the discard pile to play it
3. **Or drag** a card directly to the discard pile
4. Any card can be played on any card (no rules for now)
5. A new card is drawn automatically when you play one

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

Potential features to add:

- [ ] Game rules (e.g., matching suits or ranks)
- [ ] Multiple players
- [ ] Score tracking
- [ ] Sound effects
- [ ] Mobile touch optimization
- [ ] Keyboard controls
- [ ] Undo/redo functionality
- [ ] Different card game modes (Solitaire, Poker, etc.)

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

