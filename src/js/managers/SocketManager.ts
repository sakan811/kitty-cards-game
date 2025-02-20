import { Scene, GameObjects } from 'phaser';
import { Room, Client } from 'colyseus.js';
import { Schema } from '@colyseus/schema';

// Add WebSocket constants since they're not available in the Room type
const enum WebSocketState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3
}

// Base WebSocket connection interface
interface Connection {
    readyState: WebSocketState;
    close(): void;
    send(data: any): void;
}

// Add custom connection type that includes reconnect method
interface ExtendedConnection extends Connection {
    reconnect?: () => void;
}

interface GameState {
    tiles: Array<{
        cupColor?: string;
        tileIndex?: number;
    }>;
    currentPlayer: string;
    players: Record<string, any>;
}

interface IGameScene extends Scene {
    socket: Room | null;
    handleGameUpdate: (data: any) => void;
    showErrorMessage: (message: string) => void;
    isDestroyed?: boolean;
}

interface ListenerEntry {
    event: string;
    handler: (...args: any[]) => void;
}

interface Player {
    id: string;
    ready: boolean;
}

// Custom type for Colyseus room with additional methods
type ExtendedRoom = Room & {
    onStateChange(callback: (state: GameState) => void): void;
    onError(callback: (code: number, message?: string) => void): void;
    onLeave(callback: (code?: number) => void): void;
    hasJoined: boolean;
    send(type: string, message?: any): void;
    leave(): void;
    removeListener(event: string, callback: Function): void;
    readyState: WebSocketState;
    connection: ExtendedConnection;
    sessionId: string;
    roomId: string;
};

export class SocketManager {
    private scene: IGameScene;
    private socket: ExtendedRoom | null = null;
    private listeners: Map<string, Function> = new Map();
    private isDestroyed: boolean;
    private cleanupStarted: boolean;
    private isInitialized: boolean;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 3;
    private endpoint: string;

    constructor(scene: IGameScene, endpoint: string) {
        this.scene = scene;
        this.endpoint = endpoint;
        
        // Initialize basic properties
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.socket = scene.socket as unknown as ExtendedRoom;
        this.isDestroyed = false;
        this.cleanupStarted = false;
        this.isInitialized = false;

        // Validate required properties and methods
        if (!this.validateScene()) {
            throw new Error('Invalid scene provided to SocketManager');
        }

        console.log('SocketManager initialized with room:', this.socket);
        
        if (this.socket) {
            this.setupListeners();
            this.isInitialized = true;
        } else {
            console.warn('No socket provided to SocketManager');
        }
    }

    private validateScene(): boolean {
        try {
            // Check if required properties exist and are of correct type
            if (!this.scene) return false;
            if (!this.scene.socket) return false;
            if (typeof this.scene.handleGameUpdate !== 'function') return false;
            if (!this.scene.showErrorMessage) {
                console.warn('UIManager not initialized, creating message handler');
                // Create a basic message handler if UIManager is not ready
                this.scene.showErrorMessage = (message: string) => {
                    console.error('Game Error:', message);
                    this.scene.events.emit('gameError', message);
                };
            }
            return true;
        } catch (error) {
            console.error('Error validating scene:', error);
            return false;
        }
    }

