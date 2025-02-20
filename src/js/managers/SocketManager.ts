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
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

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
            this.startHeartbeat();
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

        // Handle connection state changes
        if (this.socket.connection) {
            // Use the WebSocket directly if available
            const ws = (this.socket.connection as any)?.ws;
            if (ws) {
                // Listen for WebSocket close events
                ws.addEventListener('close', async (event: CloseEvent) => {
                    if (this.isDestroyed || this.cleanupStarted) return;
                    
                    console.log('WebSocket closed:', event.code, event.reason);
                    // Stop heartbeat when connection is lost
                    this.stopHeartbeat();
                    
                    // Attempt reconnection
                    const reconnected = await this.validateConnection();
                    if (reconnected) {
                        console.log('Successfully reconnected after close');
                        this.startHeartbeat();
                    } else {
                        console.error('Failed to reconnect after close');
                        if (this.scene && !this.scene.isDestroyed) {
                            this.scene.showErrorMessage('Connection lost. Attempting to reconnect...');
                        }
                    }
                });

                // Listen for WebSocket error events
                ws.addEventListener('error', async (event: Event) => {
                    if (this.isDestroyed || this.cleanupStarted) return;
                    
                    console.error('WebSocket error:', event);
                    // Attempt reconnection on error
                    await this.validateConnection();
                });
            }
        }

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
            this.stopHeartbeat();
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
    private async connect(): Promise<Client> {
        try {
            // Create new client without reconnection
            const client = new Client(this.endpoint);
            return client;
        } catch (error) {
            console.error('Failed to connect to server:', error);
            throw error;
        }
    }

    private async attemptReconnection(retries: number = 3, delay: number = 1000): Promise<boolean> {
        if (this.isDestroyed || this.cleanupStarted || !this.isInitialized) return false;
        
        for (let i = 0; i < retries; i++) {
            try {
                console.log(`Reconnection attempt ${i + 1}/${retries}`);
                
                // Store session info before any cleanup
                const sessionId = this.socket?.sessionId;
                const roomId = this.socket?.roomId;

                if (!sessionId || !roomId) {
                    console.warn('Missing session or room ID for reconnection');
                    continue;
                }

                // If socket exists and is in a bad state, clean it up
                if (this.socket) {
                    const wsState = this.socket.connection?.readyState ?? this.socket.readyState;
                    if (wsState === WebSocketState.CLOSING || wsState === WebSocketState.CLOSED) {
                        try {
                            await this.socket.leave();
                        } catch (error) {
                            console.warn('Error leaving room:', error);
                        }
                        // Remove all listeners from the old socket
                        this.removeListeners();
                    }
                }

                // Wait before attempting reconnection with progressive delay
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(1.5, i)));

                try {
                    // Create new client and attempt to rejoin with the same sessionId
                    console.log('Creating new client and rejoining room...');
                    const client = await this.connect();
                    
                    // Join the room with the same sessionId to maintain state
                    const newSocket = await client.joinById(roomId, { 
                        sessionId: sessionId,
                        retryTimes: 3,
                        requestId: Date.now()
                    }) as ExtendedRoom;
                    
                    if (!newSocket) {
                        throw new Error('Failed to create new socket connection');
                    }

                    // Update socket reference
                    this.socket = newSocket;

                    // Wait for connection to stabilize
                    const connected = await this.waitForConnection(5000);
                    if (!connected) {
                        throw new Error('Failed to establish stable connection');
                    }

                    // Double-check connection state
                    if (!this.socket.hasJoined || this.socket.connection?.readyState !== WebSocketState.OPEN) {
                        throw new Error('Connection state mismatch after reconnection');
                    }

                    // Re-setup listeners for the new socket
                    this.setupListeners();
                    // Restart heartbeat
                    this.startHeartbeat();
                    console.log('Reconnection successful');
                    return true;

                } catch (reconnectError) {
                    console.warn(`Reconnection attempt ${i + 1} failed:`, reconnectError);
                    // If this is the last attempt, throw the error
                    if (i === retries - 1) throw reconnectError;
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

        // Get the raw WebSocket if available
        const ws = (this.socket.connection as any)?.ws;
        const wsState = ws?.readyState ?? this.socket.connection?.readyState ?? this.socket.readyState;

        // Check both the socket join state and WebSocket state
        const isValid = this.socket.hasJoined && wsState === WebSocketState.OPEN;

        if (!isValid) {
            console.log('Socket validation failed:', {
                hasJoined: this.socket.hasJoined,
                wsState,
                expectedState: WebSocketState.OPEN
            });

            // If WebSocket is closed but hasJoined is true, the connection was lost
            if (this.socket.hasJoined && wsState !== WebSocketState.OPEN) {
                console.log('WebSocket connection lost, attempting reconnection...');
                // Stop heartbeat before reconnection attempt
                this.stopHeartbeat();
                const success = await this.attemptReconnection();
                if (success) {
                    // Restart heartbeat after successful reconnection
                    this.startHeartbeat();
                }
                return success;
            }

            return false;
        }

        return true;
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

    public async drawCard(type: 'assist' | 'number'): Promise<void> {
        console.log(`Attempting to draw ${type} card...`);
        
        if (this.isDestroyed || this.cleanupStarted) {
            throw new Error('Socket manager is being destroyed');
        }

        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
            try {
                // Check if we have a valid socket
                if (!this.socket?.hasJoined) {
                    // Try to reconnect
                    const reconnected = await this.validateConnection();
                    if (!reconnected) {
                        throw new Error('Failed to establish connection');
                    }
                }

                // Double check socket state
                const wsState = this.socket?.connection?.readyState ?? WebSocketState.CLOSED;
                if (wsState !== WebSocketState.OPEN) {
                    throw new Error('Socket not in OPEN state');
                }

                // Use the robust sendDrawCardRequest method
                await this.sendDrawCardRequest(type);

                // Only emit success event after server confirms
                if (this.scene && !this.scene.isDestroyed) {
                    this.scene.events.emit('cardDrawn', {
                        type,
                        success: true
                    });
                }

                // If we get here, the operation was successful
                return;

            } catch (error) {
                retries++;
                console.warn(`Draw card attempt ${retries} failed:`, error);

                if (retries >= maxRetries) {
                    console.error('Error drawing card after all retries:', error);
                    if (this.scene && !this.scene.isDestroyed) {
                        const errorMsg = error instanceof Error ? error.message : 'Failed to draw card';
                        this.scene.showErrorMessage(errorMsg);
                        throw error;
                    }
                }

                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
            }
        }
    }

    private async sendDrawCardRequest(type: 'assist' | 'number'): Promise<void> {
        // Validate connection before attempting to send
        const isValid = await this.validateConnection();
        if (!isValid) {
            throw new Error('Failed to establish valid connection');
        }

        if (!this.socket?.hasJoined) {
            throw new Error('Socket not connected');
        }

        const socket = this.socket; // Store reference to avoid null checks

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanupListeners();
                reject(new Error('Draw card request timed out'));
            }, 10000);

            const onCardDrawn = (message: any) => {
                if (message.type === type) {
                    cleanupListeners();
                    resolve();
                }
            };

            const onError = (error: any) => {
                cleanupListeners();
                reject(new Error(error.error || 'Failed to draw card'));
            };

            const cleanupListeners = () => {
                clearTimeout(timeout);
                socket.removeListener('cardDrawn', onCardDrawn);
                socket.removeListener('error', onError);
            };

            try {
                // Add message listeners
                socket.onMessage('cardDrawn', onCardDrawn);
                socket.onMessage('error', onError);

                // Send the draw card request
                console.log(`Sending drawCard request for ${type}`);
                socket.send('drawCard', { type });
            } catch (error) {
                cleanupListeners();
                reject(error);
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

    private startHeartbeat(): void {
        // Clear any existing heartbeat
        this.stopHeartbeat();

        // Start new heartbeat interval
        this.heartbeatInterval = setInterval(async () => {
            try {
                if (!this.socket || this.isDestroyed || this.cleanupStarted) {
                    this.stopHeartbeat();
                    return;
                }

                const wsState = (this.socket.connection as any)?.ws?.readyState ?? 
                              this.socket.connection?.readyState ?? 
                              this.socket.readyState;

                if (wsState === WebSocketState.OPEN) {
                    this.socket.send('heartbeat');
                } else {
                    console.log('Connection not open during heartbeat, validating...');
                    const isValid = await this.validateConnection();
                    if (!isValid) {
                        console.warn('Failed to validate connection during heartbeat');
                        this.stopHeartbeat();
                    }
                }
            } catch (error) {
                console.warn('Error during heartbeat:', error);
                await this.validateConnection();
            }
        }, this.HEARTBEAT_INTERVAL);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
} 