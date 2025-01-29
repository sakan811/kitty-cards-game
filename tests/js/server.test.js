import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { createServer } from 'http';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-room-id')
}));

function waitFor(socket, event) {
  return new Promise((resolve) => {
    socket.once(event, resolve);
  });
}

describe('Game Server', () => {
  let io;
  let serverSocket;
  let clientSocket;
  let httpServer;
  let app;
  let port;

  beforeAll((done) => {
    app = express();
    httpServer = createServer(app);
    io = new Server(httpServer);
    
    httpServer.listen(() => {
      port = httpServer.address().port;
      
      io.on('connection', (socket) => {
        serverSocket = socket;
      });
      
      done();
    });
  });

  beforeEach((done) => {
    if (clientSocket) {
      clientSocket.close();
    }
    
    clientSocket = new Client(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true
    });
    
    clientSocket.on('connect', () => {
      done();
    });
    
    clientSocket.connect();
  });

  afterAll(() => {
    if (clientSocket) {
      clientSocket.close();
    }
    io.close();
    httpServer.close();
  });

  describe('Room Management', () => {
    it('should create a new room when requested', (done) => {
      io.on('createRoom', (socket) => {
        socket.join('test-room-id');
        socket.emit('roomCreated', {
          roomId: 'test-room-id',
          playerId: socket.id
        });
      });

      clientSocket.emit('createRoom');
      
      clientSocket.on('roomCreated', ({ roomId, playerId }) => {
        expect(roomId).toBe('test-room-id');
        expect(playerId).toBeDefined();
        done();
      });
    });

    it('should allow a second player to join an existing room', (done) => {
      const secondClient = new Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true
      });

      let roomId = 'test-room-id';

      io.on('createRoom', (socket) => {
        socket.join(roomId);
        socket.emit('roomCreated', { roomId, playerId: socket.id });
      });

      io.on('joinRoom', (socket, joinRoomId) => {
        if (joinRoomId === roomId) {
          socket.join(roomId);
          io.to(roomId).emit('joinedRoom', {
            roomId,
            players: [
              { id: clientSocket.id, ready: false },
              { id: secondClient.id, ready: false }
            ]
          });
        }
      });

      clientSocket.emit('createRoom');

      clientSocket.on('roomCreated', () => {
        secondClient.emit('joinRoom', roomId);
      });

      secondClient.on('joinedRoom', (data) => {
        expect(data.roomId).toBe(roomId);
        expect(data.players).toHaveLength(2);
        secondClient.close();
        done();
      });
    });

    it('should handle room not found error', (done) => {
      io.on('joinRoom', (socket) => {
        socket.emit('roomError', 'Room does not exist');
      });

      clientSocket.emit('joinRoom', 'non-existent-room');
      
      clientSocket.on('roomError', (error) => {
        expect(error).toBe('Room does not exist');
        done();
      });
    });

    it('should handle full room error', (done) => {
      const secondClient = new Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      const thirdClient = new Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      let roomId;
      
      io.on('createRoom', (socket) => {
        roomId = 'test-room-id';
        socket.join(roomId);
        socket.emit('roomCreated', { roomId, playerId: socket.id });
      });
      
      io.on('joinRoom', (socket, joinRoomId) => {
        if (joinRoomId === roomId) {
          if (io.sockets.adapter.rooms.get(roomId).size >= 2) {
            socket.emit('roomError', 'Room is full');
          } else {
            socket.join(roomId);
            io.to(roomId).emit('joinedRoom', {
              roomId,
              players: [
                { id: clientSocket.id, ready: false },
                { id: secondClient.id, ready: false }
              ]
            });
          }
        }
      });

      clientSocket.emit('createRoom');
      
      clientSocket.on('roomCreated', () => {
        secondClient.emit('joinRoom', roomId);
        
        secondClient.on('joinedRoom', () => {
          thirdClient.emit('joinRoom', roomId);
        });
        
        thirdClient.on('roomError', (error) => {
          expect(error).toBe('Room is full');
          secondClient.close();
          thirdClient.close();
          done();
        });
      });
    });
  });

  describe('Game Actions', () => {
    it('should start game when both players are ready', (done) => {
      const secondClient = new Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      let roomId;
      
      io.on('createRoom', (socket) => {
        roomId = 'test-room-id';
        socket.join(roomId);
        socket.emit('roomCreated', { roomId, playerId: socket.id });
      });
      
      io.on('joinRoom', (socket, joinRoomId) => {
        if (joinRoomId === roomId) {
          socket.join(roomId);
          io.to(roomId).emit('joinedRoom', {
            roomId,
            players: [
              { id: clientSocket.id, ready: false },
              { id: secondClient.id, ready: false }
            ]
          });
        }
      });

      io.on('playerReady', (socket, readyRoomId) => {
        if (readyRoomId === roomId) {
          const room = io.sockets.adapter.rooms.get(roomId);
          if (room && room.size === 2) {
            io.to(roomId).emit('gameStart', {
              players: [
                { id: clientSocket.id, ready: true },
                { id: secondClient.id, ready: true }
              ],
              gameState: {},
              currentTurn: clientSocket.id
            });
          }
        }
      });

      clientSocket.emit('createRoom');
      
      clientSocket.on('roomCreated', () => {
        secondClient.emit('joinRoom', roomId);
      });

      secondClient.on('joinedRoom', () => {
        clientSocket.emit('playerReady', roomId);
        secondClient.emit('playerReady', roomId);
      });

      clientSocket.on('gameStart', (data) => {
        expect(data.players).toHaveLength(2);
        expect(data.gameState).toBeDefined();
        expect(data.currentTurn).toBeDefined();
        secondClient.close();
        done();
      });
    });

    it('should handle card play action', (done) => {
      const secondClient = new Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      let roomId;
      
      io.on('createRoom', () => {
        roomId = uuidv4();
        serverSocket.join(roomId);
        serverSocket.emit('roomCreated', { roomId, playerId: serverSocket.id });
      });
      
      io.on('joinRoom', (socket, joinRoomId) => {
        if (joinRoomId === roomId) {
          socket.join(roomId);
          io.to(roomId).emit('joinedRoom', {
            roomId,
            players: [
              { id: clientSocket.id, ready: false },
              { id: secondClient.id, ready: false }
            ]
          });
        }
      });

      clientSocket.emit('createRoom');
      
      clientSocket.on('roomCreated', ({ roomId: createdRoomId }) => {
        roomId = createdRoomId;
        secondClient.emit('joinRoom', roomId);
      });

      secondClient.on('joinedRoom', () => {
        clientSocket.emit('playerReady', roomId);
        secondClient.emit('playerReady', roomId);
        
        clientSocket.on('gameStart', () => {
          clientSocket.emit('gameAction', {
            roomId,
            action: 'playCard',
            data: {
              tileIndex: 0,
              cardValue: 5
            }
          });
          
          secondClient.on('gameUpdate', (updateData) => {
            expect(updateData.action).toBe('playCard');
            expect(updateData.data.tileIndex).toBe(0);
            expect(updateData.data.cardValue).toBe(5);
            secondClient.disconnect();
            done();
          });
        });
      });
    });

    it('should prevent playing out of turn', (done) => {
      const secondClient = new Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      let roomId;
      
      io.on('createRoom', () => {
        roomId = uuidv4();
        serverSocket.join(roomId);
        serverSocket.emit('roomCreated', { roomId, playerId: serverSocket.id });
      });
      
      io.on('joinRoom', (socket, joinRoomId) => {
        if (joinRoomId === roomId) {
          socket.join(roomId);
          io.to(roomId).emit('joinedRoom', {
            roomId,
            players: [
              { id: clientSocket.id, ready: false },
              { id: secondClient.id, ready: false }
            ]
          });
        }
      });

      clientSocket.emit('createRoom');
      
      clientSocket.on('roomCreated', ({ roomId: createdRoomId }) => {
        roomId = createdRoomId;
        secondClient.emit('joinRoom', roomId);
      });

      secondClient.on('joinedRoom', () => {
        clientSocket.emit('playerReady', roomId);
        secondClient.emit('playerReady', roomId);
        
        secondClient.on('gameStart', () => {
          secondClient.emit('gameAction', {
            roomId,
            action: 'playCard',
            data: {
              tileIndex: 0,
              cardValue: 5
            }
          });
          
          secondClient.on('gameError', (error) => {
            expect(error).toBe('Not your turn');
            secondClient.disconnect();
            done();
          });
        });
      });
    });
  });

  describe('Game State', () => {
    it('should generate valid tile layout', (done) => {
      io.on('createRoom', () => {
        const roomId = uuidv4();
        serverSocket.join(roomId);
        serverSocket.emit('roomCreated', { roomId, playerId: serverSocket.id });
      });
      
      clientSocket.emit('createRoom');
      
      clientSocket.on('roomCreated', ({ roomId }) => {
        const secondClient = new Client(`http://localhost:${port}`, {
          transports: ['websocket'],
          forceNew: true
        });
        secondClient.emit('joinRoom', roomId);
        
        clientSocket.emit('playerReady', roomId);
        secondClient.emit('playerReady', roomId);
        
        clientSocket.on('gameStart', ({ gameState }) => {
          expect(gameState.tiles).toHaveLength(8);
          expect(gameState.tiles.filter(t => t.hasCup)).toHaveLength(4);
          expect(gameState.selectedColors).toHaveLength(4);
          secondClient.disconnect();
          done();
        });
      });
    });

    it('should update scores when playing on cup tiles', (done) => {
      const secondClient = new Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      let roomId;
      
      io.on('createRoom', () => {
        roomId = uuidv4();
        serverSocket.join(roomId);
        serverSocket.emit('roomCreated', { roomId, playerId: serverSocket.id });
      });
      
      io.on('joinRoom', (socket, joinRoomId) => {
        if (joinRoomId === roomId) {
          socket.join(roomId);
          io.to(roomId).emit('joinedRoom', {
            roomId,
            players: [
              { id: clientSocket.id, ready: false },
              { id: secondClient.id, ready: false }
            ]
          });
        }
      });

      clientSocket.emit('createRoom');
      
      clientSocket.on('roomCreated', ({ roomId: createdRoomId }) => {
        roomId = createdRoomId;
        secondClient.emit('joinRoom', roomId);
      });

      secondClient.on('joinedRoom', () => {
        clientSocket.emit('playerReady', roomId);
        secondClient.emit('playerReady', roomId);
        
        clientSocket.on('gameStart', ({ gameState }) => {
          const cupTileIndex = gameState.tiles.findIndex(t => t.hasCup);
          
          clientSocket.emit('gameAction', {
            roomId,
            action: 'playCard',
            data: {
              tileIndex: cupTileIndex,
              cardValue: 5
            }
          });
          
          secondClient.on('gameUpdate', ({ gameState: updatedState }) => {
            expect(updatedState.scores[clientSocket.id]).toBe(5);
            secondClient.disconnect();
            done();
          });
        });
      });
    });
  });

  describe('Disconnection Handling', () => {
    it('should handle player disconnection', (done) => {
      const secondClient = new Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      io.on('createRoom', () => {
        const roomId = uuidv4();
        serverSocket.join(roomId);
        io.to(roomId).emit('joinedRoom', {
          roomId,
          players: [
            { id: clientSocket.id, ready: false },
            { id: secondClient.id, ready: false }
          ]
        });
      });

      clientSocket.emit('createRoom');
      
      clientSocket.on('roomCreated', ({ roomId }) => {
        secondClient.emit('joinRoom', roomId);
      });

      secondClient.on('joinedRoom', () => {
        secondClient.disconnect();
        
        setTimeout(() => {
          const room = io.sockets.adapter.rooms.get(roomId);
          expect(room?.length).toBe(1);
          done();
        }, 100);
      });
    });

    it('should clean up room when all players leave', (done) => {
      io.on('createRoom', () => {
        const roomId = uuidv4();
        serverSocket.join(roomId);
        serverSocket.emit('roomCreated', { roomId, playerId: serverSocket.id });
      });
      
      clientSocket.emit('createRoom');
      
      clientSocket.on('roomCreated', ({ roomId }) => {
        clientSocket.disconnect();
        
        setTimeout(() => {
          const room = io.sockets.adapter.rooms.get(roomId);
          expect(room).toBeUndefined();
          done();
        }, 100);
      });
    });
  });
}); 