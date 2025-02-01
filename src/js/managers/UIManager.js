export class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.pointsText = null;
        this.turnText = null;
    }

    createUIElements() {
        this.createScoreDisplay();
        this.createTurnIndicator();
    }

    createScoreDisplay() {
        this.pointsText = this.scene.add.text(
            this.scene.scale.width - 20,
            20,
            `Total Points: ${this.scene.gameState.scores[this.scene.playerId] || 0}`,
            {
                fontSize: '24px',
                color: '#000000',
                backgroundColor: '#ffffff',
                padding: { x: 10, y: 5 }
            }
        )
        .setOrigin(1, 0)
        .setDepth(1000);
    }

    createTurnIndicator() {
        this.turnText = this.scene.add.text(
            20,
            20,
            '',
            {
                fontSize: '24px',
                color: '#000000',
                backgroundColor: '#ffffff',
                padding: { x: 10, y: 5 }
            }
        )
        .setOrigin(0, 0)
        .setDepth(1000);

        this.updateTurnIndicator();
    }

    updateTurnIndicator() {
        if (!this.turnText) return;
        
        this.turnText.setText(this.scene.isPlayerTurn ? 'Your Turn' : "Opponent's Turn");
        this.turnText.setBackgroundColor(this.scene.isPlayerTurn ? '#90EE90' : '#FFB6C1');
    }

    updateScore(score) {
        if (this.pointsText) {
            this.pointsText.setText(`Total Points: ${score}`);
        }
    }

    showWarning(message) {
        const warningText = this.scene.add.text(
            this.scene.scale.width/2,
            this.scene.scale.height/2,
            message,
            {
                fontSize: '24px',
                color: '#ff0000',
                backgroundColor: '#ffffff',
                padding: { x: 10, y: 5 }
            }
        ).setOrigin(0.5);
        
        this.scene.time.delayedCall(1000, () => warningText.destroy());
    }

    showErrorMessage(message) {
        const errorText = this.scene.add.text(
            this.scene.scale.width/2,
            100,
            message,
            {
                fontSize: '24px',
                fill: '#ff0000',
                backgroundColor: '#ffffff',
                padding: { x: 10, y: 5 }
            }
        )
        .setOrigin(0.5)
        .setDepth(1000);

        this.scene.tweens.add({
            targets: errorText,
            alpha: 0,
            duration: 2000,
            onComplete: () => errorText.destroy()
        });
    }

    showGameOver(message) {
        this.scene.disableAllInteractions();
        
        const gameOverText = this.scene.add.text(
            this.scene.scale.width/2,
            this.scene.scale.height/2,
            message,
            {
                fontSize: '32px',
                fill: '#000000',
                backgroundColor: '#ffffff',
                padding: { x: 20, y: 10 }
            }
        ).setOrigin(0.5);
    }
} 