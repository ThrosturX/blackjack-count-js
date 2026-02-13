/**
 * Pyramid Solitaire Game Controller
 */
const pyramidSoundFiles = {
    card: ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav'],
    win: ['win.wav'],
    shuffle: ['shuffle.wav']
};

const PYRAMID_ROWS = 7;
const PYRAMID_PAIR_SCORE = 5;
const PYRAMID_KING_SCORE = 10;
const PYRAMID_MAX_HISTORY = 200;
const PYRAMID_WASTE_FAN_BASE = 20;
const PYRAMID_WASTE_FAN_MIN = 8;
const PYRAMID_QUICK_CHECK_LIMITS = {
    1: { maxStates: 10000, maxDurationMs: 1000 },
    3: { maxStates: 25000, maxDurationMs: 5000 }
};
const PYRAMID_ATTEMPT_CHECK_LIMITS = {
    1: { maxStates: 50000, maxDurationMs: 30000 },
    3: { maxStates: 100000, maxDurationMs: 60000 }
};

const pyramidState = {
    pyramid: [],
    stock: [],
    waste: [],
    score: 0,
    moves: 0,
    startTime: null,
    timerInterval: null,
    isGameWon: false,
    moveHistory: [],
    drawCount: 1
};

const pyramidVariant = (() => {
    const defaults = {
        stateGameId: 'pyramid',
        highScoreGameId: 'pyramid',
        hideBlockedCards: false,
        winMessage: 'You solved Pyramid!'
    };
    const incoming = (typeof window !== 'undefined' && window.PyramidVariant && typeof window.PyramidVariant === 'object')
        ? window.PyramidVariant
        : {};
    return {
        stateGameId: String(incoming.stateGameId || defaults.stateGameId),
        highScoreGameId: String(incoming.highScoreGameId || defaults.highScoreGameId),
        hideBlockedCards: incoming.hideBlockedCards === true,
        winMessage: String(incoming.winMessage || defaults.winMessage)
    };
})();

let pyramidStateManager = null;
let pyramidCheckWorker = null;
let pyramidCheckRequestId = 0;
let pyramidCheckSolvedLocked = false;
let pyramidCheckUnsolvableLocked = false;
let pyramidStoredSolution = null;

function getPyramidRuleSetKey() {
    const drawCount = pyramidState.drawCount === 3 ? 3 : 1;
    return `draw-${drawCount}`;
}

function syncPyramidHighScore() {
    const highScoreEl = document.getElementById('pyramid-high-score');
    if (!highScoreEl) return;
    const highScore = CommonUtils.updateHighScore(pyramidVariant.highScoreGameId, getPyramidRuleSetKey(), pyramidState.score);
    highScoreEl.textContent = highScore;
}

const selectionState = {
    selected: []
};

function ensurePyramidSizing() {
    const tableEl = document.getElementById('table');
    if (tableEl) {
        const fanOffset = pyramidState.drawCount === 3 ? getPyramidWasteFanOffset() : 0;
        tableEl.style.setProperty('--pyramid-waste-fan-x', `${fanOffset}px`);
    }
    applyPyramidLift();
    CommonUtils.ensureScrollableWidth({
        table: 'table',
        wrapper: 'pyramid-scroll',
        contentSelectors: ['#pyramid-top-row', '#pyramid-area']
    });
}

function applyPyramidLift() {
    const tableEl = document.getElementById('table');
    const areaEl = document.getElementById('pyramid-area');
    if (!tableEl || !areaEl) return;

    const tableStyles = getComputedStyle(tableEl);
    const rowGap = parseFloat(tableStyles.rowGap || tableStyles.gap) || 0;
    const scale = CommonUtils.getUiScaleValue();
    const minClearance = Math.max(6, 8 * scale);
    const maxLift = Math.max(0, rowGap - minClearance);

    const isPortraitPhone = window.innerWidth <= 600
        && window.matchMedia('(orientation: portrait)').matches;
    const desiredFactor = isPortraitPhone
        ? 0.78
        : (window.innerWidth <= 900 ? 0.42 : 0);
    const desiredLift = rowGap * desiredFactor;
    const lift = Math.min(maxLift, desiredLift);

    areaEl.style.setProperty('--pyramid-lift', `${Math.max(0, Math.round(lift))}px`);
}

const schedulePyramidSizing = CommonUtils.createRafScheduler(ensurePyramidSizing);

document.addEventListener('DOMContentLoaded', () => {
    CommonUtils.preloadAudio(pyramidSoundFiles);
    setupPyramidEventListeners();
    CommonUtils.initCardScaleControls('pyramid-card-scale', 'pyramid-card-scale-value');

    const scaleInput = document.getElementById('pyramid-card-scale');
    if (scaleInput) {
        scaleInput.addEventListener('input', () => updateUI());
    }

    window.addEventListener('resize', () => updateUI());
    window.addEventListener('card-scale:changed', schedulePyramidSizing);

    pyramidStateManager = new CommonUtils.StateManager({
        gameId: pyramidVariant.stateGameId,
        getState: getPyramidSaveState,
        setState: restorePyramidState,
        isWon: () => pyramidState.isGameWon
    });
    const restored = pyramidStateManager.load();
    if (!restored) {
        initPyramidGame();
    }
});

function initPyramidGame() {
    pyramidState.pyramid = [];
    pyramidState.stock = [];
    pyramidState.waste = [];
    pyramidState.score = 0;
    pyramidState.moves = 0;
    pyramidState.isGameWon = false;
    pyramidState.moveHistory = [];

    clearSelection();

    if (pyramidState.timerInterval) {
        clearInterval(pyramidState.timerInterval);
    }
    pyramidState.startTime = Date.now();

    dealPyramid();
    startTimer();
    updateUI();
    updateUndoButtonState();
    resetPyramidCheckAvailability();
    CommonUtils.playSound('shuffle');
    if (pyramidStateManager) {
        pyramidStateManager.markDirty();
    }
}

