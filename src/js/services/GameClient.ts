// @ts-ignore
import { Client, Room } from 'colyseus.js';

interface GameClientOptions {
    serverUrl?: string;
    maxReconnectAttempts?: number;
    connectionTimeout?: number;
    retryDelay?: number;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

// Extend the Colyseus Client type to include connection property
interface ExtendedClient extends Client {
    connection: WebSocket & {
        isOpen: boolean;
        close: () => void;
    };
    onStateChange: (callback: (state: ConnectionState) => void) => void;
    onError: (callback: (error: Error) => void) => void;
    joinOrCreate: (roomName: string, options?: any) => Promise<Room>;
    joinById: (roomId: string) => Promise<Room>;
}

interface RoomState {
    players: Map<string, any>;
    gameStarted: boolean;
    hostId?: string;
}

export class GameClient {
    private client: ExtendedClient | null;
    private room: Room | null;
    private listeners: Map<string, Set<Function>>;
    private isConnected: boolean;
    private reconnectAttempts: number;
    private readonly maxReconnectAttempts: number;
    private readonly connectionTimeout: number;
    private readonly retryDelay: number;
    private isConnecting: boolean;
    private connectionPromise: Promise<ExtendedClient> | null;
    private readonly serverUrl: string;

    constructor(options: GameClientOptions = {}) {
        this.serverUrl = options.serverUrl || (
            process.env.NODE_ENV === 'production'
                ? 'wss://your-production-url.com'
                : `ws://${window.location.hostname}:3000`
        );
        this.client = null;
        this.room = null;
        this.listeners = new Map();
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
        this.connectionTimeout = options.connectionTimeout || 10000;
        this.retryDelay = options.retryDelay || 2000;
        this.isConnecting = false;
        this.connectionPromise = null;
    }

    async checkServerStatus(endpoint: string): Promise<boolean> {
        try {
            const wsUrl = new URL(endpoint);
            const ws = new WebSocket(wsUrl);
            
            return new Promise<boolean>((resolve) => {
                const timeout = setTimeout(() => {
                    ws.close();
                    this.checkHttpHealth(endpoint)
                        .then(resolve)
                        .catch(() => resolve(false));
                }, 2000);

                ws.onopen = () => {
                    clearTimeout(timeout);
                    ws.close();
                    resolve(true);
                };

                ws.onerror = () => {
                    clearTimeout(timeout);
                    ws.close();
                    this.checkHttpHealth(endpoint)
                        .then(resolve)
                        .catch(() => resolve(false));
                };
            });
        } catch (error) {
            console.error('Server check failed:', error);
            return false;
        }
    }

    private async checkHttpHealth(endpoint: string): Promise<boolean> {
        try {
            const url = new URL(endpoint.replace('ws://', 'http://'));
            const response = await fetch(`${url.origin}/health`, {
                signal: AbortSignal.timeout(3000)
            });
            return response.ok;
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }

    async connect(): Promise<ExtendedClient> {
        try {
            console.log('Attempting to connect to:', this.serverUrl);
            
            // If already connected, return existing client
            if (this.isConnected && this.client?.connection?.isOpen) {
                console.log('Already connected, reusing existing client');
                return this.client;
            }

            // If already connecting, return existing promise
            if (this.isConnecting && this.connectionPromise) {
                console.log('Connection already in progress');
                return this.connectionPromise;
            }

            this.isConnecting = true;
            console.log('Starting new connection attempt');

            // Create new connection promise
            this.connectionPromise = new Promise<ExtendedClient>((resolve, reject) => {
                let timeoutId: NodeJS.Timeout | undefined;
                
                const cleanup = () => {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }
                };

                try {
                    // Always create a new client instance when connecting
                    console.log('Creating new Colyseus client');
                    this.client = new Client(this.serverUrl) as ExtendedClient;

                    timeoutId = setTimeout(() => {
                        console.log('Connection timeout reached');
                        if (this.client?.connection) {
                            this.client.connection.close();
                        }
                        reject(new Error('Connection timeout'));
                    }, this.connectionTimeout);

                    // Test connection by trying to join or create a room
                    this.client.joinOrCreate('game_room')
                        .then(() => {
                            cleanup();
                            this.isConnected = true;
                            this.reconnectAttempts = 0;
                            resolve(this.client!);
                        })
                        .catch((error) => {
                            console.error('Failed to join room:', error);
                            cleanup();
                            this.handleConnectionFailure(reject);
                        });

                } catch (error) {
                    console.error('Error during connection setup:', error);
                    cleanup();
                    this.handleConnectionFailure(reject);
                }
            });

            const client = await this.connectionPromise;
            console.log('Successfully connected to server');
            return client;
        } catch (error) {
            console.error('Connection failed:', error);
            this.isConnected = false;
            throw error;
        } finally {
            this.isConnecting = false;
            this.connectionPromise = null;
        }
    }

