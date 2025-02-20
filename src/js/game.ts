import Phaser from './lib/phaser';
import GameScene from './scenes/GameScene';
import LobbyScene from './scenes/LobbyScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 900,
    height: 1600,
    backgroundColor: '#2d2d2d',
    parent: 'game',
    scene: [LobbyScene, GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 900,
        height: 1600,
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
    autoFocus: false
};

export default config; 