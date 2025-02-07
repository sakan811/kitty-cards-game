import { v4 as uuidv4 } from 'uuid';
import { Room } from '../models/Room.js';
import { GameState } from '../models/GameState.js';
import { sanitizeGameState, sanitizeRoom } from '../utils/sanitizer.js';
import { validateCardDraw, validateCardPlay } from '../utils/validation.js';

// Storage
const rooms = new Map();
const gameStates = new Map();

export function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        socket.on('createRoom', () => handleCreateRoom(socket, io));
        socket.on('joinRoom', (payload) => handleJoinRoom(socket, io, payload));
        socket.on('playerReady', (payload) => handlePlayerReady(socket, io, payload));
        socket.on('gameAction', ({ roomId, action, data }) => handleGameAction(socket, io, roomId, action, data));
        socket.on('exitRoom', (roomId) => handleExitRoom(socket, io, roomId));
        socket.on('disconnect', () => handleDisconnect(socket, io));
    });
}

function handleCreateRoom(socket, io) {
    const roomId = uuidv4();
    const room = new Room(roomId, socket.id);
    rooms.set(roomId, room);

    const gameState = new GameState();
    gameState.initializePlayer(socket.id);
    gameStates.set(roomId, gameState);

    socket.join(roomId);
    socket.emit('roomCreated', {
        roomId,
        playerId: socket.id,
        players: [{ id: socket.id }],
        gameState: sanitizeGameState(gameState, socket.id)
    });
}

function handleExitRoom(socket, io, roomId) {
    try {
        const room = rooms.get(roomId);
        if (!room) return;

        room.removePlayer(socket.id);
        socket.leave(roomId);

        if (room.players.length === 0) {
            rooms.delete(roomId);
            gameStates.delete(roomId);
        } else {
            io.to(roomId).emit('playerLeft', {
                roomId,
                room: sanitizeRoom(room)
            });
            
            // End game if a player leaves
            const gameState = gameStates.get(roomId);
            if (gameState) {
                gameState.gameEnded = true;
                io.to(roomId).emit('gameEnded', {
                    reason: 'player_left',
                    gameState: sanitizeGameState(gameState)
                });
            }
        }

    } catch (error) {
        socket.emit('roomError', error.message);
    }
}

function handlePlayerReady(socket, io, payload) {
    try {
        const { roomId, ready } = typeof payload === 'object' ? payload : { roomId: payload, ready: true };
        
        const room = rooms.get(roomId);
        if (!room) {
            throw new Error('Room not found');
        }

        room.setPlayerReady(socket.id, ready);
        io.to(roomId).emit('playerReady', {
            roomId,
            players: room.players.map(p => ({ id: p.id, ready: p.ready })),
            room: sanitizeRoom(room)
        });

        if (room.areAllPlayersReady()) {
            room.startGame();
            const gameState = gameStates.get(roomId);
            gameState.setPlayerOrder(room.getPlayerIds());

            io.to(roomId).emit('gameStart', {
                roomId,
                players: room.players.map(p => ({ id: p.id })),
                gameState: sanitizeGameState(gameState, room.hostId)
            });
        }

    } catch (error) {
        console.error('Player ready error:', error);
        socket.emit('roomError', error.message);
    }
}

function handleGameAction(socket, io, roomId, action, data) {
    const gameState = gameStates.get(roomId);
    if (!gameState) {
        socket.emit('gameError', 'Invalid game state');
        return;
    }

    if (gameState.gameEnded) {
        socket.emit('gameError', 'Game has ended');
        return;
    }

    switch (action) {
        case 'drawCard':
            handleDrawCard(socket, io, gameState, roomId, data);
            break;
        case 'playCard':
            handlePlayCard(socket, io, gameState, roomId, data);
            break;
        case 'endTurn':
            handleEndTurn(socket, io, gameState, roomId);
            break;
        default:
            socket.emit('gameError', 'Invalid action');
    }
}

function handleDrawCard(socket, io, gameState, roomId, data) {
    try {
        if (gameState.currentPlayer !== socket.id) {
            socket.emit('gameError', 'Not your turn');
            return;
        }

        const validation = validateCardDraw(gameState, socket.id, data);
        if (!validation.valid) {
            socket.emit('gameError', validation.error);
            return;
        }

        const deck = gameState.decks[data.deckType];
        if (!deck || deck.length === 0) {
            socket.emit('gameError', 'Deck is empty');
            return;
        }

        const drawnCard = deck.pop();
        const player = gameState.players.get(socket.id);
        
        // Add card to player's hand
        gameState.addCardToHand(socket.id, drawnCard);

        // Update game state based on card type
        if (data.deckType === 'assist') {
            if (player.hasDrawnAssist) {
                socket.emit('gameError', 'Already drawn an assist card this turn');
                return;
            }
            player.hasDrawnAssist = true;
            gameState.turnState = 'number_phase';
        } else if (data.deckType === 'number') {
            if (player.hasDrawnNumber) {
                socket.emit('gameError', 'Already drawn a number card this turn');
                return;
            }
            if (!player.hasDrawnAssist) {
                socket.emit('gameError', 'Must draw assist card first');
                return;
            }
            player.hasDrawnNumber = true;
        }

        // Emit updates to all players
        io.to(roomId).emit('gameUpdate', {
            type: 'cardDraw',
            data: {
                playerId: socket.id,
                deckType: data.deckType,
                cardsRemaining: deck.length,
                drawnCard: socket.id === gameState.currentPlayer ? drawnCard : null
            },
            gameState: sanitizeGameState(gameState, socket.id)
        });

    } catch (error) {
        console.error('Error in handleDrawCard:', error);
        socket.emit('gameError', 'Failed to draw card');
    }
}

