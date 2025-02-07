// Import assets
import numberCardBack from '../../assets/images/cards/number-card-back.jpeg';
import assistCardBack from '../../assets/images/cards/assist-card-back.jpeg';
import cupPurple from '../../assets/images/cups/cup-purple.jpg';
import cupRed from '../../assets/images/cups/cup-red.jpg';
import cupGreen from '../../assets/images/cups/cup-green.jpg';
import cupBrown from '../../assets/images/cups/cup-brown.jpg';
import cupWhite from '../../assets/images/cups/cup-white.jpeg';

export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        // Create loading bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const progressBox = this.add.graphics();
        const progressBar = this.add.graphics();
        
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 4, height / 2 - 30, width / 2, 50);
        
        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        // Add comprehensive error handling
        this.load.on('loaderror', (fileObj) => {
            console.error('Error loading asset:', fileObj.key, 'from path:', fileObj.src);
            loadingText.setText(`Error loading: ${fileObj.key}`);
        });

        this.load.on('filecomplete', (key) => {
            console.log('Successfully loaded:', key);
        });

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0x00ff00, 1);
            progressBar.fillRect(width / 4 + 10, height / 2 - 20, (width / 2 - 20) * value, 30);
            loadingText.setText(`Loading... ${Math.round(value * 100)}%`);
        });

        this.load.on('complete', () => {
            console.log('All assets loaded');
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
        });

        // Load card back images with imported assets
        this.load.image('number-card-back', numberCardBack);
        this.load.image('assist-card-back', assistCardBack);

        // Load cup images with imported assets
        this.load.image('cup-purple', cupPurple);
        this.load.image('cup-red', cupRed);
        this.load.image('cup-green', cupGreen);
        this.load.image('cup-brown', cupBrown);
        this.load.image('cup-white', cupWhite);
    }

    create() {
        // Add a delay to ensure all assets are properly loaded
        this.time.delayedCall(100, () => {
            // Verify assets loaded correctly before proceeding
            if (!this.textures.exists('number-card-back') || 
                !this.textures.exists('assist-card-back') ||
                !this.textures.exists('cup-purple') ||
                !this.textures.exists('cup-red') ||
                !this.textures.exists('cup-green') ||
                !this.textures.exists('cup-brown') ||
                !this.textures.exists('cup-white')) {
                console.error('Some required assets failed to load');
                // Show error message to the user
                this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 
                    'Error loading game assets.\nPlease refresh the page.', {
                        fontSize: '24px',
                        fill: '#ff0000',
                        align: 'center'
                    }).setOrigin(0.5);
                return;
            }

            this.scene.start('LobbyScene');
        });
    }
} 