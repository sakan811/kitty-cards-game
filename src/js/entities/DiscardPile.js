import { CARD_DIMENSIONS } from '../config/constants.js';

export class DiscardPile {
    constructor(scene, x, y) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.cards = [];
        this.cardSprites = []; // Keep track of visible card sprites
        this.createVisual();
    }

    createVisual() {
        // Create discard pile area
        this.area = this.scene.add.rectangle(
            this.x,
            this.y,
            CARD_DIMENSIONS.width + 10,
            CARD_DIMENSIONS.height + 10,
            0x666666,
            0.3
        )
        .setStrokeStyle(2, 0x333333)
        .setDepth(0);

        // Add label
        this.label = this.scene.add.text(
            this.x,
            this.y - (CARD_DIMENSIONS.height / 2) - 25,
            'Discard Pile',
            {
                fontSize: '16px',
                color: '#000000'
            }
        ).setOrigin(0.5);

        // Add count display
        this.countText = this.scene.add.text(
            this.x,
            this.y + (CARD_DIMENSIONS.height / 2) + 15,
            'Cards: 0',
            {
                fontSize: '14px',
                color: '#666666'
            }
        ).setOrigin(0.5);
    }

    addCard(card) {
        // Calculate slight offset for visual stacking
        const offsetX = Math.random() * 4 - 2; // Random offset between -2 and 2
        const offsetY = Math.random() * 4 - 2;

        // Move card to discard pile position with offset
        card.moveTo(this.x + offsetX, this.y + offsetY).then(() => {
            // Store card info
            this.cards.push({
                type: card.type,
                value: card.value
            });

            // Store the visible elements
            const cardVisuals = {
                sprite: card.frontSprite, // Always use frontSprite since cards are flipped
                text: card.text,
                border: card.border
            };

            if (cardVisuals.sprite) {
                this.cardSprites.push(cardVisuals);

                // Set proper depth for stacking appearance
                const depth = 10 + this.cardSprites.length;
                cardVisuals.sprite.setDepth(depth);
                if (cardVisuals.text?.active) cardVisuals.text.setDepth(depth + 1);
                if (cardVisuals.border?.active) cardVisuals.border.setDepth(depth + 1);

                // Clean up the back sprite if it still exists
                if (card.sprite?.active) {
                    card.sprite.destroy();
                }
            }
            
            // Maintain only the last few visible cards to prevent memory issues
            while (this.cardSprites.length > 5) {
                const oldCard = this.cardSprites.shift();
                if (oldCard.sprite?.active) oldCard.sprite.destroy();
                if (oldCard.text?.active) oldCard.text.destroy();
                if (oldCard.border?.active) oldCard.border.destroy();
            }
            
            // Update count display
            this.updateCount();
        });
    }

    updateCount() {
        this.countText.setText(`Cards: ${this.cards.length}`);
    }

    getTopCard() {
        return this.cards[this.cards.length - 1];
    }

    destroy() {
        // Clean up all card sprites
        this.cardSprites.forEach(card => {
            if (card.sprite?.active) card.sprite.destroy();
            if (card.text?.active) card.text.destroy();
            if (card.border?.active) card.border.destroy();
        });

        if (this.area?.active) this.area.destroy();
        if (this.label?.active) this.label.destroy();
        if (this.countText?.active) this.countText.destroy();
    }
} 