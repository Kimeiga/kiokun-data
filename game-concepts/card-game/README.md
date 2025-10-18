# Card Game - Crazy Eights

A 4-player Crazy Eights card game built with Svelte 5, SvelteKit, and smooth animations.

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## 📚 Documentation

### Start Here
- **[CURRENT_STATUS.md](./CURRENT_STATUS.md)** - 👈 **READ THIS FIRST**
  - What works, what doesn't
  - Known issues and their status
  - Quick reference for debugging

### Deep Dives
- **[HAND_REORDERING_PROBLEM.md](./HAND_REORDERING_PROBLEM.md)** - Active bug investigation
  - Complete analysis of hand reordering teleport bug
  - All attempted solutions and their outcomes
  - Next debugging steps

- **[DRAG_DROP_LESSONS.md](./DRAG_DROP_LESSONS.md)** - General patterns
  - Coordinate system solutions
  - Svelte 5 reactivity patterns
  - Animation best practices

- **[README_CARD_GAME.md](./README_CARD_GAME.md)** - Project overview
  - Features and gameplay
  - Project structure
  - How to play

## 🎮 How to Play

1. Each player starts with 7 cards
2. Play a card matching the suit OR rank of the discard pile
3. If you can't play, draw from the deck
4. First player to run out of cards wins
5. Drag cards to reorder your hand (⚠️ has a visual glitch sometimes)

## 🔴 Known Issues

**Hand Reordering Teleport Bug**: Sometimes when reordering cards in your hand, the card teleports to the deck on release instead of smoothly animating. See [HAND_REORDERING_PROBLEM.md](./HAND_REORDERING_PROBLEM.md) for details.

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
