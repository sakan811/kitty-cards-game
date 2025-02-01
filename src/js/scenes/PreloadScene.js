export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        // Create loading bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width/4, height/2 - 30, width/2, 50);
        
        const loadingText = this.add.text(width/2, height/2 - 50, 'Loading...', {
            font: '20px monospace',
            fill: '#ffffff'
        });
        loadingText.setOrigin(0.5, 0.5);
        
        // Loading progress events
        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0x00ff00, 1);
            progressBar.fillRect(width/4 + 10, height/2 - 20, (width/2 - 20) * value, 30);
        });
        
        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
        });

        // Load card images
        this.load.image('number-card-back', 'assets/images/cards/number-card-back.jpeg');
        this.load.image('assist-card-back', 'assets/images/cards/assist-card-back.jpeg');

        // Load cup images
        this.load.image('cup-purple', 'assets/images/cups/cup-purple.jpg');
        this.load.image('cup-red', 'assets/images/cups/cup-red.jpg');
        this.load.image('cup-green', 'assets/images/cups/cup-green.jpg');
        this.load.image('cup-brown', 'assets/images/cups/cup-brown.jpg');
        this.load.image('cup-white', 'assets/images/cups/cup-white.jpeg');
    }

    create() {
        this.scene.start('LobbyScene');
    }
} 