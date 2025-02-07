import { io } from 'socket.io-client';

export class SocketService {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
        this.isConnected = false;
        this.currentRoomId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect(url = 'http://localhost:3000') {
        if (this.socket?.connected) {
            console.log('Socket already connected');
            return this.socket;
        }

        if (this.socket) {
            console.log('Cleaning up existing socket before reconnecting');
            this.disconnect();
        }

        console.log('Connecting to socket server:', url);
        this.socket = io(url, {
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            autoConnect: true,
            auth: {
                roomId: this.currentRoomId
            },
            connectionStateRecovery: {
                maxDisconnectionDuration: 2000,
                skipMiddlewares: true
            }
        });

        this.setupCoreListeners();
        return this.socket;
    }

    setupCoreListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('Socket connected successfully');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            if (this.currentRoomId && this.socket.recovered) {
                console.log('Connection recovered, attempting to rejoin room:', this.currentRoomId);
                this.emit('joinRoom', { roomId: this.currentRoomId });
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            this.isConnected = false;
            
            if (reason === 'io server disconnect') {
                this.socket.connect();
            }
            if (reason === 'transport close' || reason === 'ping timeout') {
                console.log('Temporary disconnect, keeping room state');
            } else {
                this.currentRoomId = null;
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.isConnected = false;
            this.reconnectAttempts++;
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('Max reconnection attempts reached');
                this.disconnect();
            }
        });

        this.socket.on('roomCreated', ({ roomId }) => {
            console.log('Room created, setting current room:', roomId);
            this.setRoom(roomId);
        });

        this.socket.on('joinedRoom', ({ roomId }) => {
            console.log('Joined room, setting current room:', roomId);
            this.setRoom(roomId);
        });

        this.socket.on('leaveRoom', () => {
            console.log('Left room, clearing current room');
            this.currentRoomId = null;
        });

        this.socket.on('connect_timeout', () => {
            console.log('Connection timeout, attempting to reconnect');
            this.socket.connect();
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log('Attempting to reconnect:', attemptNumber);
            if (this.currentRoomId) {
                this.socket.auth = { roomId: this.currentRoomId };
            }
        });

        this.socket.on('reconnect_error', (error) => {
            console.error('Reconnection error:', error);
        });

        this.socket.on('reconnect_failed', () => {
            console.error('Failed to reconnect');
            this.currentRoomId = null;
        });
    }

    setRoom(roomId) {
        console.log('Setting current room:', roomId);
        this.currentRoomId = roomId;
        if (this.socket) {
            this.socket.auth = { roomId };
        }
    }

    getCurrentRoom() {
        return this.currentRoomId;
    }

    disconnect() {
        if (this.socket) {
            console.log('Disconnecting socket');
            if (this.currentRoomId) {
                this.emit('leaveRoom', { roomId: this.currentRoomId });
            }
            this.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.currentRoomId = null;
            this.reconnectAttempts = 0;
        }
    }

    on(event, callback) {
        if (!this.socket) {
            console.warn('Attempting to add listener without socket connection');
            return;
        }
        console.log('Adding listener for event:', event);
        
        const wrappedCallback = (...args) => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in ${event} listener:`, error);
            }
        };
        
        this.socket.on(event, wrappedCallback);
        
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(wrappedCallback);
    }

    off(event, callback) {
        if (!this.socket) return;
        
        if (callback) {
            this.socket.off(event, callback);
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                callbacks.delete(callback);
            }
        } else {
            this.socket.off(event);
            this.listeners.delete(event);
        }
    }

    emit(event, ...args) {
        if (!this.socket) {
            console.warn('Attempting to emit without socket connection');
            return;
        }
        if (!this.isConnected) {
            console.warn('Socket not connected, cannot emit:', event);
            return;
        }

        if (['playerReady', 'startGame', 'leaveRoom', 'gameAction'].includes(event)) {
            const payload = args[0] || {};
            if (!this.currentRoomId) {
                console.error(`No room ID found for event: ${event}`);
                return;
            }
            
            if (typeof payload === 'object') {
                args[0] = { ...payload, roomId: this.currentRoomId };
            } else {
                args[0] = { roomId: this.currentRoomId };
            }
        }
        else if (event === 'joinRoom') {
            const payload = args[0] || {};
            if (!payload.roomId) {
                console.error('No room ID provided for join room event');
                return;
            }
            console.log('Attempting to join room:', payload.roomId);
        }

        try {
            console.log(`Emitting ${event}:`, args[0]);
            this.socket.emit(event, ...args);
        } catch (error) {
            console.error(`Error emitting ${event}:`, error);
            throw error;
        }
    }

    removeAllListeners() {
        if (!this.socket) return;
        console.log('Removing all socket listeners');
        this.listeners.forEach((callbacks, event) => {
            callbacks.forEach(callback => {
                try {
                    this.socket.off(event, callback);
                } catch (error) {
                    console.error(`Error removing listener for ${event}:`, error);
                }
            });
        });
        this.listeners.clear();
    }

    getSocket() {
        return this.socket;
    }

    isSocketConnected() {
        return this.isConnected && this.socket?.connected;
    }
}

const socketService = new SocketService();
export default socketService; 