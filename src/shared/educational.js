/**
 * Shared educational utilities for kids' learning games.
 * Provides common functions for card-based educational mini-games.
 */

const EducationalUtils = {
    /**
     * Creates a deck of cards filtered by difficulty level.
     * @param {number} level - Difficulty level (1-5)
     * @returns {Array} Array of Card objects
     */
    createDeckForLevel: function(level) {
        const values = this.getValuesForLevel(level);
        const deck = [];
        for (const suit of SUITS) {
            for (const val of values) {
                deck.push(new Card(suit, val));
            }
        }
        return deck;
    },

    /**
     * Gets card values allowed at a given difficulty level.
     * @param {number} level - Difficulty level (1-5)
     * @returns {Array} Array of card values
     */
    getValuesForLevel: function(level) {
        switch(level) {
            case 1: return ['2', '3', '4', '5'];
            case 2: return ['2', '3', '4', '5', '6', '7', '8', '9', '10'];
            case 3: return VALUES.slice(0, 11); // 2 through Q
            case 4: return VALUES.slice(0, 12); // 2 through K
            case 5: return VALUES; // All values including Ace
            default: return ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        }
    },

    /**
     * Gets the numeric rank of a card value.
     * @param {string} val - Card value
     * @returns {number} Numeric rank (1-13)
     */
    getRank: function(val) {
        if (val === 'A') return 1;
        if (val === 'J') return 11;
        if (val === 'C') return 12;
        if (val === 'Q') return 12;
        if (val === 'K') return 13;
        return parseInt(val, 10);
    },

    getSuitName: function(suit) {
        const labels = {
            '♥': 'Hearts',
            '♦': 'Diamonds',
            '♠': 'Spades',
            '♣': 'Clubs'
        };
        return labels[suit] || suit;
    },

    getValueLabel: function(val) {
        const labels = {
            A: 'Ace',
            J: 'Jack',
            C: 'Knight',
            Q: 'Queen',
            K: 'King'
        };
        return labels[val] || String(val);
    },

    getValueWithRank: function(val) {
        return `${this.getValueLabel(val)} (${this.getRank(val)})`;
    },

    /**
     * Shuffles an array using Fisher-Yates algorithm.
     * @param {Array} array - Array to shuffle
     * @returns {Array} New shuffled array
     */
    shuffle: function(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    /**
     * Picks random items from an array.
     * @param {Array} array - Source array
     * @param {number} count - Number of items to pick
     * @returns {Array} Array of picked items
     */
    pickRandom: function(array, count) {
        const shuffled = this.shuffle(array);
        return shuffled.slice(0, count);
    },

    /**
     * Gets the color of a card (red or black).
     * @param {Object} card - Card object with suit property
     * @returns {string} 'red' or 'black'
     */
    getCardColor: function(card) {
        return (card.suit === '♥' || card.suit === '♦') ? 'red' : 'black';
    },

    /**
     * Generates a random card from available deck.
     * @param {Array} availableDeck - Pool of cards to choose from
     * @returns {Object} Random card object
     */
    getRandomCard: function(availableDeck) {
        const idx = Math.floor(Math.random() * availableDeck.length);
        return availableDeck[idx];
    },

    /**
     * Generates a pair of different random cards.
     * @param {Array} availableDeck - Pool of cards
     * @returns {Array} Array of two different cards
     */
    getTwoDifferentCards: function(availableDeck) {
        if (availableDeck.length < 2) return [availableDeck[0], availableDeck[0]];

        const idx1 = Math.floor(Math.random() * availableDeck.length);
        let idx2;
        do {
            idx2 = Math.floor(Math.random() * availableDeck.length);
        } while (idx2 === idx1);

        return [availableDeck[idx1], availableDeck[idx2]];
    },

    /**
     * Calculates success rate from recent answers.
     * @param {Array} recentAnswers - Array of booleans (true = correct)
     * @returns {number} Success rate (0-1)
     */
    calculateSuccessRate: function(recentAnswers) {
        if (!recentAnswers || recentAnswers.length === 0) return 0;
        const correct = recentAnswers.filter(a => a).length;
        return correct / recentAnswers.length;
    },

    /**
     * Adjusts difficulty based on success rate.
     * @param {number} currentLevel - Current difficulty level
     * @param {number} successRate - Recent success rate (0-1)
     * @param {number} minLevel - Minimum difficulty (default: 1)
     * @param {number} maxLevel - Maximum difficulty (default: 5)
     * @returns {number} Adjusted difficulty level
     */
    adjustDifficulty: function(currentLevel, successRate, minLevel = 1, maxLevel = 5) {
        if (successRate > 0.85 && currentLevel < maxLevel) {
            return currentLevel + 1;
        }
        if (successRate < 0.4 && currentLevel > minLevel) {
            return currentLevel - 1;
        }
        return currentLevel;
    },

    /**
     * Saves educational game progress to localStorage.
     * @param {string} gameId - Unique game identifier
     * @param {Object} data - Progress data to save
     */
    saveProgress: function(gameId, data) {
        try {
            const key = `bj_table.edu.${gameId}`;
            const payload = {
                version: 1,
                updatedAt: Date.now(),
                data: data
            };
            localStorage.setItem(key, JSON.stringify(payload));
        } catch (err) {
            console.warn('Could not save educational progress:', err);
        }
    },

    /**
     * Loads educational game progress from localStorage.
     * @param {string} gameId - Unique game identifier
     * @returns {Object|null} Progress data or null if not found
     */
    loadProgress: function(gameId) {
        try {
            const key = `bj_table.edu.${gameId}`;
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const payload = JSON.parse(raw);
            return payload.data || null;
        } catch (err) {
            return null;
        }
    },

    /**
     * Resets educational game progress.
     * @param {string} gameId - Unique game identifier
     */
    resetProgress: function(gameId) {
        try {
            const key = `bj_table.edu.${gameId}`;
            localStorage.removeItem(key);
        } catch (err) {
            // Ignore
        }
    },

    /**
     * Gets display name for a difficulty level.
     * @param {number} level - Difficulty level
     * @returns {string} Human-readable level name
     */
    getDifficultyName: function(level) {
        const names = {
            1: 'Trivial',
            2: 'Easy',
            3: 'Medium',
            4: 'Hard',
            5: 'Expert'
        };
        return names[level] || 'Medium';
    },

    /**
     * Gets all difficulty levels for UI display.
     * @returns {Array} Array of level objects
     */
    getDifficultyLevels: function() {
        return [
            { level: 1, name: 'Trivial', description: 'Numbers 2-5 only' },
            { level: 2, name: 'Easy', description: 'Numbers 2-10' },
            { level: 3, name: 'Medium', description: 'Includes Face Cards (J-Q)' },
            { level: 4, name: 'Hard', description: 'Includes Kings' },
            { level: 5, name: 'Expert', description: 'Full deck with Aces' }
        ];
    }
};

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EducationalUtils;
}
