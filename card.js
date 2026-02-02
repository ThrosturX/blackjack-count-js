/* --- CONSTANTS --- */
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/* --- CARD CLASS --- */
class Card {
    constructor(suit, val) {
        this.suit = suit;
        this.val = val;
        this.hidden = false;
        this.isSplitCard = false;
    }
    get num() {
        if (['J', 'Q', 'K'].includes(this.val)) return 10;
        if (this.val === 'A') return 11;
        return parseInt(this.val);
    }
    // removed count getter as it is game specific

    get color() { return (this.suit === '♥' || this.suit === '♦') ? 'red' : 'black'; }
}

// Export for Node.js environments (for testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Card, SUITS, VALUES };
}
