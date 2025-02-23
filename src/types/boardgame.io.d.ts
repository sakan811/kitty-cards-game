declare module 'boardgame.io/dist/cjs/server' {
  import type { Game } from 'boardgame.io';
  import type { Server as KoaServer } from 'koa';

  export interface ServerConfig {
    games: Game[];
    origins?: (string | RegExp)[];
  }

  export class Server {
    constructor(config: ServerConfig);
    app: KoaServer;
    run(port: number, callback?: () => void): void;
  }

  export class Origins {
    static LOCALHOST: string;
    static LOCALHOST_IN_DEVELOPMENT: string;
  }
}

declare module 'boardgame.io' {
  export interface Ctx {
    numPlayers: number;
    turn: number;
    currentPlayer: string;
    playOrder: string[];
    playOrderPos: number;
    phase: string | null;
    activePlayers: null | { [key: string]: string };
  }

  export const INVALID_MOVE: "INVALID_MOVE";

  export interface Game<T = any> {
    name?: string;
    setup?: (ctx: Ctx) => T;
    moves?: {
      [key: string]: (G: T, ctx: Ctx, ...args: any[]) => T | typeof INVALID_MOVE;
    };
    turn?: {
      minMoves?: number;
      maxMoves?: number;
      order?: {
        first: () => number;
        next: ({ ctx }: { ctx: Ctx }) => number;
      };
    };
    endIf?: (G: T, ctx: Ctx) => any;
  }
} 