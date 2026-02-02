const logic = require('./logic');

function assert(condition, message) {
    if (!condition) {
        console.error('❌ FAIL: ' + message);
        process.exit(1);
    }
    console.log('✅ PASS: ' + message);
}

// Mock card objects
const A = { val: 'A' };
const K = { val: 'K' };
const Q = { val: 'Q' };
const J = { val: 'J' };
const T = { val: '10' };
const N9 = { val: '9' };
const N8 = { val: '8' };
const N7 = { val: '7' };
const N6 = { val: '6' };
const N5 = { val: '5' };
const N4 = { val: '4' };
const N3 = { val: '3' };
const N2 = { val: '2' };

console.log('Running Blackjack Logic Tests...\n');

// 1. Basic Scoring Tests
assert(logic.calcScore([N2, N3]) === 5, '2 + 3 = 5');
assert(logic.calcScore([T, N7]) === 17, '10 + 7 = 17');
assert(logic.calcScore([K, Q]) === 20, 'K + Q = 20');
assert(logic.calcScore([A, N9]) === 20, 'A + 9 = 20 (Soft)');
assert(logic.calcScore([A, N9, N2]) === 12, 'A + 9 + 2 = 12 (Hard)');
assert(logic.calcScore([A, A, N8]) === 20, 'A + A + 8 = 20');
assert(logic.calcScore([A, A, A, A, N7]) === 21, '4 Aces + 7 = 21');

// 2. Blackjack Tests
assert(logic.isBlackjack([A, T]) === true, 'A + 10 is Blackjack');
assert(logic.isBlackjack([A, K]) === true, 'A + K is Blackjack');
assert(logic.isBlackjack([A, N9, N2]) === false, 'A + 9 + 2 is NOT Blackjack (3 cards)');
assert(logic.isBlackjack([T, T]) === false, '10 + 10 is NOT Blackjack');

// 3. Soft Hand Tests
assert(logic.isSoftHand([A, N6]) === true, 'A + 6 is Soft');
assert(logic.isSoftHand([A, N6, N5]) === false, 'A + 6 + 5 is Hard 12');
assert(logic.isSoftHand([A, A, N2]) === true, 'A + A + 2 is Soft 14');

// 4. Edge Case: Player Blackjack vs Dealer 3-card 21
const pCardsBJ = [A, K];
const dCards21 = [T, N8, N3];

assert(logic.isBlackjack(pCardsBJ) === true, 'Player has Blackjack');
assert(logic.calcScore(dCards21) === 21, 'Dealer has 21');
assert(logic.isBlackjack(dCards21) === false, 'Dealer does NOT have Blackjack (3 cards)');

assert(logic.determineResult(pCardsBJ, dCards21) === 'blackjack',
    'Player Blackjack SHOULD win against Dealer 3-card 21');

// 5. Result Determination Tests
assert(logic.determineResult([T, N8], [T, N7]) === 'win', '18 vs 17 is Win');
assert(logic.determineResult([T, N8], [T, N9]) === 'lose', '18 vs 19 is Lose');
assert(logic.determineResult([T, N8], [T, N8]) === 'push', '18 vs 18 is Push');
assert(logic.determineResult([T, T, N2], [T, T]) === 'lose', 'Player Bust is Lose');
assert(logic.determineResult([T, N7], [T, T, N5]) === 'win', 'Dealer Bust is Win');

console.log('\nAll tests passed successfully! 🚀');
