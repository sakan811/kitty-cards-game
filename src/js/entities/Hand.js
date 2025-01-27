import { HAND_CONFIG, CARD_DIMENSIONS } from '../config/constants.js';

export class Hand {
    constructor(scene, x, y, width) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.width = width;
        this.cards = [];
        this.createVisual();
    }

    createVisual() {
        // Create hand area
        this.area = this.scene.add.rectangle(
            this.x + this.width/2,
            this.y + HAND_CONFIG.height/2,
            this.width,
            HAND_CONFIG.height,
            0xf0f0f0
        )
        .setStrokeStyle(2, 0x000000)
        .setAlpha(0.5);

        // Add label
        this.label = this.scene.add.text(
            this.x + this.width/2,
            this.y - 10,
            'Your Hand',
            {
                fontSize: '20px',
                color: '#000000'
            }
        ).setOrigin(0.5);
    }

    addCard(card) {
        if (this.cards.length >= HAND_CONFIG.maxCards) {
            this.showFullHandWarning();
            return false;
        }

        this.cards.push(card);
        const position = this.getCardPosition(this.cards.length - 1);
        card.moveTo(position.x, position.y);
        this.updateCardDepths();
        return true;
    }

    getCardPosition(index) {
        const totalSpacing = this.width - (HAND_CONFIG.maxCards * CARD_DIMENSIONS.width);
        const spacingBetween = totalSpacing / (HAND_CONFIG.maxCards - 1);
        return {
            x: this.x + (CARD_DIMENSIONS.width / 2) + (index * (CARD_DIMENSIONS.width + spacingBetween)),
            y: this.y + (HAND_CONFIG.height / 2)
        };
    }

    removeCard(card) {
        const index = this.cards.indexOf(card);
        if (index > -1) {
            this.cards.splice(index, 1);
            this.rearrangeCards();
        }
    }

    rearrangeCards() {
        this.cards.forEach((card, index) => {
            const position = this.getCardPosition(index);
            card.moveTo(position.x, position.y);
        });
        this.updateCardDepths();
    }

    updateCardDepths() {
        this.cards.forEach((card, index) => {
            const baseDepth = (index + 1) * 10;
            if (card.sprite) card.sprite.setDepth(baseDepth);
            if (card.frontSprite) card.frontSprite.setDepth(baseDepth);
            if (card.text) card.text.setDepth(baseDepth + 1);
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
                padding: { x: 10, y: 5 }
            }
        ).setOrigin(0.5);

        this.scene.time.delayedCall(1000, () => warningText.destroy());
    }

    destroy() {
        this.cards.forEach(card => card.destroy());
        if (this.area?.active) this.area.destroy();
        if (this.label?.active) this.label.destroy();
    }
} 