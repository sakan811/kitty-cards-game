import { CARD_DIMENSIONS, COLORS, ASSIST_CARDS, ASSET_KEYS } from '../config/constants.js';

export class Card {
    constructor(scene, x, y, type, value) {
        this.scene = scene;
        this.type = type;
        this.value = value;
        this.isLifted = false;

        // Create back sprite first (this will be the main sprite)
        this.createSprite(x, y);
        // Create front sprite for both types
        this.createFrontSprite(x, y);
        // Create text (will be shown after flip)
        this.createText(x, y);
        this.setInteractive();
        this.setupClickHandler();
    }

    createSprite(x, y) {
        const texture = this.type === 'number' ? ASSET_KEYS.numberCard : ASSET_KEYS.assistCard;
        this.sprite = this.scene.add.image(x, y, texture)
            .setDisplaySize(CARD_DIMENSIONS.width, CARD_DIMENSIONS.height)
            .setInteractive()
            .setData('value', this.value)
            .setData('type', this.type)
            .setDepth(1);

        // Add special styling for special assist cards
        if (this.type === 'assist') {
            let borderColor;
            if (this.value === 'bye-bye') {
                borderColor = 0xff4444;
            } else if (this.value === 'meowster') {
                borderColor = 0x4488ff;
            }

            if (borderColor) {
                const graphics = this.scene.make.graphics();
                graphics.lineStyle(3, borderColor);
                graphics.strokeRect(0, 0, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
                graphics.generateTexture(`${this.value}-border`, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
                graphics.destroy();
            }
        }
    }

    createFrontSprite(x, y) {
        let textureName;
        let color;

        if (this.type === 'number') {
            color = COLORS.numberColors[this.value] || {
                hex: '0x808080',  // Default gray for unknown numbers
                cup: 'cup-white'
            };
            textureName = `card-front-${this.value}`;
            
            // Create the colored front sprite
            const graphics = this.scene.make.graphics();
            graphics.fillStyle(color.hex, 1);
            graphics.fillRect(0, 0, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
            graphics.lineStyle(2, 0x000000);
            graphics.strokeRect(0, 0, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
            graphics.generateTexture(textureName, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
            graphics.destroy();
        } else {
            textureName = `assist-front-${this.value}`;
            
            // Create assist card front
            const graphics = this.scene.make.graphics();
            graphics.fillStyle(0xffffff, 1);
            graphics.fillRect(0, 0, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
            graphics.lineStyle(2, 0x000000);
            graphics.strokeRect(0, 0, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
            graphics.generateTexture(textureName, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
            graphics.destroy();
        }

        // Create front sprite (initially hidden)
        this.frontSprite = this.scene.add.image(x, y, textureName)
            .setDisplaySize(CARD_DIMENSIONS.width, CARD_DIMENSIONS.height)
            .setVisible(false)
            .setDepth(1);

        if (this.type === 'number') {
            this.frontSprite.setData('matchingCup', color.cup);
        }

        // Add special border for special assist cards
        if (this.type === 'assist') {
            let borderColor;
            if (this.value === 'bye-bye') {
                borderColor = 0xff4444;
            } else if (this.value === 'meowster') {
                borderColor = 0x4488ff;
            }

            if (borderColor) {
                const borderTexture = `${this.value}-border`;
                this.border = this.scene.add.image(x, y, borderTexture)
                    .setDisplaySize(CARD_DIMENSIONS.width, CARD_DIMENSIONS.height)
                    .setDepth(2)
                    .setVisible(false);
            }
        }
    }

    createText(x, y) {
        let textConfig;
        if (this.type === 'assist') {
            const assistCard = ASSIST_CARDS[this.value] || {
                name: this.value,
                color: '#000000'  // Default color for unknown assist cards
            };
            textConfig = {
                fontSize: '20px',
                color: assistCard.color,
                fontWeight: 'bold'
            };
        } else {
            textConfig = {
                fontSize: '32px',
                color: '#FFFFFF',
                fontWeight: 'bold'
            };
        }

        this.text = this.scene.add.text(
            x,
            y,
            this.type === 'assist' ? 
                (ASSIST_CARDS[this.value]?.name || this.value) : 
                this.value.toString(),
            textConfig
        )
            .setOrigin(0.5)
            .setVisible(false)
            .setDepth(2);
    }

    setInteractive() {
        if (this.frontSprite) {
            this.frontSprite.setInteractive();
            this.scene.input.setDraggable(this.frontSprite);
        } else {
            this.sprite.setInteractive();
            this.scene.input.setDraggable(this.sprite);
        }
    }

    setupClickHandler() {
        const target = this.frontSprite || this.sprite;
        target.on('pointerup', (pointer) => {
            if (pointer.getDistance() < 5) {
                this.scene.onCardClick(this);
            }
        });
    }

    select() {
        // Allow selection for both number and assist cards
        const targets = [];
        if (this.sprite?.active) targets.push(this.sprite);
        if (this.frontSprite?.active) targets.push(this.frontSprite);
        if (this.text?.active) targets.push(this.text);
        if (this.border?.active) targets.push(this.border);

        targets.forEach(target => {
            target.setTint(0xffff99);
        });
    }

    deselect() {
        // Allow deselection for both number and assist cards
        const targets = [];
        if (this.sprite?.active) targets.push(this.sprite);
        if (this.frontSprite?.active) targets.push(this.frontSprite);
        if (this.text?.active) targets.push(this.text);
        if (this.border?.active) targets.push(this.border);

        targets.forEach(target => {
            target.clearTint();
        });
    }

    moveTo(x, y, duration = 200) {
        const targets = [this.sprite];
        if (this.frontSprite) targets.push(this.frontSprite);
        if (this.text) targets.push(this.text);
        if (this.border) targets.push(this.border);

        return new Promise(resolve => {
            this.scene.tweens.add({
                targets,
                x,
                y,
                duration,
                ease: 'Power2',
                onComplete: resolve
            });
        });
    }

    flip() {
        if (!this.frontSprite) return;

        return new Promise(resolve => {
            this.scene.tweens.add({
                targets: this.sprite,
                scaleX: 0,
                duration: 150,
                ease: 'Linear',
                onComplete: () => {
                    this.sprite.destroy();
                    this.frontSprite.setVisible(true);
                    this.text.setVisible(true);
                    if (this.border) this.border.setVisible(true);
                    
                    this.scene.tweens.add({
                        targets: [this.frontSprite, this.text, ...(this.border ? [this.border] : [])],
                        scaleX: 1,
                        duration: 150,
                        ease: 'Linear',
                        onComplete: resolve
                    });
                }
            });
        });
    }

    lift() {
        if (this.isLifted) return;
        
        const targets = [];
        if (this.sprite?.active) targets.push(this.sprite);
        if (this.frontSprite?.active) targets.push(this.frontSprite);
        if (this.text?.active) targets.push(this.text);

        if (targets.length > 0) {
            this.scene.tweens.add({
                targets,
                y: '-=20',
                duration: 200,
                ease: 'Power2'
            });

            const sourceSprite = this.frontSprite?.active ? this.frontSprite : this.sprite;
            let descriptionText = `Card Type: ${this.type}\nValue: ${this.value}`;
            
            // Add assist card description if it's an assist card
            if (this.type === 'assist' && ASSIST_CARDS[this.value]) {
                descriptionText = ASSIST_CARDS[this.value].description;
            }

            this.description = this.scene.add.text(
                sourceSprite.x,
                sourceSprite.y - 70,
                descriptionText,
                {
                    fontSize: '16px',
                    color: '#000',
                    backgroundColor: '#fff',
                    padding: { x: 10, y: 5 }
                }
            )
            .setOrigin(0.5)
            .setDepth(100);

            this.isLifted = true;
        }
    }

    lower() {
        if (!this.isLifted) return;

        const targets = [];
        if (this.sprite?.active) targets.push(this.sprite);
        if (this.frontSprite?.active) targets.push(this.frontSprite);
        if (this.text?.active) targets.push(this.text);

        if (targets.length > 0) {
            this.scene.tweens.add({
                targets,
                y: '+=20',
                duration: 200,
                ease: 'Power2'
            });
        }

        if (this.description?.active) {
            this.description.destroy();
            this.description = null;
        }

        this.isLifted = false;
    }

    destroy() {
        if (this.sprite?.active) this.sprite.destroy();
        if (this.frontSprite?.active) this.frontSprite.destroy();
        if (this.text?.active) this.text.destroy();
        if (this.description?.active) this.description.destroy();
        if (this.border?.active) this.border.destroy();
    }
} 