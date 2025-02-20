import { Scene } from 'phaser';
import { io, Socket } from 'socket.io-client';
import type { GameScene as IGameScene } from '../types/game';

interface IGameState {
    tiles: Array<{
        cupColor?: string;
        tileIndex?: number;
        hasNumber?: boolean;
        number?: number;
    }>;
    currentPlayer: string;
    players: Map<string, {
        id: string;
        ready: boolean;
        hasDrawnAssist: boolean;
        hasDrawnNumber: boolean;
        score: number;
        hand: Array<any>;
    }>;
}

export class SocketManager {
    private scene: IGameScene;
    private socket: Socket | null = null;
    private isDestroyed: boolean = false;
    private cleanupStarted: boolean = false;
    private isInitialized: boolean = false;
    private endpoint: string;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

    constructor(scene: IGameScene, endpoint: string) {
        console.log('[SocketManager] Initializing with endpoint:', endpoint);
        this.scene = scene;
        this.endpoint = endpoint;
        
        if (!this.validateScene()) {
            throw new Error('Invalid scene provided to SocketManager');
        }

        try {
            this.socket = io(endpoint, {
                withCredentials: true,
                autoConnect: true,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 10000
            });

            this.setupListeners();
            this.startHeartbeat();
            this.isInitialized = true;
        } catch (error) {
            console.error('[SocketManager] Failed to initialize:', error);
            throw error;
        }
    }

    private validateScene(): boolean {
        try {
            console.log('[SocketManager] Validating scene:', {
                hasScene: !!this.scene,
                hasHandleGameUpdate: typeof this.scene?.handleGameUpdate === 'function',
                hasShowErrorMessage: !!this.scene?.showErrorMessage
            });

            if (!this.scene) return false;
            if (typeof this.scene.handleGameUpdate !== 'function') return false;
            if (!this.scene.showErrorMessage) {
                console.warn('[SocketManager] UIManager not initialized, creating message handler');
                this.scene.showErrorMessage = (message: string) => {
                    console.error('[SocketManager] Game Error:', message);
                    this.scene.events.emit('gameError', message);
                };
            }
            return true;
        } catch (error) {
            console.error('[SocketManager] Error validating scene:', error);
            return false;
        }
    }

