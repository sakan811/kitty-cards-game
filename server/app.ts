import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameState, Player, Room } from './models/GameState';

const app = express();
const httpServer = createServer(app);

const CORS_ORIGIN = process.env.NODE_ENV === 'production' 
    ? 'https://your-production-domain.com'
    : 'http://localhost:5173'; // Vite's default port

// Enable CORS with specific configuration
app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Initialize Socket.IO with CORS configuration
const io = new Server(httpServer, {
    cors: {
        origin: CORS_ORIGIN,
        credentials: true,
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// Store active game rooms
const gameRooms = new Map<string, Room>();

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Handle room creation
    socket.on('createRoom', async (data, callback) => {
        try {
            const roomId = generateRoomId();
            const room: Room = {
                id: roomId,
                players: new Map(),
                state: new GameState(),
                currentTurn: '',
                isGameStarted: false
            };
            
            gameRooms.set(roomId, room);
            
            // Join room
            await socket.join(roomId);
            
            // Add player to room
            const player: Player = {
                id: socket.id,
                ready: false,
                hasDrawnAssist: false,
                hasDrawnNumber: false,
                score: 0,
                hand: []
            };
            room.players.set(socket.id, player);

            // Emit state change
            io.to(roomId).emit('stateChange', {
                players: Array.from(room.players.entries()),
                currentTurn: room.currentTurn,
                isGameStarted: room.isGameStarted
            });

            callback({ success: true, roomId });
        } catch (error) {
            console.error('Error creating room:', error);
            callback({ success: false, error: 'Failed to create room' });
        }
    });

    // Handle joining room
    socket.on('joinRoom', async ({ roomId }, callback) => {
        try {
            const room = gameRooms.get(roomId);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            if (room.players.size >= 2) {
                return callback({ success: false, error: 'Room is full' });
            }

            // Join room
            await socket.join(roomId);
            
            // Add player to room
            const player: Player = {
                id: socket.id,
                ready: false,
                hasDrawnAssist: false,
                hasDrawnNumber: false,
                score: 0,
                hand: []
            };
            room.players.set(socket.id, player);

            // Emit state change
            io.to(roomId).emit('stateChange', {
                players: Array.from(room.players.entries()),
                currentTurn: room.currentTurn,
                isGameStarted: room.isGameStarted
            });

            // If room is now full, start the game
            if (room.players.size === 2) {
                room.isGameStarted = true;
                room.currentTurn = Array.from(room.players.keys())[0]; // First player starts
                
                // Notify all players in room
                io.to(roomId).emit('gameStart', {
                    firstPlayer: room.currentTurn,
                    turnOrder: Array.from(room.players.keys())
                });

                // Emit updated state
                io.to(roomId).emit('stateChange', {
                    players: Array.from(room.players.entries()),
                    currentTurn: room.currentTurn,
                    isGameStarted: room.isGameStarted
                });
            }

            callback({ success: true });
        } catch (error) {
            console.error('Error joining room:', error);
            callback({ success: false, error: 'Failed to join room' });
        }
    });

    // Handle player ready state
    socket.on('ready', async ({ roomId }, callback) => {
        console.log('Ready event received:', { roomId, socketId: socket.id });
        try {
            const room = gameRooms.get(roomId);
            if (!room) {
                console.log('Room not found:', roomId);
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Room not found' });
                }
                return;
            }

            const player = room.players.get(socket.id);
            if (!player) {
                console.log('Player not found in room:', socket.id);
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Player not found in room' });
                }
                return;
            }

            // Toggle ready state
            player.ready = !player.ready;
            room.players.set(socket.id, player);
            console.log('Player ready state updated:', { playerId: socket.id, ready: player.ready });

            // Check if all players are ready
            const allPlayersReady = Array.from(room.players.values()).every(p => p.ready);
            const shouldStartGame = room.players.size >= 2 && allPlayersReady;

            if (shouldStartGame && !room.isGameStarted) {
                room.isGameStarted = true;
                room.currentTurn = Array.from(room.players.keys())[0];
                console.log('Game starting:', { roomId, firstPlayer: room.currentTurn });

                // First emit game started event
                const gameStartMessage = {
                    firstPlayer: room.currentTurn,
                    turnOrder: Array.from(room.players.keys())
                };
                io.to(roomId).emit('gameStarted', gameStartMessage);

                // Then emit state update
                const stateUpdate = {
                    players: Array.from(room.players.entries()).map(([id, p]) => ({
                        id,
                        ready: p.ready,
                        hasDrawnAssist: p.hasDrawnAssist,
                        hasDrawnNumber: p.hasDrawnNumber,
                        score: p.score,
                        hand: p.hand
                    })),
                    currentTurn: room.currentTurn,
                    isGameStarted: true,
                    hostId: Array.from(room.players.keys())[0]
                };
                io.to(roomId).emit('stateChange', stateUpdate);

                if (typeof callback === 'function') {
                    callback({ 
                        success: true,
                        state: stateUpdate,
                        ready: player.ready,
                        gameStarted: true,
                        gameStartMessage
                    });
                }
                return;
            }

            // If game hasn't started, just send regular state update
            // Prepare state update
            const stateUpdate = {
                players: Array.from(room.players.entries()).map(([id, p]) => ({
                    id,
                    ready: p.ready,
                    hasDrawnAssist: p.hasDrawnAssist,
                    hasDrawnNumber: p.hasDrawnNumber,
                    score: p.score,
                    hand: p.hand
                })),
                currentTurn: room.currentTurn,
                isGameStarted: room.isGameStarted,
                hostId: Array.from(room.players.keys())[0] // First player is host
            };
            console.log('Emitting state update:', stateUpdate);
            io.to(roomId).emit('stateChange', stateUpdate);

            if (typeof callback === 'function') {
                callback({ 
                    success: true,
                    state: stateUpdate,
                    ready: player.ready
                });
            }
        } catch (error) {
            console.error('Error updating ready state:', error);
            if (typeof callback === 'function') {
                callback({ success: false, error: 'Failed to update ready state' });
            }
        }
    });

    // Handle leaving room
    socket.on('leaveRoom', async ({ roomId }, callback) => {
        try {
            const room = gameRooms.get(roomId);
            if (!room) {
                return callback?.({ success: false, error: 'Room not found' });
            }

            // Remove player from room
            room.players.delete(socket.id);
            await socket.leave(roomId);

            // If room is empty, delete it
            if (room.players.size === 0) {
                gameRooms.delete(roomId);
            } else {
                // Emit state change to remaining players
                io.to(roomId).emit('stateChange', {
                    players: Array.from(room.players.entries()),
                    currentTurn: room.currentTurn,
                    isGameStarted: room.isGameStarted
                });
            }

            callback?.({ success: true });
        } catch (error) {
            console.error('Error leaving room:', error);
            callback?.({ success: false, error: 'Failed to leave room' });
        }
    });

    // Handle getting available rooms
    socket.on('getRooms', async (data, callback) => {
        try {
            const rooms = Array.from(gameRooms.entries()).map(([roomId, room]) => ({
                roomId,
                players: room.players.size
            }));
            callback({ success: true, rooms });
        } catch (error) {
            console.error('Error getting rooms:', error);
            callback({ success: false, error: 'Failed to get rooms' });
        }
    });

    // Handle game actions
    socket.on('drawCard', async ({ type, timestamp }, callback) => {
        try {
            const room = findPlayerRoom(socket.id);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            if (room.currentTurn !== socket.id) {
                return callback({ success: false, error: 'Not your turn' });
            }

            const player = room.players.get(socket.id);
            if (!player) {
                return callback({ success: false, error: 'Player not found' });
            }

            // Handle card draw logic
            const card = room.state.drawCard(type);
            if (card) {
                player.hand.push(card);
                if (type === 'assist') {
                    player.hasDrawnAssist = true;
                } else {
                    player.hasDrawnNumber = true;
                }

                // Notify all players about the card draw
                io.to(room.id).emit('cardDrawn', {
                    playerId: socket.id,
                    type,
                    card
                });

                callback({ success: true, card });
            } else {
                callback({ success: false, error: 'No cards left' });
            }
        } catch (error) {
            console.error('Error drawing card:', error);
            callback({ success: false, error: 'Failed to draw card' });
        }
    });

    // Handle end turn
    socket.on('endTurn', async (data, callback) => {
        try {
            const room = findPlayerRoom(socket.id);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            if (room.currentTurn !== socket.id) {
                return callback({ success: false, error: 'Not your turn' });
            }

            // Switch turns
            const players = Array.from(room.players.keys());
            room.currentTurn = players[(players.indexOf(socket.id) + 1) % players.length];

            // Reset player's draw states
            const player = room.players.get(socket.id);
            if (player) {
                player.hasDrawnAssist = false;
                player.hasDrawnNumber = false;
            }

            // Notify all players about turn change
            io.to(room.id).emit('turnChanged', {
                currentTurn: room.currentTurn
            });

            callback({ success: true });
        } catch (error) {
            console.error('Error ending turn:', error);
            callback({ success: false, error: 'Failed to end turn' });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        // Find and leave all rooms this socket was in
        for (const [roomId, room] of gameRooms.entries()) {
            if (room.players.has(socket.id)) {
                room.players.delete(socket.id);
                
                if (room.players.size === 0) {
                    gameRooms.delete(roomId);
                } else {
                    // Emit state change to remaining players
                    io.to(roomId).emit('stateChange', {
                        players: Array.from(room.players.entries()),
                        currentTurn: room.currentTurn,
                        isGameStarted: room.isGameStarted
                    });
                }
            }
        }
    });

    // Handle ping for connection validation
    socket.on('ping', (data) => {
        socket.emit('pong', data);
    });
});

// Helper functions
function generateRoomId(): string {
    return Math.random().toString(36).substring(2, 10);
}

function findPlayerRoom(playerId: string): Room | undefined {
    for (const [_, room] of gameRooms) {
        if (room.players.has(playerId)) {
            return room;
        }
    }
    return undefined;
}

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 