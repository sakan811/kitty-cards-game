import { ASSET_KEYS } from '../config/constants.js';

export class Tile {
    constructor(scene, x, y, index, cupColor = 'cup-white') {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.index = index;
        this.hasNumber = false;
        this.value = null;
        
        // Create the visual representation
        this.container = scene.add.container(x, y);
        this.container.setDepth(10); // Set higher depth for tiles
        
        // Cup sprite - use the correct asset key format with proper fallback
        const assetKey = ASSET_KEYS[cupColor] || ASSET_KEYS['cup-white'];
        this.cupSprite = scene.add.sprite(0, 0, assetKey)
            .setDisplaySize(80, 80);
        
        // Number text
        this.numberText = scene.add.text(0, 0, '', {
            fontSize: '32px',
            color: '#000000',
            stroke: '#FFFFFF',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Add to container
        this.container.add([this.cupSprite, this.numberText]);
        
        // Make interactive
        this.cupSprite.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.onTileClick(this, this.index);
            });
    }

    render(tileData) {
        // Add validation for tileData
        if (!tileData) {
            console.warn(`No tile data provided for tile ${this.index}`);
            return;
        }
        
        // Handle value updates
        if (tileData.value !== undefined) {
            this.setNumber(tileData.value);
        } else {
            this.removeNumber();
        }
        
        // Handle cup color updates if provided
        if (tileData.cupColor) {
            const assetKey = ASSET_KEYS[tileData.cupColor] || ASSET_KEYS['cup-white'];
            this.cupSprite.setTexture(assetKey);
        }
    }

    setNumber(value) {
        this.value = value;
        this.hasNumber = true;
        this.numberText.setText(value.toString());
    }

    removeNumber() {
        this.value = null;
        this.hasNumber = false;
        this.numberText.setText('');
        this.cupSprite.setTexture(ASSET_KEYS['cup-white']);
    }

    getNumber() {
        return this.value;
    }
} 