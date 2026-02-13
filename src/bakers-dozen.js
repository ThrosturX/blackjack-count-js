const BAKERS_SUITS = (typeof SUITS !== 'undefined') ? SUITS : ['♥', '♦', '♣', '♠'];
const BAKERS_VALUES = (typeof VALUES !== 'undefined') ? VALUES : ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const BAKERS_COLUMNS = 13;
const FOUNDATION_SUITS = ['♥', '♦', '♣', '♠'];
const STACKED_OFFSET = 16;
const HISTORY_LIMIT = 320;
const FOUNDATION_SCORE = 10;
const TABLEAU_MOVE_SCORE = 2;
const BAKER_QUICK_CHECK_MAX_STATES = 22000;
const BAKER_QUICK_CHECK_MAX_DURATION_MS = 800;
const BAKER_DEEP_CHECK_MAX_STATES = 120000;
const BAKER_DEEP_CHECK_MAX_DURATION_MS = 4500;

const bakersSoundFiles = {
    card: ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav'],
    win: ['win.wav'],
    shuffle: ['shuffle.wav']
};

const bakerState = {
    tableau: Array.from({ length: BAKERS_COLUMNS }, () => []),
    foundations: FOUNDATION_SUITS.map(() => []),
    score: 0,
    moves: 0,
    startTime: null,
    timerInterval: null,
    isGameWon: false,
    moveHistory: []
};

let bakerStateManager = null;
let selectedCard = null;
let currentHint = null;
let scheduleBakerSizing = null;
let bakerSolvabilityChecker = null;
let bakerCheckSolvedLocked = false;
let bakerCheckUnsolvableLocked = false;

function getBakerTotalCardCount() {
    const tableauCount = Array.isArray(bakerState.tableau)
        ? bakerState.tableau.reduce((sum, col) => sum + (Array.isArray(col) ? col.length : 0), 0)
        : 0;
    const foundationsCount = Array.isArray(bakerState.foundations)
        ? bakerState.foundations.reduce((sum, pile) => sum + (Array.isArray(pile) ? pile.length : 0), 0)
        : 0;
    return tableauCount + foundationsCount;
}

function isBakerStatePlayable() {
    if (!Array.isArray(bakerState.tableau) || bakerState.tableau.length !== BAKERS_COLUMNS) return false;
    if (!bakerState.tableau.every((column) => Array.isArray(column))) return false;
    if (!Array.isArray(bakerState.foundations) || bakerState.foundations.length !== FOUNDATION_SUITS.length) return false;
    if (!bakerState.foundations.every((pile) => Array.isArray(pile))) return false;
    return getBakerTotalCardCount() === 52;
}

function getElapsedSeconds(startTime) {
    if (!Number.isFinite(startTime)) return 0;
    return Math.max(0, Math.floor((Date.now() - startTime) / 1000));
}

