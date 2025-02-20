import { Room, Client } from "@colyseus/core";
import { GameState, Player, Card, Tile, CupColor } from "../models/GameState";

interface DrawCardMessage {
    type: 'assist' | 'number';
}

export class GameRoom extends Room<GameState> {
    maxClients = 2;

    onCreate(options: any): void {
        console.log("GameRoom created!", options);

        // Initialize room state
        this.setState(new GameState());

        // Register message handlers
        this.onMessage("ready", (client, message) => this.handlePlayerReady(client, message));
        this.onMessage("drawCard", (client, message: DrawCardMessage) => this.handleDrawCard(client, message));
        this.onMessage("playCard", (client, message) => this.handlePlayCard(client, message));
        this.onMessage("endTurn", (client) => this.handleEndTurn(client));
    }

    onJoin(client: Client, options?: any): void {
        console.log("Client joined!", client.sessionId);

        // Create new player instance
        const player = new Player();
        player.id = client.sessionId;
        
        // Add player to game state
        this.state.players.set(client.sessionId, player);

        // If we have 2 players, lock the room
        if (this.state.players.size === 2) {
            this.lock();
        }
    }

    onLeave(client: Client, consented: boolean): void {
        console.log("Client left!", client.sessionId);
        
        // Remove player from game state
        this.state.players.delete(client.sessionId);

        // End game if a player leaves
        this.state.gameEnded = true;
        this.broadcast("gameEnded", { reason: "Player left" });
    }

    handlePlayerReady(client: Client, message: any): void {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        // Toggle ready state
        player.ready = !player.ready;

        // Check if all players are ready
        const allReady = Array.from(this.state.players.values()).every(p => p.ready);
        if (allReady && this.state.players.size === 2) {
            this.startGame();
        }
    }

    startGame(): void {
        // Initialize game state
        this.state.gameStarted = true;
        this.state.gameEnded = false;
        
        // Set random turn order and get first player
        const firstPlayer = this.state.setRandomTurnOrder();
        
        // Reset all player states
        this.state.players.forEach(player => {
            player.hasDrawnAssist = false;
            player.hasDrawnNumber = false;
            player.score = 0;
            player.hand.length = 0;
        });

        // Set initial game state
        this.state.turnState = 'assist_phase';
        
        // Notify all clients about game start and turn order
        this.broadcast("gameStarted", {
            firstPlayer,
            turnOrder: Array.from(this.state.turnOrder)
        });
    }

