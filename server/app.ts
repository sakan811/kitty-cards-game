import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { GameRoom } from './rooms/GameRoom';

// Server configuration
const SERVER_CONFIG = {
    port: Number(process.env.PORT) || 3000
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Limit each IP to 100 requests per windowMs
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Enable CORS with specific options
app.use(cors({
    origin: '*', // Allow all origins
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const httpServer = createServer(app);

// Configure rate limiter for production only
if (process.env.NODE_ENV !== 'development') {
    const limiter = rateLimit(RATE_LIMIT_CONFIG);
    app.use(limiter);
}

// Create Colyseus server with WebSocket transport
const gameServer = new Server({
    transport: new WebSocketTransport({
        server: httpServer,
        pingInterval: 1000,
        pingMaxRetries: 3,
        verifyClient: (info, next) => {
            console.log('Accepting connection from:', info.origin);
            next(true);
        }
    })
});

// Add WebSocket error handling
httpServer.on('upgrade', (request, socket, head) => {
    socket.on('error', (err) => {
        console.error('WebSocket error:', err);
    });
});

// Register game room with options
gameServer.define('game_room', GameRoom, {
    maxClients: 2,
    allowReconnection: true,
    reconnectionTimeout: 60,
    retryTimes: 3,
    retryDelay: 2000,
    // Development settings
    ...((process.env.NODE_ENV === 'development') ? {
        presence: false,
        reconnectionTimeout: 120
    } : {})
})
.enableRealtimeListing();

// Serve static files based on environment
if (process.env.NODE_ENV === 'development') {
    // In development, serve from src directory
    app.use(express.static(join(__dirname, '..', 'src')));
    app.use('/assets', express.static(join(__dirname, '..', 'src', 'assets')));
    
    // Serve Colyseus monitor
    app.use("/colyseus", monitor());
} else {
    // In production, serve from dist directory
    app.use(express.static(join(__dirname, '..', 'dist')));
    app.use('/assets', express.static(join(__dirname, '..', 'src', 'assets')));
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start server
gameServer.listen(SERVER_CONFIG.port)
    .then(() => {
        console.log(`Game server running at http://localhost:${SERVER_CONFIG.port}`);
        console.log(`WebSocket server is ready for connections`);
    })
    .catch(err => {
        console.error('Failed to start server:', err);
        process.exit(1);
    }); 