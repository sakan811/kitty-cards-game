import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameState } from './models/GameState.js';

// Server configuration
const SERVER_CONFIG = {
    port: process.env.PORT || 3000,
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    }
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: SERVER_CONFIG.cors,
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 30000,
    connectionStateRecovery: {
        // the backup duration of the sessions and the packets
        maxDisconnectionDuration: 2 * 60 * 1000,
        // whether to skip middlewares upon successful recovery
        skipMiddlewares: true,
    },
    // Enable detailed debug logging
    debug: process.env.NODE_ENV === 'development'
});

// Configure rate limiter for production only
if (process.env.NODE_ENV !== 'development') {
    const limiter = rateLimit(RATE_LIMIT_CONFIG);
    app.use(limiter);
}

// Serve static files from 'dist' directory
app.use(express.static(join(__dirname, '..', 'dist')));

// Serve game assets with proper MIME types
app.use('/assets', express.static(join(__dirname, '..', 'src', 'assets'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.jpg')) {
            res.set('Content-Type', 'image/jpeg');
        } else if (path.endsWith('.png')) {
            res.set('Content-Type', 'image/png');
        }
    }
}));

// Serve index.html for all routes to support client-side routing
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

// Setup Socket.IO handlers
const setupSocketHandlers = (io) => {
    // Store active rooms
    const rooms = new Map();

    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        socket.on('createRoom', () => {
            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            const room = {
                id: roomId,
                hostId: socket.id,
                players: [{ id: socket.id, ready: false }],
                gameState: null
            };
            rooms.set(roomId, room);
            socket.join(roomId);
            socket.roomId = roomId;
            console.log(`Room created: ${roomId} by player ${socket.id}`);
            socket.emit('roomCreated', { roomId, playerId: socket.id });
        });

        socket.on('joinRoom', ({ roomId }) => {
            console.log(`Join room attempt: ${roomId} by player ${socket.id}`);
            const room = rooms.get(roomId);
            if (!room) {
                socket.emit('roomError', 'Room not found');
                return;
            }
            if (room.players.length >= 2) {
                socket.emit('roomError', 'Room is full');
                return;
            }
            
            room.players.push({ id: socket.id, ready: false });
            socket.join(roomId);
            socket.roomId = roomId;
            console.log(`Player ${socket.id} joined room ${roomId}`);
            
            // Send room data to the joining player
            socket.emit('joinedRoom', { 
                roomId, 
                playerId: socket.id,
                room: {
                    ...room,
                    players: room.players
                }
            });

            // Notify all players in the room
            io.to(roomId).emit('playerJoined', { room });
        });

        socket.on('playerReady', ({ roomId, ready }) => {
            console.log(`Player ${socket.id} ready state in room ${roomId}: ${ready}`);
            const room = rooms.get(roomId);
            if (!room) {
                socket.emit('roomError', 'Room not found');
                return;
            }

            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.ready = ready;
                io.to(roomId).emit('playerReady', { room });

                // Check if all players are ready
                const allReady = room.players.length === 2 && room.players.every(p => p.ready);
                if (allReady) {
                    // Initialize game state
                    const gameState = new GameState();
                    room.gameState = {
                        currentPlayer: room.players[Math.floor(Math.random() * 2)].id,
                        players: room.players,
                        tiles: gameState.tiles,
                        assistDeck: gameState.decks.assist,
                        numberDeck: gameState.decks.number
                    };
                    io.to(roomId).emit('gameStart', { 
                        roomId,
                        gameState: room.gameState
                    });
                }
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            if (socket.roomId) {
                const room = rooms.get(socket.roomId);
                if (room) {
                    room.players = room.players.filter(p => p.id !== socket.id);
                    if (room.players.length === 0) {
                        rooms.delete(socket.roomId);
                    } else {
                        io.to(socket.roomId).emit('playerLeft', { 
                            playerId: socket.id,
                            room: {
                                ...room,
                                players: room.players
                            }
                        });
                    }
                }
            }
        });

        socket.on('leaveRoom', () => {
            if (socket.roomId) {
                const room = rooms.get(socket.roomId);
                if (room) {
                    room.players = room.players.filter(p => p.id !== socket.id);
                    socket.leave(socket.roomId);
                    if (room.players.length === 0) {
                        rooms.delete(socket.roomId);
                    } else {
                        io.to(socket.roomId).emit('playerLeft', { 
                            playerId: socket.id,
                            room: {
                                ...room,
                                players: room.players
                            }
                        });
                    }
                }
                socket.roomId = null;
            }
        });

        socket.on('gameAction', ({ roomId, action }) => {
            if (roomId) {
                const room = rooms.get(roomId);
                if (room && room.gameState) {
                    // Update game state based on action
                    room.gameState = { ...room.gameState, ...action };
                    io.to(roomId).emit('gameUpdate', { gameState: room.gameState });
                }
            }
        });
    });
};

// Add middleware to track socket state
io.use((socket, next) => {
    console.log('Socket middleware - connection attempt:', socket.id);
    const roomId = socket.handshake.auth.roomId;
    if (roomId) {
        console.log('Socket attempting to join room:', roomId);
        socket.roomId = roomId;
    }
    next();
});

// Initialize socket handlers
setupSocketHandlers(io);

// Start server
httpServer.listen(SERVER_CONFIG.port, () => {
    console.log(`Game server running at http://localhost:${SERVER_CONFIG.port}`);
}); 