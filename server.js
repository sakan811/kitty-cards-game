import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Game rooms storage
const rooms = new Map();

// Configure rate limiter for production only
if (process.env.NODE_ENV !== 'development') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
  });
  
  // Apply rate limiter to all routes
  app.use(limiter);
}

// Serve static files from 'src' directory
app.use(express.static(join(__dirname, 'src'), {
  setHeaders: (res, path) => {
    // Set proper MIME types for JavaScript modules
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    // Enable CORS for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create a new room
  socket.on('createRoom', () => {
    const roomId = uuidv4();
    rooms.set(roomId, {
      id: roomId,
      players: [{ id: socket.id, ready: false }],
      gameState: null
    });
    socket.join(roomId);
    socket.emit('roomCreated', roomId);
  });

  // Join an existing room
  socket.on('joinRoom', (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.players.length < 2) {
      room.players.push({ id: socket.id, ready: false });
      socket.join(roomId);
      socket.emit('joinedRoom', roomId);
      io.to(roomId).emit('playerJoined', room.players);
    } else {
      socket.emit('roomError', 'Room is full or does not exist');
    }
  });

  // Player ready
  socket.on('playerReady', (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.ready = true;
        if (room.players.every(p => p.ready)) {
          io.to(roomId).emit('gameStart');
        }
      }
    }
  });

  // Handle game actions
  socket.on('gameAction', ({ roomId, action, data }) => {
    io.to(roomId).emit('gameUpdate', { playerId: socket.id, action, data });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('playerLeft', room.players);
        }
      }
    });
  });
});

// Handle client-side routing for Phaser
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'src', 'index.html'));
});

httpServer.listen(port, () => {
  console.log(`Game server running at http://localhost:${port}`);
}); 