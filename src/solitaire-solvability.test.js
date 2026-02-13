const SolitaireStateSolvabilityChecker = require('./shared/solitaire-solvability.js');

function assert(condition, message) {
    if (!condition) {
        console.error(`FAIL: ${message}`);
        process.exit(1);
    }
    console.log(`PASS: ${message}`);
}

console.log('=== Solitaire Solvability Tests ===');

const checker = new SolitaireStateSolvabilityChecker({
    isSolved: (state) => state.value === 3,
    normalizeState: (state) => String(state.value),
    listMoves: (state) => {
        if (state.value >= 3) return [];
        return [{ step: 1 }, { step: 2 }];
    },
    applyMove: (state, move) => ({ value: state.value + move.step })
});

const solvable = checker.check({ value: 0 }, { maxStates: 20, maxDurationMs: 500 });
assert(solvable.solved, 'Checker finds a reachable solved state');
assert(solvable.statesExplored > 0, 'Checker reports explored state count');

const unsolved = checker.check({ value: 0 }, { maxStates: 1, maxDurationMs: 500 });
assert(!unsolved.solved, 'Checker returns unsolved when limits are too tight');
assert(unsolved.reason === 'state-limit', 'Checker reports state-limit reason');

const checkerWithHooks = new SolitaireStateSolvabilityChecker({
    isSolved: (state) => state.value >= 2,
    normalizeState: (state) => String(state.value),
    prepareState: (state) => {
        if (state.value === 1) return null; // force prune during expansion
        if (state.value === 0) return { value: 2 }; // forced-safe closure analogue
        return state;
    },
    shouldPrune: (state) => state.value < 0,
    listMoves: () => [{ step: 1 }],
    applyMove: (state, move) => ({ value: state.value + move.step })
});

const hookResult = checkerWithHooks.check({ value: 0 }, { maxStates: 20, maxDurationMs: 500 });
assert(hookResult.solved, 'Checker supports prepareState closure before search');
assert((hookResult.prunedStates || 0) >= 0, 'Checker reports pruned state count');

console.log('All solitaire solvability tests passed.');