function handlePlayCard(socket, io, gameState, roomId, data) {
    try {
        if (gameState.currentPlayer !== socket.id) {
            socket.emit('gameError', 'Not your turn');
            return;
        }

        const validation = validateCardPlay(gameState, socket.id, data);
        if (!validation.valid) {
            socket.emit('gameError', validation.error);
            return;
        }

        const player = gameState.players.get(socket.id);
        if (!player.hasDrawnAssist || !player.hasDrawnNumber) {
            socket.emit('gameError', 'Must draw both cards first');
            return;
        }

        const playedCard = gameState.removeCardFromHand(socket.id, data.cardIndex);
        if (playedCard) {
            const tile = gameState.tiles.tiles[data.tileIndex];
            
            // Calculate score
            const score = gameState.calculateScore(playedCard, tile.cupColor);
            const currentScore = gameState.scores.get(socket.id) || 0;
            gameState.scores.set(socket.id, currentScore + score);
            
            // Update tile
            tile.hasNumber = true;
            tile.number = playedCard.value;
            gameState.discardPile.push(playedCard);

            io.to(roomId).emit('gameUpdate', {
                type: 'cardPlay',
                data: {
                    playerId: socket.id,
                    tileIndex: data.tileIndex,
                    card: playedCard,
                    score
                },
                gameState: sanitizeGameState(gameState, socket.id)
            });

            // Check if game has ended
            if (gameState.gameEnded) {
                io.to(roomId).emit('gameEnded', {
                    reason: 'game_complete',
                    scores: Object.fromEntries(gameState.scores),
                    gameState: sanitizeGameState(gameState)
                });
            }
        }
    } catch (error) {
        console.error('Error in handlePlayCard:', error);
        socket.emit('gameError', 'Failed to play card');
    }
}

function handleEndTurn(socket, io, gameState, roomId) {
    try {
        if (gameState.currentPlayer !== socket.id) {
            socket.emit('gameError', 'Not your turn');
            return;
        }

        const player = gameState.players.get(socket.id);
        if (!player.hasDrawnAssist || !player.hasDrawnNumber) {
            socket.emit('gameError', 'Must draw both cards before ending turn');
            return;
        }

        gameState.nextTurn();
        io.to(roomId).emit('gameUpdate', {
            type: 'turnEnd',
            data: {
                nextPlayer: gameState.currentPlayer
            },
            gameState: sanitizeGameState(gameState)
        });

    } catch (error) {
        console.error('Error in handleEndTurn:', error);
        socket.emit('gameError', 'Failed to end turn');
    }
}

function handleJoinRoom(socket, io, payload) {
    try {
        const { roomId } = payload;
        console.log(`Player ${socket.id} attempting to join room ${roomId}`);
        
        const room = rooms.get(roomId);
        if (!room) {
            throw new Error('Room not found');
        }

        if (room.players.length >= 2) {
            throw new Error('Room is full');
        }

        // Add player to room
        room.addPlayer(socket.id);
        socket.join(roomId);

        // Initialize player in game state
        const gameState = gameStates.get(roomId);
        if (gameState) {
            gameState.initializePlayer(socket.id);
        }

        // Create sanitized room data
        const sanitizedRoom = {
            id: room.id,
            hostId: room.hostId,
            players: room.players.map(p => ({ id: p.id, ready: p.ready })),
            gameStarted: room.gameStarted
        };

        // Notify all players in room
        io.to(roomId).emit('playerJoined', {
            roomId,
            room: sanitizedRoom
        });

        // Send success response to joining player
        socket.emit('joinedRoom', {
            roomId,
            playerId: socket.id,
            room: sanitizedRoom,
            gameState: gameState ? sanitizeGameState(gameState, socket.id) : null
        });

    } catch (error) {
        console.error('Join room error:', error);
        socket.emit('roomError', error.message);
    }
}

function handleDisconnect(socket, io) {
    for (const [roomId, room] of rooms.entries()) {
        if (room.players.some(p => p.id === socket.id)) {
            handleExitRoom(socket, io, roomId);
            break;
        }
    }
} 