    private setupListeners(): void {
        if (!this.socket || this.cleanupStarted) return;

        // Connection events
        this.socket.on('connect', () => {
            console.log('[SocketManager] Connected to server');
            this.startHeartbeat();
        });

        this.socket.on('disconnect', (reason) => {
            console.log('[SocketManager] Disconnected:', reason);
            this.stopHeartbeat();
            
            if (reason === 'io server disconnect') {
                // Server disconnected us, try to reconnect
                this.socket?.connect();
            }
            
            if (!this.cleanupStarted && this.scene && !this.scene.isDestroyed) {
                this.scene.handleDisconnect();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('[SocketManager] Connection error:', error);
            if (!this.cleanupStarted && this.scene && !this.scene.isDestroyed) {
                this.scene.showErrorMessage('Connection error: ' + error.message);
            }
        });

        // Game state updates
        this.socket.on('gameState', (state: IGameState) => {
            if (this.isDestroyed || this.cleanupStarted) return;
            
            if (this.scene && !this.scene.isDestroyed) {
                this.scene.handleGameUpdate({
                    type: 'gameState',
                    gameState: state
                });
            }
        });

        // Card drawn events
        this.socket.on('cardDrawn', (data: any) => {
            if (this.isDestroyed || this.cleanupStarted) return;
            
            if (this.scene && !this.scene.isDestroyed) {
                this.scene.events.emit('cardDrawn', data);
            }
        });

        // Turn changed events
        this.socket.on('turnChanged', (data: any) => {
            if (this.isDestroyed || this.cleanupStarted) return;
            
            if (this.scene && !this.scene.isDestroyed) {
                this.scene.handleGameUpdate({
                    type: 'gameState',
                    gameState: { currentPlayer: data.currentTurn }
                });
            }
        });

        // Game ended events
        this.socket.on('gameEnded', (data: any) => {
            if (this.isDestroyed || this.cleanupStarted) return;
            
            if (this.scene && !this.scene.isDestroyed) {
                this.scene.handleGameEnded(data.reason);
            }
        });

        // Error events
        this.socket.on('error', (error: any) => {
            if (this.isDestroyed || this.cleanupStarted) return;
            
            if (this.scene && !this.scene.isDestroyed) {
                this.scene.showErrorMessage(error.message || 'Unknown error');
            }
        });
    }

    private removeListeners(): void {
        if (!this.socket || this.cleanupStarted) return;
        
        try {
            this.socket.removeAllListeners();
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
            
            if (this.socket) {
                this.socket.disconnect();
                this.socket = null;
            }
            
            (this.scene as any) = null;
        } catch (error) {
            console.warn('Error during SocketManager cleanup:', error);
        }
    }

    private startHeartbeat(): void {
        console.log('[SocketManager] Starting heartbeat');
        this.stopHeartbeat();

        this.heartbeatInterval = setInterval(() => {
            if (!this.socket || this.isDestroyed || this.cleanupStarted) {
                this.stopHeartbeat();
                return;
            }

            if (this.socket.connected) {
                this.socket.emit('ping', { timestamp: Date.now() });
            } else {
                console.warn('[SocketManager] Socket disconnected during heartbeat');
                this.socket.connect();
            }
        }, this.HEARTBEAT_INTERVAL);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            console.log('[SocketManager] Stopping heartbeat interval');
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    public async drawCard(type: 'assist' | 'number'): Promise<void> {
        if (this.isDestroyed || this.cleanupStarted || !this.socket) {
            throw new Error('Socket manager is being destroyed or not initialized');
        }

        return new Promise((resolve, reject) => {
            this.socket!.emit('drawCard', { type, timestamp: Date.now() }, (response: any) => {
                if (response.success) {
                    resolve();
                } else {
                    reject(new Error(response.error || 'Failed to draw card'));
                }
            });
        });
    }

    public async endTurn(): Promise<void> {
        if (this.isDestroyed || this.cleanupStarted || !this.socket) {
            throw new Error('Cannot end turn - socket manager is in invalid state');
        }

        return new Promise((resolve, reject) => {
            this.socket!.emit('endTurn', { timestamp: Date.now() }, (response: any) => {
                if (response.success) {
                    resolve();
                } else {
                    reject(new Error(response.error || 'Failed to end turn'));
                }
            });
        });
    }

    public async emitCardSelect(card: any): Promise<void> {
        if (this.isDestroyed || this.cleanupStarted || !this.socket) {
            throw new Error('Cannot select card - socket manager is in invalid state');
        }

        return new Promise((resolve, reject) => {
            this.socket!.emit('cardSelect', {
                cardId: card.cardId,
                timestamp: Date.now()
            }, (response: any) => {
                if (response.success) {
                    resolve();
                } else {
                    reject(new Error(response.error || 'Failed to select card'));
                }
            });
        });
    }

    public async emitTileClick(tileIndex: number): Promise<void> {
        if (this.isDestroyed || this.cleanupStarted || !this.socket) {
            throw new Error('Cannot click tile - socket manager is in invalid state');
        }

        return new Promise((resolve, reject) => {
            this.socket!.emit('tileClick', {
                tileIndex,
                timestamp: Date.now()
            }, (response: any) => {
                if (response.success) {
                    resolve();
                } else {
                    reject(new Error(response.error || 'Failed to click tile'));
                }
            });
        });
    }

    public async exitRoom(): Promise<void> {
        if (this.cleanupStarted || !this.socket) {
            console.log('[SocketManager] Cleanup already in progress or socket not initialized');
            return;
        }

        try {
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Exit room timeout'));
                }, 5000);

                this.socket!.emit('exitRoom', { timestamp: Date.now() }, (response: any) => {
                    clearTimeout(timeout);
                    if (response.success) {
                        resolve();
                    } else {
                        reject(new Error(response.error || 'Failed to exit room'));
                    }
                });
            });
        } catch (error) {
            console.warn('[SocketManager] Error during room exit:', error);
        } finally {
            this.cleanup();
        }
    }

    public updateDeckInteractivity(): void {
        if (this.isDestroyed || this.cleanupStarted || !this.isInitialized) {
            return;
        }

        try {
            if (this.scene && !this.scene.isDestroyed) {
                this.scene.events.emit('updateDeckInteractivity');
            }
        } catch (error) {
            console.warn('[SocketManager] Error updating deck interactivity:', error);
        }
    }
}