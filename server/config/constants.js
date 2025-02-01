export const TURN_STATES = {
  ASSIST_PHASE: 'assist_phase',
  NUMBER_PHASE: 'number_phase'
};

export const ASSIST_CARDS = [
    { 
        type: 'assist',
        value: 'Bye Bye',
        effect: 'remove_all_numbers',
        serverKey: 'bye-bye'
    },
    {
        type: 'assist', 
        value: 'Swap',
        effect: 'swap_tiles',
        serverKey: 'swap'
    },
    {
        type: 'assist',
        value: 'Double', 
        effect: 'double_points',
        serverKey: 'double'
    },
    {
        type: 'assist',
        value: 'Shield',
        effect: 'block_opponent', 
        serverKey: 'shield'
    },
    {
        type: 'assist',
        value: 'Draw Two',
        effect: 'draw_extra_cards',
        serverKey: 'draw-two' 
    }
]; 