    private handleConnectionFailure(reject: (reason?: any) => void): void {
        this.reconnectAttempts++;
        this.isConnected = false;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log(`Connection attempt ${this.reconnectAttempts} failed, retrying in ${this.retryDelay/1000}s...`);
            setTimeout(() => {
                this.connect().catch(() => {}); // Ignore error here as it's handled in connect()
            }, this.retryDelay);
        } else {
            this.client = null;
            reject(new Error(`Connection failed after ${this.maxReconnectAttempts} attempts. Please check if the server is running.`));
        }
    }

    async joinOrCreate(roomName: string = 'game_room', options: any = {}): Promise<Room> {
        if (!this.isConnected) {
            await this.connect();
        }

        try {
            if (this.room) {
                await this.leave();
            }

            if (!this.client) {
                throw new Error('Client not initialized');
            }

            const newRoom = await this.client.joinOrCreate(roomName, {
                ...options,
                retryTimes: 3,
                retryDelay: 2000
            });

            if (!newRoom) {
                throw new Error('Failed to create or join room');
            }

            this.room = newRoom;

            // Set up room event handlers
            newRoom.onLeave((code: number) => {
                this.room = null;
                if (code > 1000) {
                    this.attemptReconnect();
                }
            });

            newRoom.onError((code: number, message: string) => {
                console.error('Room error:', code, message);
                if (code === 4000) { // Connection lost
                    this.attemptReconnect();
                }
            });

            return newRoom;
        } catch (error) {
            console.error('Failed to join room:', error);
            throw error;
        }
    }

    async attemptReconnect(): Promise<void> {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        try {
            this.reconnectAttempts++;
            await this.connect();
            if (this.room) {
                const roomId = this.room.id;
                await this.joinById(roomId);
            }
            this.reconnectAttempts = 0;
        } catch (error) {
            console.error('Reconnection attempt failed:', error);
            setTimeout(() => this.attemptReconnect(), 1000 * Math.pow(2, this.reconnectAttempts));
        }
    }

    async joinById(roomId: string): Promise<Room> {
        if (!this.client) {
            throw new Error('Client not initialized');
        }
        const room = await this.client.joinById(roomId);
        if (!room) {
            throw new Error('Failed to join room');
        }
        this.room = room;
        return room;
    }

    setupRoomListeners(): void {
        if (!this.room) return;

        this.room.onStateChange((state: RoomState) => {
            console.log('Room state changed:', state);
        });

        this.room.onError((code: number, message: string) => {
            console.error('Room error:', code, message);
            if (code === 4000) { // Connection lost
                this.attemptReconnect();
            }
        });
    }

    async leave(): Promise<void> {
        if (this.room) {
            try {
                await this.room.leave();
            } catch (error) {
                console.error('Error leaving room:', error);
            }
            this.room = null;
        }
    }

    async disconnect(): Promise<void> {
        console.log('Disconnecting client...');
        
        if (this.room) {
            await this.leave();
        }
        
        if (this.client?.connection) {
            this.client.connection.close();
        }
        
        this.isConnected = false;
        this.client = null;
        console.log('Client disconnected');
    }

    on(event: string, callback: Function): void {
        if (!this.room) {
            console.warn('Room not joined yet');
            return;
        }

        const wrappedCallback = (...args: any[]) => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in ${event} listener:`, error);
            }
        };

        this.room.onMessage(event, wrappedCallback);
        
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)?.add(wrappedCallback);
    }

    send(event: string, data: any): void {
        if (!this.room || !this.isConnected) {
            throw new Error('Not connected to room');
        }

        try {
            this.room.send(event, data);
        } catch (error) {
            console.error(`Error sending ${event}:`, error);
            throw error;
        }
    }

    getRoom(): Room | null {
        return this.room;
    }

    getConnectionStatus(): boolean {
        return this.isConnected && !!this.client?.connection?.isOpen;
    }
}

// Create singleton instance
const gameClient = new GameClient();
export default gameClient; 