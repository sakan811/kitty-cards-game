import { Scene, GameObjects } from 'phaser';
import { Room, Client } from 'colyseus';
import GameScene from '../scenes/GameScene';

interface GameState {
    tiles: Array<{
        cupColor?: string;
        tileIndex?: number;
    }>;
    currentPlayer: string;
    players: Record<string, any>;
}

interface IGameScene extends Scene {
    socket: Room;
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
}

export class SocketManager {
    private scene: IGameScene;
    private socket: ExtendedRoom | null = null;
    private listeners: Map<string, Function> = new Map();
    private isDestroyed: boolean;
    private cleanupStarted: boolean;
    private isInitialized: boolean;

    constructor(scene: Scene) {
        // Basic type check first
        const gameScene = scene as IGameScene;
        
        // Initialize basic properties
        this.scene = gameScene;
        this.socket = gameScene.socket as unknown as ExtendedRoom;
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
        this.socket.onMessage('*', (client: Client<any, any>, type: string | number, message: any) => {
            if (this.isDestroyed || this.cleanupStarted || !this.isInitialized) return;
            
            if (type === 'gameState') {
                console.log('Game state update received:', message);
                this.scene.handleGameUpdate({
                    type: 'gameState',
                    gameState: message
                });
            } else if (type === 'error') {
                console.error('Socket error:', message);
                this.scene.showErrorMessage(message.error);
            } else if (type === 'disconnect') {
                console.log('Disconnected from server');
                this.scene.showErrorMessage('Disconnected from server');
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
    public drawCard(): void {
        if (!this.isConnected() || this.isDestroyed || this.cleanupStarted || !this.isInitialized) return;
        try {
            this.socket?.send('drawCard');
        } catch (error) {
            console.warn('Error sending drawCard:', error);
        }
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
        return Boolean(this.socket?.hasJoined && !this.isDestroyed && !this.cleanupStarted && this.isInitialized);
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

    private async attemptReconnection(retries: number = 3, delay: number = 1000): Promise<void> {
        if (this.isDestroyed || this.cleanupStarted || !this.isInitialized) return;
        
        for (let i = 0; i < retries; i++) {
            try {
                console.log(`Reconnection attempt ${i + 1}/${retries}`);
                
                // Wait before attempting reconnection
                await new Promise(resolve => setTimeout(resolve, delay));
                
                if (this.socket && this.socket.hasJoined) {
                    console.log('Already reconnected');
                    return;
                }
                
                // Attempt to rejoin the room
                if (this.scene && this.scene.socket) {
                    // Reconnect using the room's reconnect method
                    await (this.scene.socket as any).reconnect();
                    console.log('Reconnection successful');
                    return;
                }
            } catch (error) {
                console.warn(`Reconnection attempt ${i + 1} failed:`, error);
                // Increase delay for next attempt
                delay *= 1.5;
            }
        }
        
        // If all retries failed, emit error
        if (this.scene && !this.scene.isDestroyed) {
            this.scene.events.emit('gameError', 'Failed to reconnect to game');
        }
    }
} 