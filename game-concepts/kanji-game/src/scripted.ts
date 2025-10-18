import { ScriptedGame } from './scriptedGame';

async function main() {
  const scriptPath = process.argv[2];
  
  if (!scriptPath) {
    console.error('Usage: npm run scripted <script-file>');
    console.error('Example: npm run scripted scripts/demo.txt');
    process.exit(1);
  }
  
  try {
    const game = new ScriptedGame(true);
    await game.initialize();
    await game.runScript(scriptPath);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();

