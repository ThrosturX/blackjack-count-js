/**
 * Solitaire (Klondike) Game Logic
 * Pure functions for game rules and validation
 */

const SolitaireLogic = {
    FOUNDATION_SUIT_ORDER: ['♥', '♠', '♦', '♣'],
    /**
     * Checks if a card can be placed on a tableau pile
     * Rules: Alternating colors, descending rank
     * @param {Card} card - The card to place
     * @param {Card} targetCard - The card to place on (top of target pile)
     * @returns {boolean}
     */
    canPlaceOnTableau: function (card, targetCard) {
        if (!card || !targetCard) return false;

        // Must be alternating colors
        if (card.color === targetCard.color) return false;

        // Must be descending rank (target rank - 1)
        return card.rank === targetCard.rank - 1;
    },

    /**
     * Checks if a card can be placed on a foundation pile
     * Rules: Same suit, ascending from Ace
     * @param {Card} card - The card to place
     * @param {Array} foundationPile - The foundation pile array
     * @returns {boolean}
     */
    canPlaceOnFoundation: function (card, foundationPile) {
        if (!card) return false;

        // Empty foundation must start with Ace
        if (foundationPile.length === 0) {
            return card.val === 'A';
        }

        const topCard = foundationPile[foundationPile.length - 1];

        // Must be same suit
        if (card.suit !== topCard.suit) return false;

        // Must be ascending rank (top rank + 1)
        return card.rank === topCard.rank + 1;
    },

    /**
     * Checks if a card can be moved to an empty tableau column
     * Rules: Only Kings can be placed on empty tableau columns
     * @param {Card} card - The card to check
     * @returns {boolean}
     */
    canMoveToEmptyTableau: function (card, options = {}) {
        if (!card) return false;
        if (options.allowAnyCardOnEmpty) return true;
        return card.val === 'K';
    },

    /**
     * Checks if the game is won
     * Rules: All 4 foundations must have 13 cards (Ace through King)
     * @param {Array} foundations - Array of 4 foundation piles
     * @returns {boolean}
     */
    isGameWon: function (foundations) {
        if (!foundations || foundations.length !== 4) return false;

        return foundations.every(pile => pile.length === 13);
    },

    /**
     * Finds all cards that can be automatically moved to foundations
     * @param {Object} gameState - Current game state
     * @returns {Array} Array of {card, fromPile, toPile} objects
     */
    getAutoMoves: function (gameState) {
        const autoMoves = [];

        // Check waste pile
        if (gameState.waste.length > 0) {
            const wasteCard = gameState.waste[gameState.waste.length - 1];
            const foundationIndex = this.findAutoFoundationTarget(wasteCard, gameState.foundations);
            if (foundationIndex !== -1) {
                autoMoves.push({
                    card: wasteCard,
                    fromPile: 'waste',
                    toPile: `foundation-${foundationIndex}`
                });
            }
        }

        // Check tableau piles
        for (let col = 0; col < 7; col++) {
            const tableau = gameState.tableau[col];
            if (tableau.length > 0) {
                const topCard = tableau[tableau.length - 1];
                if (!topCard.hidden) {
                    const foundationIndex = this.findAutoFoundationTarget(topCard, gameState.foundations);
                    if (foundationIndex !== -1) {
                        autoMoves.push({
                            card: topCard,
                            fromPile: `tableau-${col}`,
                            toPile: `foundation-${foundationIndex}`
                        });
                    }
                }
            }
        }

        return autoMoves;
    },

    findAutoFoundationTarget: function (card, foundations) {
        if (!card || !Array.isArray(foundations) || foundations.length !== 4) return -1;
        const candidates = [];
        for (let i = 0; i < 4; i++) {
            if (this.canPlaceOnFoundation(card, foundations[i])) {
                candidates.push(i);
            }
        }
        if (candidates.length === 0) return -1;
        if (candidates.length === 1) return candidates[0];

        const preferredIndex = this.FOUNDATION_SUIT_ORDER.indexOf(card.suit);
        if (preferredIndex !== -1 && candidates.includes(preferredIndex)) {
            return preferredIndex;
        }
        return candidates[0];
    },

    /**
     * Calculates score for a move
     * @param {string} moveType - Type of move (waste-to-tableau, tableau-to-foundation, etc.)
     * @returns {number} Points awarded
     */
    scoreMove: function (moveType) {
        const scores = {
            'waste-to-tableau': 5,
            'waste-to-foundation': 10,
            'tableau-to-foundation': 10,
            'foundation-to-tableau': -15,
            'flip-card': 5,
            'recycle-waste': -100
        };

        return scores[moveType] || 0;
    },

    /**
     * Gets valid moves for a card
     * @param {Card} card - The card to check
     * @param {Object} gameState - Current game state
     * @returns {Array} Array of valid destination piles
     */
    getValidMoves: function (card, gameState, options = {}) {
        const validMoves = [];

        // Check foundations
        for (let i = 0; i < 4; i++) {
            if (this.canPlaceOnFoundation(card, gameState.foundations[i])) {
                validMoves.push({ type: 'foundation', index: i });
            }
        }

        // Check tableau columns
        for (let col = 0; col < 7; col++) {
            const tableau = gameState.tableau[col];
            if (tableau.length === 0) {
                if (this.canMoveToEmptyTableau(card, options)) {
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
    module.exports = SolitaireLogic;
}
