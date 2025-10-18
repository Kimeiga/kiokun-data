# 漢字ポーカー (Kanji Component Poker)

A Balatro-inspired roguelike deck-building game where you combine kanji components to form words and score points!

## 🎮 Game Concept

Inspired by the hit game Balatro, this is a poker-style roguelike where instead of playing poker hands, you:
- **Combine** kanji components to create more complex characters
- **Dissolve** complex characters back into their components
- **Play words** using your characters to score points
- **Beat blinds** by reaching target scores with limited hands
- **Buy jokers** in the shop to enhance your scoring

## 🎯 How to Play

### Core Mechanics

1. **Your Hand**: You start with 8 cards, each showing a kanji character or component
2. **Actions**:
   - **Play a Word**: Select 2-4 characters to form a valid Chinese or Japanese word
   - **Combine**: Merge two components to create a more complex character (e.g., 木 + 日 = 東)
   - **Dissolve**: Break down a complex character into its components
   - **Discard**: Replace unwanted cards (limited uses per round)

3. **Scoring**: 
   - Base Score = (Sum of strokes in each character) × (Word length)
   - Multipliers from Jokers can dramatically increase your score
   - Example: Playing 日本 (Japan) = (4 + 5 strokes) × 2 characters = 18 base points

4. **Progression**:
   - Each Ante has 3 Blinds: Small → Big → Boss
   - Beat 8 Antes to win the game
   - Target scores increase with each Ante
   - Boss Blinds have special effects that make them harder

5. **Shop Phase**:
   - Between blinds, visit the shop
   - Buy Jokers with special effects (¥3-12)
   - Earn interest on your currency (¥1 per ¥5, max ¥5)
   - Skip shop for +¥1

### Joker Examples

- **筆画の力** (Stroke Power): Multiply score by 1.5×
- **長文の達人** (Long Word Master): +10 points per character
- **部首の祝福** (Radical Blessing): +20 points per component card
- **追加の手** (Extra Hand): +1 hand per round
- **追加の捨て** (Extra Discard): +1 discard per round

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ and npm
- The game data files must be generated first (see parent directory)

### Installation

```bash
cd kanji-game
npm install
```

### Running the Game

```bash
npm run dev
```

Or build and run:

```bash
npm run build
npm start
```

## 📊 Game Data

The game uses three data files generated from the parent project:

1. **ids_forward.json** (4MB): Maps characters to their components
   - Used for the "Dissolve" action
   - Example: 東 → [木, 日]

2. **ids_reverse.json** (1MB): Maps component pairs to resulting characters
   - Used for the "Combine" action
   - Example: 木 + 日 → [東, 杲, ...]

3. **word_index.json** (14MB): Valid Chinese and Japanese words
   - 186,624 Chinese words
   - 217,009 Japanese words
   - Used to validate played words

## 🎲 Strategy Tips

1. **Build Complex Characters**: Combining components creates characters with more strokes, leading to higher scores
2. **Save Components**: Keep basic components to combine later when you need specific characters
3. **Word Length Matters**: Longer words multiply your score more
4. **Joker Synergy**: Stack jokers that work well together (e.g., stroke multiplier + component bonus)
5. **Manage Resources**: Balance spending currency on jokers vs. saving for interest
6. **Plan Ahead**: Think about what words you can make before combining/dissolving

## 🏗️ Technical Details

### Architecture

- **TypeScript**: Type-safe game logic
- **Inquirer.js**: Interactive terminal UI
- **Chalk**: Colorful terminal output
- **IDS Database**: CHISE Ideographic Description Sequences for character decomposition

### Key Components

- `dataLoader.ts`: Loads and manages game data (IDS, dictionary, strokes)
- `cardManager.ts`: Handles card creation, combining, dissolving
- `scoring.ts`: Validates words and calculates scores
- `gameState.ts`: Manages game progression and blind system
- `shop.ts`: Generates and manages shop items
- `ui.ts`: Terminal user interface
- `game.ts`: Main game loop

## 🎨 Future Enhancements

Potential features for browser version:

- **Visual Card Design**: Beautiful kanji cards with stroke animations
- **Drag & Drop**: Intuitive card combining
- **Animations**: Smooth transitions and effects
- **Sound Effects**: Audio feedback for actions
- **Leaderboards**: Track high scores
- **More Jokers**: Expanded joker pool with unique effects
- **Tarot Cards**: One-time use power-ups
- **Vouchers**: Permanent upgrades
- **Different Decks**: Start with different character sets
- **Achievements**: Unlock rewards for specific accomplishments

## 📝 License

Part of the kiokun-data project.

## 🙏 Credits

- Inspired by **Balatro** by LocalThunk
- Uses **CHISE IDS Database** for character decomposition
- Dictionary data from **CC-CEDICT** and **JMdict**
- Built with ❤️ for language learners and game enthusiasts

