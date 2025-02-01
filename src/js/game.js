import { MainScene } from './scenes/MainScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';

let game = null;

// Wait for both Phaser and Socket.IO to be available
if (typeof Phaser === 'undefined') {
    console.error('Phaser is not loaded');
    document.getElementById('error-message').textContent = 'Error: Could not load Phaser. Please check your internet connection and refresh the page.';
    document.getElementById('error-message').style.display = 'block';
} else if (typeof io === 'undefined') {
    console.error('Socket.IO is not loaded');
    document.getElementById('error-message').textContent = 'Error: Could not load Socket.IO. Please check your internet connection and refresh the page.';
    document.getElementById('error-message').style.display = 'block';
} else {
    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        backgroundColor: '#ffffff',
        dom: {
            createContainer: true
        },
        scene: [PreloadScene, LobbyScene, MainScene],
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH
        },
        parent: 'game-container'
    };

    try {
        console.log('Initializing game with scenes:', [PreloadScene, LobbyScene, MainScene]);
        game = new Phaser.Game(config);

        // Handle window resize
        window.addEventListener('resize', () => {
            if (game && game.scale && typeof game.scale.refresh === 'function') {
                game.scale.refresh();
            }
        });
    } catch (error) {
        console.error('Error initializing game:', error);
        document.getElementById('error-message').textContent = 'Error initializing game. Please refresh the page.';
        document.getElementById('error-message').style.display = 'block';
    }
}

export default game; 