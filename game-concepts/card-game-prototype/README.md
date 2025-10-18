# Card Game Prototype

An interactive card game prototype built with Svelte 5 and svelte-motion, featuring smooth animations and intuitive drag-and-drop interactions.

## Features

### ✨ Card Interactions

1. **Hover Effects**
   - Cards raise slightly when you hover over them
   - Cards brighten with a golden glow
   - Smooth spring animations

2. **Click to Select**
   - Click a card to select it (golden border appears)
   - Click again to deselect
   - Click the discard pile to play the selected card

3. **Drag and Drop**
   - Click and hold a card to grab it
   - Card follows your cursor with smooth inertia
   - Card scales up while dragging
   - Release to drop the card

4. **Hand Fan Layout**
   - Cards automatically arrange in a fan shape
   - Each card has a slight rotation based on position
   - Cards curve upward at the edges
   - Automatic spacing and positioning

5. **Auto-Reordering**
   - When you remove a card, remaining cards smoothly rearrange
   - Spring physics for natural movement
   - Cards maintain fan formation

6. **Deck Interaction**
   - Click the deck to draw a card
   - Card animates from deck to hand
   - Deck shows remaining card count
   - Deck raises on hover

7. **Discard Pile**
   - Click selected card then click discard pile to play
   - Or drag any card to the discard area
   - Shows the top card of the discard pile
   - Smooth card-to-pile animation

## Running the Prototype

```bash
cd card-game-prototype
npm install
npm run dev
```

Then open http://localhost:5173/

## Controls

- **Click Deck**: Draw a card from the deck
- **Hover Card**: Card raises and glows
- **Click Card**: Select/deselect a card
- **Drag Card**: Click and hold to drag, release to drop
- **Click Discard**: Play selected card to discard pile
- **New Game**: Reset and shuffle a new deck

## Technical Details

### Built With
- **Svelte 5**: Using new runes ($state, $effect, $props)
- **svelte-motion**: Framer Motion for Svelte (animations)
- **Vite**: Fast build tool

### Animation Features
- Spring physics for natural movement
- Layout animations (auto-reordering)
- Gesture support (drag, hover)
- Smooth interpolation
- Transform-based positioning (GPU accelerated)

### Card Layout Math
- Fan rotation: ±15° based on position from center
- Card spacing: 80px between centers
- Vertical curve: Parabolic offset for fan shape
- Z-index management: Hovered/dragged cards on top

## Next Steps for Your Kanji Game

This prototype demonstrates all the interactions you requested. To adapt it for your kanji game:

1. **Replace Card Data**: Change from 52-card deck to kanji characters
2. **Add Game Logic**: Implement combining, dissolving, word validation
3. **Customize Visuals**: Update card design for kanji display
4. **Add More Zones**: Create areas for combining, dissolving, etc.
5. **Integrate Backend**: Connect to your existing game logic

The animation and interaction code can be reused directly!