    private setupListeners(): void {
        if (!this.socket || this.isDestroyed || this.cleanupStarted || !this.isInitialized) return;

        // Set up error handler
        const errorHandler = (message?: string): void => {
            if (this.isDestroyed || this.cleanupStarted || !this.isInitialized) return;
            
            if (this.scene && !this.scene.isDestroyed) {
                const errorMsg = `Error: ${message || 'Unknown error'}`;
                console.error(errorMsg);
                this.scene.showErrorMessage(errorMsg);
            }
        };
        this.listeners.set('error', errorHandler);

        // Set up card drawn handler
        const cardDrawnHandler = (message: any): void => {
            if (this.isDestroyed || this.cleanupStarted || !this.isInitialized) return;
            
            if (this.scene && !this.scene.isDestroyed && message) {
                console.log('Card drawn:', message);
                this.scene.events.emit('cardDrawn', message);
            }
        };
        this.socket.onMessage('cardDrawn', cardDrawnHandler);
        this.listeners.set('cardDrawn', cardDrawnHandler);

        // Set up disconnect handler
        const disconnectHandler = (): void => {
            if (this.isDestroyed || this.cleanupStarted || !this.isInitialized) return;
            
            if (this.scene && !this.scene.isDestroyed) {
                this.scene.showErrorMessage('Disconnected from server');
            }
        };
        this.listeners.set('disconnect', disconnectHandler);

        // Set up leave handler
        const leaveHandler = (code?: number): void => {
            if (this.isDestroyed || this.cleanupStarted || !this.isInitialized) return;
            
            // Only handle unexpected disconnections
            if (code === 1000 || code === 1001) {
                // Normal closure or going away - likely intentional
                console.log('Room left normally:', code);
                return;
            }
            
            console.log('Unexpected room leave:', code);
            
            if (this.scene && !this.scene.isDestroyed) {
                try {
                    // Show different messages based on code
                    let message = 'Disconnected from game';
                    if (code === 4002) {
                        message = 'Connection lost. Attempting to reconnect...';
                    }
                    this.scene.showErrorMessage(message);
                } catch (error) {
                    console.warn('Failed to show error message:', error);
                }
                
                // Only emit game error for non-reconnectable codes
                if (code !== 4002) {
                    try {
                        this.scene.events.emit('gameError', 'Connection lost');
                    } catch (error) {
                        console.warn('Failed to emit game error:', error);
                    }
                }
            }
        };
        this.socket.onLeave(leaveHandler);
        this.listeners.set('leave', leaveHandler);

        // Add socket event listeners
        this.socket.onMessage("*", (type: string | number | Schema, message: any) => {
            if (this.isDestroyed || this.cleanupStarted || !this.isInitialized) return;
            
            if (typeof type === 'string' || typeof type === 'number') {
                if (type === 'gameState' && message) {
                    console.log('Game state update received:', message);
                    this.scene.handleGameUpdate({
                        type: 'gameState',
                        gameState: message
                    });
                } else if (type === 'error' && message) {
                    console.error('Socket error:', message);
                    this.scene.showErrorMessage(message.error);
                } else if (type === 'disconnect') {
                    console.log('Disconnected from server');
                    this.scene.showErrorMessage('Disconnected from server');
                }
            }
        });
    }

    private removeListeners(): void {
        if (!this.socket || this.cleanupStarted) return;
        
        try {
            // Remove tracked listeners
            this.listeners.forEach((listener, event) => {
                try {
                    if (this.socket) {
                        this.socket.removeListener(event, listener);
                    }
                } catch (error) {
                    console.warn(`Error removing ${event} listener:`, error);
                }
            });
            this.listeners.clear();
        } catch (error) {
            console.warn('Error removing listeners:', error);
        }
    }

    public cleanup(): void {
        if (this.cleanupStarted) return;
        
        console.log('Cleaning up SocketManager');
        this.cleanupStarted = true;
        this.isDestroyed = true;
        this.isInitialized = false;
        
        try {
            this.removeListeners();
            
            // Clear references
            (this.scene as any) = null;
            this.socket = null;
            this.listeners.clear();
        } catch (error) {
            console.warn('Error during SocketManager cleanup:', error);
        }
    }

