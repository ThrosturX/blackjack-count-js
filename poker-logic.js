/**
 * Poker hand evaluation logic for Texas Hold'em.
 */

const PokerLogic = {
    HAND_RANKS: {
        ROYAL_FLUSH: 10,
        STRAIGHT_FLUSH: 9,
        FOUR_OF_A_KIND: 8,
        FULL_HOUSE: 7,
        FLUSH: 6,
        STRAIGHT: 5,
        THREE_OF_A_KIND: 4,
        TWO_PAIR: 3,
        ONE_PAIR: 2,
        HIGH_CARD: 1
    },

    /**
     * Evaluates the best 5-card hand out of 7 cards.
     * @param {Array} cards - Array of 7 card objects.
     * @returns {Object} { rank, name, value, bestHand }
     */
    evaluateHand: function (cards) {
        const bestFive = this.getBestFive(cards);
        const rankInfo = this.getRank(bestFive);
        return {
            rank: rankInfo.rank,
            name: rankInfo.name,
            value: rankInfo.value, // Numerical value for comparison
            bestHand: bestFive
        };
    },

    /**
     * Brute force all 5-card combinations from 7 cards to find the best one.
     */
    getBestFive: function (cards) {
        let best = null;
        let combos = this.getCombinations(cards, 5);
        for (let combo of combos) {
            let rankInfo = this.getRank(combo);
            if (!best || this.compareRankInfo(rankInfo, best.rankInfo) > 0) {
                best = { combo, rankInfo };
            }
        }
        return best.combo;
    },

    getCombinations: function (array, k) {
        let results = [];
        function helper(start, combo) {
            if (combo.length === k) {
                results.push([...combo]);
                return;
            }
            for (let i = start; i < array.length; i++) {
                combo.push(array[i]);
                helper(i + 1, combo);
                combo.pop();
            }
        }
        helper(0, []);
        return results;
    },

    getRank: function (cards) {
        const sorted = [...cards].sort((a, b) => b.rank - a.rank);
        const isFlush = new Set(cards.map(c => c.suit)).size === 1;
        const isStraight = this.isStraight(sorted);

        const counts = {};
        cards.forEach(c => counts[c.rank] = (counts[c.rank] || 0) + 1);
        const countValues = Object.values(counts).sort((a, b) => b - a);
        const rankByCount = Object.keys(counts).sort((a, b) => {
            if (counts[b] !== counts[a]) return counts[b] - counts[a];
            return b - a;
        }).map(Number);

        if (isFlush && isStraight) {
            if (sorted[0].rank === 13 && sorted[1].rank === 12 && sorted[2].rank === 11 && sorted[3].rank === 10 && sorted[4].rank === 1) {
                return { rank: 10, name: "Royal Flush", value: 14 }; // Consistent high value
            }
            const straightRank = (sorted[0].rank === 13 && sorted[4].rank === 1 && sorted[1].rank === 5) ? 5 : this.getAdjustedRank(sorted[0].rank);
            return { rank: 9, name: "Straight Flush", value: straightRank };
        }

        if (countValues[0] === 4) return { rank: 8, name: "Four of a Kind", value: this.getAdjustedRank(rankByCount[0]) * 100 + this.getAdjustedRank(rankByCount[1]) };
        if (countValues[0] === 3 && countValues[1] === 2) return { rank: 7, name: "Full House", value: this.getAdjustedRank(rankByCount[0]) * 100 + this.getAdjustedRank(rankByCount[1]) };
        if (isFlush) return { rank: 6, name: "Flush", value: this.getKickerValue(sorted) };
        if (isStraight) {
            const straightRank = (sorted[0].rank === 13 && sorted[4].rank === 1 && sorted[1].rank === 5) ? 5 : this.getAdjustedRank(sorted[0].rank);
            return { rank: 5, name: "Straight", value: straightRank };
        }
        if (countValues[0] === 3) return { rank: 4, name: "Three of a Kind", value: this.getAdjustedRank(rankByCount[0]) * 10000 + this.getKickerValueByCount(rankByCount, 1) };
        if (countValues[0] === 2 && countValues[1] === 2) return { rank: 3, name: "Two Pair", value: this.getAdjustedRank(rankByCount[0]) * 10000 + this.getAdjustedRank(rankByCount[1]) * 100 + this.getAdjustedRank(rankByCount[2]) };
        if (countValues[0] === 2) return { rank: 2, name: "One Pair", value: this.getAdjustedRank(rankByCount[0]) * 1000000 + this.getKickerValueByCount(rankByCount, 1) };

        return { rank: 1, name: "High Card", value: this.getKickerValue(sorted) };
    },

    getAdjustedRank: function (r) {
        return r === 1 ? 14 : r;
    },

    isStraight: function (sorted) {
        // Special case: A, 2, 3, 4, 5 (Aces are 1 in card.js, but kings are 13)
        // Wait, card.js: A=1, 2=2... K=13. So A is actually 1.
        // But for straights, A can be 1 or 14 (above K).
        let ranks = [...new Set(sorted.map(c => c.rank))].sort((a, b) => a - b);
        if (ranks.length < 5) return false;

        // Check for normal straight
        for (let i = 0; i <= ranks.length - 5; i++) {
            if (ranks[i + 4] - ranks[i] === 4) return true;
        }

        // Check for Broadway (T, J, Q, K, A)
        if (ranks.includes(1) && ranks.includes(10) && ranks.includes(11) && ranks.includes(12) && ranks.includes(13)) return true;

        return false;
    },

    getKickerValue: function (sorted) {
        // Ace (1) should be treated as 14 for kicker comparison
        let val = 0;
        let power = 1;
        for (let i = sorted.length - 1; i >= 0; i--) {
            let r = sorted[i].rank === 1 ? 14 : sorted[i].rank;
            val += r * power;
            power *= 15;
        }
        return val;
    },

    getKickerValueByCount: function (rankByCount, startIndex) {
        let val = 0;
        let power = 1;
        for (let i = rankByCount.length - 1; i >= startIndex; i--) {
            let r = rankByCount[i] === 1 ? 14 : rankByCount[i];
            val += r * power;
            power *= 15;
        }
        return val;
    },

    compareRankInfo: function (a, b) {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.value - b.value;
    }
};

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PokerLogic;
}
