export function sanitizeGameState(gameState, playerId) {
    return {
        tiles: gameState.tiles.tiles.map(tile => ({
            position: tile.position,
            hasCup: tile.hasCup,
            cupColor: tile.cupColor,
            hasNumber: tile.hasNumber,
            number: tile.number
        })),
        currentPlayer: gameState.currentPlayer,
        scores: gameState.scores,
        playerHand: gameState.hands.get(playerId),
        turnState: gameState.turnState,
        opponentHandCounts: Array.from(gameState.hands.entries())
            .filter(([id]) => id !== playerId)
            .map(([id, hand]) => ({
                playerId: id,
                numberCount: hand.filter(c => c.type === 'number').length,
                assistCount: hand.filter(c => c.type === 'assist').length
            }))
    };
}

export function sanitizeRoom(room) {
    return {
        id: room.id,
        players: room.players.map(p => ({
            id: p.id,
            ready: p.ready
        })),
        status: room.status,
        hostId: room.hostId
    };
} 