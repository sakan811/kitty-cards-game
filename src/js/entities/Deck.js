import { DECK_VALUES, CARD_DIMENSIONS } from '../config/constants.js';
import { Card } from './Card.js';

export class Deck {
    constructor(scene, x, y, type) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.type = type;
        this.cards = this.createCards();
        this.createVisual();
    }

    createCards() {
        const values = DECK_VALUES[this.type];
        const pairs = 2; // Each value appears twice
        return Phaser.Utils.Array.Shuffle(Array(pairs).fill(values).flat());
    }

    createVisual() {
        const texture = this.type === 'number' ? 'number-card' : 'assist-card';
        this.visual = this.scene.add.image(this.x, this.y, texture)
            .setDisplaySize(CARD_DIMENSIONS.width, CARD_DIMENSIONS.height)
            .setInteractive();

        // Add deck label
        const label = `${this.type.charAt(0).toUpperCase() + this.type.slice(1)} Deck`;
        this.label = this.scene.add.text(this.x, this.y + 90, label, {
            fontSize: '20px',
            color: '#000',
            align: 'center'
        }).setOrigin(0.5);
    }

    drawCard() {
        if (this.cards.length === 0) {
            this.showEmptyDeckWarning();
            return null;
        }

        const value = this.cards.pop();
        return new Card(this.scene, this.x, this.y, this.type, value);
    }

    showEmptyDeckWarning() {
        this.scene.showWarning('Deck is empty!');
    }

    destroy() {
        if (this.visual?.active) this.visual.destroy();
        if (this.label?.active) this.label.destroy();
    }
} 