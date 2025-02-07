import Phaser from '../lib/phaser.js';
import { CARD_DIMENSIONS, COLORS, ASSIST_CARDS, ASSET_KEYS } from '../config/constants.js';

export class Card extends Phaser.GameObjects.Container {
    constructor(scene, x, y, type, value) {
        super(scene, x, y);
        scene.add.existing(this);
        
        this.type = type;
        this.value = value;
        this.isFlipped = false;
        this.isAnimating = false;
        
        this.createCardVisuals();
        this.setupInteraction();
        this.setSize(CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
        this.setDepth(1);
    }

    createCardVisuals() {
        // Create card background
        const color = COLORS.numberColors[this.value] || { hex: '0x808080' };
        const graphics = this.scene.add.graphics();
        
        // Front face
        graphics.fillStyle(this.type === 'number' ? color.hex : 0xffffff);
        graphics.fillRect(0, 0, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
        graphics.lineStyle(2, 0x000000);
        graphics.strokeRect(0, 0, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
        
        const frontTextureName = `card-front-${this.type}-${this.value}`;
        graphics.generateTexture(frontTextureName, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
        
        // Back face
        graphics.clear();
        graphics.fillStyle(0x2244cc);
        graphics.fillRect(0, 0, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
        graphics.lineStyle(2, 0x000000);
        graphics.strokeRect(0, 0, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
        
        const backTextureName = `card-back-${this.type}`;
        graphics.generateTexture(backTextureName, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
        graphics.destroy();

        // Create front and back sprites
        this.frontSprite = this.scene.add.sprite(0, 0, frontTextureName)
            .setOrigin(0.5)
            .setDisplaySize(CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
            
        this.backSprite = this.scene.add.sprite(0, 0, backTextureName)
            .setOrigin(0.5)
            .setDisplaySize(CARD_DIMENSIONS.width, CARD_DIMENSIONS.height)
            .setVisible(false);

        // Add text
        this.text = this.scene.add.text(0, 0, 
            this.type === 'assist' ? (ASSIST_CARDS[this.value]?.name || this.value) : this.value.toString(),
            {
                fontSize: this.type === 'assist' ? '20px' : '32px',
                color: this.type === 'assist' ? '#000000' : '#ffffff',
                fontWeight: 'bold'
            }
        ).setOrigin(0.5);

        // Add all elements to container
        this.add([this.backSprite, this.frontSprite, this.text]);
    }

    setupInteraction() {
        this.setInteractive({ 
            hitArea: new Phaser.Geom.Rectangle(
                -CARD_DIMENSIONS.width/2, 
                -CARD_DIMENSIONS.height/2, 
                CARD_DIMENSIONS.width, 
                CARD_DIMENSIONS.height
            ), 
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            useHandCursor: true
        });

        this.on('pointerup', (pointer) => {
            if (!this.isAnimating && pointer.getDistance() < 5) {
                this.scene.onCardClick(this);
            }
        });

        this.on('pointerover', () => {
            if (!this.isAnimating) {
                this.scene.tweens.add({
                    targets: this,
                    scaleX: 1.1,
                    scaleY: 1.1,
                    duration: 200,
                    ease: 'Power2'
                });
            }
        });

        this.on('pointerout', () => {
            if (!this.isAnimating) {
                this.scene.tweens.add({
                    targets: this,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 200,
                    ease: 'Power2'
                });
            }
        });
    }

    flip(duration = 300) {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        const targetRotation = this.isFlipped ? 0 : Math.PI;
        
        return new Promise(resolve => {
            this.scene.tweens.add({
                targets: this,
                scaleX: 0,
                duration: duration/2,
                ease: 'Power2',
                onComplete: () => {
                    this.isFlipped = !this.isFlipped;
                    this.frontSprite.setVisible(!this.isFlipped);
                    this.backSprite.setVisible(this.isFlipped);
                    this.text.setVisible(!this.isFlipped);
                    
                    this.scene.tweens.add({
                        targets: this,
                        scaleX: 1,
                        duration: duration/2,
                        ease: 'Power2',
                        onComplete: () => {
                            this.isAnimating = false;
                            resolve();
                        }
                    });
                }
            });
        });
    }

    moveTo(x, y, duration = 200) {
        if (this.isAnimating) return Promise.resolve();
        
        this.isAnimating = true;
        return new Promise(resolve => {
            this.scene.tweens.add({
                targets: this,
                x: x,
                y: y,
                duration: duration,
                ease: 'Power2',
                onComplete: () => {
                    this.isAnimating = false;
                    resolve();
                }
            });
        });
    }

    destroy() {
        super.destroy();
    }
} 