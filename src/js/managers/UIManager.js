export class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.messageTimeout = null;
        this.uiElements = {
            turnIndicator: null,
            phaseIndicator: null,
            messageText: null,
            endTurnButton: null,
            exitButton: null,
            scoreText: null
        };
    }

    createUIElements() {
        this.createTopUI();
        this.createBottomUI();
        this.createMessageArea();
        this.updateUI(); // Initial UI update
    }

    createTopUI() {
        const gameWidth = this.scene.game.config.width;
        
        // Create turn indicator at top left
        this.uiElements.turnIndicator = this.scene.add.text(10, 10, '', {
            fontSize: '24px',
            fill: '#ff0000',
            stroke: '#000000',
            strokeThickness: 2
        });

        // Create phase indicator below turn indicator
        this.uiElements.phaseIndicator = this.scene.add.text(10, 40, '', {
            fontSize: '20px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        });

        // Create score text at top right
        this.uiElements.scoreText = this.scene.add.text(
            gameWidth - 10, 
            10, 
            'Score: 0', 
            {
                fontSize: '24px',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }
        ).setOrigin(1, 0);

        this.updateTurnIndicator();
        this.updatePhaseIndicator();
    }

    createBottomUI() {
        const buttonStyle = {
            fontSize: '20px',
            backgroundColor: '#4a5568',
            padding: { x: 20, y: 10 },
            fixedWidth: 150,
            align: 'center',
            color: '#ffffff'
        };

        // Create end turn button
        this.uiElements.endTurnButton = this.scene.add.text(
            this.scene.game.config.width - 160,
            this.scene.game.config.height - 50,
            'End Turn',
            buttonStyle
        )
        .setInteractive({ useHandCursor: true })
        .on('pointerover', function() {
            this.setStyle({ color: '#00ff00' });
        })
        .on('pointerout', function() {
            this.setStyle({ color: '#ffffff' });
        })
        .on('pointerdown', () => {
            if (this.scene.turnManager) {
                this.scene.turnManager.onEndTurnClick();
            }
        })
        .setOrigin(1, 0.5);

        // Create exit button
        this.uiElements.exitButton = this.scene.add.text(
            10,
            this.scene.game.config.height - 50,
            'Exit Game',
            buttonStyle
        )
        .setInteractive({ useHandCursor: true })
        .on('pointerover', function() {
            this.setStyle({ color: '#ff0000' });
        })
        .on('pointerout', function() {
            this.setStyle({ color: '#ffffff' });
        })
        .on('pointerdown', () => {
            if (this.scene.turnManager) {
                this.scene.turnManager.onExitClick();
            }
        })
        .setOrigin(0, 0.5);

        // Initially disable buttons until game state is ready
        this.disableButtons();
    }

    createMessageArea() {
        // Create message text in the middle top area
        this.uiElements.messageText = this.scene.add.text(
            this.scene.game.config.width / 2,
            80,
            '',
            {
                fontSize: '24px',
                fill: '#ffffff',
                backgroundColor: '#00000080',
                padding: { x: 10, y: 5 }
            }
        )
        .setOrigin(0.5)
        .setDepth(100)
        .setVisible(false);
    }

    showMessage(message, duration = 2000) {
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
        }

        const messageText = this.uiElements.messageText;
        messageText.setText(message);
        messageText.setAlpha(1);

        this.messageTimeout = setTimeout(() => {
            messageText.setAlpha(0);
        }, duration);
    }

    updateTurnIndicator() {
        if (!this.uiElements.turnIndicator) return;
        
        const text = this.scene.isPlayerTurn ? 'Your Turn' : 'Opponent\'s Turn';
        const color = this.scene.isPlayerTurn ? '#00ff00' : '#ff0000';
        this.uiElements.turnIndicator.setText(text).setColor(color);
    }

    updatePhaseIndicator() {
        if (!this.uiElements.phaseIndicator) return;

        let phaseText = '';
        switch (this.scene.currentPhase) {
            case 'assist_phase':
                phaseText = 'Draw Assist Card';
                break;
            case 'number_phase':
                phaseText = 'Draw Number Card';
                break;
            default:
                phaseText = 'Play Card';
        }
        this.uiElements.phaseIndicator.setText(phaseText);
    }

    updateActionButtons() {
        if (!this.uiElements.endTurnButton) return;

        const canEndTurn = this.scene.isPlayerTurn && 
                          this.scene.hasDrawnAssist && 
                          this.scene.hasDrawnNumber;

        this.uiElements.endTurnButton
            .setAlpha(canEndTurn ? 1 : 0.5)
            .setInteractive(canEndTurn);
    }

    showScoreAnimation(playerId, score) {
        const isCurrentPlayer = playerId === this.scene.playerId;
        const x = isCurrentPlayer ? 100 : this.scene.game.config.width - 100;
        const y = this.scene.game.config.height / 2;

        const scoreText = this.scene.add.text(x, y, `+${score}`, {
            fontSize: '48px',
            fill: '#00ff00',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.scene.tweens.add({
            targets: scoreText,
            y: y - 100,
            alpha: 0,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => scoreText.destroy()
        });
    }

    showGameEndedMessage(message, scores) {
        const overlay = this.scene.add.rectangle(
            0, 0,
            this.scene.game.config.width,
            this.scene.game.config.height,
            0x000000, 0.7
        ).setOrigin(0);

        const content = this.scene.add.container(
            this.scene.game.config.width / 2,
            this.scene.game.config.height / 2
        );

        const messageText = this.scene.add.text(0, -50, message, {
            fontSize: '32px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        let scoresText = '';
        if (scores) {
            scoresText = Object.entries(scores)
                .map(([id, score]) => `${id === this.scene.playerId ? 'You' : 'Opponent'}: ${score}`)
                .join('\n');
        }

        const scoreDisplay = this.scene.add.text(0, 0, scoresText, {
            fontSize: '24px',
            fill: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        content.add([messageText, scoreDisplay]);
    }

    enableButtons() {
        Object.values(this.uiElements).forEach(element => {
            if (element?.input) {
                element.input.enabled = true;
                element.setAlpha(1);
            }
        });
    }

    disableButtons() {
        Object.values(this.uiElements).forEach(element => {
            if (element?.input) {
                element.input.enabled = false;
                element.setAlpha(0.5);
            }
        });
    }

    cleanup() {
        // Clear any pending timeouts
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
            this.messageTimeout = null;
        }

        // Destroy all UI elements
        Object.values(this.uiElements).forEach(element => {
            if (element) {
                if (element.input) {
                    element.removeInteractive();
                }
                element.destroy();
            }
        });

        // Reset UI elements object
        this.uiElements = {
            turnIndicator: null,
            phaseIndicator: null,
            messageText: null,
            endTurnButton: null,
            exitButton: null,
            scoreText: null
        };
    }

    updateUI() {
        this.updateTurnIndicator();
        this.updatePhaseIndicator();
        this.updateActionButtons();
    }
} 