    // Game action methods
    private async attemptReconnection(retries: number = 3, delay: number = 1000): Promise<boolean> {
        if (this.isDestroyed || this.cleanupStarted || !this.isInitialized) return false;
        
        for (let i = 0; i < retries; i++) {
            try {
                console.log(`Reconnection attempt ${i + 1}/${retries}`);
                
                // Check if socket is already open
                const wsState = this.socket?.connection?.readyState ?? this.socket?.readyState;
                if (wsState === WebSocketState.OPEN && this.socket?.hasJoined) {
                    console.log('Socket is already open and joined');
                    return true;
                }

                // If socket is in CLOSING or CLOSED state, wait for it to fully close
                if (wsState === WebSocketState.CLOSING || wsState === WebSocketState.CLOSED) {
                    console.log('Waiting for socket to fully close...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                // Wait before attempting reconnection with progressive delay
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(1.5, i)));
                
                // Attempt to reconnect
                if (this.socket) {
                    try {
                        // Get the reconnection token if available
                        const sessionId = this.socket.sessionId;
                        const roomId = this.socket.roomId;
                        
                        if (!sessionId || !roomId) {
                            console.warn('Missing session or room ID for reconnection');
                            continue;
                        }

                        // Try to reconnect using the room's built-in reconnection mechanism
                        await new Promise<void>((resolve, reject) => {
                            const timeoutId = setTimeout(() => {
                                reject(new Error('Reconnection timeout'));
                            }, 5000);

                            // Set up temporary error handler
                            const errorHandler = (code: number, message?: string) => {
                                clearTimeout(timeoutId);
                                reject(new Error(`Reconnection failed: ${message || code}`));
                            };
                            
                            // Set up temporary success handler
                            const stateChangeHandler = () => {
                                if (this.socket?.hasJoined) {
                                    clearTimeout(timeoutId);
                                    resolve();
                                }
                            };
                            
                            // Add temporary handlers
                            this.socket?.onError(errorHandler);
                            this.socket?.onStateChange(stateChangeHandler);
                            
                            try {
                                // First check if we can use the client's reconnect method
                                if (this.socket?.connection && typeof this.socket.connection.reconnect === 'function') {
                                    this.socket.connection.reconnect();
                                } else {
                                    // Fallback to manual reconnection
                                    this.socket?.send('reconnect', {
                                        sessionId,
                                        roomId
                                    });
                                }
                            } catch (error) {
                                clearTimeout(timeoutId);
                                reject(error);
                            }
                        });
                        
                        // Wait for connection to be established
                        const connected = await this.waitForConnection(5000);
                        if (connected) {
                            console.log('Reconnection successful');
                            // Re-setup listeners
                            this.setupListeners();
                            return true;
                        }
                    } catch (reconnectError) {
                        console.warn(`Reconnection attempt ${i + 1} failed:`, reconnectError);
                        // If this is the last attempt, throw the error
                        if (i === retries - 1) throw reconnectError;
                    }
                }
            } catch (error) {
                console.warn(`Reconnection attempt ${i + 1} failed:`, error);
                // If this is the last attempt, throw the error
                if (i === retries - 1) throw error;
            }
        }
        
        // If all retries failed, emit error
        if (this.scene && !this.scene.isDestroyed) {
            this.scene.events.emit('gameError', 'Failed to reconnect to game');
            this.scene.showErrorMessage('Connection lost. Please refresh the page.');
        }
        return false;
    }

    private async waitForConnection(timeout: number = 5000): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const startTime = Date.now();
            let checkCount = 0;
            const maxChecks = 50;
            
            const checkConnection = () => {
                if (!this.socket || checkCount >= maxChecks) {
                    resolve(false);
                    return;
                }

                checkCount++;
                
                // Check if the socket is truly connected and ready
                const isConnected = this.socket.hasJoined && 
                    (this.socket.connection?.readyState === WebSocketState.OPEN ||
                    (this.socket as any)?.connection?.ws?.readyState === WebSocketState.OPEN);

                if (isConnected) {
                    resolve(true);
                    return;
                }
                
                if (Date.now() - startTime >= timeout) {
                    resolve(false);
                    return;
                }
                
                setTimeout(checkConnection, 100);
            };
            
