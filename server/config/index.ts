export const config = {
    server: {
        port: Number(process.env.PORT) || 3000,
        cors: {
            origin: process.env.NODE_ENV === 'production'
                ? 'https://your-production-domain.com'
                : 'http://localhost:5173',
            methods: ['GET', 'POST']
        }
    },
    game: {
        maxPlayers: 2,
        reconnectTimeout: 60000,
        turnTimeout: 60000
    }
}; 