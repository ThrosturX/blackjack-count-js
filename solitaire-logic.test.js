/**
 * Unit tests for Solitaire game logic
 */

const { Card } = require('./card.js');
const SolitaireLogic = require('./solitaire-logic.js');

console.log('=== Solitaire Logic Tests ===\n');

// Test 1: canPlaceOnTableau - valid move
console.log('Test 1: canPlaceOnTableau - valid alternating colors');
const redSeven = new Card('♥', '7');
const blackSix = new Card('♠', '6');
console.assert(SolitaireLogic.canPlaceOnTableau(blackSix, redSeven),
    'FAILED: Black 6 should be placeable on Red 7');
console.log('✓ Passed\n');

// Test 2: canPlaceOnTableau - invalid same color
console.log('Test 2: canPlaceOnTableau - reject same color');
const redSix = new Card('♦', '6');
console.assert(!SolitaireLogic.canPlaceOnTableau(redSix, redSeven),
    'FAILED: Red 6 should NOT be placeable on Red 7');
console.log('✓ Passed\n');

// Test 3: canPlaceOnTableau - invalid rank
console.log('Test 3: canPlaceOnTableau - reject wrong rank');
const blackFive = new Card('♣', '5');
console.assert(!SolitaireLogic.canPlaceOnTableau(blackFive, redSeven),
    'FAILED: Black 5 should NOT be placeable on Red 7');
console.log('✓ Passed\n');

// Test 4: canPlaceOnFoundation - Ace on empty
console.log('Test 4: canPlaceOnFoundation - Ace on empty foundation');
const aceHearts = new Card('♥', 'A');
console.assert(SolitaireLogic.canPlaceOnFoundation(aceHearts, []),
    'FAILED: Ace should be placeable on empty foundation');
console.log('✓ Passed\n');

// Test 5: canPlaceOnFoundation - non-Ace on empty
console.log('Test 5: canPlaceOnFoundation - reject non-Ace on empty');
const twoHearts = new Card('♥', '2');
console.assert(!SolitaireLogic.canPlaceOnFoundation(twoHearts, []),
    'FAILED: 2 should NOT be placeable on empty foundation');
console.log('✓ Passed\n');

// Test 6: canPlaceOnFoundation - valid sequence
console.log('Test 6: canPlaceOnFoundation - valid same suit sequence');
console.assert(SolitaireLogic.canPlaceOnFoundation(twoHearts, [aceHearts]),
    'FAILED: 2 of Hearts should be placeable on Ace of Hearts');
const threeHearts = new Card('♥', '3');
console.assert(SolitaireLogic.canPlaceOnFoundation(threeHearts, [aceHearts, twoHearts]),
    'FAILED: 3 of Hearts should be placeable on 2 of Hearts');
console.log('✓ Passed\n');

// Test 7: canPlaceOnFoundation - wrong suit
console.log('Test 7: canPlaceOnFoundation - reject wrong suit');
const twoSpades = new Card('♠', '2');
console.assert(!SolitaireLogic.canPlaceOnFoundation(twoSpades, [aceHearts]),
    'FAILED: 2 of Spades should NOT be placeable on Ace of Hearts');
console.log('✓ Passed\n');

// Test 8: canPlaceOnFoundation - wrong rank
console.log('Test 8: canPlaceOnFoundation - reject wrong rank');
const fourHearts = new Card('♥', '4');
console.assert(!SolitaireLogic.canPlaceOnFoundation(fourHearts, [aceHearts, twoHearts]),
    'FAILED: 4 of Hearts should NOT be placeable on 2 of Hearts');
console.log('✓ Passed\n');

// Test 9: canMoveToEmptyTableau - King allowed
console.log('Test 9: canMoveToEmptyTableau - King allowed');
const kingSpades = new Card('♠', 'K');
console.assert(SolitaireLogic.canMoveToEmptyTableau(kingSpades),
    'FAILED: King should be moveable to empty tableau');
console.log('✓ Passed\n');

// Test 10: canMoveToEmptyTableau - non-King rejected
console.log('Test 10: canMoveToEmptyTableau - non-King rejected');
const queenHearts = new Card('♥', 'Q');
console.assert(!SolitaireLogic.canMoveToEmptyTableau(queenHearts),
    'FAILED: Queen should NOT be moveable to empty tableau');
console.log('✓ Passed\n');

// Test 11: isGameWon - incomplete foundations
console.log('Test 11: isGameWon - incomplete foundations');
const incompleteFoundations = [
    [aceHearts, twoHearts],
    [],
    [],
    []
];
console.assert(!SolitaireLogic.isGameWon(incompleteFoundations),
    'FAILED: Game should NOT be won with incomplete foundations');
console.log('✓ Passed\n');

// Test 12: isGameWon - complete foundations
console.log('Test 12: isGameWon - complete foundations');
const completeFoundations = [
    Array(13).fill(new Card('♥', 'A')),
    Array(13).fill(new Card('♦', 'A')),
    Array(13).fill(new Card('♣', 'A')),
    Array(13).fill(new Card('♠', 'A'))
];
console.assert(SolitaireLogic.isGameWon(completeFoundations),
    'FAILED: Game should be won with all foundations complete');
console.log('✓ Passed\n');

// Test 13: scoreMove - various move types
console.log('Test 13: scoreMove - various move types');
console.assert(SolitaireLogic.scoreMove('waste-to-tableau') === 5,
    'FAILED: waste-to-tableau should score 5 points');
console.assert(SolitaireLogic.scoreMove('tableau-to-foundation') === 10,
    'FAILED: tableau-to-foundation should score 10 points');
console.assert(SolitaireLogic.scoreMove('foundation-to-tableau') === -15,
    'FAILED: foundation-to-tableau should score -15 points');
console.log('✓ Passed\n');

// Test 14: getValidMoves - empty tableau
console.log('Test 14: getValidMoves - King to empty tableau');
const gameState = {
    tableau: [[], [], [], [], [], [], []],
    foundations: [[], [], [], []],
    waste: [],
    stock: []
};
const kingMoves = SolitaireLogic.getValidMoves(kingSpades, gameState);
console.assert(kingMoves.length === 7,
    `FAILED: King should have 7 valid moves to empty tableau, got ${kingMoves.length}`);
console.log('✓ Passed\n');

// Test 15: getValidMoves - foundation placement
console.log('Test 15: getValidMoves - Ace to foundation');
const aceMoves = SolitaireLogic.getValidMoves(aceHearts, gameState);
console.assert(aceMoves.some(m => m.type === 'foundation'),
    'FAILED: Ace should have valid foundation move');
console.log('✓ Passed\n');

console.log('=================================');
console.log('All Solitaire logic tests passed successfully! 🎉');
console.log('=================================');
