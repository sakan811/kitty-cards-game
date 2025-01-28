export const CARD_DIMENSIONS = {
    width: 100,
    height: 140
};

export const HAND_CONFIG = {
    maxCards: 10,
    height: 150
};

export const COLORS = {
    cupColors: ['cup-purple', 'cup-red', 'cup-green', 'cup-brown'],
    numberColors: {
        1: { hex: '0xE0B0FF', cup: 'cup-purple' },  // Purple
        2: { hex: '0xe80c33', cup: 'cup-red' },     // Red
        3: { hex: '0x61b571', cup: 'cup-green' },   // Green
        4: { hex: '0x8B4513', cup: 'cup-brown' }    // Brown
    }
};

export const DECK_VALUES = {
    number: [1, 2, 3, 4],
    assist: ['bye-bye', 'A', 'B', 'C', 'D']
};

export const ASSIST_CARDS = {
    'bye-bye': {
        name: 'Bye-bye',
        description: 'Remove all number cards from cups',
        color: '#ff4444'
    },
    'A': { name: 'A', description: 'Regular assist card', color: '#ffffff' },
    'B': { name: 'B', description: 'Regular assist card', color: '#ffffff' },
    'C': { name: 'C', description: 'Regular assist card', color: '#ffffff' },
    'D': { name: 'D', description: 'Regular assist card', color: '#ffffff' }
};

export const ASSET_KEYS = {
    numberCard: 'number-card',
    assistCard: 'assist-card',
    cupWhite: 'cup-white',
    cupPurple: 'cup-purple',
    cupRed: 'cup-red',
    cupGreen: 'cup-green',
    cupBrown: 'cup-brown',
    cardFront: 'card-front'
}; 