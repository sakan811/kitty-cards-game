export class LobbyUI {
    constructor(scene) {
        this.scene = scene;
        this.mainContainer = scene.add.container(0, 0);
        this.waitingContainer = scene.add.container(0, 0);
        this.waitingContainer.setVisible(false);
        this.statusText = null;
        this.readyButton = null;
        this.roomInput = null;
    }

    createMainMenu() {
        // Add background
        const bg = this.scene.add.rectangle(0, 0, 800, 600, 0xf0f0f0).setOrigin(0);
        this.mainContainer.add(bg);

        // Title
        const title = this.scene.add.text(400, 100, 'Kitty Cards Game Lobby', {
            fontSize: '32px',
            color: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.mainContainer.add(title);

        this._createCreateRoomButton();
        this._createJoinRoomSection();

        return this.mainContainer;
    }

    _createCreateRoomButton() {
        const createButton = this.scene.add.rectangle(400, 250, 200, 50, 0x4CAF50);
        const createText = this.scene.add.text(400, 250, 'Create Room', {
            fontSize: '24px',
            color: '#fff'
        }).setOrigin(0.5);

        createButton.setInteractive({ useHandCursor: true });
        createText.setInteractive({ useHandCursor: true });

        [createButton, createText].forEach(element => {
            element.on('pointerdown', () => this.scene.handleCreateRoom());
            element.on('pointerover', () => createButton.setAlpha(0.8));
            element.on('pointerout', () => createButton.setAlpha(1));
        });

        this.mainContainer.add([createButton, createText]);
    }

    _createJoinRoomSection() {
        const joinTitle = this.scene.add.text(400, 350, 'Join Room', {
            fontSize: '24px',
            color: '#000'
        }).setOrigin(0.5);
        this.mainContainer.add(joinTitle);

        // Create input element
        const inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.placeholder = 'Enter Room Code';
        inputElement.style.width = '200px';
        inputElement.style.height = '30px';
        inputElement.style.textAlign = 'center';
        inputElement.style.fontSize = '18px';

        this.roomInput = this.scene.add.dom(400, 400, inputElement);
        this.mainContainer.add(this.roomInput);

        // Join button
        const joinButton = this.scene.add.rectangle(400, 450, 200, 50, 0x2196F3);
        const joinText = this.scene.add.text(400, 450, 'Join Room', {
            fontSize: '24px',
            color: '#fff'
        }).setOrigin(0.5);

        [joinButton, joinText].forEach(element => {
            element.setInteractive({ useHandCursor: true });
            element.on('pointerdown', () => {
                const roomId = this.roomInput.node.value.trim();
                if (roomId) {
                    this.scene.handleJoinRoom(roomId);
                } else {
                    this.scene.showError('Please enter a room code');
                }
            });
            element.on('pointerover', () => joinButton.setAlpha(0.8));
            element.on('pointerout', () => joinButton.setAlpha(1));
        });

        this.mainContainer.add([joinButton, joinText]);

        // Add Enter key handler
        inputElement.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                const roomId = this.roomInput.node.value.trim();
                if (roomId) {
                    this.scene.handleJoinRoom(roomId);
                } else {
                    this.scene.showError('Please enter a room code');
                }
            }
        });
    }

    showWaitingRoom(roomId, players, playerId) {
        this.mainContainer.setVisible(false);
        this.waitingContainer.setVisible(true);
        this.waitingContainer.removeAll();

        // Background
        const bg = this.scene.add.rectangle(0, 0, 800, 600, 0xf0f0f0).setOrigin(0);
        this.waitingContainer.add(bg);

        // Room code section
        const titleText = this.scene.add.text(400, 100, `Room Code: ${roomId}`, {
            fontSize: '24px',
            color: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.waitingContainer.add(titleText);

        this._createPlayerStatusSection(players, playerId);
        this._createReadyButton();

        return this.waitingContainer;
    }

    _createPlayerStatusSection(players, playerId) {
        const statusContainer = this.scene.add.container(400, 300);
        
        const playersHeader = this.scene.add.text(0, -60, 'Players:', {
            fontSize: '24px',
            color: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        const myStatusBox = this.scene.add.rectangle(-100, 0, 180, 80, 0xffffff);
        const opponentStatusBox = this.scene.add.rectangle(100, 0, 180, 80, 0xffffff);
        
        this.statusText = {
            playerStatus: this.scene.add.text(-100, 0, 'Not Ready', {
                fontSize: '20px',
                color: '#ff0000'
            }).setOrigin(0.5),
            opponentStatus: this.scene.add.text(100, 0, 'Waiting...', {
                fontSize: '20px',
                color: '#666666'
            }).setOrigin(0.5)
        };

        statusContainer.add([
            playersHeader,
            myStatusBox,
            opponentStatusBox,
            this.statusText.playerStatus,
            this.statusText.opponentStatus
        ]);

        this.waitingContainer.add(statusContainer);
        this.updatePlayerStatus(players, playerId);
    }

    _createReadyButton() {
        this.readyButton = this.scene.add.rectangle(400, 400, 200, 50, 0x4CAF50);
        const readyText = this.scene.add.text(400, 400, 'Ready', {
            fontSize: '24px',
            color: '#fff'
        }).setOrigin(0.5);

        this.readyButton.setInteractive({ useHandCursor: true });
        readyText.setInteractive({ useHandCursor: true });

        [this.readyButton, readyText].forEach(element => {
            element.on('pointerdown', () => this.scene.handleReady());
        });

        this.waitingContainer.add([this.readyButton, readyText]);
    }

    updatePlayerStatus(players, playerId) {
        if (!this.statusText) return;

        const myPlayer = players.find(p => p.id === playerId);
        const otherPlayer = players.find(p => p.id !== playerId);

        if (myPlayer) {
            this.statusText.playerStatus
                .setText(myPlayer.ready ? 'Ready' : 'Not Ready')
                .setStyle({ color: myPlayer.ready ? '#00aa00' : '#ff0000' });
            
            if (myPlayer.ready && this.readyButton) {
                this.readyButton.setFillStyle(0x666666);
                this.readyButton.disableInteractive();
            }
        }

        if (otherPlayer) {
            this.statusText.opponentStatus
                .setText(otherPlayer.ready ? 'Ready' : 'Not Ready')
                .setStyle({ color: otherPlayer.ready ? '#00aa00' : '#ff0000' });
        } else {
            this.statusText.opponentStatus
                .setText('Waiting...')
                .setStyle({ color: '#666666' });
        }
    }

    showCopyableCode(roomId) {
        const codeInput = document.createElement('input');
        codeInput.type = 'text';
        codeInput.value = roomId;
        codeInput.readOnly = true;
        codeInput.style.width = '200px';
        codeInput.style.height = '40px';
        codeInput.style.textAlign = 'center';
        codeInput.style.fontSize = '24px';
        codeInput.style.backgroundColor = '#4CAF50';
        codeInput.style.color = 'white';
        codeInput.style.border = 'none';
        codeInput.style.borderRadius = '5px';
        codeInput.style.cursor = 'pointer';

        codeInput.onclick = () => {
            codeInput.select();
            document.execCommand('copy');
            this.scene.showMessage('Room code copied!');
        };

        const codeElement = this.scene.add.dom(400, 150, codeInput);
        const instructionText = this.scene.add.text(400, 200, 'Click the code to copy it!', {
            fontSize: '18px',
            color: '#666'
        }).setOrigin(0.5);

        this.waitingContainer.add([codeElement, instructionText]);
    }
} 