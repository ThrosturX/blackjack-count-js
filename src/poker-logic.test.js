const PokerLogic = require('./poker-logic');

function assert(condition, message) {
    if (!condition) {
        console.error('❌ FAIL: ' + message);
        process.exit(1);
    }
    console.log('✅ PASS: ' + message);
}

// Mock card objects
const card = (suit, val) => {
    const ranks = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
    return { suit, val, rank: ranks[val], color: (suit === '♥' || suit === '♦') ? 'red' : 'black' };
};

console.log('Running Poker Logic Tests...\n');

// 1. High Card
const highCard = [card('♠', 'A'), card('♦', 'K'), card('♣', '5'), card('♥', '3'), card('♠', '2')];
const res1 = PokerLogic.getRank(highCard);
assert(res1.rank === 1, 'High Card detected');

// 2. One Pair
const onePair = [card('♠', 'A'), card('♦', 'A'), card('♣', '5'), card('♥', '3'), card('♠', '2')];
const res2 = PokerLogic.getRank(onePair);
assert(res2.rank === 2, 'One Pair detected');

// 3. Two Pair
const twoPair = [card('♠', 'A'), card('♦', 'A'), card('♣', 'K'), card('♥', 'K'), card('♠', '2')];
const res3 = PokerLogic.getRank(twoPair);
assert(res3.rank === 3, 'Two Pair detected');

// 4. Three of a Kind
const threeOfAKind = [card('♠', 'A'), card('♦', 'A'), card('♣', 'A'), card('♥', '3'), card('♠', '2')];
const res4 = PokerLogic.getRank(threeOfAKind);
assert(res4.rank === 4, 'Three of a Kind detected');

// 5. Straight
const straight = [card('♠', '6'), card('♦', '5'), card('♣', '4'), card('♥', '3'), card('♠', '2')];
const res5 = PokerLogic.getRank(straight);
assert(res5.rank === 5, 'Straight (2-6) detected');

const straightA = [card('♠', '5'), card('♦', '4'), card('♣', '3'), card('♥', '2'), card('♠', 'A')];
const res5A = PokerLogic.getRank(straightA);
assert(res5A.rank === 5, 'Straight (A-5) detected');

const broadway = [card('♠', 'A'), card('♦', 'K'), card('♣', 'Q'), card('♥', 'J'), card('♠', '10')];
const resBW = PokerLogic.getRank(broadway);
assert(resBW.rank === 5, 'Broadway detected');

// 6. Flush
const flush = [card('♠', 'A'), card('♠', 'K'), card('♠', 'Q'), card('♠', 'J'), card('♠', '2')];
const res6 = PokerLogic.getRank(flush);
assert(res6.rank === 6, 'Flush detected');

// 7. Full House
const fullHouse = [card('♠', 'A'), card('♦', 'A'), card('♣', 'A'), card('♥', 'K'), card('♠', 'K')];
const res7 = PokerLogic.getRank(fullHouse);
assert(res7.rank === 7, 'Full House detected');

// 8. Four of a Kind
const fourOfAKind = [card('♠', 'A'), card('♦', 'A'), card('♣', 'A'), card('♥', 'A'), card('♠', '2')];
const res8 = PokerLogic.getRank(fourOfAKind);
assert(res8.rank === 8, 'Four of a Kind detected');

// 9. Straight Flush
const straightFlush = [card('♠', '6'), card('♠', '5'), card('♠', '4'), card('♠', '3'), card('♠', '2')];
const res9 = PokerLogic.getRank(straightFlush);
assert(res9.rank === 9, 'Straight Flush detected');

// 10. Royal Flush
const royalFlush = [card('♠', 'A'), card('♠', 'K'), card('♠', 'Q'), card('♠', 'J'), card('♠', '10')];
const res10 = PokerLogic.getRank(royalFlush);
assert(res10.rank === 10, 'Royal Flush detected');

// 11. Comparison
assert(PokerLogic.compareRankInfo(res10, res9) > 0, 'Royal Flush beats Straight Flush');
assert(PokerLogic.compareRankInfo(res8, res7) > 0, 'Four of a Kind beats Full House');

// 12. Best 5 of 7
const sevenCards = [
    card('♠', 'A'), card('♦', 'A'), // Pair of Aces
    card('♣', 'K'), card('♥', 'K'), card('♠', 'K'), // Three Kings
    card('♦', '2'), card('♣', '3')
];
const bestRes = PokerLogic.evaluateHand(sevenCards);
console.log('Result:', JSON.stringify(bestRes, null, 2));
assert(bestRes.rank === 7, 'Best hand is Full House (K over A)');
assert(bestRes.name === "Full House", 'Full House name check');

console.log('\nAll Poker logic tests passed successfully! 🚀');
