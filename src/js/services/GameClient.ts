import { io, Socket } from 'socket.io-client';

export interface GameClientOptions {
    serverUrl?: string;
    maxReconnectAttempts?: number;
    connectionTimeout?: number;
    retryDelay?: number;
}

export interface RoomListing {
    roomId: string;
    players: number;
}

export interface Player {
    id: string;
    ready: boolean;
    hasDrawnAssist: boolean;
    hasDrawnNumber: boolean;
    score: number;
    hand: any[];
}

export interface GameState {
    players: Map<string, Player>;
    currentPlayer: string;
    isGameStarted: boolean;
}

export class GameClient {
    private socket: Socket | null;
    private isConnected: boolean;
    private reconnectAttempts: number;
    private readonly maxReconnectAttempts: number;
    private readonly connectionTimeout: number;
    private readonly retryDelay: number;
    private isConnecting: boolean;
    private connectionPromise: Promise<void> | null;
    private readonly serverUrl: string;
    private currentRoom: string | null;

    constructor(options: GameClientOptions = {}) {
        this.serverUrl = options.serverUrl || (
            process.env.NODE_ENV === 'production'
                ? process.env.VITE_GAME_SERVER_URL || 'http://localhost:3000'
                : `http://${window.location.hostname}:3000`
        );
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
        this.connectionTimeout = options.connectionTimeout || 10000;
        this.retryDelay = options.retryDelay || 2000;
        this.isConnecting = false;
        this.connectionPromise = null;
        this.currentRoom = null;
    }

    public async connect(): Promise<void> {
        if (this.isConnected) {
            return;
        }

        if (this.isConnecting && this.connectionPromise) {
            return this.connectionPromise;
        }

        this.isConnecting = true;
        this.socket = io(this.serverUrl, {
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: this.retryDelay,
            timeout: this.connectionTimeout
        });

        this.connectionPromise = new Promise((resolve, reject) => {
            if (!this.socket) {
                this.isConnecting = false;
                reject(new Error('Socket not initialized'));
                return;
            }

            const timeout = setTimeout(() => {
                this.isConnecting = false;
                reject(new Error('Connection timeout'));
            }, this.connectionTimeout);

            this.socket.once('connect', () => {
                clearTimeout(timeout);
                this.isConnected = true;
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                resolve();
            });

            this.socket.once('connect_error', (error) => {
                clearTimeout(timeout);
                this.isConnecting = false;
                reject(error);
            });
        });

        return this.connectionPromise;
    }

    public async joinOrCreate(roomName: string = 'game_room'): Promise<any> {
        if (!this.socket) {
            throw new Error('Not connected to server');
        }

        return new Promise((resolve, reject) => {
            this.socket!.emit('createRoom', {}, (response: any) => {
                if (response.success) {
                    this.currentRoom = response.roomId;
                    resolve({
                        id: response.roomId,
                        sessionId: this.socket!.id,
                        state: {
                            players: new Map([[this.socket!.id, { id: this.socket!.id, ready: false }]])
                        }
                    });
                } else {
                    reject(new Error(response.error || 'Failed to create room'));
                }
            });
        });
    }

    public async joinById(roomId: string): Promise<any> {
        if (!this.socket) {
            throw new Error('Not connected to server');
        }

        return new Promise((resolve, reject) => {
            this.socket!.emit('joinRoom', { roomId }, (response: any) => {
                if (response.success) {
                    this.currentRoom = roomId;
                    resolve({
                        id: roomId,
                        sessionId: this.socket!.id,
                        state: {
                            players: new Map(),
                            hostId: undefined
                        }
                    });
                } else {
                    reject(new Error(response.error || 'Failed to join room'));
                }
            });
        });
    }

    public leave(): void {
        if (this.socket && this.currentRoom) {
            this.socket.emit('leaveRoom', { roomId: this.currentRoom });
            this.currentRoom = null;
        }
        return;
    }

    public getRoom(): any {
        if (!this.socket || !this.currentRoom) {
            return null;
        }

        return {
            id: this.currentRoom,
            sessionId: this.socket.id,
            state: {
                players: new Map(),
                hostId: undefined
            },
            onStateChange: (callback: (state: any) => void) => {
                this.socket!.on('stateChange', callback);
            },
            onMessage: (type: string, callback: (data: any) => void) => {
                this.socket!.on(type, callback);
            },
            send: (type: string, data?: any, callback?: (response: any) => void) => {
                if (callback) {
                    this.socket!.emit(type, { ...data, roomId: this.currentRoom }, callback);
                } else {
                    this.socket!.emit(type, { ...data, roomId: this.currentRoom });
                }
            },
            leave: () => this.leave(),
            removeAllListeners: () => {
                if (this.socket) {
                    this.socket.removeAllListeners('stateChange');
                    this.socket.removeAllListeners('gameStarted');
                }
            }
        };
    }

    public getConnectionStatus(): boolean {
        return this.isConnected;
    }

    public disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.currentRoom = null;
        }
    }

    public async getAvailableRooms(): Promise<RoomListing[]> {
        if (!this.socket) {
            throw new Error('Not connected to server');
        }

        return new Promise((resolve, reject) => {
            this.socket!.emit('getRooms', {}, (response: any) => {
                if (response.success) {
                    resolve(response.rooms);
                } else {
                    reject(new Error(response.error || 'Failed to get available rooms'));
                }
            });
        });
    }
}

// Create singleton instance
export const gameClient = new GameClient(); 