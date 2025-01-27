export class Tile {
    constructor(scene, x, y, size, color) {
        this.scene = scene;
        this.size = size;
        this.score = 0;
        this.hasNumber = false;
        this.createVisual(x, y, color);
    }

    createVisual(x, y, color) {
        this.sprite = this.scene.add.image(x, y, color)
            .setDisplaySize(this.size, this.size)
            .setOrigin(0.5, 0.5)
            .setInteractive()
            .setData('hasCup', true)
            .setData('score', 0);

        this.scoreText = null;
    }

    applyCard(card) {
        if (this.hasNumber || !card) return false;

        const cardValue = parseInt(card.value);
        if (isNaN(cardValue)) return false;

        const cupColor = this.sprite.texture.key;
        let points = cardValue;

        // Calculate points based on color matching
        if (cupColor === 'cup-white') {
            points = cardValue;
        } else if (card.frontSprite?.getData('matchingCup') === cupColor) {
            points = cardValue * 2;
        } else {
            points = 0;
        }

        this.hasNumber = true;
        this.updateScore(points);
        this.animateScoreUpdate();
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

    destroy() {
        if (this.sprite?.active) this.sprite.destroy();
        if (this.scoreText?.active) this.scoreText.destroy();
    }
} 