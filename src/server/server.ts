import { Server, Origins } from 'boardgame.io/dist/cjs/server';
import { NoKittyCardsGame } from '../js/game/NoKittyCardsGame';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = Server({
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

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const frontEndAppBuildPath = path.resolve(__dirname, '../dist');
  server.app.use(require('koa-static')(frontEndAppBuildPath));
}

server.run(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 