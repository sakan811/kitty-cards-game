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

// Helper function to get player's room
function getPlayerRoom(socketId) {
  for (const [roomId, room] of rooms.entries()) {
    if (room.players.some(p => p.id === socketId)) {
      return { roomId, room };
    }
  }
  return null;
}

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
    const room = {
      id: roomId,
      players: [{ id: socket.id, ready: false }],
      status: 'waiting',
      hostId: socket.id,
      currentTurn: null,
      gameState: {
        tiles: null,
        selectedColors: null,
        currentPlayer: null,
        scores: {}
      }
    };
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, playerId: socket.id });
    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  // Join an existing room
  socket.on('joinRoom', (roomId) => {
    console.log(`Join room attempt for ${roomId} by ${socket.id}`);
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('roomError', 'Room does not exist');
      return;
    }
    
    if (room.players.length >= 2) {
      socket.emit('roomError', 'Room is full');
      return;
    }

    if (room.status !== 'waiting') {
      socket.emit('roomError', 'Game already in progress');
      return;
    }

    room.players.push({ id: socket.id, ready: false });
    socket.join(roomId);
    
    socket.emit('joinedRoom', {
      roomId,
      playerId: socket.id,
      players: room.players.map(p => ({ id: p.id, ready: p.ready }))
    });

    io.to(roomId).emit('playerJoined', {
      roomId,
      players: room.players.map(p => ({ id: p.id, ready: p.ready }))
    });
    
    console.log(`Player ${socket.id} joined room ${roomId}. Players:`, room.players);
  });

  // Player ready
  socket.on('playerReady', (roomId) => {
    console.log(`Player ${socket.id} ready in room ${roomId}`);
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('roomError', 'Room not found');
      return;
    }

    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      socket.emit('roomError', 'Player not in this room');
      return;
    }

    player.ready = true;
    
    // Check if all players are ready
    if (room.players.length === 2 && room.players.every(p => p.ready)) {
      room.status = 'playing';
      
      // Initialize game state
      const gameLayout = generateTileLayout();
      room.gameState = {
        tiles: gameLayout.tiles,
        selectedColors: gameLayout.selectedColors,
        currentPlayer: room.hostId,
        scores: {
          [room.players[0].id]: 0,
          [room.players[1].id]: 0
        }
      };

      // Start the game
      io.to(roomId).emit('gameStart', {
        roomId,
        players: room.players.map(p => ({ id: p.id })),
        gameState: room.gameState,
        currentTurn: room.gameState.currentPlayer
      });
      
      console.log(`Game starting in room ${roomId}`);
    } else {
      io.to(roomId).emit('playerReady', {
        roomId,
        players: room.players.map(p => ({ id: p.id, ready: p.ready }))
      });
    }
  });

  // Handle game actions
  socket.on('gameAction', ({ roomId, action, data }) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'playing') return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // Validate turn
    if (room.gameState.currentPlayer !== socket.id) {
      socket.emit('gameError', 'Not your turn');
      return;
    }

    // Process the action
    switch (action) {
      case 'playCard':
        if (data.tileIndex >= 0 && data.tileIndex < room.gameState.tiles.length) {
          const tile = room.gameState.tiles[data.tileIndex];
          if (!tile.hasNumber) {
            tile.hasNumber = true;
            tile.number = data.cardValue;
            // Update score if needed
            if (tile.hasCup) {
              room.gameState.scores[socket.id] += data.cardValue;
            }
          }
        }
        break;
      
      case 'drawCard':
        // Handle card drawing
        break;
    }

    // Broadcast the updated game state
    io.to(roomId).emit('gameUpdate', { 
      roomId,
      playerId: socket.id, 
      action, 
      data,
      gameState: room.gameState
    });

    // Switch turns
    room.gameState.currentPlayer = room.players.find(p => p.id !== socket.id).id;
    io.to(roomId).emit('turnUpdate', {
      roomId,
      currentPlayer: room.gameState.currentPlayer
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const playerRoom = getPlayerRoom(socket.id);
    if (playerRoom) {
      const { roomId, room } = playerRoom;
      room.players = room.players.filter(p => p.id !== socket.id);
      
      if (room.players.length === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted - no players remaining`);
      } else {
        room.status = 'ended';
        io.to(roomId).emit('playerLeft', {
          roomId,
          players: room.players.map(p => ({ id: p.id, ready: p.ready }))
        });
        console.log(`Player ${socket.id} left room ${roomId}`);
      }
    }
  });
});

// Helper function to generate tile layout
function generateTileLayout() {
  const tileIndices = Array.from({length: 8}, (_, i) => i).sort(() => Math.random() - 0.5);
  const cupColors = ['cup-purple', 'cup-red', 'cup-green', 'cup-brown'];
  const selectedColors = [...cupColors].sort(() => Math.random() - 0.5);
  
  return {
    tileIndices,
    selectedColors,
    tiles: tileIndices.map((index, position) => ({
      position,
      hasCup: index < 4,
      cupColor: index < 4 ? selectedColors[index] : 'cup-white',
      hasNumber: false,
      number: null
    }))
  };
}

// Handle client-side routing for Phaser
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'src', 'index.html'));
});

httpServer.listen(port, () => {
  console.log(`Game server running at http://localhost:${port}`);
}); 