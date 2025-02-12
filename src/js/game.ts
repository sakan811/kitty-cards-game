import Phaser from './lib/phaser';
import GameScene from './scenes/GameScene';
import { LobbyScene } from './scenes/LobbyScene';

const config: Phaser.Types.Core.GameConfig = {
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
        }
    }
};

export default config; 