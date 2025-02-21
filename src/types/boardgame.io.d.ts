declare module 'boardgame.io/dist/cjs/server' {
  import { Game } from 'boardgame.io';
  import { Server as KoaServer } from 'koa';

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