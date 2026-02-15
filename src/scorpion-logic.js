/**
 * Scorpion Solitaire Game Logic
 * Pure functions for game rules and validation
 */

const ScorpionLogic = {
    /**
     * Checks if a card can be placed on a tableau pile
     * Rules: Same suit, descending rank
     * @param {Card} card - The card to place
     * @param {Card} targetCard - The card to place on (top of target pile)
     * @returns {boolean}
     */
    canPlaceOnTableau: function (card, targetCard) {
        if (!card || !targetCard) return false;

        // Must be same suit
        if (card.suit !== targetCard.suit) return false;

        // Must be descending rank (target rank - 1)
        return card.rank === targetCard.rank - 1;
    },

    /**
     * Checks if a card can be moved to an empty tableau column
     * Rules: Only Kings can be placed on empty tableau columns
     * @param {Card} card - The card to check
     * @returns {boolean}
     */
    canMoveToEmptyTableau: function (card) {
        if (!card) return false;
        return card.val === 'K';
    },

    /**
     * Checks if the game is won
     * Rules: All cards must be in 4 suited sequences King to Ace in the tableau
     * @param {Array} tableau - Array of tableau columns
     * @returns {boolean}
     */
    isGameWon: function (tableau) {
        if (!tableau || tableau.length !== 7) return false;

        let completedSequences = 0;
        for (const col of tableau) {
            if (col.length === 0) continue;

            // A column might have multiple sequences or cards not part of a full sequence
            // In Scorpion, we win when all 52 cards are arranged in 4 complete suited columns
            // Actually, usually in Scorpion, you win when you have 4 suited sequences K-A.
            // Since there are 7 columns but only 4 suits, some columns must be empty.

            if (col.length === 13) {
                if (this.isCompleteSequence(col)) {
                    completedSequences++;
                }
            }
        }

        return completedSequences === 4;
    },

    /**
     * Checks if a pile of cards forms a complete suited sequence from King to Ace
     * @param {Array} pile 
     * @returns {boolean}
     */
    isCompleteSequence: function (pile) {
        if (pile.length !== 13) return false;
        if (pile[0].val !== 'K') return false;

        const suit = pile[0].suit;
        for (let i = 1; i < 13; i++) {
            if (pile[i].suit !== suit || pile[i].rank !== pile[i - 1].rank - 1) {
                return false;
            }
        }
        return true;
    },

    /**
     * Gets valid moves for a card
     * @param {Card} card - The card to check
     * @param {Object} gameState - Current game state
     * @returns {Array} Array of valid destination piles
     */
    getValidMoves: function (card, gameState) {
        const validMoves = [];

        // Check tableau columns
        for (let col = 0; col < 7; col++) {
            const tableau = gameState.tableau[col];
            if (tableau.length === 0) {
                if (this.canMoveToEmptyTableau(card)) {
                    validMoves.push({ type: 'tableau', index: col });
                }
            } else {
                const topCard = tableau[tableau.length - 1];
                if (!topCard.hidden && this.canPlaceOnTableau(card, topCard)) {
                    validMoves.push({ type: 'tableau', index: col });
                }
            }
        }

        return validMoves;
    }
};

// Export for Node.js environments (for testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScorpionLogic;
}
