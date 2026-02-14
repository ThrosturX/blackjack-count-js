/* --- CONSTANTS --- */
const SUITS = ['♥', '♠', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const EXTENDED_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'C', 'Q', 'K', 'A'];
const EXTENDED_FACE_VALUES = ['J', 'C', 'Q', 'K'];
const EXTENDED_RANKS = { A: 1, J: 11, C: 12, Q: 13, K: 14 };

function getRandomRotation() {
    let max = 3;
    let min = -2;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* --- CARD CLASS --- */
class Card {
    constructor(suit, val) {
        this.suit = suit;
        this.val = val;
        this.hidden = false;
        this.isSplitCard = false;
        this.rotation = getRandomRotation();
    }
    get rank() {
        if (typeof window !== 'undefined' && window.CardRankOverrides && Number.isFinite(window.CardRankOverrides[this.val])) {
            return window.CardRankOverrides[this.val];
        }
        if (this.val === 'A') return 1;
        if (this.val === 'J') return 11;
        if (this.val === 'C') return 12;
        if (this.val === 'Q') return 12;
        if (this.val === 'K') return 13;
        return parseInt(this.val);
    }
    // removed count getter as it is game specific

    get color() { return (this.suit === '♥' || this.suit === '♦') ? 'red' : 'black'; }
}

// Export for Node.js environments (for testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Card, SUITS, VALUES, EXTENDED_VALUES, EXTENDED_FACE_VALUES, EXTENDED_RANKS };
}
