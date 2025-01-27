import { gameConfig } from './config/gameConfig.js';
import { MainScene } from './scenes/MainScene.js';

// Add the main scene to the game config
gameConfig.scene = MainScene;

// Create the game instance
const game = new Phaser.Game(gameConfig);

// Handle window resize
window.addEventListener('resize', () => {
    game.scale.refresh();
}); 