function formatTime(seconds) {
    const value = Number.isFinite(seconds) ? seconds : 0;
    const minutes = Math.floor(value / 60);
    const remainder = Math.floor(value % 60);
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function getBakerStackOffset() {
    if (typeof CommonUtils !== 'undefined' && typeof CommonUtils.getSolitaireStackOffset === 'function') {
        return CommonUtils.getSolitaireStackOffset(STACKED_OFFSET, { minFactor: 0.45 });
    }
    return STACKED_OFFSET;
}

function ensureBakerSizing() {
    const stackOffset = getBakerStackOffset();
    const maxCards = Math.max(4, ...bakerState.tableau.map((column) => (Array.isArray(column) ? column.length : 0)));
    const stackHeight = CommonUtils.getStackHeight(maxCards, stackOffset);

    CommonUtils.preserveHorizontalScroll({
        targets: ['bakers-scroll', 'bakers-tableau-area'],
        update: () => {
            CommonUtils.ensureTableauMinHeight({
                table: 'table',
                topRow: 'bakers-foundations',
                stackOffset,
                maxCards
            });
            document.querySelectorAll('.bakers-column').forEach((column) => {
                column.style.minHeight = `${Math.ceil(stackHeight)}px`;
            });
            CommonUtils.ensureScrollableWidth({
                table: 'bakers-tableau',
                wrapper: 'bakers-tableau-area',
                contentSelectors: ['#bakers-foundations', '#bakers-tableau']
            });
            CommonUtils.ensureScrollableWidth({
                table: 'table',
                wrapper: 'bakers-scroll',
                contentSelectors: ['#bakers-foundations', '#bakers-tableau-area']
            });
        }
    });
}

function clearSelection() {
    if (!selectedCard) return;
    selectedCard = null;
}

function clearHint() {
    if (!currentHint) return;
    const { cardEl, foundationEl, targetColumn } = currentHint;
    if (cardEl) cardEl.classList.remove('hint');
    if (foundationEl) foundationEl.classList.remove('hint');
    if (targetColumn) targetColumn.classList.remove('hint');
    currentHint = null;
}

function updateTimeDisplay() {
    const timeEl = document.getElementById('bakers-time');
    if (!timeEl) return;
    timeEl.textContent = formatTime(getElapsedSeconds(bakerState.startTime));
}

function syncBakerHighScore() {
    const highScoreEl = document.getElementById('bakers-high-score');
    if (!highScoreEl) return;
    const stored = CommonUtils.getHighScore('bakers-dozen', 'default');
    if (bakerState.score > stored) {
        highScoreEl.textContent = CommonUtils.updateHighScore('bakers-dozen', 'default', bakerState.score);
    } else {
        highScoreEl.textContent = stored;
    }
}

function updateStats() {
    const movesEl = document.getElementById('bakers-moves');
    if (movesEl) movesEl.textContent = String(bakerState.moves);
    const scoreEl = document.getElementById('bakers-score');
    if (scoreEl) scoreEl.textContent = String(bakerState.score);
    updateTimeDisplay();
    syncBakerHighScore();
}

function updateUndoButtonState() {
    const undoBtn = document.getElementById('bakers-undo');
    if (!undoBtn) return;
    undoBtn.disabled = bakerState.moveHistory.length === 0 || bakerState.isGameWon;
}

function checkForWin() {
    if (bakerState.isGameWon) return;
    if (!Array.isArray(bakerState.foundations) || bakerState.foundations.length !== FOUNDATION_SUITS.length) return;
    const finished = bakerState.foundations.every(pile => pile.length === 13);
    if (!finished) return;

    bakerState.isGameWon = true;
    stopTimer();
    showWinOverlay();
    if (bakerStateManager) bakerStateManager.clear();
}

function showWinOverlay() {
    const overlay = document.getElementById('bakers-win-overlay');
    if (!overlay) return;
    const scoreEl = document.getElementById('bakers-final-score');
    const timeEl = document.getElementById('bakers-final-time');
    if (scoreEl) scoreEl.textContent = String(bakerState.score);
    if (timeEl) timeEl.textContent = formatTime(getElapsedSeconds(bakerState.startTime));
    overlay.classList.remove('hidden');
    CommonUtils.showTableToast("You solved Baker's Dozen!", { variant: 'win', duration: 2200 });
    CommonUtils.playSound('win');
}

function hideWinOverlay() {
    const overlay = document.getElementById('bakers-win-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
}

function startTimer() {
    if (bakerState.timerInterval) {
        clearInterval(bakerState.timerInterval);
    }
    bakerState.timerInterval = setInterval(() => {
        updateTimeDisplay();
    }, 1000);
}

function stopTimer() {
    if (bakerState.timerInterval) {
        clearInterval(bakerState.timerInterval);
        bakerState.timerInterval = null;
    }
}

function getBakersSaveState() {
    return {
        tableau: bakerState.tableau,
        foundations: bakerState.foundations,
        score: bakerState.score,
        moves: bakerState.moves,
        moveHistory: bakerState.moveHistory,
        elapsedSeconds: getElapsedSeconds(bakerState.startTime),
        isGameWon: bakerState.isGameWon
    };
}

function reviveBakerCard(card) {
    if (!card) return card;
    if (typeof CommonUtils !== 'undefined' && typeof CommonUtils.reviveCardObject === 'function') {
        return CommonUtils.reviveCardObject(card);
    }
    if (typeof Card === 'function' && card.suit && card.val) {
        const revived = new Card(card.suit, card.val);
        revived.hidden = !!card.hidden;
        revived.isSplitCard = !!card.isSplitCard;
        if (Number.isFinite(card.rotation)) {
            revived.rotation = card.rotation;
        }
        return revived;
    }
    return card;
}

function restoreBakersState(saved) {
    if (!saved || typeof saved !== 'object') return;
    bakerState.tableau = Array.isArray(saved.tableau)
        ? saved.tableau
            .slice(0, BAKERS_COLUMNS)
            .map(col => (Array.isArray(col) ? col.map(card => reviveBakerCard(card)) : []))
        : Array.from({ length: BAKERS_COLUMNS }, () => []);
    while (bakerState.tableau.length < BAKERS_COLUMNS) {
        bakerState.tableau.push([]);
    }
    bakerState.foundations = Array.isArray(saved.foundations) && saved.foundations.length === FOUNDATION_SUITS.length
        ? saved.foundations.map(pile => (Array.isArray(pile) ? pile.map(card => reviveBakerCard(card)) : []))
        : FOUNDATION_SUITS.map(() => []);
    bakerState.score = Number.isFinite(saved.score) ? saved.score : 0;
    bakerState.moves = Number.isFinite(saved.moves) ? saved.moves : 0;
    bakerState.moveHistory = Array.isArray(saved.moveHistory)
        ? saved.moveHistory.map(entry => (
            typeof CommonUtils !== 'undefined' && typeof CommonUtils.hydrateSavedValue === 'function'
                ? CommonUtils.hydrateSavedValue(entry)
                : entry
        ))
        : [];
    bakerState.isGameWon = false;
    resetBakerCheckAvailability();
    closeBakerCheckOverlay();
    const elapsed = Number.isFinite(saved.elapsedSeconds) ? saved.elapsedSeconds : 0;
    bakerState.startTime = Date.now() - elapsed * 1000;
    clearSelection();
    clearHint();
    startTimer();

    if (!isBakerStatePlayable()) {
        if (bakerStateManager) bakerStateManager.clear();
        initBakerGame();
        return;
    }

    updateUI();
}

function dealBakerLayout() {
    const deck = CommonUtils.createShoe(1, BAKERS_SUITS, BAKERS_VALUES);
    for (let row = 0; row < 4; row += 1) {
        for (let column = 0; column < BAKERS_COLUMNS; column += 1) {
            const card = deck.pop();
            if (!card) continue;
            card.hidden = false;
            bakerState.tableau[column].push(card);
        }
    }

    for (let column = 0; column < BAKERS_COLUMNS; column += 1) {
        const columnCards = bakerState.tableau[column];
        const kings = columnCards.filter(card => card.val === 'K');
        const others = columnCards.filter(card => card.val !== 'K');
        bakerState.tableau[column] = [...others, ...kings];
    }
}

function canPlaceOnFoundation(card, pile) {
    if (!card) return false;
    if (!pile || !Array.isArray(pile)) return false;
    if (pile.length === 0) {
        return card.val === 'A';
    }
    const top = pile[pile.length - 1];
    return card.suit === top.suit && card.rank === top.rank + 1;
}

function canStackOnColumn(card, column) {
    if (!card) return false;
    if (!Array.isArray(column)) return false;
    if (column.length === 0) {
        return false;
    }
    const top = column[column.length - 1];
    return card.rank === top.rank - 1;
}

function cloneBakerCardForSolvability(card) {
    if (!card) return card;
    return {
        suit: card.suit,
        val: card.val,
        rank: card.rank,
        color: card.color
    };
}

function createBakerSolvabilitySnapshot() {
    return {
        tableau: bakerState.tableau.map((column) => column.map(cloneBakerCardForSolvability)),
        foundations: bakerState.foundations.map((pile) => pile.map(cloneBakerCardForSolvability))
    };
}

function normalizeBakerSolvabilityState(state) {
    if (!state || !Array.isArray(state.tableau) || !Array.isArray(state.foundations)) return '';
    const tableauKey = state.tableau
        .map((column) => column.map((card) => `${card.suit}${card.val}`).join(','))
        .join('|');
    const foundationKey = state.foundations
        .map((pile) => pile.map((card) => `${card.suit}${card.val}`).join(','))
        .join('|');
    return `T:${tableauKey}#F:${foundationKey}`;
}

function listBakerSolvabilityMoves(state) {
    if (!state || !Array.isArray(state.tableau) || !Array.isArray(state.foundations)) return [];
    const moves = [];
    for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol += 1) {
        const column = state.tableau[sourceCol];
        if (!Array.isArray(column) || !column.length) continue;
        const top = column[column.length - 1];
        for (let foundationIndex = 0; foundationIndex < state.foundations.length; foundationIndex += 1) {
            if (canPlaceOnFoundation(top, state.foundations[foundationIndex])) {
                moves.push({ type: 'tableau-to-foundation', sourceCol, foundationIndex, priority: 4 });
            }
        }
        for (let targetCol = 0; targetCol < state.tableau.length; targetCol += 1) {
            if (targetCol === sourceCol) continue;
            if (canStackOnColumn(top, state.tableau[targetCol])) {
                moves.push({ type: 'tableau-to-tableau', sourceCol, targetCol, priority: 2 });
            }
        }
    }
    moves.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return moves;
}

function applyBakerSolvabilityMove(state, move) {
    if (!state || !move || !move.type) return null;
    const next = {
        tableau: state.tableau.map((column) => column.slice()),
        foundations: state.foundations.map((pile) => pile.slice())
    };
    if (move.type === 'tableau-to-foundation') {
        const source = next.tableau[move.sourceCol];
        const foundation = next.foundations[move.foundationIndex];
        if (!source || !source.length || !foundation) return null;
        const card = source[source.length - 1];
        if (!canPlaceOnFoundation(card, foundation)) return null;
        foundation.push(source.pop());
        return next;
    }
    if (move.type === 'tableau-to-tableau') {
        const source = next.tableau[move.sourceCol];
        const target = next.tableau[move.targetCol];
        if (!source || !source.length || !target || !target.length) return null;
        const card = source[source.length - 1];
        if (!canStackOnColumn(card, target)) return null;
        target.push(source.pop());
        return next;
    }
    return null;
}

function createBakerSolvabilityChecker() {
    if (typeof SolitaireStateSolvabilityChecker === 'undefined') return null;
    return new SolitaireStateSolvabilityChecker({
        isSolved: (state) => Array.isArray(state.foundations) && state.foundations.length === FOUNDATION_SUITS.length
            && state.foundations.every((pile) => Array.isArray(pile) && pile.length === 13),
        normalizeState: normalizeBakerSolvabilityState,
        listMoves: listBakerSolvabilityMoves,
        applyMove: applyBakerSolvabilityMove,
        shouldPrune: (state) => {
            if (!state || !Array.isArray(state.foundations)) return true;
            const solved = state.foundations.every((pile) => Array.isArray(pile) && pile.length === 13);
            if (solved) return false;
            return listBakerSolvabilityMoves(state).length === 0;
        }
    });
}

function getBakerCheckButton() {
    return document.getElementById('bakers-check');
}

function getBakerCheckModalApi() {
    if (typeof SolitaireCheckModal !== 'undefined') return SolitaireCheckModal;
    return null;
}

function showBakerCheckOverlay(options = {}) {
    const modal = getBakerCheckModalApi();
    if (modal) {
        modal.showInfo(options);
        return;
    }
    if (options && options.message) {
        CommonUtils.showTableToast(options.message, { variant: 'warn', duration: 2200, containerId: 'table' });
    }
}

function closeBakerCheckOverlay() {
    const modal = getBakerCheckModalApi();
    if (!modal) return;
    modal.close();
}

function lockBakerChecksAsUnsolvable() {
    bakerCheckUnsolvableLocked = true;
    bakerCheckSolvedLocked = false;
    const button = getBakerCheckButton();
    if (!button) return;
    button.disabled = true;
    button.textContent = 'Unsolvable';
    button.classList.remove('check-solved');
    button.classList.add('check-unsolvable');
}

function lockBakerChecksAsSolvable() {
    bakerCheckSolvedLocked = true;
    bakerCheckUnsolvableLocked = false;
    const button = getBakerCheckButton();
    if (!button) return;
    button.disabled = true;
    button.textContent = 'SOLVABLE';
    button.classList.add('check-solved');
    button.classList.remove('check-unsolvable');
}

function releaseBakerCheckButtonsFromBusyState() {
    if (bakerCheckSolvedLocked || bakerCheckUnsolvableLocked) return;
    const button = getBakerCheckButton();
    if (!button) return;
    button.disabled = false;
    button.textContent = 'Check';
    button.classList.remove('check-solved');
    button.classList.remove('check-unsolvable');
}

function startBakerCheckButtonsBusyState() {
    const button = getBakerCheckButton();
    if (!button) return;
    button.disabled = true;
    if (!bakerCheckSolvedLocked && !bakerCheckUnsolvableLocked) {
        button.classList.remove('check-solved');
        button.classList.remove('check-unsolvable');
    }
}

function resetBakerCheckAvailability() {
    bakerCheckSolvedLocked = false;
    bakerCheckUnsolvableLocked = false;
    const button = getBakerCheckButton();
    if (!button) return;
    button.disabled = false;
    button.textContent = 'Check';
    button.classList.remove('check-solved');
    button.classList.remove('check-unsolvable');
}

function promptBakerDeepCheck() {
    const modal = getBakerCheckModalApi();
    if (!modal) {
        showBakerCheckOverlay({
            title: 'Quick Check Complete',
            message: 'No immediate proof found. Run a deeper check.',
            busy: false
        });
        return;
    }
    modal.showChoice({
        title: 'Quick Check Complete',
        message: 'No immediate proof found. Run a deeper check?',
        secondaryLabel: 'Not Now',
        confirmLabel: 'Prove Solve',
        cancelLabel: 'Close'
    }).then((choice) => {
        if (choice === 'confirm') {
            startBakerCheckButtonsBusyState();
            runBakerCheck('attempt');
        }
    });
}

function handleBakerCheckResult(mode, result, limits) {
    const isAttempt = mode === 'attempt';
    if (result.solved && result.reason === 'solved') {
        lockBakerChecksAsSolvable();
        showBakerCheckOverlay({
            title: `${isAttempt ? 'Prove Solve' : 'Quick Check'} Result`,
            message: `A solution path was found (${result.statesExplored} states explored).`,
            busy: false
        });
        return;
    }

    if (result.reason === 'exhausted') {
        lockBakerChecksAsUnsolvable();
        showBakerCheckOverlay({
            title: `${isAttempt ? 'Prove Solve' : 'Quick Check'} Result`,
            message: `No solution exists from this position (${result.statesExplored} states explored).`,
            busy: false
        });
        return;
    }

    releaseBakerCheckButtonsFromBusyState();
    if (!isAttempt) {
        promptBakerDeepCheck();
        return;
    }
    showBakerCheckOverlay({
        title: 'Prove Solve Result',
        message: `No solution was found within current limits (${result.reason}, ${result.statesExplored} states).`,
        busy: false
    });
    console.log(
        `Baker's Dozen Check: solved=${result.solved}, reason=${result.reason}, statesExplored=${result.statesExplored}, durationMs=${result.durationMs}, maxStates=${limits.maxStates}, maxDurationMs=${limits.maxDurationMs}`
    );
}

function runBakerCheck(mode) {
    if (!bakerSolvabilityChecker) {
        releaseBakerCheckButtonsFromBusyState();
        CommonUtils.showTableToast('Solvability checker unavailable.', { variant: 'warn', duration: 2200, containerId: 'table' });
        return;
    }
    const isAttempt = mode === 'attempt';
    const limits = isAttempt
        ? { maxStates: BAKER_DEEP_CHECK_MAX_STATES, maxDurationMs: BAKER_DEEP_CHECK_MAX_DURATION_MS }
        : { maxStates: BAKER_QUICK_CHECK_MAX_STATES, maxDurationMs: BAKER_QUICK_CHECK_MAX_DURATION_MS };
    const snapshot = createBakerSolvabilitySnapshot();
    showBakerCheckOverlay({
        title: isAttempt ? 'Prove Solve Running' : 'Quick Check Running',
        message: 'Checking current position...',
        busy: true
    });
    window.setTimeout(() => {
        const result = bakerSolvabilityChecker.check(snapshot, limits);
        closeBakerCheckOverlay();
        handleBakerCheckResult(mode, result, limits);
    }, 0);
}

function checkCurrentBakerSolvability() {
    if (bakerState.isGameWon || bakerCheckSolvedLocked || bakerCheckUnsolvableLocked) return;
    startBakerCheckButtonsBusyState();
    runBakerCheck('quick');
}

function recordMove(entry) {
    const nextHistory = bakerState.moveHistory || [];
    nextHistory.push(entry);
    if (nextHistory.length > HISTORY_LIMIT) {
        nextHistory.shift();
    }
    bakerState.moveHistory = nextHistory;
}

function moveCardToFoundation(fromColumn, suitIndex) {
    const column = bakerState.tableau[fromColumn];
    if (!column || column.length === 0) return false;
    const card = column.pop();
    const prevScore = bakerState.score;
    const prevMoves = bakerState.moves;
    bakerState.foundations[suitIndex].push(card);
    bakerState.score += FOUNDATION_SCORE;
    bakerState.moves += 1;
    resetBakerCheckAvailability();
    recordMove({
        type: 'tableau-to-foundation',
        column: fromColumn,
        suitIndex,
        card,
        prevScore,
        prevMoves
    });
    clearSelection();
    clearHint();
    if (bakerStateManager) bakerStateManager.markDirty();
    updateUI();
    CommonUtils.playSound('card');
    return true;
}

function moveTopCardToAnyFoundation(columnIndex) {
    const column = bakerState.tableau[columnIndex];
    if (!column || column.length === 0) return false;
    const card = column[column.length - 1];
    if (!card) return false;
    const suitIndex = FOUNDATION_SUITS.indexOf(card.suit);
    if (suitIndex === -1) return false;
    if (!canPlaceOnFoundation(card, bakerState.foundations[suitIndex])) return false;
    return moveCardToFoundation(columnIndex, suitIndex);
}

function moveCardBetweenTableau(fromColumn, toColumn) {
    const column = bakerState.tableau[fromColumn];
    if (!column || column.length === 0) return false;
    const card = column.pop();
    const prevScore = bakerState.score;
    const prevMoves = bakerState.moves;
    bakerState.tableau[toColumn].push(card);
    bakerState.score += TABLEAU_MOVE_SCORE;
    bakerState.moves += 1;
    resetBakerCheckAvailability();
    recordMove({
        type: 'tableau-to-tableau',
        fromColumn,
        toColumn,
        card,
        prevScore,
        prevMoves
    });
    clearSelection();
    clearHint();
    if (bakerStateManager) bakerStateManager.markDirty();
    updateUI();
    CommonUtils.playSound('card');
    return true;
}

function updateFoundations() {
    FOUNDATION_SUITS.forEach((suit, suitIndex) => {
        const slot = document.querySelector(`.foundation-slot[data-suit="${suit}"]`);
        if (!slot) return;
        const pileNode = slot.querySelector('.foundation-pile');
        if (!pileNode) return;
        const pile = bakerState.foundations[suitIndex] || [];
        pileNode.innerHTML = '';
        slot.classList.toggle('foundation-empty', pile.length === 0);
        if (pile.length === 0) {
            return;
        }
        const topCard = pile[pile.length - 1];
        const cardEl = CommonUtils.createCardEl(topCard);
        cardEl.classList.add('foundation-card');
        pileNode.appendChild(cardEl);
    });
}

function updateTableau() {
    const root = document.getElementById('bakers-tableau');
    if (!root) return;
    const stackOffset = getBakerStackOffset();
    root.innerHTML = '';
    bakerState.tableau.forEach((column, columnIndex) => {
        const columnEl = document.createElement('div');
        columnEl.className = 'bakers-column';
        columnEl.dataset.column = String(columnIndex);
        columnEl.addEventListener('click', () => {
            handleColumnClick(columnIndex);
        });
        if (!Array.isArray(column) || column.length === 0) {
            columnEl.classList.add('empty');
            const placeholder = document.createElement('div');
            placeholder.className = 'column-placeholder';
            placeholder.textContent = 'Empty';
            columnEl.appendChild(placeholder);
            root.appendChild(columnEl);
            return;
        }
        column.forEach((card, cardIndex) => {
            const cardEl = CommonUtils.createCardEl(card);
            cardEl.classList.add('stacked-card');
            cardEl.dataset.column = String(columnIndex);
            cardEl.dataset.index = String(cardIndex);
            cardEl.style.setProperty('--stack-index', String(cardIndex));
            cardEl.style.setProperty('top', `calc(var(--stack-index) * ${stackOffset}px)`);
            cardEl.style.zIndex = String(cardIndex + 1);
            if (selectedCard && selectedCard.column === columnIndex && selectedCard.index === cardIndex) {
                cardEl.classList.add('selected-card');
                cardEl.classList.add('picked-up');
            }
            if (cardIndex !== column.length - 1) {
                cardEl.addEventListener('click', (evt) => evt.stopPropagation());
            } else {
                cardEl.classList.add('top-card');
                cardEl.addEventListener('click', (evt) => {
                    evt.stopPropagation();
                    handleTableauCardClick(columnIndex, cardIndex);
                });
                cardEl.addEventListener('dblclick', (evt) => {
                    evt.stopPropagation();
                    if (bakerState.isGameWon) return;
                    moveTopCardToAnyFoundation(columnIndex);
                });
            }
            columnEl.appendChild(cardEl);
        });
        root.appendChild(columnEl);
    });
}

function updateUI() {
    CommonUtils.preserveHorizontalScroll({
        targets: ['bakers-scroll', 'bakers-tableau-area'],
        update: () => {
            clearHint();
            updateFoundations();
            updateTableau();
            updateStats();
            updateUndoButtonState();
            if (scheduleBakerSizing) scheduleBakerSizing();
            checkForWin();
        }
    });
}

function handleTableauCardClick(columnIndex, cardIndex) {
    if (bakerState.isGameWon) return;
    const column = bakerState.tableau[columnIndex];
    if (!column || cardIndex !== column.length - 1) return;

    if (selectedCard && selectedCard.column !== columnIndex) {
        const destination = bakerState.tableau[columnIndex];
        if (canStackOnColumn(selectedCard.card, destination)) {
            moveCardBetweenTableau(selectedCard.column, columnIndex);
            return;
        }
    }

    if (selectedCard && selectedCard.column === columnIndex && selectedCard.index === cardIndex) {
        selectedCard = null;
        updateTableau();
        return;
    }
    selectedCard = {
        column: columnIndex,
        index: cardIndex,
        card: column[cardIndex]
    };
    updateTableau();
}

function handleColumnClick(targetColumn) {
    if (bakerState.isGameWon || !selectedCard) return;
    if (targetColumn === selectedCard.column) {
        selectedCard = null;
        updateTableau();
        return;
    }
    const destination = bakerState.tableau[targetColumn];
    if (!canStackOnColumn(selectedCard.card, destination)) {
    CommonUtils.showTableToast('That card cannot go there yet.', { variant: 'warn' });
        return;
    }
    moveCardBetweenTableau(selectedCard.column, targetColumn);
}

function handleFoundationClick(event) {
    if (bakerState.isGameWon) return;
    const slot = event.currentTarget;
    const suit = slot.dataset.suit;
    if (!selectedCard || !suit) {
        CommonUtils.showTableToast('Select an exposed card before moving it to a foundation.', { variant: 'warn' });
        return;
    }
    const suitIndex = FOUNDATION_SUITS.indexOf(suit);
    if (suitIndex === -1) return;
    if (!canPlaceOnFoundation(selectedCard.card, bakerState.foundations[suitIndex])) {
        CommonUtils.showTableToast('That card cannot go to that foundation yet.', { variant: 'warn' });
        return;
    }
    moveCardToFoundation(selectedCard.column, suitIndex);
}

function findBakerHint() {
    for (let columnIndex = 0; columnIndex < BAKERS_COLUMNS; columnIndex += 1) {
        const column = bakerState.tableau[columnIndex];
        if (!column || column.length === 0) continue;
        const card = column[column.length - 1];
        const foundationIndex = FOUNDATION_SUITS.indexOf(card.suit);
        if (foundationIndex !== -1 && canPlaceOnFoundation(card, bakerState.foundations[foundationIndex])) {
            return { type: 'foundation', from: columnIndex, cardIndex: column.length - 1, card, suit: card.suit };
        }
        for (let dest = 0; dest < BAKERS_COLUMNS; dest += 1) {
            if (dest === columnIndex) continue;
            if (canStackOnColumn(card, bakerState.tableau[dest])) {
                return { type: 'tableau', from: columnIndex, to: dest, cardIndex: column.length - 1, card };
            }
        }
    }
    return null;
}

function showBakerHint() {
    if (bakerState.isGameWon) return;
    clearHint();
    const hint = findBakerHint();
    if (!hint) {
        CommonUtils.showTableToast('No clear moves right now. Look for a suit run or expose an ace.', { variant: 'warn', duration: 2200 });
        return;
    }
    const cardSelector = `#bakers-tableau [data-column="${hint.from}"][data-index="${hint.cardIndex}"]`;
    const cardEl = document.querySelector(cardSelector);
    if (cardEl) cardEl.classList.add('hint');
    currentHint = { cardEl };
    if (hint.type === 'foundation') {
        const foundationEl = document.querySelector(`.foundation-slot[data-suit="${hint.suit}"]`);
        if (foundationEl) {
            foundationEl.classList.add('hint');
            currentHint.foundationEl = foundationEl;
        }
        CommonUtils.showTableToast(`Hint: Move ${hint.card.val}${hint.card.suit} to the foundation.`, { variant: 'warn', duration: 2200 });
        return;
    }
    const columnEl = document.querySelector(`.bakers-column[data-column="${hint.to}"]`);
    if (columnEl) {
        columnEl.classList.add('hint');
        currentHint.targetColumn = columnEl;
    }
    CommonUtils.showTableToast(`Hint: Place ${hint.card.val}${hint.card.suit} on column ${hint.to + 1}.`, { variant: 'warn', duration: 2200 });
}

function autoCompleteBaker() {
    if (bakerState.isGameWon) return;
    clearSelection();
    clearHint();
    let moved = false;
    let progress = true;
    while (progress) {
        progress = false;
        for (let columnIndex = 0; columnIndex < BAKERS_COLUMNS; columnIndex += 1) {
            const column = bakerState.tableau[columnIndex];
            if (!column || column.length === 0) continue;
            const card = column[column.length - 1];
            const suitIndex = FOUNDATION_SUITS.indexOf(card.suit);
            if (suitIndex === -1) continue;
            if (canPlaceOnFoundation(card, bakerState.foundations[suitIndex])) {
                moveCardToFoundation(columnIndex, suitIndex);
                moved = true;
                progress = true;
                break;
            }
        }
        if (bakerState.isGameWon) {
            progress = false;
        }
    }
    if (!moved) {
        CommonUtils.showTableToast('No immediate auto-complete moves available yet.', { variant: 'warn', duration: 2000 });
    }
}

function undoLastMove() {
    if (!bakerState.moveHistory.length) return;
    const move = bakerState.moveHistory.pop();
    if (!move) return;
    if (move.type === 'tableau-to-foundation') {
        const pile = bakerState.foundations[move.suitIndex] || [];
        pile.pop();
        bakerState.tableau[move.column].push(move.card);
    } else if (move.type === 'tableau-to-tableau') {
        const dest = bakerState.tableau[move.toColumn];
        if (dest && dest.length) {
            dest.pop();
        }
        bakerState.tableau[move.fromColumn].push(move.card);
    }
    bakerState.score = move.prevScore;
    bakerState.moves = move.prevMoves;
    resetBakerCheckAvailability();
    if (bakerState.isGameWon) {
        bakerState.isGameWon = false;
        hideWinOverlay();
    }
    clearSelection();
    clearHint();
    updateUI();
    if (bakerStateManager) bakerStateManager.markDirty();
}

function setupBakersEventListeners() {
    document.getElementById('bakers-new-game')?.addEventListener('click', initBakerGame);
    document.getElementById('bakers-undo')?.addEventListener('click', undoLastMove);
    document.getElementById('bakers-hint')?.addEventListener('click', showBakerHint);
    document.getElementById('bakers-autocomplete')?.addEventListener('click', autoCompleteBaker);
    document.getElementById('bakers-check')?.addEventListener('click', checkCurrentBakerSolvability);
    document.getElementById('bakers-win-new-game')?.addEventListener('click', initBakerGame);
    document.querySelectorAll('.foundation-slot').forEach(slot => {
        slot.addEventListener('click', handleFoundationClick);
    });
    const overlay = document.getElementById('bakers-win-overlay');
    if (overlay) {
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) hideWinOverlay();
        });
    }

    const syncThemeClasses = () => {
        const tableSelect = document.getElementById('table-style-select');
        if (tableSelect) {
            Array.from(document.body.classList).forEach(cls => {
                if (cls.startsWith('table-')) document.body.classList.remove(cls);
            });
            if (tableSelect.value) {
                document.body.classList.add(`table-${tableSelect.value}`);
            }
        }

        const deckSelect = document.getElementById('deck-style-select');
        if (deckSelect) {
            Array.from(document.body.classList).forEach(cls => {
                if (cls.startsWith('deck-')) document.body.classList.remove(cls);
            });
            if (deckSelect.value) {
                document.body.classList.add(`deck-${deckSelect.value}`);
            }
        }
    };

    const tableSelect = document.getElementById('table-style-select');
    if (tableSelect) {
        tableSelect.addEventListener('change', syncThemeClasses);
    }
    const deckSelect = document.getElementById('deck-style-select');
    if (deckSelect) {
        deckSelect.addEventListener('change', syncThemeClasses);
    }

    const scheduleThemeSync = () => requestAnimationFrame(syncThemeClasses);
    scheduleThemeSync();
    if (window.AddonLoader && window.AddonLoader.ready) {
        window.AddonLoader.ready.then(scheduleThemeSync);
    } else {
        scheduleThemeSync();
    }
    window.addEventListener('addons:changed', syncThemeClasses);
}

