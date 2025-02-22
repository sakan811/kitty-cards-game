import { Server, Origins } from 'boardgame.io/dist/cjs/server';
import { NoKittyCardsGame } from '../js/game/NoKittyCardsGame';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import koaStatic from 'koa-static';
import cors from '@koa/cors';
import type { Context, Next } from 'koa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = new Server({
  games: [NoKittyCardsGame],
  origins: [
    // Allow localhost in development
    Origins.LOCALHOST,
    Origins.LOCALHOST_IN_DEVELOPMENT,
    // Allow your game site to connect
    process.env.NODE_ENV === 'production' ? 'https://yourgame.com' : '*'
  ],
});

const PORT = Number(process.env.PORT) || 8000;

// Add CORS middleware
server.app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://yourgame.com' 
    : '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Add health check endpoint
server.app.use(async (ctx: Context, next: Next) => {
  if (ctx.path === '/health') {
    ctx.status = 200;
    ctx.body = { status: 'ok' };
    return;
  }
  await next();
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const frontEndAppBuildPath = path.resolve(__dirname, '../dist');
  server.app.use(koaStatic(frontEndAppBuildPath));
}

server.run(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 