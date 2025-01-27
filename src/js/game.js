import { gameConfig } from './config/gameConfig.js';
import { MainScene } from './scenes/MainScene.js';

// Add the main scene to the game config
gameConfig.scene = MainScene;

// Create the game instance
const game = new Phaser.Game(gameConfig);

// Handle window resize - ensure this runs after game is created
if (typeof window !== 'undefined' && game && game.scale) {
    window.addEventListener('resize', () => {
        if (game && game.scale && typeof game.scale.refresh === 'function') {
            game.scale.refresh();
        }
    });
}

export default game; 