import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SERVER_CONFIG, RATE_LIMIT_CONFIG } from './config/gameConfig.js';
import { setupSocketHandlers } from './handlers/socketHandlers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: SERVER_CONFIG.cors
});

// Configure rate limiter for production only
if (process.env.NODE_ENV !== 'development') {
    const limiter = rateLimit(RATE_LIMIT_CONFIG);
    app.use(limiter);
}

// Serve static files from 'src' directory
app.use(express.static(join(__dirname, '..', 'src'), {
    setHeaders: (res, path) => {
        // Set proper MIME types for JavaScript modules
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
        // Enable CORS for development
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
}));

// Handle client-side routing for Phaser
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'src', 'index.html'));
});

// Setup Socket.IO handlers
setupSocketHandlers(io);

// Start server
httpServer.listen(SERVER_CONFIG.port, () => {
    console.log(`Game server running at http://localhost:${SERVER_CONFIG.port}`);
}); 