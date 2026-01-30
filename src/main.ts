import { Game } from '@/game/Game';

// ============================================================================
// Application Entry Point
// ============================================================================

async function main(): Promise<void> {
  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Game container not found');
  }

  // Show loading message
  container.innerHTML = '<div style="color: white; font-size: 24px; text-align: center; padding-top: 300px;">Loading...</div>';

  try {
    const game = new Game(container);
    container.innerHTML = ''; // Clear loading message
    await game.init();
  } catch (error) {
    console.error('[Main] Failed to initialize game:', error);
    container.innerHTML = `<div style="color: red; font-size: 18px; text-align: center; padding-top: 300px;">
      Failed to load game.<br/>
      ${error instanceof Error ? error.message : 'Unknown error'}
    </div>`;
  }
}

main().catch(console.error);