function startTimer() {
    pyramidState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - pyramidState.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeEl = document.getElementById('pyramid-time');
        if (timeEl) {
            timeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function getElapsedSeconds(startTime) {
    if (!Number.isFinite(startTime)) return 0;
    return Math.max(0, Math.floor((Date.now() - startTime) / 1000));
}

function getPyramidSaveState() {
    return {
        pyramid: pyramidState.pyramid,
        stock: pyramidState.stock,
        waste: pyramidState.waste,
        score: pyramidState.score,
        moves: pyramidState.moves,
        moveHistory: pyramidState.moveHistory,
        drawCount: pyramidState.drawCount,
        elapsedSeconds: getElapsedSeconds(pyramidState.startTime),
        isGameWon: pyramidState.isGameWon
    };
}

function restorePyramidState(saved) {
    if (!saved || typeof saved !== 'object') return;
    pyramidState.pyramid = saved.pyramid || [];
    pyramidState.stock = saved.stock || [];
    pyramidState.waste = saved.waste || [];
    pyramidState.score = Number.isFinite(saved.score) ? saved.score : 0;
    pyramidState.moves = Number.isFinite(saved.moves) ? saved.moves : 0;
    pyramidState.moveHistory = Array.isArray(saved.moveHistory) ? saved.moveHistory : [];
    pyramidState.drawCount = saved.drawCount === 3 ? 3 : 1;
    pyramidState.isGameWon = false;

    const drawSelect = document.getElementById('pyramid-draw-select');
    if (drawSelect) {
        drawSelect.value = String(pyramidState.drawCount);
    }

    clearSelection();
    if (pyramidState.timerInterval) {
        clearInterval(pyramidState.timerInterval);
    }
    const elapsed = Number.isFinite(saved.elapsedSeconds) ? saved.elapsedSeconds : 0;
    pyramidState.startTime = Date.now() - elapsed * 1000;
    startTimer();

    updateUI();
    updateUndoButtonState();
    resetPyramidCheckAvailability();
}

function dealPyramid() {
    const deck = CommonUtils.createShoe(1, SUITS, VALUES);
    pyramidState.pyramid = [];

    for (let row = 0; row < PYRAMID_ROWS; row++) {
        const rowCards = [];
        for (let col = 0; col <= row; col++) {
            const card = deck.pop();
            card.hidden = false;
            rowCards.push(card);
        }
        pyramidState.pyramid.push(rowCards);
    }

    pyramidState.stock = deck;
    pyramidState.stock.forEach(card => {
        card.hidden = true;
    });
    pyramidState.waste = [];
}

function updateUI() {
    updateStock();
    updateWaste();
    updatePyramid();
    updateStats();
    schedulePyramidSizing();
}

function updateStock() {
    const stockEl = document.getElementById('pyramid-stock');
    if (!stockEl) return;
    stockEl.innerHTML = '';

    if (pyramidState.stock.length > 0) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card hidden';
        cardEl.style.cursor = 'pointer';
        cardEl.addEventListener('click', drawFromStock);
        stockEl.appendChild(cardEl);
    } else if (pyramidState.waste.length > 0) {
        const recycleEl = document.createElement('div');
        recycleEl.className = 'pile-placeholder recycle';
        recycleEl.textContent = '↻';
        recycleEl.style.cursor = 'pointer';
        recycleEl.style.fontSize = '2.4rem';
        recycleEl.addEventListener('click', recycleStock);
        stockEl.appendChild(recycleEl);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'pile-placeholder';
        placeholder.textContent = 'Stock';
        stockEl.appendChild(placeholder);
    }
}

function updateWaste() {
    const wasteEl = document.getElementById('pyramid-waste');
    if (!wasteEl) return;
    wasteEl.innerHTML = '';

    if (pyramidState.waste.length > 0) {
        const visibleCount = pyramidState.drawCount === 3 ? 3 : 1;
        CommonUtils.renderWasteFanPile({
            containerEl: wasteEl,
            waste: pyramidState.waste,
            visibleCount,
            fanOffset: getPyramidWasteFanOffset(),
            fanStyle: 'classic',
            onCard: ({ cardEl, isTop }) => {
                if (!isTop) return;
                cardEl.dataset.waste = 'true';
                cardEl.style.cursor = 'pointer';
                cardEl.addEventListener('click', handleCardClick);
                cardEl.style.zIndex = 10;
            }
        });
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'pile-placeholder';
        placeholder.textContent = 'Waste';
        wasteEl.appendChild(placeholder);
    }
}

function getPyramidWasteFanOffset() {
    return CommonUtils.getSolitaireStackOffset(PYRAMID_WASTE_FAN_BASE, {
        min: PYRAMID_WASTE_FAN_MIN,
        max: PYRAMID_WASTE_FAN_BASE
    });
}

function updatePyramid() {
    const area = document.getElementById('pyramid-area');
    if (!area) return;
    clearSelection();
    area.innerHTML = '';

    const metrics = getPyramidMetrics();
    const maxRowWidth = metrics.cardWidth + (PYRAMID_ROWS - 1) * metrics.hStep;
    const totalHeight = metrics.cardHeight + (PYRAMID_ROWS - 1) * metrics.vStep;

    area.style.width = `${maxRowWidth}px`;
    area.style.height = `${totalHeight}px`;

    for (let row = 0; row < PYRAMID_ROWS; row++) {
        const rowCards = pyramidState.pyramid[row] || [];
        const rowWidth = metrics.cardWidth + row * metrics.hStep;
        const offsetX = (maxRowWidth - rowWidth) / 2;

        for (let col = 0; col <= row; col++) {
            const card = rowCards[col];
            if (!card) continue;

            const cardEl = CommonUtils.createCardEl(card);
            cardEl.classList.add('pyramid-card');
            cardEl.dataset.row = row;
            cardEl.dataset.col = col;
            cardEl.style.position = 'absolute';
            cardEl.style.left = `${offsetX + col * metrics.hStep}px`;
            cardEl.style.top = `${row * metrics.vStep}px`;

            const exposed = isCardExposed(row, col);
            if (!exposed) {
                cardEl.classList.add('blocked');
                if (pyramidVariant.hideBlockedCards) {
                    cardEl.classList.add('hidden');
                }
            } else {
                cardEl.style.cursor = 'pointer';
                cardEl.addEventListener('click', handleCardClick);
            }

            area.appendChild(cardEl);
        }
    }
}

function updateStats() {
    const movesEl = document.getElementById('pyramid-moves');
    if (movesEl) movesEl.textContent = pyramidState.moves;
    const scoreEl = document.getElementById('pyramid-score');
    if (scoreEl) scoreEl.textContent = pyramidState.score;
    syncPyramidHighScore();
}

function drawFromStock() {
    if (pyramidState.stock.length === 0) {
        if (pyramidState.waste.length > 0) {
            recycleStock();
        }
        return;
    }

    clearSelection();

    const drawCount = pyramidState.drawCount === 3 ? 3 : 1;
    const drawnCards = [];
    for (let i = 0; i < drawCount; i++) {
        if (pyramidState.stock.length === 0) break;
        const card = pyramidState.stock.pop();
        card.hidden = false;
        pyramidState.waste.push(card);
        drawnCards.push(card);
    }
    if (!drawnCards.length) return;
    pyramidState.moves += 1;
    recordMove({
        type: 'draw',
        cards: drawnCards,
        scoreDelta: 0,
        movesDelta: 1
    });

    CommonUtils.playSound('card');
    updateUI();
}

function recycleStock() {
    if (pyramidState.waste.length === 0) return;

    clearSelection();

    const recycled = pyramidState.waste.slice();
    pyramidState.waste = [];

    for (let i = recycled.length - 1; i >= 0; i--) {
        const card = recycled[i];
        card.hidden = true;
        pyramidState.stock.push(card);
    }

    pyramidState.moves += 1;
    recordMove({
        type: 'recycle',
        cards: recycled,
        scoreDelta: 0,
        movesDelta: 1
    });

    CommonUtils.playSound('card');
    updateUI();
}

function handleCardClick(e) {
    const cardEl = e.target.closest('.card');
    if (!cardEl) return;

    if (cardEl.dataset.waste) {
        const card = pyramidState.waste[pyramidState.waste.length - 1];
        if (!card) return;
        handleSelection({ source: 'waste', card, el: cardEl });
        return;
    }

    const row = parseInt(cardEl.dataset.row, 10);
    const col = parseInt(cardEl.dataset.col, 10);
    if (!isCardExposed(row, col)) return;
    const card = pyramidState.pyramid[row][col];
    if (!card) return;

    handleSelection({ source: 'pyramid', row, col, card, el: cardEl });
}

function handleSelection(selection) {
    if (!selection || !selection.card) return;

    if (selection.card.rank === 13) {
        clearSelection();
        removeSelectedCards([selection], PYRAMID_KING_SCORE);
        return;
    }

    if (selectionState.selected.length === 0) {
        setSelection([selection]);
        return;
    }

    const existing = selectionState.selected[0];
    if (isSameSelection(existing, selection)) {
        clearSelection();
        return;
    }

    const sum = existing.card.rank + selection.card.rank;
    if (sum === 13) {
        removeSelectedCards([existing, selection], PYRAMID_PAIR_SCORE);
        clearSelection();
        return;
    }

    clearSelection();
    setSelection([selection]);
}

function setSelection(selections) {
    selectionState.selected = selections;
    selections.forEach(sel => {
        if (sel.el) sel.el.classList.add('picked-up');
    });
}

function clearSelection() {
    selectionState.selected.forEach(sel => {
        if (sel.el) sel.el.classList.remove('picked-up');
    });
    selectionState.selected = [];
}

function isSameSelection(a, b) {
    if (!a || !b) return false;
    if (a.source !== b.source) return false;
    if (a.source === 'waste') return true;
    return a.row === b.row && a.col === b.col;
}

function removeSelectedCards(selections, scoreDelta) {
    if (!selections.length) return;

    const removed = [];
    selections.forEach(sel => {
        if (sel.source === 'pyramid') {
            pyramidState.pyramid[sel.row][sel.col] = null;
            removed.push({ source: 'pyramid', row: sel.row, col: sel.col, card: sel.card });
        } else if (sel.source === 'waste') {
            const top = pyramidState.waste.pop();
            const card = top || sel.card;
            removed.push({ source: 'waste', card });
        }
    });

    pyramidState.score += scoreDelta;
    pyramidState.moves += 1;
    recordMove({
        type: 'remove',
        cards: removed,
        scoreDelta,
        movesDelta: 1
    });

    CommonUtils.playSound('card');
    updateUI();
    checkWinCondition();
}

function isCardExposed(row, col) {
    if (row >= PYRAMID_ROWS - 1) return true;
    const belowLeft = pyramidState.pyramid[row + 1]?.[col];
    const belowRight = pyramidState.pyramid[row + 1]?.[col + 1];
    return !belowLeft && !belowRight;
}

function checkWinCondition() {
    const allCleared = pyramidState.pyramid.every(row => row.every(card => !card));
    if (!allCleared) return;

    pyramidState.isGameWon = true;
    clearInterval(pyramidState.timerInterval);
    CommonUtils.playSound('win');
    CommonUtils.showTableToast(pyramidVariant.winMessage, { variant: 'win', duration: 2500 });
    if (pyramidStateManager) {
        pyramidStateManager.clear();
    }
}

function recordMove(entry) {
    pyramidState.moveHistory.push(entry);
    if (pyramidState.moveHistory.length > PYRAMID_MAX_HISTORY) {
        pyramidState.moveHistory.shift();
    }
    updateUndoButtonState();
    if (pyramidStateManager) {
        pyramidStateManager.markDirty();
    }
}

function updateUndoButtonState() {
    const btn = document.getElementById('pyramid-undo');
    if (!btn) return;
    btn.disabled = pyramidState.moveHistory.length === 0;
}

function undoLastMove() {
    if (pyramidState.moveHistory.length === 0) return;

    const entry = pyramidState.moveHistory.pop();
    clearSelection();

    if (entry.type === 'remove') {
        entry.cards.forEach(cardEntry => {
            if (cardEntry.source === 'pyramid') {
                pyramidState.pyramid[cardEntry.row][cardEntry.col] = cardEntry.card;
            } else if (cardEntry.source === 'waste') {
                if (cardEntry.card) {
                    cardEntry.card.hidden = false;
                    pyramidState.waste.push(cardEntry.card);
                }
            }
        });
    } else if (entry.type === 'draw') {
        const cards = Array.isArray(entry.cards) ? entry.cards : (entry.card ? [entry.card] : []);
        for (let i = 0; i < cards.length; i++) {
            const card = pyramidState.waste.pop();
            if (!card) break;
            card.hidden = true;
            pyramidState.stock.push(card);
        }
    } else if (entry.type === 'recycle') {
        pyramidState.stock = [];
        pyramidState.waste = entry.cards.map(card => {
            card.hidden = false;
            return card;
        });
    }

    pyramidState.score = Math.max(0, pyramidState.score - (entry.scoreDelta || 0));
    pyramidState.moves = Math.max(0, pyramidState.moves - (entry.movesDelta || 0));
    pyramidState.isGameWon = false;

    if (!pyramidState.timerInterval) {
        pyramidState.startTime = Date.now();
        startTimer();
    }

    updateUI();
    updateUndoButtonState();
    if (pyramidStateManager) {
        pyramidStateManager.markDirty();
    }
}

function getPyramidMetrics() {
    const styles = getComputedStyle(document.documentElement);
    const baseW = parseFloat(styles.getPropertyValue('--card-w')) || 70;
    const baseH = parseFloat(styles.getPropertyValue('--card-h')) || 100;
    const scale = parseFloat(styles.getPropertyValue('--card-scale')) || 1;
    const cardWidth = baseW * scale;
    const cardHeight = baseH * scale;

    return {
        cardWidth,
        cardHeight,
        hStep: cardWidth * 0.6,
        vStep: cardHeight * 0.32
    };
}

function setupPyramidEventListeners() {
    const newGameBtn = document.getElementById('pyramid-new-game');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', initPyramidGame);
    }

    const drawSelect = document.getElementById('pyramid-draw-select');
    if (drawSelect) {
        drawSelect.value = String(pyramidState.drawCount || 1);
        drawSelect.addEventListener('change', (event) => {
            const next = parseInt(event.target.value, 10);
            pyramidState.drawCount = next === 3 ? 3 : 1;
            updateUI();
            updateStats();
            if (pyramidStateManager) {
                pyramidStateManager.markDirty();
            }
        });
    }

    const undoBtn = document.getElementById('pyramid-undo');
    if (undoBtn) {
        undoBtn.addEventListener('click', undoLastMove);
    }
    const hintBtn = document.getElementById('pyramid-hint');
    if (hintBtn) {
        hintBtn.addEventListener('click', showPyramidHint);
    }
    const checkBtn = document.getElementById('pyramid-check');
    if (checkBtn) {
        checkBtn.addEventListener('click', checkCurrentPyramidSolvability);
    }

    const applyTableStyle = () => {
        const select = document.getElementById('table-style-select');
        if (!select) return;
        const style = select.value;
        Array.from(document.body.classList).forEach(cls => {
            if (cls.startsWith('table-')) document.body.classList.remove(cls);
        });
        if (style) {
            document.body.classList.add(`table-${style}`);
        }
    };

    const applyDeckStyle = () => {
        const select = document.getElementById('deck-style-select');
        if (!select) return;
        const style = select.value;
        Array.from(document.body.classList).forEach(cls => {
            if (cls.startsWith('deck-')) document.body.classList.remove(cls);
        });
        if (style) {
            document.body.classList.add(`deck-${style}`);
        }
    };

    const syncThemeClasses = () => {
        applyTableStyle();
        applyDeckStyle();
    };

    const scheduleThemeSync = () => {
        requestAnimationFrame(syncThemeClasses);
    };

    const tableSelect = document.getElementById('table-style-select');
    if (tableSelect) {
        tableSelect.addEventListener('change', applyTableStyle);
        applyTableStyle();
    }

    const deckSelect = document.getElementById('deck-style-select');
    if (deckSelect) {
        deckSelect.addEventListener('change', applyDeckStyle);
        applyDeckStyle();
    }

    if (window.AddonLoader && window.AddonLoader.ready) {
        window.AddonLoader.ready.then(scheduleThemeSync);
    } else {
        scheduleThemeSync();
    }
    window.addEventListener('addons:changed', scheduleThemeSync);
}