            checkConnection();
        });
    }

    private async validateConnection(): Promise<boolean> {
        if (!this.socket) {
            console.warn('No socket available');
            return false;
        }

        // Check if socket exists and is in a valid state
        const isValid = this.socket.hasJoined && 
            (this.socket.connection?.readyState === WebSocketState.OPEN ||
            (this.socket as any)?.connection?.ws?.readyState === WebSocketState.OPEN);

        if (!isValid) {
            console.log('Socket not in valid state, attempting reconnection...');
            return await this.attemptReconnection();
        }

        return true;
    }

    private async connect(): Promise<Client> {
        try {
            const client = new Client(this.endpoint);
            await client.reconnect(Date.now().toString());
            return client;
        } catch (error) {
            console.error('Failed to connect to server:', error);
            throw error;
        }
    }

    private async reconnectAndDraw(type: 'assist' | 'number'): Promise<void> {
        let attempts = 0;
        const maxAttempts = 3;
        const baseDelay = 1000;

        while (attempts < maxAttempts) {
            const delay = baseDelay * Math.pow(2, attempts);
            console.log(`Reconnection attempt ${attempts + 1}/${maxAttempts} (delay: ${delay}ms)`);
            
            try {
                if (!this.socket) {
                    throw new Error('No socket available for reconnection');
                }

                // Store session info for reconnection
                const sessionId = this.socket.sessionId;
                const roomId = this.socket.roomId;

                if (!sessionId || !roomId) {
                    throw new Error('Missing session information for reconnection');
                }

                // Close existing connection if in a bad state
                if (this.socket.connection?.readyState !== 1) {
                    try {
                        await this.socket.leave();
                    } catch (error) {
                        console.warn('Error leaving room:', error);
                    }
                }

                // Wait for any cleanup to complete
                await new Promise(resolve => setTimeout(resolve, 500));

                // Get the client instance and attempt to rejoin
                console.log('Attempting to rejoin room...');
                const client = await this.connect();
                const newSocket = await client.joinById(roomId, { sessionId }) as ExtendedRoom;
                
                if (!newSocket) {
                    throw new Error('Failed to create new socket connection');
                }
                
                this.socket = newSocket;

                // Wait for connection to stabilize
                const connected = await this.waitForConnection(5000);
                if (!connected) {
                    throw new Error('Failed to establish stable connection');
                }

                // Double-check connection state
                if (!this.socket?.hasJoined || this.socket?.connection?.readyState !== 1) {
                    throw new Error('Connection state mismatch after reconnection');
                }

                // Wait a bit to ensure connection is stable
                await new Promise(resolve => setTimeout(resolve, 500));

                console.log('Reconnected successfully, attempting to draw card...');
                return await this.sendDrawCardRequest(type);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.warn(`Attempt ${attempts + 1} failed:`, errorMessage);
                attempts++;
                
                if (attempts >= maxAttempts) {
                    throw new Error('Maximum reconnection attempts reached');
                }
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw new Error('Failed to establish connection after multiple attempts');
    }

    private async sendDrawCardRequest(type: 'assist' | 'number'): Promise<void> {
        // Ensure connection is in a good state
        const connected = await this.waitForConnection(5000);
        if (!connected) {
            throw new Error('Connection not stable for sending messages');
        }

        if (!this.socket?.hasJoined || this.socket.connection?.readyState !== 1) {
            throw new Error('Socket not in valid state for sending messages');
        }

        const socket = this.socket;
        let messageHandlersRegistered = false;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanupListeners();
                reject(new Error('Draw card request timed out'));
            }, 10000);

            const onCardDrawn = (message: any) => {
                console.log('Received cardDrawn message:', message);
                if (message.type === type) {
                    cleanupListeners();
                    resolve();
                }
            };

            const onError = (error: any) => {
                console.error('Received error from server:', error);
                cleanupListeners();
                reject(new Error(error.error || 'Failed to draw card'));
            };

            const onStateChange = () => {
                // Monitor connection state changes during request
                if (!socket.hasJoined || socket.connection?.readyState !== 1) {
                    cleanupListeners();
                    reject(new Error('Connection lost during draw request'));
                }
            };

            const cleanupListeners = () => {
                console.log('Cleaning up draw card listeners');
                clearTimeout(timeout);
                
                if (messageHandlersRegistered && socket) {
                    try {
                        // Remove message handlers
                        socket.removeAllListeners();
                        // Re-initialize basic room listeners
                        this.setupListeners();
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        console.warn('Error during listener cleanup:', errorMessage);
                    }
                }
            };

            try {
                // Final connection check before sending
                if (!socket.hasJoined || socket.connection?.readyState !== 1) {
                    throw new Error('Connection lost while setting up draw request');
                }

                // Add message listeners
                socket.onMessage('cardDrawn', onCardDrawn);
                socket.onMessage('error', onError);
                socket.onStateChange(onStateChange);
                messageHandlersRegistered = true;

                // Send the draw card request
                console.log(`Sending drawCard request for ${type}`);
                socket.send('drawCard', { type });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error('Error during draw card setup:', errorMessage);
                cleanupListeners();
                reject(new Error(`Failed to setup draw card request: ${errorMessage}`));
            }
        });
    }

    public async drawCard(type: 'assist' | 'number'): Promise<void> {
        console.log(`Attempting to draw ${type} card...`);
        
        if (this.isDestroyed || this.cleanupStarted) {
            throw new Error('Socket manager is being destroyed');
        }

        // Validate connection before proceeding
        const isConnected = await this.validateConnection();
        if (!isConnected) {
            throw new Error('Failed to establish connection');
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Draw card request timed out'));
            }, 10000); // Increased timeout for validation

            const cleanup = () => {
                clearTimeout(timeout);
                if (this.socket) {
                    // Remove all message handlers and re-initialize base listeners
                    this.socket.removeAllListeners();
                    this.setupListeners();
                }
            };

            try {
                if (!this.socket) {
                    throw new Error('Socket not available');
                }

                // Create message handlers
                const drawValidatedHandler = (message: any) => {
                    if (message.type === type) {
                        // Server validated the draw
                        console.log('Draw validated by server:', message);
                        cleanup();
                        resolve();
                    }
                };

                const drawRejectedHandler = (error: any) => {
                    console.error('Draw rejected by server:', error);
                    cleanup();
                    
                    // Emit event for game scene to handle rejection (revert local state)
                    if (this.scene && !this.scene.isDestroyed) {
                        this.scene.events.emit('drawRejected', {
                            type,
                            error: error.error || 'Failed to draw card'
                        });
                    }
                    
                    reject(new Error(error.error || 'Failed to draw card'));
                };

                // Register validation handlers
                this.socket.onMessage('drawValidated', drawValidatedHandler);
                this.socket.onMessage('drawRejected', drawRejectedHandler);

                // Send the draw request for validation
                console.log(`Sending drawCard request for ${type}`);
                this.socket.send('drawCard', { type });

            } catch (error) {
                cleanup();
                reject(new Error('Failed to send draw card request'));
            }
        });
    }

    public playCard(cardIndex: number, tileIndex: number): void {
        if (!this.isConnected() || this.isDestroyed || this.cleanupStarted || !this.isInitialized) return;
        try {
            this.socket?.send('playCard', { cardIndex, tileIndex });
        } catch (error) {
            console.warn('Error sending playCard:', error);
        }
    }

    public endTurn(): void {
        if (!this.isConnected() || this.isDestroyed || this.cleanupStarted || !this.isInitialized) return;
        try {
            this.socket?.send('endTurn');
        } catch (error) {
            console.warn('Error sending endTurn:', error);
        }
    }

    public exitRoom(): void {
        if (!this.socket || this.isDestroyed || this.cleanupStarted || !this.isInitialized) {
            console.warn('Cannot exit room: Socket not in valid state');
            return;
        }
        
        try {
            // Store socket reference before cleanup
            const socket = this.socket;
            
            // First notify other players we're leaving
            socket.send('playerLeaving');
            
            // Mark as destroyed to prevent further operations
            this.isDestroyed = true;
            
            // Leave the room before cleanup
            socket.leave();
            
            // Finally cleanup everything else
            this.cleanup();
            
            console.log('Successfully exited room');
        } catch (error) {
            console.error('Error exiting room:', error);
            // Even if there's an error, we should mark as destroyed
            this.isDestroyed = true;
            // Still try to cleanup
            this.cleanup();
        }
    }

    public isConnected(): boolean {
        // Consider connection active if socket exists and has joined, without relying on readyState
        return !!(this.socket && this.socket.hasJoined);
    }

    emitCardSelect(card: GameObjects.GameObject): void {
        if (!this.socket) return;

        try {
            this.socket.send('cardSelect', {
                cardId: (card as any).cardId
            });
        } catch (error) {
            console.error('Error sending card select:', error);
            this.scene.showErrorMessage('Failed to select card');
        }
    }

    emitTileClick(tileIndex: number): void {
        if (!this.socket) return;

        try {
            this.socket.send('tileClick', {
                tileIndex: tileIndex
            });
        } catch (error) {
            console.error('Error sending tile click:', error);
            this.scene.showErrorMessage('Failed to select tile');
        }
    }

    public async reconnect(): Promise<boolean> {
        console.log('Attempting to reconnect...');
        return this.attemptReconnection();
    }
} 