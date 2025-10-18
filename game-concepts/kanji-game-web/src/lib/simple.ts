import { SimpleGame } from './simpleGame';

async function main() {
  try {
    const game = new SimpleGame();
    await game.initialize();
    await game.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();

