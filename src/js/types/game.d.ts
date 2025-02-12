import { Scene } from 'phaser';
import { Room } from 'colyseus.js';
import { SocketManager } from '../managers/SocketManager';
import { BoardManager } from '../managers/BoardManager';

declare module 'colyseus.js' {
    export * from '@colyseus/client';
}

declare global {
    interface Window {
        game: Phaser.Game;
    }
}

export interface TextStyle {
    fontSize?: string;
    color?: string;
    backgroundColor?: string;
    padding?: { x: number; y: number };
    stroke?: string;
    strokeThickness?: number;
    fixedWidth?: number;
    align?: string;
}

export interface GameState {
    players: Map<string, Player>;
    currentPlayer: string;
    gameStarted: boolean;
    tiles: Array<{
        cupColor?: string;
        tileIndex?: number;
    }>;
}

export interface Player {
    id: string;
    ready: boolean;
}

export interface GameScene extends Scene {
    socket: Room | null;
    socketManager: SocketManager | null;
    boardManager: BoardManager | null;
    isPlayerTurn: boolean;
    currentPhase: string;
    hasDrawnAssist: boolean;
    hasDrawnNumber: boolean;
    playerId: string;
    isDestroyed: boolean;
    isInitialized: boolean;
    showMessage(message: string, duration?: number): void;
    showErrorMessage(message: string): void;
    handleGameUpdate(data: { type: string; gameState: GameState }): void;
}

export interface TurnManager {
    onEndTurnClick(): void;
    onExitClick(): void;
} 