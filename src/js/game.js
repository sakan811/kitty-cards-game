import Phaser from './lib/phaser.js';
import { MainScene } from './scenes/MainScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#2d2d2d',
    parent: 'game',
    scene: [PreloadScene, LobbyScene, MainScene],
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
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    audio: {
        disableWebAudio: false,
        noAudio: false
    },
    dom: {
        createContainer: true
    },
    autoFocus: false
};

export default config; 