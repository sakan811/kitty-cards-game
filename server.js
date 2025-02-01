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

// Add new game state structure
const gameStates = new Map();

// Add this above generateAssistDeck function
const ASSIST_CARDS = [
  { type: 'assist', value: 'Bye Bye', effect: 'remove_all_numbers' },
  { type: 'assist', value: 'Swap', effect: 'swap_tiles' },
  { type: 'assist', value: 'Double', effect: 'double_points' },
  { type: 'assist', value: 'Shield', effect: 'block_opponent' },
  { type: 'assist', value: 'Draw Two', effect: 'draw_extra_cards' }
];

function initializeGameState(roomId) {
  const gameState = {
    tiles: generateTileLayout(),
    players: new Map(),
    currentPlayer: null,
    scores: {},
    hands: new Map(),
    decks: {
      number: generateNumberDeck(),
      assist: generateAssistDeck()
    },
    discardPile: []
  };
  gameStates.set(roomId, gameState);
  return gameState;
}

// Add these deck generation functions
function generateNumberDeck() {
  return Array.from({length: 20}, (_, i) => ({
    type: 'number',
    value: Math.floor(Math.random() * 10) + 1
  })).sort(() => Math.random() - 0.5);
}

function generateAssistDeck() {
  return ASSIST_CARDS.map(card => ({...card}))
    .sort(() => Math.random() - 0.5);
}

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
    const gameState = initializeGameState(roomId);
    
    // Initialize player state
    gameState.players.set(socket.id, {
      id: socket.id,
      ready: false
    });
    gameState.hands.set(socket.id, []);
    
    rooms.set(roomId, {
      id: roomId,
      players: [{ id: socket.id, ready: false }],
      status: 'waiting',
      hostId: socket.id
    });

    socket.join(roomId);
    socket.emit('roomCreated', { 
      roomId, 
      playerId: socket.id,
      gameState: sanitizeGameState(gameState, socket.id) 
    });
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

    room.players.push({
      id: socket.id,
      ready: false,
      hand: []
    });
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

    if (room.players.length === 2) {
      const gameState = initializeGameState(room.id);
      // Initialize hands for both players
      room.players.forEach(player => {
        gameState.hands.set(player.id, []);  // Add empty hand array
      });

      // Notify players with initialized hand counts
      room.players.forEach(player => {
        io.to(player.id).emit('opponentHandUpdate', {
          roomId: room.id,
          handCount: room.players
            .filter(p => p.id !== player.id)
            .map(p => ({
              playerId: p.id,
              numberCount: gameState.hands.get(p.id)?.length || 0,
              assistCount: 0
            }))
        });
      });
    }
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
      
      // Get the existing game state from gameStates map
      const gameState = gameStates.get(roomId);
      
      // Initialize game state properly
      gameState.currentPlayer = room.hostId;
      gameState.scores = {
          [room.players[0].id]: 0,
          [room.players[1].id]: 0
      };

      // Start the game with the proper game state
      io.to(roomId).emit('gameStart', {
          roomId,
          players: room.players.map(p => ({
              id: p.id,
              handCount: gameState.hands.get(p.id)?.length || 0
          })),
          gameState: sanitizeGameState(gameState, room.hostId),
          currentTurn: gameState.currentPlayer
      });

      // Send initial hand counts using gameState
      room.players.forEach(player => {
          const opponent = room.players.find(p => p.id !== player.id);
          if (opponent) {
              io.to(player.id).emit('opponentHandUpdate', {
                  roomId,
                  handCount: gameState.hands.get(opponent.id)?.length || 0
              });
          }
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
    const gameState = gameStates.get(roomId);
    if (!gameState || gameState.currentPlayer !== socket.id) {
      socket.emit('gameError', 'Invalid action');
      return;
    }

    switch (action) {
      case 'playCard':
        if (validateCardPlay(gameState, socket.id, data)) {
          const result = processCardPlay(gameState, socket.id, data);
          broadcastGameUpdate(roomId, result);
        }
        break;
      
      case 'drawCard':
        if (validateCardDraw(gameState, socket.id, data)) {
          const result = processCardDraw(gameState, socket.id, data);
          broadcastGameUpdate(roomId, result);
        }
        break;
    }
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

// Add specific handler for when cards are drawn/played
function updateOpponentHandCount(room, playerId) {
    const player = room.players.find(p => p.id === playerId);
    const opponent = room.players.find(p => p.id !== playerId);
    
    if (player && opponent) {
        io.to(opponent.id).emit('opponentHandUpdate', {
            roomId: room.id,
            handCount: player.hand ? player.hand.length : 0
        });
    }
}

// Helper functions
function validateCardPlay(gameState, playerId, data) {
  const hand = gameState.hands.get(playerId);
  const tile = gameState.tiles[data.tileIndex];
  return hand && tile && !tile.hasNumber;
}

function processCardPlay(gameState, playerId, data) {
  const hand = gameState.hands.get(playerId);
  const cardIndex = hand.findIndex(card => card.value === data.cardValue);
  
  if (cardIndex === -1) return null;
  
  // Remove card from hand
  const [playedCard] = hand.splice(cardIndex, 1);
  
  // Update tile
  gameState.tiles[data.tileIndex].hasNumber = true;
  gameState.tiles[data.tileIndex].number = playedCard.value;
  
  // Add to discard pile
  gameState.discardPile.push(playedCard);
  
  // Update scores
  gameState.scores[playerId] = calculateScore(gameState.tiles, playerId);
  
  return {
    type: 'cardPlay',
    playerId,
    data: {
      tileIndex: data.tileIndex,
      cardValue: playedCard.value,
      handCount: hand.length,
      score: gameState.scores[playerId]
    }
  };
}

function broadcastGameUpdate(roomId, update) {
  const gameState = gameStates.get(roomId);
  
  // Broadcast to all players
  io.to(roomId).emit('gameUpdate', {
    roomId,
    action: update.type,
    playerId: update.playerId,
    data: update.data,
    gameState: sanitizeGameState(gameState, update.playerId)
  });
}

// Sanitize game state before sending to client
function sanitizeGameState(gameState, playerId) {
  return {
    tiles: gameState.tiles.tiles || [],
    currentPlayer: gameState.currentPlayer,
    scores: gameState.scores,
    playerHand: gameState.hands.get(playerId),
    opponentHandCounts: Array.from(gameState.hands.entries())
      .filter(([id]) => id !== playerId)
      .map(([id, hand]) => ({
        playerId: id,
        numberCount: hand.filter(c => c.type === 'number').length,
        assistCount: hand.filter(c => c.type === 'assist').length
      }))
  };
}

// Add these functions above the broadcastGameUpdate function
function validateCardDraw(gameState, playerId, data) {
  const deck = gameState.decks[data.deckType];
  return deck && deck.length > 0;
}

function processCardDraw(gameState, playerId, data) {
  const deck = gameState.decks[data.deckType];
  if (!deck || deck.length === 0) return null;

  // Draw card from deck
  const drawnCard = deck.pop();
  const hand = gameState.hands.get(playerId);
  hand.push(drawnCard);

  return {
    type: 'cardDraw',
    playerId,
    data: {
      deckType: data.deckType,
      handCount: hand.length,
      drawnCard: {
        value: drawnCard.value,
        type: drawnCard.type
      }
    }
  };
} 