function checkCurrentPyramidSolvability() {
    if (pyramidCheckSolvedLocked || pyramidCheckUnsolvableLocked) return;
    startPyramidCheckBusyState();
    runPyramidCheck('quick');
}

function runPyramidCheck(mode) {
    const limits = getPyramidCheckLimits(mode, pyramidState.drawCount);
    const snapshot = createPyramidCheckSnapshot();
    const requestId = ++pyramidCheckRequestId;
    if (typeof Worker !== 'undefined') {
        runPyramidCheckViaWorker({
            game: 'pyramid',
            snapshot,
            limits,
            requestId
        }).then((result) => {
            if (!result || requestId !== pyramidCheckRequestId) return;
            handlePyramidCheckResult(mode, result, limits, snapshot, { hadWorker: true });
        }).catch(() => {
            runPyramidCheckOnMainThreadWithModal(mode, snapshot, limits, requestId);
        });
        return;
    }
    runPyramidCheckOnMainThreadWithModal(mode, snapshot, limits, requestId);
}

function runPyramidCheckOnMainThreadWithModal(mode, snapshot, limits, requestId) {
    showPyramidCheckModal({
        title: mode === 'attempt' ? 'Prove Solve Running' : 'Quick Check Running',
        message: 'Running on the main thread. The page may become unresponsive until the check finishes.',
        busy: true
    });
    window.setTimeout(() => {
        const fallback = runPyramidCheckOnMainThread(snapshot, limits);
        if (!fallback || requestId !== pyramidCheckRequestId) return;
        closePyramidCheckModal();
        handlePyramidCheckResult(mode, fallback, limits, snapshot, { hadWorker: false });
    }, 0);
}

