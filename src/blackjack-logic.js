/**
 * Core Blackjack game logic separated from UI and state management.
 */

const BlackjackLogic = {
    /**
     * Calculates the score of a hand.
     * @param {Array} cards - Array of card objects {val: string, hidden: boolean}
     * @param {boolean} peek - Whether to include hidden cards in the calculation
     * @returns {number} The calculated score
     */
    calcScore: function (cards, peek = false) {
        let s = 0;
        let a = 0;
        cards.forEach(c => {
            if (c.hidden && !peek) return;
            s += this.getCardValue(c);
            if (c.val === 'A') a++;
        });
        while (s > 21 && a > 0) { s -= 10; a--; }
        return s;
    },

    /**
     * Gets the base numeric value of a card (A=11, Face=10).
     * @param {Object} card - Card object {val: string}
     * @returns {number}
     */
    getCardValue: function (card) {
        if (['J', 'Q', 'K'].includes(card.val)) return 10;
        if (card.val === 'A') return 11;
        return parseInt(card.val);
    },

    /**
     * Checks if a hand is a natural Blackjack (21 with 2 cards).
     * @param {Array} cards - Array of card objects
     * @returns {boolean}
     */
    isBlackjack: function (cards) {
        return cards.length === 2 && this.calcScore(cards, true) === 21;
    },

    /**
     * Checks if a hand is "soft" (contains an Ace that can be 1 or 11).
     * @param {Array} cards - Array of card objects
     * @returns {boolean}
     */
    isSoftHand: function (cards) {
        let minScore = 0;
        let hasAce = false;

        for (let c of cards) {
            if (c.hidden) continue;

            if (c.val === 'A') {
                minScore += 1;
                hasAce = true;
            } else {
                minScore += this.getCardValue(c);
            }
        }

        return hasAce && (minScore + 10 <= 21);
    },

    /**
     * Determines the result of a hand compared to the dealer.
     * @param {Array} playerCards - Array of player card objects
     * @param {Array} dealerCards - Array of dealer card objects
     * @returns {string} 'win', 'lose', 'push', or 'blackjack'
     */
    determineResult: function (playerCards, dealerCards) {
        const pScore = this.calcScore(playerCards, true);
        const dScore = this.calcScore(dealerCards, true);
        const pBJ = this.isBlackjack(playerCards);
        const dBJ = this.isBlackjack(dealerCards);

        if (pScore > 21) return 'lose';
        if (pBJ && !dBJ) return 'blackjack';
        if (!pBJ && dBJ) return 'lose';
        if (pBJ && dBJ) return 'push';

        if (dScore > 21) return 'win';
        if (pScore > dScore) return 'win';
        if (pScore < dScore) return 'lose';
        return 'push';
    },

    /**
     * Gets the count value of a card for card counting (Hi-Lo system).
     * @param {Object} card - Card object
     * @returns {number} -1, 0, or 1
     */
    getCardCount: function (card) {
        if (['10', 'J', 'Q', 'K', 'A'].includes(card.val)) return -1;
        if (['2', '3', '4', '5', '6'].includes(card.val)) return 1;
        return 0;
    }
};

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlackjackLogic;
}
