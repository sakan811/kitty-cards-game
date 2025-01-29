import { ASSET_KEYS } from '../config/constants.js';

export class Tile {
    constructor(scene, x, y, size, assetKey) {
        this.scene = scene;
        this.size = size;
        this.score = 0;
        this.hasNumber = false;
        this.createVisual(x, y, assetKey || ASSET_KEYS.cupWhite);
    }

    createVisual(x, y, assetKey) {
        console.log('Creating tile with asset key:', assetKey);
        if (!this.scene.textures.exists(assetKey)) {
            console.error('Missing texture for asset key:', assetKey);
            assetKey = ASSET_KEYS.cupWhite; // Fallback to white cup
        }
        
        this.sprite = this.scene.add.image(x, y, assetKey)
            .setDisplaySize(this.size, this.size)
            .setOrigin(0.5, 0.5)
            .setInteractive()
            .setData('hasCup', true)
            .setData('score', 0);

        this.scoreText = null;
    }

    setNumber(value) {
        if (this.hasNumber) return;
        
        this.hasNumber = true;
        const points = parseInt(value);
        if (!isNaN(points)) {
            this.updateScore(points);
        }
    }

    applyCard(card) {
        if (this.hasNumber || !card) return false;

        const cardValue = parseInt(card.value);
        if (isNaN(cardValue)) return false;

        const cupColor = this.sprite.texture.key;
        let points = cardValue;

        // Calculate points based on color matching
        if (cupColor === ASSET_KEYS.cupWhite) {
            points = cardValue;
        } else if (card.frontSprite?.getData('matchingCup') === cupColor) {
            points = cardValue * 2;
        } else {
            points = 0;
        }

        this.hasNumber = true;
        this.updateScore(points);
        this.animateScoreUpdate();
        
        // Destroy the card after applying it
        if (card.description) {
            card.lower(); // This will clear the description text
        }
        card.destroy();
        return true;
    }

    updateScore(points) {
        this.score += points;
        this.sprite.setData('score', this.score);

        if (!this.scoreText) {
            this.scoreText = this.scene.add.text(
                this.sprite.x,
                this.sprite.y - this.size/2 - 10,
                this.score.toString(),
                {
                    fontSize: '24px',
                    color: '#000000',
                    backgroundColor: '#ffffff',
                    padding: { x: 5, y: 2 }
                }
            )
            .setOrigin(0.5)
            .setDepth(1000);
        } else {
            this.scoreText.setText(this.score.toString());
        }
    }

    animateScoreUpdate() {
        const originalScale = this.sprite.scale;
        this.scene.tweens.add({
            targets: this.sprite,
            scaleX: originalScale * 0.9,
            scaleY: originalScale * 0.9,
            duration: 100,
            yoyo: true,
            ease: 'Power2',
            onComplete: () => {
                this.sprite.setScale(originalScale);
            }
        });
    }

    removeNumber() {
        if (!this.hasNumber) return;

        // Animate the score text disappearing
        if (this.scoreText) {
            this.scene.tweens.add({
                targets: this.scoreText,
                alpha: 0,
                y: this.scoreText.y - 20,
                duration: 200,
                onComplete: () => {
                    this.scoreText.destroy();
                    this.scoreText = null;
                }
            });
        }

        // Reset tile properties
        this.hasNumber = false;
        this.score = 0;
        this.sprite.setData('score', 0);

        // Shake effect
        this.scene.tweens.add({
            targets: this.sprite,
            x: this.sprite.x + 5,
            duration: 50,
            yoyo: true,
            repeat: 2,
            ease: 'Power2'
        });
    }

    destroy() {
        if (this.sprite?.active) this.sprite.destroy();
        if (this.scoreText?.active) this.scoreText.destroy();
    }
} 