function getPyramidCheckLimits(mode, drawCount) {
    const normalizedDraw = drawCount === 3 ? 3 : 1;
    const perMode = mode === 'attempt' ? PYRAMID_ATTEMPT_CHECK_LIMITS : PYRAMID_QUICK_CHECK_LIMITS;
    const selected = perMode[normalizedDraw] || perMode[1];
    return {
        maxStates: selected.maxStates,
        maxDurationMs: selected.maxDurationMs,
        relaxedSearch: mode === 'attempt'
    };
}

function handlePyramidCheckResult(mode, result, limits, snapshot, context = {}) {
    const isAttempt = mode === 'attempt';
    console.log(
        `Pyramid ${isAttempt ? 'Attempt' : 'Quick'} Check: solved=${result.solved}, reason=${result.reason}, statesExplored=${result.statesExplored}, durationMs=${result.durationMs}, maxStates=${limits.maxStates}, maxDurationMs=${limits.maxDurationMs}`
    );
    if (result.solved && result.reason === 'solved') {
        storePyramidSolution(snapshot, result);
        lockPyramidChecksAsSolvable();
        showPyramidCheckModal({
            title: `${isAttempt ? 'Prove Solve' : 'Quick Check'} Result`,
            message: `A solution path was found (${result.statesExplored} states explored).`,
            busy: false
        });
        return;
    }
    clearStoredPyramidSolution();
    const isLikely = result.reason === 'likely-solved';
    if (result.provenUnsolvable === true) {
        lockPyramidChecksAsUnsolvable();
        showPyramidCheckModal({
            title: `${isAttempt ? 'Prove Solve' : 'Quick Check'} Result`,
            message: `No solution exists from this position (${result.statesExplored} states explored).`,
            busy: false
        });
        return;
    }
    releasePyramidCheckBusyState();
    if (isLikely) {
        markPyramidCheckAsLikely();
    }
    const inconclusive = result.reason === 'state-limit'
        || result.reason === 'time-limit'
        || result.reason === 'cycle-detected';
    if (!isAttempt) {
        promptPyramidDeepCheck(result);
        return;
    }
    const message = isLikely
        ? 'This position looks promising, but prove solve could not confirm a full winning line yet. Work the layout more and try prove solve again.'
        : (result.reason === 'cycle-detected'
        ? 'The solver got caught in a loop. Try clearing more of the layout first, then run check again.'
        : (inconclusive
            ? 'No immediate solution was found within current limits. This does not mean the deck is unsolvable, only that the solution is not immediately obvious.'
            : `No solution was found (${result.reason}, ${result.statesExplored} states). This does not mean the deck is unsolvable, only that the solution is not immediately obvious.`));
    showPyramidCheckModal({
        title: `${isAttempt ? 'Prove Solve' : 'Quick Check'} Result`,
        message,
        busy: false
    });
}

