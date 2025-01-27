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
        1: { hex: 0x800080, cup: 'cup-purple' },  // Purple
        2: { hex: 0xFF0000, cup: 'cup-red' },     // Red
        3: { hex: 0x008000, cup: 'cup-green' },   // Green
        4: { hex: 0x8B4513, cup: 'cup-brown' },   // Brown
        5: { hex: 0x8B4513, cup: 'cup-brown' }    // Brown
    }
};

export const DECK_VALUES = {
    number: [1, 2, 3, 4, 5],
    assist: ['A', 'B', 'C', 'D', 'E']
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