function initBakerGame() {
    if (bakerState.timerInterval) {
        clearInterval(bakerState.timerInterval);
        bakerState.timerInterval = null;
    }
    bakerState.tableau = Array.from({ length: BAKERS_COLUMNS }, () => []);
    bakerState.foundations = FOUNDATION_SUITS.map(() => []);
    bakerState.score = 0;
    bakerState.moves = 0;
    bakerState.isGameWon = false;
    bakerState.moveHistory = [];
    resetBakerCheckAvailability();
    closeBakerCheckOverlay();
    selectedCard = null;
    currentHint = null;
    if (bakerStateManager) bakerStateManager.clear();
    bakerState.startTime = Date.now();
    dealBakerLayout();
    startTimer();
    updateUI();
    hideWinOverlay();
    CommonUtils.playSound('shuffle');
    if (bakerStateManager) bakerStateManager.markDirty();
}

document.addEventListener('DOMContentLoaded', () => {
    CommonUtils.preloadAudio(bakersSoundFiles);
    bakerSolvabilityChecker = createBakerSolvabilityChecker();
    setupBakersEventListeners();
    CommonUtils.initCardScaleControls('bakers-card-scale', 'bakers-card-scale-value', { min: 0.6, max: 1.6, step: 0.05 });
    scheduleBakerSizing = CommonUtils.createRafScheduler(ensureBakerSizing);
    window.addEventListener('resize', () => { if (scheduleBakerSizing) scheduleBakerSizing(); });
    window.addEventListener('card-scale:changed', () => { if (scheduleBakerSizing) scheduleBakerSizing(); });
    scheduleBakerSizing?.();
    bakerStateManager = new CommonUtils.StateManager({
        gameId: 'bakers-dozen',
        getState: getBakersSaveState,
        setState: restoreBakersState,
        isWon: () => bakerState.isGameWon
    });
    const restored = bakerStateManager.load();
    if (!restored || !isBakerStatePlayable()) {
        if (bakerStateManager) bakerStateManager.clear();
        initBakerGame();
    }
});