function createPyramidCheckSnapshot() {
    return {
        pyramid: pyramidState.pyramid.map((row) => row.map((card) => (card ? cloneCardForCheck(card) : null))),
        stock: pyramidState.stock.map(cloneCardForCheck),
        waste: pyramidState.waste.map(cloneCardForCheck),
        drawCount: pyramidState.drawCount
    };
}

function cloneCardForCheck(card) {
    if (!card) return null;
    return {
        suit: card.suit,
        val: card.val,
        rank: Number.isFinite(card.rank) ? card.rank : parseCardRankForCheck(card.val),
        hidden: false
    };
}

function parseCardRankForCheck(value) {
    if (value === 'A') return 1;
    if (value === 'J') return 11;
    if (value === 'Q') return 12;
    if (value === 'K') return 13;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function runPyramidCheckOnMainThread(snapshot, limits) {
    if (limits && limits.relaxedSearch) {
        return runPyramidRelaxedCheckOnMainThread(snapshot, limits);
    }
    const startedAt = Date.now();
    const fallbackLimits = getPyramidCheckLimits('quick', snapshot.drawCount);
    const maxStates = Number.isFinite(limits.maxStates) ? Math.max(1, limits.maxStates) : fallbackLimits.maxStates;
    const maxDurationMs = Number.isFinite(limits.maxDurationMs) ? Math.max(1, limits.maxDurationMs) : fallbackLimits.maxDurationMs;
    const drawCount = snapshot.drawCount === 3 ? 3 : 1;
    const state = {
        pyramid: snapshot.pyramid.map((row) => row.map((card) => (card ? Object.assign({}, card) : null))),
        stock: snapshot.stock.map((card) => Object.assign({}, card)),
        waste: snapshot.waste.map((card) => Object.assign({}, card))
    };
    const initialRemaining = countPyramidCardsRemaining(state.pyramid);
    const startKey = normalizePyramidSimulationState(state);
    const seenStates = new Set([startKey]);
    const solutionMoves = [];
    const solutionStateKeys = [startKey];
    let iterations = 0;
    let cycleDetected = false;

    while (iterations < maxStates) {
        if ((Date.now() - startedAt) >= maxDurationMs) {
            return { solved: false, reason: 'time-limit', statesExplored: iterations, prunedStates: 0, durationMs: Date.now() - startedAt, maxStates, maxDurationMs };
        }
        if (isPyramidSolvedState(state.pyramid)) {
            return {
                solved: true,
                reason: 'solved',
                statesExplored: iterations,
                prunedStates: 0,
                durationMs: Date.now() - startedAt,
                maxStates,
                maxDurationMs,
                solutionMoves: solutionMoves.slice(),
                solutionStateKeys: solutionStateKeys.slice()
            };
        }
        iterations++;
        if (applyPyramidGreedyRemoval(state)) {
            solutionMoves.push({ type: 'remove-exposed' });
            const key = normalizePyramidSimulationState(state);
            if (seenStates.has(key)) {
                cycleDetected = true;
                break;
            }
            seenStates.add(key);
            solutionStateKeys.push(key);
            continue;
        }
        if (state.stock.length > 0) {
            for (let i = 0; i < drawCount; i++) {
                if (!state.stock.length) break;
                state.waste.push(state.stock.pop());
            }
            solutionMoves.push({ type: 'draw-stock', count: drawCount });
            const key = normalizePyramidSimulationState(state);
            if (seenStates.has(key)) {
                cycleDetected = true;
                break;
            }
            seenStates.add(key);
            solutionStateKeys.push(key);
            continue;
        }
        if (state.waste.length > 0) {
            while (state.waste.length > 0) {
                state.stock.push(state.waste.pop());
            }
            solutionMoves.push({ type: 'recycle-waste' });
            const key = normalizePyramidSimulationState(state);
            if (seenStates.has(key)) {
                cycleDetected = true;
                break;
            }
            seenStates.add(key);
            solutionStateKeys.push(key);
            continue;
        }
        break;
    }

    const remaining = countPyramidCardsRemaining(state.pyramid);
    const cleared = initialRemaining - remaining;
    const likely = cleared >= 20 || (remaining <= 8 && state.stock.length === 0);
    return {
        solved: likely,
        reason: likely ? 'likely-solved' : (cycleDetected ? 'cycle-detected' : (iterations >= maxStates ? 'state-limit' : 'exhausted')),
        statesExplored: iterations,
        prunedStates: 0,
        durationMs: Date.now() - startedAt,
        maxStates,
        maxDurationMs
    };
}

function runPyramidRelaxedCheckOnMainThread(snapshot, limits) {
    const startedAt = Date.now();
    const fallbackLimits = getPyramidCheckLimits('attempt', snapshot.drawCount);
    const maxStates = Number.isFinite(limits.maxStates) ? Math.max(1, limits.maxStates) : fallbackLimits.maxStates;
    const maxDurationMs = Number.isFinite(limits.maxDurationMs) ? Math.max(1, limits.maxDurationMs) : fallbackLimits.maxDurationMs;
    const drawCount = snapshot.drawCount === 3 ? 3 : 1;
    const startState = clonePyramidCheckState({
        pyramid: snapshot.pyramid,
        stock: snapshot.stock,
        waste: snapshot.waste
    });
    const initialRemaining = countPyramidCardsRemaining(startState.pyramid);
    const startKey = normalizePyramidSimulationState(startState);
    const frontier = [{
        state: startState,
        key: startKey,
        moves: [],
        stateKeys: [startKey],
        depth: 0
    }];
    const seenStateDepth = new Map([[startKey, 0]]);
    let iterations = 0;
    let bestCleared = 0;

    while (frontier.length > 0 && iterations < maxStates) {
        if ((Date.now() - startedAt) >= maxDurationMs) {
            return {
                solved: false,
                reason: 'time-limit',
                statesExplored: iterations,
                prunedStates: 0,
                durationMs: Date.now() - startedAt,
                maxStates,
                maxDurationMs
            };
        }
        iterations++;
        const current = frontier.pop();
        const knownCurrentDepth = seenStateDepth.get(current.key);
        if (knownCurrentDepth !== undefined && knownCurrentDepth < current.depth) {
            continue;
        }
        const state = clonePyramidCheckState(current.state);
        const moves = current.moves.slice();
        const stateKeys = current.stateKeys.slice();
        const depth = current.depth;

        if (isPyramidSolvedState(state.pyramid)) {
            return {
                solved: true,
                reason: 'solved',
                statesExplored: iterations,
                prunedStates: 0,
                durationMs: Date.now() - startedAt,
                maxStates,
                maxDurationMs,
                solutionMoves: moves,
                solutionStateKeys: stateKeys
            };
        }

        const remaining = countPyramidCardsRemaining(state.pyramid);
        const cleared = initialRemaining - remaining;
        if (cleared > bestCleared) bestCleared = cleared;

        const candidates = listPyramidCandidateMoves(state, drawCount);
        for (let i = candidates.length - 1; i >= 0; i--) {
            const move = candidates[i];
            const nextState = clonePyramidCheckState(state);
            if (!applyPyramidSimulationMove(nextState, move, drawCount)) continue;
            const key = normalizePyramidSimulationState(nextState);
            const nextDepth = depth + 1;
            const knownDepth = seenStateDepth.get(key);
            if (knownDepth !== undefined && knownDepth <= nextDepth) continue;
            seenStateDepth.set(key, nextDepth);
            frontier.push({
                state: nextState,
                key,
                moves: moves.concat([{ type: move.type === 'draw-stock' || move.type === 'recycle-waste' ? move.type : 'remove-exposed' }]),
                stateKeys: stateKeys.concat([key]),
                depth: nextDepth
            });
        }
    }

    const likely = bestCleared >= 20;
    const exhausted = frontier.length === 0;
    return {
        solved: likely,
        reason: likely ? 'likely-solved' : (iterations >= maxStates ? 'state-limit' : 'exhausted'),
        statesExplored: iterations,
        prunedStates: 0,
        durationMs: Date.now() - startedAt,
        maxStates,
        maxDurationMs,
        provenUnsolvable: exhausted && !likely
    };
}

function isPyramidSolvedState(pyramid) {
    return pyramid.every((row) => row.every((card) => !card));
}

function countPyramidCardsRemaining(pyramid) {
    let remaining = 0;
    for (let row = 0; row < pyramid.length; row++) {
        for (let col = 0; col < pyramid[row].length; col++) {
            if (pyramid[row][col]) remaining++;
        }
    }
    return remaining;
}

function serializePyramidSimulationCard(card) {
    if (!card) return '__';
    const rank = Number.isFinite(card.rank) ? card.rank : String(card.rank || '?');
    return `${rank}${card.suit || '?'}`;
}

function serializePyramidSimulationPile(pile) {
    if (!pile || pile.length === 0) return '';
    return pile.map((card) => serializePyramidSimulationCard(card)).join(',');
}

function normalizePyramidSimulationState(state) {
    const pyramid = state.pyramid.map((row) => row.map((card) => serializePyramidSimulationCard(card)).join(',')).join('|');
    return `${pyramid}#${serializePyramidSimulationPile(state.stock)}#${serializePyramidSimulationPile(state.waste)}`;
}

function clonePyramidCheckState(state) {
    return {
        pyramid: state.pyramid.map((row) => row.map((card) => (card ? Object.assign({}, card) : null))),
        stock: state.stock.map((card) => Object.assign({}, card)),
        waste: state.waste.map((card) => Object.assign({}, card))
    };
}

function isPyramidCardExposedForCheck(pyramid, row, col) {
    if (row >= pyramid.length - 1) return true;
    const belowLeft = pyramid[row + 1] ? pyramid[row + 1][col] : null;
    const belowRight = pyramid[row + 1] ? pyramid[row + 1][col + 1] : null;
    return !belowLeft && !belowRight;
}

function applyPyramidGreedyRemoval(state) {
    const exposed = [];
    for (let row = 0; row < state.pyramid.length; row++) {
        for (let col = 0; col < state.pyramid[row].length; col++) {
            const card = state.pyramid[row][col];
            if (!card) continue;
            if (!isPyramidCardExposedForCheck(state.pyramid, row, col)) continue;
            exposed.push({ source: 'pyramid', row, col, card });
        }
    }
    const wasteTop = state.waste.length > 0 ? state.waste[state.waste.length - 1] : null;

    for (let i = 0; i < exposed.length; i++) {
        const a = exposed[i];
        if (a.card.rank === 13) {
            state.pyramid[a.row][a.col] = null;
            return true;
        }
        if (wasteTop && (a.card.rank + wasteTop.rank === 13)) {
            state.pyramid[a.row][a.col] = null;
            state.waste.pop();
            return true;
        }
        for (let j = i + 1; j < exposed.length; j++) {
            const b = exposed[j];
            if (a.card.rank + b.card.rank === 13) {
                state.pyramid[a.row][a.col] = null;
                state.pyramid[b.row][b.col] = null;
                return true;
            }
        }
    }

    if (wasteTop && wasteTop.rank === 13) {
        state.waste.pop();
        return true;
    }
    return false;
}

function listPyramidCandidateMoves(state, drawCount) {
    const exposed = [];
    for (let row = 0; row < state.pyramid.length; row++) {
        for (let col = 0; col < state.pyramid[row].length; col++) {
            const card = state.pyramid[row][col];
            if (!card) continue;
            if (!isPyramidCardExposedForCheck(state.pyramid, row, col)) continue;
            exposed.push({ row, col, card });
        }
    }
    const wasteTop = state.waste.length > 0 ? state.waste[state.waste.length - 1] : null;
    const moves = [];

    for (let i = 0; i < exposed.length; i++) {
        const a = exposed[i];
        if (a.card.rank === 13) {
            moves.push({ type: 'remove-king', row: a.row, col: a.col, priority: 6 });
        }
        if (wasteTop && a.card.rank + wasteTop.rank === 13) {
            moves.push({ type: 'remove-with-waste', row: a.row, col: a.col, priority: 5 });
        }
        for (let j = i + 1; j < exposed.length; j++) {
            const b = exposed[j];
            if (a.card.rank + b.card.rank === 13) {
                moves.push({ type: 'remove-pair', rowA: a.row, colA: a.col, rowB: b.row, colB: b.col, priority: 7 });
            }
        }
    }

    if (wasteTop && wasteTop.rank === 13) {
        moves.push({ type: 'remove-waste-king', priority: 4 });
    }
    if (state.stock.length > 0) {
        moves.push({ type: 'draw-stock', count: drawCount, priority: 2 });
    } else if (state.waste.length > 0) {
        moves.push({ type: 'recycle-waste', priority: 1 });
    }

    moves.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return moves;
}

function applyPyramidSimulationMove(state, move, drawCount) {
    if (!move) return false;
    if (move.type === 'remove-king') {
        if (!state.pyramid[move.row] || !state.pyramid[move.row][move.col]) return false;
        state.pyramid[move.row][move.col] = null;
        return true;
    }
    if (move.type === 'remove-with-waste') {
        if (!state.pyramid[move.row] || !state.pyramid[move.row][move.col]) return false;
        if (!state.waste.length) return false;
        state.pyramid[move.row][move.col] = null;
        state.waste.pop();
        return true;
    }
    if (move.type === 'remove-pair') {
        if (!state.pyramid[move.rowA] || !state.pyramid[move.rowB]) return false;
        if (!state.pyramid[move.rowA][move.colA] || !state.pyramid[move.rowB][move.colB]) return false;
        state.pyramid[move.rowA][move.colA] = null;
        state.pyramid[move.rowB][move.colB] = null;
        return true;
    }
    if (move.type === 'remove-waste-king') {
        if (!state.waste.length) return false;
        state.waste.pop();
        return true;
    }
    if (move.type === 'draw-stock') {
        if (!state.stock.length) return false;
        const count = Number.isFinite(move.count) ? move.count : drawCount;
        for (let i = 0; i < count; i++) {
            if (!state.stock.length) break;
            state.waste.push(state.stock.pop());
        }
        return true;
    }
    if (move.type === 'recycle-waste') {
        if (!state.waste.length) return false;
        while (state.waste.length > 0) {
            state.stock.push(state.waste.pop());
        }
        return true;
    }
    return false;
}

function runPyramidCheckViaWorker(payload, onStarted) {
    return new Promise((resolve, reject) => {
        if (typeof Worker === 'undefined') {
            reject(new Error('Web Worker unavailable.'));
            return;
        }
        if (!pyramidCheckWorker) {
            pyramidCheckWorker = new Worker('shared/solitaire-check-worker.js');
        }
        const worker = pyramidCheckWorker;
        const onMessage = (event) => {
            const data = event && event.data ? event.data : {};
            if (data.requestId !== payload.requestId) return;
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
            if (data.error) {
                reject(new Error(data.error));
                return;
            }
            resolve(data.result);
        };
        const onError = () => {
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
            cleanupPyramidCheckWorker();
            reject(new Error('Pyramid worker failed.'));
        };
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        try {
            worker.postMessage(payload);
        } catch (err) {
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
            cleanupPyramidCheckWorker();
            reject(err instanceof Error ? err : new Error('Pyramid worker failed.'));
            return;
        }
        if (typeof onStarted === 'function') {
            onStarted();
        }
    });
}

function cleanupPyramidCheckWorker() {
    pyramidCheckRequestId++;
    if (!pyramidCheckWorker) return;
    try {
        pyramidCheckWorker.terminate();
    } catch (err) {
        // Ignore terminate failures.
    }
    pyramidCheckWorker = null;
}

function getSolitaireCheckModalApi() {
    if (typeof SolitaireCheckModal !== 'undefined') return SolitaireCheckModal;
    return null;
}

function showPyramidCheckModal(options = {}) {
    const modal = getSolitaireCheckModalApi();
    if (!modal) return;
    modal.showInfo(options);
}

function closePyramidCheckModal() {
    const modal = getSolitaireCheckModalApi();
    if (!modal) return;
    modal.close();
}

function getPyramidCheckButton() {
    return document.getElementById('pyramid-check');
}

function startPyramidCheckBusyState() {
    const button = getPyramidCheckButton();
    if (!button) return;
    button.disabled = true;
    if (!pyramidCheckSolvedLocked && !pyramidCheckUnsolvableLocked) {
        button.classList.remove('check-solved');
        button.classList.remove('check-unsolvable');
    }
}

function releasePyramidCheckBusyState() {
    if (pyramidCheckSolvedLocked || pyramidCheckUnsolvableLocked) return;
    const button = getPyramidCheckButton();
    if (!button) return;
    button.disabled = false;
    button.textContent = 'Check';
    button.classList.remove('check-solved');
    button.classList.remove('check-unsolvable');
}

function markPyramidCheckAsLikely() {
    const button = getPyramidCheckButton();
    if (!button) return;
    button.disabled = false;
    button.textContent = 'Likely';
    button.classList.add('check-solved');
    button.classList.remove('check-unsolvable');
}

function lockPyramidChecksAsSolvable() {
    pyramidCheckSolvedLocked = true;
    pyramidCheckUnsolvableLocked = false;
    const button = getPyramidCheckButton();
    if (!button) return;
    button.disabled = true;
    button.textContent = 'SOLVABLE';
    button.classList.add('check-solved');
    button.classList.remove('check-unsolvable');
}

function lockPyramidChecksAsUnsolvable() {
    pyramidCheckSolvedLocked = false;
    pyramidCheckUnsolvableLocked = true;
    const button = getPyramidCheckButton();
    if (!button) return;
    button.disabled = true;
    button.textContent = 'Unsolvable';
    button.classList.remove('check-solved');
    button.classList.add('check-unsolvable');
}

function resetPyramidCheckAvailability() {
    pyramidCheckSolvedLocked = false;
    pyramidCheckUnsolvableLocked = false;
    clearStoredPyramidSolution();
    const button = getPyramidCheckButton();
    if (button) {
        button.disabled = false;
        button.textContent = 'Check';
        button.classList.remove('check-solved');
        button.classList.remove('check-unsolvable');
    }
    closePyramidCheckModal();
}

function promptPyramidDeepCheck(result) {
    const needsTableauWork = result && result.reason === 'cycle-detected';
    const likely = result && result.reason === 'likely-solved';
    const message = needsTableauWork
        ? 'The solver got stuck in a loop. Try opening up the layout first (clear exposed pairs and improve access), then run a deeper solve attempt.'
        : (likely
            ? 'Quick check sees promising progress, but it is not proven yet. Run Prove Solve for a stricter answer?'
            : 'Quick check found no immediate solution. Run Prove Solve?');
    const modal = getSolitaireCheckModalApi();
    if (!modal) {
        showPyramidCheckModal({
            title: 'Quick Check Result',
            message,
            busy: false
        });
        return;
    }
    modal.showChoice({
        title: 'Quick Check Complete',
        message,
        secondaryLabel: 'Not Now',
        confirmLabel: 'Prove Solve',
        cancelLabel: 'Close'
    }).then((choice) => {
        if (choice === 'confirm') {
            startPyramidCheckBusyState();
            runPyramidCheck('attempt');
        }
    });
}

function storePyramidSolution(snapshot, result) {
    const moves = Array.isArray(result.solutionMoves) ? result.solutionMoves.slice() : [];
    if (!moves.length) {
        pyramidStoredSolution = null;
        return;
    }
    const stateKeys = Array.isArray(result.solutionStateKeys) && result.solutionStateKeys.length
        ? result.solutionStateKeys.slice()
        : [normalizePyramidSimulationState({
            pyramid: snapshot.pyramid.map((row) => row.map((card) => (card ? Object.assign({}, card) : null))),
            stock: snapshot.stock.map((card) => Object.assign({}, card)),
            waste: snapshot.waste.map((card) => Object.assign({}, card))
        })];
    pyramidStoredSolution = { moves, stateKeys };
}

function clearStoredPyramidSolution() {
    pyramidStoredSolution = null;
}

function getStoredPyramidHint() {
    if (!pyramidStoredSolution || !Array.isArray(pyramidStoredSolution.moves) || !pyramidStoredSolution.moves.length) {
        return null;
    }
    const snapshot = createPyramidCheckSnapshot();
    const currentState = {
        pyramid: snapshot.pyramid.map((row) => row.map((card) => (card ? Object.assign({}, card) : null))),
        stock: snapshot.stock.map((card) => Object.assign({}, card)),
        waste: snapshot.waste.map((card) => Object.assign({}, card))
    };
    const key = normalizePyramidSimulationState(currentState);
    const stepIndex = pyramidStoredSolution.stateKeys.indexOf(key);
    if (stepIndex < 0 || stepIndex >= pyramidStoredSolution.moves.length) return null;
    return pyramidStoredSolution.moves[stepIndex];
}

function formatPyramidHintMove(move) {
    if (!move || !move.type) return 'Remove an exposed pair that sums to 13.';
    if (move.type === 'remove-exposed') return 'Remove an exposed king or exposed pair summing to 13.';
    if (move.type === 'draw-stock') return 'Draw from stock.';
    if (move.type === 'recycle-waste') return 'Recycle waste into stock.';
    return 'Try the next legal forward move.';
}

function showPyramidHint() {
    const storedHint = getStoredPyramidHint();
    if (storedHint) {
        CommonUtils.showTableToast(`Hint: ${formatPyramidHintMove(storedHint)}`, { variant: 'warn', containerId: 'table', duration: 2400 });
        return;
    }
    const snapshot = createPyramidCheckSnapshot();
    const state = {
        pyramid: snapshot.pyramid.map((row) => row.map((card) => (card ? Object.assign({}, card) : null))),
        stock: snapshot.stock.map((card) => Object.assign({}, card)),
        waste: snapshot.waste.map((card) => Object.assign({}, card))
    };
    if (applyPyramidGreedyRemoval(state)) {
        CommonUtils.showTableToast('Hint: Remove an exposed king or exposed pair summing to 13.', { variant: 'warn', containerId: 'table', duration: 2400 });
        return;
    }
    if (state.stock.length > 0) {
        CommonUtils.showTableToast('Hint: Draw from stock.', { variant: 'warn', containerId: 'table', duration: 2400 });
        return;
    }
    if (state.waste.length > 0) {
        CommonUtils.showTableToast('Hint: Recycle waste into stock.', { variant: 'warn', containerId: 'table', duration: 2400 });
        return;
    }
    CommonUtils.showTableToast('Hint: No clear move found.', { variant: 'warn', containerId: 'table', duration: 2200 });
}
