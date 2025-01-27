import { CARD_DIMENSIONS, COLORS } from '../config/constants.js';

export class Card {
    constructor(scene, x, y, type, value) {
        this.scene = scene;
        this.type = type;
        this.value = value;
        this.isLifted = false;

        this.createSprite(x, y);
        if (type === 'number') {
            this.createFrontSprite(x, y);
        }
        this.createText(x, y);
        this.setInteractive();
        this.setupClickHandler();
    }

    createSprite(x, y) {
        const texture = this.type === 'number' ? 'number-card' : 'assist-card';
        this.sprite = this.scene.add.image(x, y, texture)
            .setDisplaySize(CARD_DIMENSIONS.width, CARD_DIMENSIONS.height)
            .setInteractive()
            .setData('value', this.value)
            .setData('type', this.type)
            .setDepth(1);
    }

    createFrontSprite(x, y) {
        if (this.type === 'number') {
            const color = COLORS.numberColors[this.value];
            const textureName = `card-front-${this.value}`;
            
            // Create the colored front sprite
            const graphics = this.scene.make.graphics();
            graphics.fillStyle(color.hex, 1);
            graphics.fillRect(0, 0, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
            graphics.lineStyle(2, 0x000000);
            graphics.strokeRect(0, 0, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
            graphics.generateTexture(textureName, CARD_DIMENSIONS.width, CARD_DIMENSIONS.height);
            graphics.destroy();

            this.frontSprite = this.scene.add.image(x, y, textureName)
                .setDisplaySize(CARD_DIMENSIONS.width, CARD_DIMENSIONS.height)
                .setVisible(false)
                .setDepth(1);
            
            this.frontSprite.setData('matchingCup', color.cup);
        }
    }

    createText(x, y) {
        const textConfig = this.type === 'number' 
            ? { fontSize: '32px', color: '#FFFFFF', fontWeight: 'bold' }
            : { fontSize: '24px', color: '#ff0000', fontWeight: 'bold' };

        this.text = this.scene.add.text(x, y, this.value.toString(), textConfig)
            .setOrigin(0.5)
            .setVisible(this.type === 'assist')
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
        if (this.type !== 'number') return;
    }

    deselect() {
        if (this.type !== 'number') return;
    }

    moveTo(x, y, duration = 200) {
        const targets = [this.sprite];
        if (this.frontSprite) targets.push(this.frontSprite);
        if (this.text) targets.push(this.text);

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
        if (this.type !== 'number' || !this.frontSprite) return;

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
                    
                    this.scene.tweens.add({
                        targets: [this.frontSprite, this.text],
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
            this.description = this.scene.add.text(
                sourceSprite.x,
                sourceSprite.y - 70,
                `Card Type: ${this.type}\nValue: ${this.value}`,
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
    }
} 