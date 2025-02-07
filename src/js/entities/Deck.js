import { CARD_DIMENSIONS, ASSET_KEYS } from '../config/constants.js';
import { Card } from './Card.js';

export class Deck extends Phaser.GameObjects.Container {
    constructor(scene, x, y, type) {
        super(scene, x, y);
        scene.add.existing(this);
        
        this.type = type;
        this.isAnimating = false;
        this.baseScale = 0.5;
        
        this.createVisual();
        this.setupInteraction();
    }

    createVisual() {
        // Create deck sprite with shadow effect
        const shadow = this.scene.add.sprite(2, 2, this.type === 'number' ? ASSET_KEYS.numberCard : ASSET_KEYS.assistCard)
            .setDisplaySize(CARD_DIMENSIONS.width * this.baseScale, CARD_DIMENSIONS.height * this.baseScale)
            .setTint(0x000000)
            .setAlpha(0.3);

        this.visual = this.scene.add.sprite(0, 0, this.type === 'number' ? ASSET_KEYS.numberCard : ASSET_KEYS.assistCard)
            .setDisplaySize(CARD_DIMENSIONS.width * this.baseScale, CARD_DIMENSIONS.height * this.baseScale);

        // Add stacked card effect
        for (let i = 1; i <= 3; i++) {
            const stackedCard = this.scene.add.sprite(-i, -i, this.type === 'number' ? ASSET_KEYS.numberCard : ASSET_KEYS.assistCard)
                .setDisplaySize(CARD_DIMENSIONS.width * this.baseScale, CARD_DIMENSIONS.height * this.baseScale)
                .setDepth(-i);
        }

        // Add all elements to container
        this.add([shadow, this.visual]);
        this.setDepth(1);
    }

    setupInteraction() {
        this.setInteractive({ 
            hitArea: new Phaser.Geom.Rectangle(
                -CARD_DIMENSIONS.width * this.baseScale / 2,
                -CARD_DIMENSIONS.height * this.baseScale / 2,
                CARD_DIMENSIONS.width * this.baseScale,
                CARD_DIMENSIONS.height * this.baseScale
            ),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            useHandCursor: true
        });

        this.on('pointerdown', () => {
            if (!this.isAnimating) {
                this.handleDraw();
            }
        });

        this.on('pointerover', () => {
            if (!this.isAnimating) {
                this.scene.tweens.add({
                    targets: this,
                    scaleX: 1.1,
                    scaleY: 1.1,
                    y: this.y - 5,
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
                    y: this.y + 5,
                    duration: 200,
                    ease: 'Power2'
                });
            }
        });
    }

    async handleDraw() {
        if (this.isAnimating) {
            console.log('Deck is already animating, ignoring draw request');
            return;
        }
        
        console.log('Starting draw animation');
        this.isAnimating = true;

        try {
            // Shake deck effect
            await new Promise(resolve => {
                this.scene.tweens.add({
                    targets: this,
                    x: this.x - 2,
                    yoyo: true,
                    duration: 50,
                    repeat: 2,
                    onComplete: resolve
                });
            });

            // Request card draw from server
            console.log('Shake animation complete, requesting card from server');
            this.scene.socketManager.drawCard(this.type);

        } catch (error) {
            console.error('Error during draw animation:', error);
        } finally {
            // Re-enable interaction after a delay
            this.scene.time.delayedCall(500, () => {
                console.log('Re-enabling deck interaction');
                this.isAnimating = false;
            });
        }
    }

    async animateCardToHand(cardData) {
        if (!cardData) {
            console.error('No card data provided for animation');
            return;
        }

        console.log('Starting card animation to hand:', cardData);
        
        // Create the card and add it to the scene
        const card = new Card(
            this.scene,
            this.x,
            this.y,
            cardData.type || this.type,
            cardData.value
        );
        
        // Set initial scale and make sure card is visible
        card.setScale(this.baseScale);
        card.setVisible(true);
        card.setActive(true);
        
        // Get hand position
        const handPosition = this.scene.hand?.getNextCardPosition();
        if (!handPosition) {
            console.error('Could not get hand position');
            card.destroy();
            return;
        }

        console.log('Animating card to position:', handPosition);

        // Calculate control points for bezier curve
        const controlPoint1 = {
            x: this.x + (handPosition.x - this.x) * 0.25,
            y: Math.min(this.y, handPosition.y) - 100
        };

        const controlPoint2 = {
            x: this.x + (handPosition.x - this.x) * 0.75,
            y: Math.min(this.y, handPosition.y) - 50
        };

        // Make sure the card is above other elements during animation
        card.setDepth(1000);

        // Animate card along bezier curve
        return new Promise((resolve, reject) => {
            try {
                this.scene.tweens.add({
                    targets: card,
                    x: {
                        value: handPosition.x,
                        duration: 500,
                        ease: (t) => {
                            const mt = 1 - t;
                            return (mt * mt * mt * this.x) +
                                   (3 * mt * mt * t * controlPoint1.x) +
                                   (3 * mt * t * t * controlPoint2.x) +
                                   (t * t * t * handPosition.x);
                        }
                    },
                    y: {
                        value: handPosition.y,
                        duration: 500,
                        ease: (t) => {
                            const mt = 1 - t;
                            return (mt * mt * mt * this.y) +
                                   (3 * mt * mt * t * controlPoint1.y) +
                                   (3 * mt * t * t * controlPoint2.y) +
                                   (t * t * t * handPosition.y);
                        }
                    },
                    scale: 1,
                    angle: 360,
                    onComplete: async () => {
                        try {
                            console.log('Card animation complete, adding to hand');
                            if (this.scene.hand) {
                                await this.scene.hand.addCard(card);
                                console.log('Card successfully added to hand');
                            } else {
                                throw new Error('Hand not found in scene');
                            }
                            resolve();
                        } catch (error) {
                            console.error('Error in animation completion:', error);
                            card.destroy();
                            reject(error);
                        }
                    }
                });
            } catch (error) {
                console.error('Error setting up card animation:', error);
                card.destroy();
                reject(error);
            }
        });
    }

    destroy() {
        super.destroy();
    }
} 
