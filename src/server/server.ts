import { Server, Origins } from 'boardgame.io/server';
import { NoKittyCardsGame } from '../js/game/NoKittyCardsGame';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { Middleware } from 'koa';

const server = Server({
  games: [NoKittyCardsGame],
  origins: [Origins.LOCALHOST],
});

// Enable CORS for all origins in development
const corsOptions = {
  origin: process.env.NODE_ENV === 'development' ? '*' : 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true,
};

// Use type casting to unknown first to satisfy TypeScript
server.app.use(cors(corsOptions) as unknown as Middleware);
server.app.use(express.json() as unknown as Middleware);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const frontEndAppBuildPath = path.resolve(__dirname, '../dist');
  server.app.use(express.static(frontEndAppBuildPath) as unknown as Middleware);
}

const PORT = Number(process.env.PORT) || 8000;

server.run(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 