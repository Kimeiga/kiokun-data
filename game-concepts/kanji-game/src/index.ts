import { Game } from './game';

async function main() {
  try {
    const game = new Game();
    await game.initialize();
    await game.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();

