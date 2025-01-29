import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import rateLimit from 'express-rate-limit';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

// Configure rate limiter for production only
if (process.env.NODE_ENV !== 'development') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
  });
  
  // Apply rate limiter to all routes
  app.use(limiter);
}

// Serve static files from 'src' directory
app.use(express.static(join(__dirname, 'src'), {
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
  res.sendFile(join(__dirname, 'src', 'index.html'));
});

app.listen(port, () => {
  console.log(`Game server running at http://localhost:${port}`);
}); 