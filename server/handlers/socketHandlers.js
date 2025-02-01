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
        socket.on('joinRoom', (roomId) => handleJoinRoom(socket, io, roomId));
        socket.on('playerReady', (roomId) => handlePlayerReady(socket, io, roomId));
        socket.on('gameAction', ({ roomId, action, data }) => handleGameAction(socket, io, roomId, action, data));
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
        gameState: sanitizeGameState(gameState, socket.id)
    });
}

function handleJoinRoom(socket, io, roomId) {
    try {
        const room = rooms.get(roomId);
        if (!room) {
            throw new Error('Room does not exist');
        }

        room.addPlayer(socket.id);
        socket.join(roomId);

        const gameState = gameStates.get(roomId);
        gameState.initializePlayer(socket.id);

        socket.emit('joinedRoom', {
            roomId,
            playerId: socket.id,
            room: sanitizeRoom(room)
        });

        io.to(roomId).emit('playerJoined', {
            roomId,
            room: sanitizeRoom(room)
        });

    } catch (error) {
        socket.emit('roomError', error.message);
    }
}

function handlePlayerReady(socket, io, roomId) {
    try {
        const room = rooms.get(roomId);
        if (!room) {
            throw new Error('Room not found');
        }

        room.setPlayerReady(socket.id);
        io.to(roomId).emit('playerReady', {
            roomId,
            room: sanitizeRoom(room)
        });

        if (room.areAllPlayersReady()) {
            room.startGame();
            const gameState = gameStates.get(roomId);
            gameState.setPlayerOrder(room.getPlayerIds());

            io.to(roomId).emit('gameStart', {
                roomId,
                gameState: sanitizeGameState(gameState, room.hostId)
            });
        }

    } catch (error) {
        socket.emit('roomError', error.message);
    }
}

function handleGameAction(socket, io, roomId, action, data) {
    const gameState = gameStates.get(roomId);
    if (!gameState) {
        socket.emit('gameError', 'Invalid game state');
        return;
    }

    switch (action) {
        case 'drawCard':
            handleDrawCard(socket, io, gameState, roomId, data);
            break;
        case 'playCard':
            handlePlayCard(socket, io, gameState, roomId, data);
            break;
        default:
            socket.emit('gameError', 'Invalid action');
    }
}

function handleDrawCard(socket, io, gameState, roomId, data) {
    const validation = validateCardDraw(gameState, socket.id, data);
    if (!validation.valid) {
        socket.emit('gameError', validation.error);
        return;
    }

    const deck = gameState.decks[data.deckType];
    const drawnCard = deck.pop();
    gameState.addCardToHand(socket.id, drawnCard);

    const playerState = gameState.players.get(socket.id);
    if (data.deckType === 'assist') {
        playerState.hasDrawnAssist = true;
        gameState.turnState = 'number_phase';
    } else {
        playerState.hasDrawnNumber = true;
        gameState.nextTurn();
    }

    io.to(roomId).emit('gameUpdate', {
        type: 'cardDraw',
        gameState: sanitizeGameState(gameState, socket.id)
    });
}

function handlePlayCard(socket, io, gameState, roomId, data) {
    const validation = validateCardPlay(gameState, socket.id, data);
    if (!validation.valid) {
        socket.emit('gameError', validation.error);
        return;
    }

    const playedCard = gameState.removeCardFromHand(socket.id, validation.cardIndex);
    if (playedCard) {
        gameState.tiles.tiles[data.tileIndex].hasNumber = true;
        gameState.tiles.tiles[data.tileIndex].number = playedCard.value;
        gameState.discardPile.push(playedCard);

        io.to(roomId).emit('gameUpdate', {
            type: 'cardPlay',
            gameState: sanitizeGameState(gameState, socket.id)
        });
    }
}

function handleDisconnect(socket, io) {
    for (const [roomId, room] of rooms.entries()) {
        if (room.players.some(p => p.id === socket.id)) {
            room.removePlayer(socket.id);
            
            if (room.players.length === 0) {
                rooms.delete(roomId);
                gameStates.delete(roomId);
            } else {
                io.to(roomId).emit('playerLeft', {
                    roomId,
                    room: sanitizeRoom(room)
                });
            }
            break;
        }
    }
} 