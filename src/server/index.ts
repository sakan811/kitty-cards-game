import express from 'express';
import { Server } from 'boardgame.io/server';
import cors from 'cors';
import { NoKittyCardsGame } from '@/js/game/NoKittyCardsGame';

const server = Server({
  games: [NoKittyCardsGame],
});

const app = express();
app.use(cors());

// Add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Mount the boardgame.io server
const lobbyServer = server.app;
app.use(lobbyServer);

const PORT = process.env.PORT || 8000;

server.run(PORT, () => {
  console.log(`Serving at: http://localhost:${PORT}/`);
}); 