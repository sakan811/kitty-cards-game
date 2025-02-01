export const SERVER_CONFIG = {
    port: 3000,
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
};

export const RATE_LIMIT_CONFIG = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Limit each IP to 100 requests per windowMs
};

export const GAME_CONFIG = {
    maxPlayers: 2,
    minPlayers: 2,
    numberDeckSize: 20,
    maxNumberValue: 10
}; 