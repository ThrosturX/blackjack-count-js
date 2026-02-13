const { Card } = require('./card.js');
const SolitaireInsolvabilityDetector = require('./shared/solitaire-insolvability.js');

function assert(condition, message) {
    if (!condition) {
        console.error(`FAIL: ${message}`);
        process.exit(1);
    }
    console.log(`PASS: ${message}`);
}

function createCard(suit, val, hidden = false) {
    const card = new Card(suit, val);
    card.hidden = hidden;
    return card;
}

console.log('=== Solitaire Insolvability Tests ===');

const forcedKlondikeDeadlock = {
    tableau: [
        [createCard('♥', 'A', true), createCard('♥', '2', true), createCard('♥', '3', true), createCard('♥', '4', true), createCard('♥', '5', false)],
        [createCard('♠', 'A', true), createCard('♠', '2', true), createCard('♠', '3', true), createCard('♠', '4', true), createCard('♠', '5', false)],
        [createCard('♣', 'A', true), createCard('♣', '2', true), createCard('♣', '3', true), createCard('♣', '4', true), createCard('♣', '5', false)],
        [],
        [],
        [],
        []
    ],
    foundations: [[], [], [], []],
    stock: [],
    waste: []
};

const cleanKlondikeState = {
    tableau: [
        [createCard('♥', 'A', false)],
        [createCard('♠', 'A', false)],
        [createCard('♣', 'A', false)],
        [createCard('♦', 'A', false)],
        [],
        [],
        []
    ],
    foundations: [[], [], [], []],
    stock: [],
    waste: []
};

const klondikePreset = SolitaireInsolvabilityDetector.createKlondikePreset();
const klondikeBlockedResult = klondikePreset.evaluate(forcedKlondikeDeadlock);
assert(klondikeBlockedResult.isLikelyInsolvable, 'Klondike preset flags a deal with multiple static deadlock motifs');
assert(klondikeBlockedResult.matchedRules.length > 0, 'Klondike preset reports matched forbidden subgraphs');

const klondikeCleanResult = klondikePreset.evaluate(cleanKlondikeState);
assert(!klondikeCleanResult.isLikelyInsolvable, 'Klondike preset allows a simple non-deadlocked position');

const forcedFreecellInversion = {
    tableau: [
        [createCard('♥', 'A'), createCard('♥', '2')],
        [createCard('♠', 'A'), createCard('♠', '2')],
        [createCard('♣', 'A'), createCard('♣', '2')],
        [createCard('♦', 'A'), createCard('♦', '2')],
        [createCard('♥', '3'), createCard('♥', '4')],
        [createCard('♠', '3'), createCard('♠', '4')],
        [createCard('♣', '3'), createCard('♣', '4')],
        [createCard('♦', '3'), createCard('♦', '4')]
    ],
    freeCells: [null, null, null, null],
    foundations: [[], [], [], []]
};

const freecellPreset = SolitaireInsolvabilityDetector.createFreeCellPreset();
const freecellBlockedResult = freecellPreset.evaluate(forcedFreecellInversion);
assert(freecellBlockedResult.isLikelyInsolvable, 'FreeCell preset flags heavy same-suit inversion blockers');

console.log('All solitaire insolvability tests passed.');
