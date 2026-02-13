const BAKERS_COLUMNS = 13;
const FOUNDATION_SUITS = ['♥', '♦', '♣', '♠'];
const STACKED_OFFSET = 16;
const HISTORY_LIMIT = 320;
const FOUNDATION_SCORE = 10;
const TABLEAU_MOVE_SCORE = 2;

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

function ensureBakerSizing() {
    const tableauArea = document.getElementById('bakers-tableau-area');
    const previousTableauScrollLeft = tableauArea ? tableauArea.scrollLeft : 0;
    CommonUtils.ensureScrollableWidth({
        table: 'bakers-tableau',
        wrapper: 'bakers-tableau-area',
        contentSelectors: ['#bakers-foundations', '#bakers-tableau']
    });
    if (tableauArea) {
        const clamped = Math.max(0, Math.min(previousTableauScrollLeft, tableauArea.scrollWidth - tableauArea.clientWidth));
        tableauArea.scrollLeft = clamped;
    }
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
    const elapsed = Number.isFinite(saved.elapsedSeconds) ? saved.elapsedSeconds : 0;
    bakerState.startTime = Date.now() - elapsed * 1000;
    clearSelection();
    clearHint();
    startTimer();
    updateUI();
}

function dealBakerLayout() {
    const deck = CommonUtils.createShoe(1, SUITS, VALUES);
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
        return card.val === 'K';
    }
    const top = column[column.length - 1];
    return card.suit === top.suit && card.rank === top.rank - 1;
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
            cardEl.style.setProperty('top', `calc(var(--stack-index) * ${STACKED_OFFSET}px)`);
            cardEl.style.zIndex = String(cardIndex + 1);
            if (selectedCard && selectedCard.column === columnIndex && selectedCard.index === cardIndex) {
                cardEl.classList.add('selected-card');
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
    const scrollContainer = document.getElementById('bakers-scroll');
    const tableauArea = document.getElementById('bakers-tableau-area');
    const previousContainerScrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
    const previousTableauScrollLeft = tableauArea ? tableauArea.scrollLeft : 0;

    clearHint();
    updateFoundations();
    updateTableau();
    updateStats();
    updateUndoButtonState();
    if (scheduleBakerSizing) scheduleBakerSizing();

    if (scrollContainer) {
        const clamped = Math.max(0, Math.min(previousContainerScrollLeft, scrollContainer.scrollWidth - scrollContainer.clientWidth));
        scrollContainer.scrollLeft = clamped;
    }
    if (tableauArea) {
        const clamped = Math.max(0, Math.min(previousTableauScrollLeft, tableauArea.scrollWidth - tableauArea.clientWidth));
        tableauArea.scrollLeft = clamped;
        requestAnimationFrame(() => {
            const nextClamped = Math.max(0, Math.min(previousTableauScrollLeft, tableauArea.scrollWidth - tableauArea.clientWidth));
            tableauArea.scrollLeft = nextClamped;
        });
    }

    checkForWin();
}

function handleTableauCardClick(columnIndex, cardIndex) {
    if (bakerState.isGameWon) return;
    const column = bakerState.tableau[columnIndex];
    if (!column || cardIndex !== column.length - 1) return;
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
    if (!restored) {
        initBakerGame();
    }
});
