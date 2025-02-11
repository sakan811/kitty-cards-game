import { Room } from "@colyseus/core";
import { GameState, Player } from "../models/GameState.js";

export class GameRoom extends Room {
    maxClients = 2;

    onCreate(options) {
        console.log("GameRoom created!", options);

        // Initialize room state
        this.setState(new GameState());

        // Register message handlers
        this.onMessage("ready", (client, message) => this.handlePlayerReady(client, message));
        this.onMessage("drawCard", (client, message) => this.handleDrawCard(client, message));
        this.onMessage("playCard", (client, message) => this.handlePlayCard(client, message));
        this.onMessage("endTurn", (client) => this.handleEndTurn(client));
    }

    onJoin(client, options) {
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

    onLeave(client, consented) {
        console.log("Client left!", client.sessionId);
        
        // Remove player from game state
        this.state.players.delete(client.sessionId);

        // End game if a player leaves
        this.state.gameEnded = true;
        this.broadcast("gameEnded", { reason: "Player left" });
    }

    handlePlayerReady(client, message) {
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

    startGame() {
        // Randomly choose first player
        const players = Array.from(this.state.players.keys());
        this.state.currentPlayer = players[Math.floor(Math.random() * players.length)];
        
        // Initialize game state
        this.state.turnState = 'assist_phase';
        this.broadcast("gameStarted", {
            firstPlayer: this.state.currentPlayer
        });
    }

    handleDrawCard(client, message) {
        if (client.sessionId !== this.state.currentPlayer) return;

        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        const { cardType } = message;
        let card;

        if (cardType === 'assist' && !player.hasDrawnAssist) {
            card = this.state.assistDeck.shift();
            if (card) {
                player.hasDrawnAssist = true;
                player.hand.push(card);
            }
        } else if (cardType === 'number' && player.hasDrawnAssist && !player.hasDrawnNumber) {
            card = this.state.numberDeck.shift();
            if (card) {
                player.hasDrawnNumber = true;
                player.hand.push(card);
            }
        }
    }

    handlePlayCard(client, message) {
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
            const score = this.state.calculateScore(card, tile.cupColor);
            player.score += score;
        }

        // Add card to discard pile
        this.state.discardPile.push(card);
    }

    handleEndTurn(client) {
        if (client.sessionId !== this.state.currentPlayer) return;

        const player = this.state.players.get(client.sessionId);
        if (!player || !player.hasDrawnAssist || !player.hasDrawnNumber) return;

        // Reset player's turn state
        player.hasDrawnAssist = false;
        player.hasDrawnNumber = false;

        // Move to next player
        const players = Array.from(this.state.players.keys());
        const currentIndex = players.indexOf(this.state.currentPlayer);
        this.state.currentPlayer = players[(currentIndex + 1) % players.length];
        this.state.turnState = 'assist_phase';

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
                )
            });
        }
    }
} 