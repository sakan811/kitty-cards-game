import { Scene } from 'phaser';

export default class LobbyScene extends Scene {
    constructor() {
        super({ key: 'LobbyScene' });
    }

    init(data?: { error?: string; message?: string }): void {
        if (data?.error) {
            console.error('Lobby error:', data.error);
        }
        if (data?.message) {
            console.log('Lobby message:', data.message);
        }
    }

    create(): void {
        // Create a simple text to show we're in the lobby
        const text = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            'Returning to lobby...',
            {
                fontSize: '32px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 20, y: 10 }
            }
        ).setOrigin(0.5);

        // After a short delay, redirect to the React lobby component
        this.time.delayedCall(1000, () => {
            // Use window.location to navigate back to the lobby route
            window.location.href = '/lobby';
        });
    }
} 