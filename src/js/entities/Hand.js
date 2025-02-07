import { HAND_CONFIG, CARD_DIMENSIONS } from '../config/constants.js';
import { Card } from './Card.js';

export class Hand extends Phaser.GameObjects.Container {
    constructor(scene, x, y, width) {
        super(scene, x, y);
        scene.add.existing(this);
        
        this.width = width;
        this.cards = [];
        this.isAnimating = false;
        
        this.createVisual();
        this.setupDropZone();
    }

    createVisual() {
        // Create hand area
        this.area = this.scene.add.rectangle(
            this.width/2,
            HAND_CONFIG.height/2,
            this.width,
            HAND_CONFIG.height,
            0xf0f0f0
        )
        .setStrokeStyle(2, 0x000000)
        .setAlpha(0.5);

        // Add label
        this.label = this.scene.add.text(
            this.width/2,
            -10,
            'Your Hand',
            {
                fontSize: '20px',
                color: '#000000',
                fontFamily: 'Arial'
            }
        ).setOrigin(0.5);

        this.add([this.area, this.label]);
    }

    setupDropZone() {
        this.dropZone = this.scene.add.zone(
            this.width/2,
            HAND_CONFIG.height/2,
            this.width,
            HAND_CONFIG.height
        ).setRectangleDropZone(this.width, HAND_CONFIG.height);

        // Visual feedback for drop zone
        const graphics = this.scene.add.graphics();
        graphics.lineStyle(2, 0x00ff00);
        graphics.strokeRect(
            this.dropZone.x - this.dropZone.input.hitArea.width/2,
            this.dropZone.y - this.dropZone.input.hitArea.height/2,
            this.dropZone.input.hitArea.width,
            this.dropZone.input.hitArea.height
        );
        graphics.setAlpha(0);  // Hide by default
        
        this.dropZone.on('pointerover', () => graphics.setAlpha(0.3));
        this.dropZone.on('pointerout', () => graphics.setAlpha(0));
        
        this.add(graphics);
    }

    async addCard(card) {
        console.log('Adding card to hand:', card);
        
        if (this.cards.length >= HAND_CONFIG.maxCards) {
            console.warn('Hand is full, cannot add more cards');
            this.showFullHandWarning();
            card.destroy();
            return;
        }

        // Check for duplicates
        const isDuplicate = this.cards.some(existingCard => 
            existingCard.type === card.type && 
            existingCard.value === card.value
        );

        if (!isDuplicate) {
            // Add card to our array first
            this.cards.push(card);
            
            // Make sure card is in the right container
            if (card.parentContainer !== this) {
                this.add(card);
            }
            
            const pos = this.getCardPosition(this.cards.length - 1);
            console.log('Card position in hand:', pos);
            
            try {
                // Animate card entry
                await this.animateCardEntry(card, pos.x, pos.y);
                console.log('Card entry animation complete');
                
                // Flip the card
                await card.flip();
                console.log('Card flip complete');
                
                // Rearrange all cards
                await this.rearrangeCards(true);
                console.log('Cards rearranged');
                
                // Update depths after all animations
                this.updateCardDepths();
            } catch (error) {
                console.error('Error during card animations:', error);
                // If any animation fails, make sure card is still visible and in position
                card.setPosition(pos.x, pos.y);
                card.setVisible(true);
            }
        } else {
            console.log('Duplicate card found, destroying');
            card.destroy();
        }
    }

    async animateCardEntry(card, targetX, targetY) {
        // Start from above the hand
        card.setPosition(targetX, targetY - 200);
        
        // Add bounce effect
        return new Promise(resolve => {
            this.scene.tweens.add({
                targets: card,
                y: targetY,
                duration: 500,
                ease: 'Bounce.easeOut',
                onComplete: resolve
            });
        });
    }

    getCardPosition(index) {
        const totalCards = this.cards.length;
        const maxSpacing = (this.width - CARD_DIMENSIONS.width) / (HAND_CONFIG.maxCards - 1);
        const spacing = Math.min(maxSpacing, CARD_DIMENSIONS.width * 1.1);
        
        // Calculate total width of cards with spacing
        const totalWidth = (totalCards - 1) * spacing + CARD_DIMENSIONS.width;
        const startX = (this.width - totalWidth) / 2;
        
        return {
            x: startX + (index * spacing) + (CARD_DIMENSIONS.width / 2),
            y: HAND_CONFIG.height / 2
        };
    }

    async removeCard(card) {
        const index = this.cards.indexOf(card);
        if (index > -1) {
            // Animate card removal
            await this.animateCardRemoval(card);
            this.cards.splice(index, 1);
            await this.rearrangeCards(true);
        }
    }

    async animateCardRemoval(card) {
        return new Promise(resolve => {
            this.scene.tweens.add({
                targets: card,
                y: '-=200',
                alpha: 0,
                duration: 300,
                ease: 'Power2',
                onComplete: () => {
                    card.destroy();
                    resolve();
                }
            });
        });
    }

    async rearrangeCards(animate = false) {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const promises = this.cards.map((card, index) => {
            const pos = this.getCardPosition(index);
            if (animate) {
                return card.moveTo(pos.x, pos.y);
            } else {
                card.setPosition(pos.x, pos.y);
                return Promise.resolve();
            }
        });

        await Promise.all(promises);
        this.isAnimating = false;
        this.updateCardDepths();
    }

    updateCardDepths() {
        this.cards.forEach((card, index) => {
            card.setDepth(index + 10);  // Base depth of 10 for cards
        });
    }

    showFullHandWarning() {
        const warningText = this.scene.add.text(
            this.scene.scale.width/2,
            this.scene.scale.height/2,
            'Hand is full!',
            {
                fontSize: '24px',
                color: '#ff0000',
                backgroundColor: '#ffffff',
                padding: { x: 10, y: 5 },
                fontFamily: 'Arial'
            }
        ).setOrigin(0.5)
         .setDepth(1000);  // Ensure it's above other elements

        // Add warning animation
        this.scene.tweens.add({
            targets: warningText,
            y: '-=50',
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => warningText.destroy()
        });
    }

    getNextCardPosition() {
        return this.getCardPosition(this.cards.length);
    }

    destroy() {
        this.cards.forEach(card => card.destroy());
        super.destroy();
    }

    render(cards) {
        // Clear existing cards
        this.cards.forEach(card => card.destroy());
        this.cards = [];

        // Add new cards
        if (Array.isArray(cards)) {
            cards.forEach((cardData, index) => {
                const position = this.getCardPosition(index);
                const card = new Card(
                    this.scene, 
                    position.x, 
                    position.y, 
                    cardData.type || cardData.cardType,
                    cardData.value || cardData.cardValue
                );
                this.cards.push(card);
                
                // Flip the card since it's in the player's hand
                card.flip();
            });
        }

        this.updateCardDepths();
    }
} 