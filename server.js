import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

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