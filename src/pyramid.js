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

let pyramidStateManager = null;

function getPyramidRuleSetKey() {
    const drawCount = pyramidState.drawCount === 3 ? 3 : 1;
    return `draw-${drawCount}`;
}

function syncPyramidHighScore() {
    const highScoreEl = document.getElementById('pyramid-high-score');
    if (!highScoreEl) return;
    const highScore = CommonUtils.updateHighScore('pyramid', getPyramidRuleSetKey(), pyramidState.score);
    highScoreEl.textContent = highScore;
}

const selectionState = {
    selected: []
};

function ensurePyramidSizing() {
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
        gameId: 'pyramid',
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
        const topCard = pyramidState.waste[pyramidState.waste.length - 1];
        const cardEl = CommonUtils.createCardEl(topCard);
        cardEl.dataset.waste = 'true';
        cardEl.style.cursor = 'pointer';
        cardEl.addEventListener('click', handleCardClick);
        wasteEl.appendChild(cardEl);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'pile-placeholder';
        placeholder.textContent = 'Waste';
        wasteEl.appendChild(placeholder);
    }
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
    CommonUtils.showTableToast('You solved Pyramid!', { variant: 'win', duration: 2500 });
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
