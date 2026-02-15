const ScorpionLogic = require('./scorpion-logic');

describe('ScorpionLogic', () => {
    test('canPlaceOnTableau returns true for suited descending rank', () => {
        const card = { suit: '♠', rank: 5, color: 'black' };
        const targetCard = { suit: '♠', rank: 6, color: 'black' };
        expect(ScorpionLogic.canPlaceOnTableau(card, targetCard)).toBe(true);
    });

    test('canPlaceOnTableau returns false for different suit', () => {
        const card = { suit: '♥', rank: 5, color: 'red' };
        const targetCard = { suit: '♠', rank: 6, color: 'black' };
        expect(ScorpionLogic.canPlaceOnTableau(card, targetCard)).toBe(false);
    });

    test('canPlaceOnTableau returns false for non-descending rank', () => {
        const card = { suit: '♠', rank: 4, color: 'black' };
        const targetCard = { suit: '♠', rank: 6, color: 'black' };
        expect(ScorpionLogic.canPlaceOnTableau(card, targetCard)).toBe(false);
    });

    test('canMoveToEmptyTableau returns true only for Kings', () => {
        const king = { val: 'K' };
        const queen = { val: 'Q' };
        expect(ScorpionLogic.canMoveToEmptyTableau(king)).toBe(true);
        expect(ScorpionLogic.canMoveToEmptyTableau(queen)).toBe(false);
    });

    test('isCompleteSequence detects a full suited run K-A', () => {
        const pile = [];
        const suits = ['♠', '♥', '♦', '♣'];
        const suit = '♠';
        const vals = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'];
        for (let i = 0; i < 13; i++) {
            pile.push({ suit: suit, rank: 13 - i, val: vals[i] });
        }
        expect(ScorpionLogic.isCompleteSequence(pile)).toBe(true);

        // Break sequence
        pile[12].suit = '♥';
        expect(ScorpionLogic.isCompleteSequence(pile)).toBe(false);
    });

    test('isGameWon returns true when 4 columns have complete sequences', () => {
        const tableau = [[], [], [], [], [], [], []];
        const suits = ['♠', '♥', '♦', '♣'];
        const vals = ['K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'];

        for (let s = 0; s < 4; s++) {
            for (let i = 0; i < 13; i++) {
                tableau[s].push({ suit: suits[s], rank: 13 - i, val: vals[i] });
            }
        }

        expect(ScorpionLogic.isGameWon(tableau)).toBe(true);
    });
});
