export function sanitizeGameState(gameState, playerId) {
    if (!gameState) return null;

    const player = gameState.players.get(playerId);
    const sanitizedPlayers = {};

    // Convert players Map to a plain object for serialization
    for (const [id, playerData] of gameState.players.entries()) {
        sanitizedPlayers[id] = {
            id: playerData.id,
            hasDrawnAssist: playerData.hasDrawnAssist,
            hasDrawnNumber: playerData.hasDrawnNumber,
            // Only include hand for the requesting player
            hand: id === playerId ? playerData.hand : []
        };
    }

    return {
        currentPlayer: gameState.currentPlayer,
        turnState: gameState.turnState,
        players: sanitizedPlayers,
        tiles: gameState.tiles,
        decks: {
            assist: { count: gameState.decks.assist.length },
            number: { count: gameState.decks.number.length }
        },
        discardPile: gameState.discardPile,
        gameEnded: gameState.gameEnded,
        scores: Object.fromEntries(gameState.scores)
    };
}

export function sanitizeRoom(room) {
    if (!room) return null;

    return {
        id: room.id,
        hostId: room.hostId,
        players: room.players.map(p => ({
            id: p.id,
            ready: p.ready
        })),
        gameStarted: room.gameStarted
    };
} 