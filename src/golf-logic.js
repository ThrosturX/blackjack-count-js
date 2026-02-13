/**
 * Golf Solitaire Game Logic
 * Pure functions for game rules and validation
 */

const GolfLogic = {
    /**
     * Checks if a card can be placed on the foundation pile in Golf.
     * Rules: One rank higher or lower than the top card, suit doesn't matter.
     * Ace can be played on King and vice versa (wrap-around).
     * @param {Card} card - The card to place.
     * @param {Card} foundationCard - The top card of the foundation pile.
     * @returns {boolean}
     */
    canPlaceOnFoundation: function (card, foundationCard, options = {}) {
        if (!card) return false;

        // If foundation is empty, any card can start it.
        // NOTE: In true Golf, the first card drawn from stock starts the foundation,
        // but for initial placement logic, this handles empty.
        if (!foundationCard) return true; // Or adapt based on deal flow

        // One rank higher or lower
        const rankDiff = Math.abs(card.rank - foundationCard.rank);

        const allowWrapAround = options.wrapAround !== false;
        const isWrapAround = allowWrapAround && (
            (card.rank === 1 && foundationCard.rank === 13) ||
            (card.rank === 13 && foundationCard.rank === 1)
        );

        return rankDiff === 1 || isWrapAround;
    },

    /**
     * Checks if the game is won in Golf Solitaire.
     * Rules: All tableau cards are cleared.
     * @param {Array<Array<Card>>} tableau - The tableau columns.
     * @returns {boolean}
     */
    isGameWon: function (tableau) {
        if (!Array.isArray(tableau) || tableau.length === 0) return false;
        return tableau.every(column => column.length === 0);
    },

    /**
     * Calculates score for a move in Golf Solitaire.
     * @param {string} moveType - Type of move.
     * @returns {number} Points awarded.
     */
    scoreMove: function (moveType) {
        const scores = {
            'tableau-to-foundation': 1,
            'waste-to-foundation': 1,
            'draw-stock': 0 // Drawing from stock doesn't add score directly
        };
        return scores[moveType] || 0;
    }
};

if (typeof window !== 'undefined') {
    window.GolfLogic = GolfLogic;
}

// Export for Node.js environments (for testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GolfLogic;
}
