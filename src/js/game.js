import Phaser from './lib/phaser.js';
import GameScene from './scenes/GameScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#2d2d2d',
    parent: 'game',
    scene: [LobbyScene, GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 600,
        min: {
            width: 375,
            height: 667
        },
        max: {
            width: 1024,
            height: 1366
        }
    },
    dom: {
        createContainer: true
    },
    autoFocus: false
};

export default config; 