    handleDrawCard(client: Client, message: DrawCardMessage): void {
        try {
            // Validate client connection and session
            if (!client.sessionId || !this.state.players.has(client.sessionId)) {
                client.send("drawRejected", { error: "Invalid client connection" });
                return;
            }

            // Basic turn validation
            if (client.sessionId !== this.state.currentPlayer) {
                client.send("drawRejected", { error: "Not your turn" });
                return;
            }

            const player = this.state.players.get(client.sessionId);
            if (!player) {
                client.send("drawRejected", { error: "Player not found" });
                return;
            }

            const { type } = message;

            // Validate draw phase and conditions
            if (type === 'assist') {
                if (player.hasDrawnAssist) {
                    client.send("drawRejected", { error: "Already drawn assist card" });
                    return;
                }
                if (this.state.assistDeck.length === 0) {
                    client.send("drawRejected", { error: "Assist deck is empty" });
                    return;
                }
            } else if (type === 'number') {
                if (!player.hasDrawnAssist) {
                    client.send("drawRejected", { error: "Must draw assist card first" });
                    return;
                }
                if (player.hasDrawnNumber) {
                    client.send("drawRejected", { error: "Already drawn number card" });
                    return;
                }
                if (this.state.numberDeck.length === 0) {
                    client.send("drawRejected", { error: "Number deck is empty" });
                    return;
                }
            }

            // Draw card and update state atomically
            try {
                let card: Card | undefined;
                
                // Get the top card from appropriate deck
                if (type === 'assist') {
                    card = this.state.assistDeck[0]; // Peek at top card without removing
                    if (card) {
                        // Update player state first
                        player.hasDrawnAssist = true;
                        player.hand.push(card);
                        // Then remove from deck
                        this.state.assistDeck.shift();
                    }
                } else if (type === 'number') {
                    card = this.state.numberDeck[0]; // Peek at top card without removing
                    if (card) {
                        // Update player state first
                        player.hasDrawnNumber = true;
                        player.hand.push(card);
                        // Then remove from deck
                        this.state.numberDeck.shift();
                    }
                }

                if (!card) {
                    client.send("drawRejected", { error: `Failed to draw ${type} card` });
                    return;
                }

                // Update player state
                this.state.players.set(client.sessionId, player);

                // Send success response to drawing player
                client.send("drawValidated", {
                    type,
                    card,
                    deckCount: type === 'assist' ? this.state.assistDeck.length : this.state.numberDeck.length
                });

                // Notify other players about the draw (without card details)
                this.broadcast("playerDrewCard", {
                    playerId: client.sessionId,
                    type,
                    deckCount: type === 'assist' ? this.state.assistDeck.length : this.state.numberDeck.length
                }, { except: client });

                // Broadcast updated game state
                this.broadcast("gameState", this.state);

            } catch (error) {
                console.error('Error processing card draw:', error);
                client.send("drawRejected", { error: "Failed to process card draw" });
                
                // Attempt to rollback any partial state changes
                if (player.hasDrawnAssist && type === 'assist') {
                    player.hasDrawnAssist = false;
                    const card = player.hand.pop();
                    if (card) this.state.assistDeck.unshift(card);
                } else if (player.hasDrawnNumber && type === 'number') {
                    player.hasDrawnNumber = false;
                    const card = player.hand.pop();
                    if (card) this.state.numberDeck.unshift(card);
                }
            }

        } catch (error) {
            console.error('Error in handleDrawCard:', error);
            client.send("drawRejected", { error: "Internal server error during card draw" });
        }
    }

    handlePlayCard(client: Client, message: { cardIndex: number, tileIndex: number }): void {
        if (client.sessionId !== this.state.currentPlayer) return;

        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        const { cardIndex, tileIndex } = message;
        const card = player.hand[cardIndex];
        const tile = this.state.tiles[tileIndex];

        if (!card || !tile || tile.hasNumber) return;

        // Remove card from hand
        player.hand.splice(cardIndex, 1);

        if (card.type === 'number') {
            // Place number on tile
            tile.hasNumber = true;
            tile.number = card.value;

            // Calculate and update score
            const score = this.state.calculateScore(card, tile.cupColor as CupColor);
            player.score += score;
        }

        // Add card to discard pile
        this.state.discardPile.push(card);
    }

    handleEndTurn(client: Client): void {
        if (client.sessionId !== this.state.currentPlayer) return;

        const player = this.state.players.get(client.sessionId);
        if (!player || !player.hasDrawnAssist || !player.hasDrawnNumber) return;

        // Reset player's turn state
        player.hasDrawnAssist = false;
        player.hasDrawnNumber = false;

        // Get next player from turn order
        const nextPlayer = this.state.getNextPlayer();
        this.state.currentPlayer = nextPlayer;
        this.state.turnState = 'assist_phase';

        // Broadcast turn change
        this.broadcast("turnChanged", {
            previousPlayer: client.sessionId,
            currentPlayer: nextPlayer,
            turnNumber: this.state.currentTurn
        });

        // Check if game has ended
        const allTilesOccupied = this.state.tiles.every((tile, index) => 
            index === 8 || tile.hasNumber
        );

        if (allTilesOccupied) {
            this.state.gameEnded = true;
            this.broadcast("gameEnded", {
                reason: "Game completed",
                scores: Object.fromEntries(
                    Array.from(this.state.players.entries())
                        .map(([id, p]) => [id, p.score])
                ),
                finalTurnOrder: Array.from(this.state.turnOrder)
            });
        }
    }
} 