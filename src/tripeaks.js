/**
 * TriPeaks Solitaire Game Controller
 */
const tripeaksSoundFiles = {
    card: ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav'],
    win: ['win.wav'],
    shuffle: ['shuffle.wav']
};

const TRIPEAKS_MAX_HISTORY = 200;
const TRIPEAKS_PEAK_CARDS = 28;
const TRIPEAKS_FACEUP_START_INDEX = 18;

const tripeaksState = {
    peaks: [], // 28 cards in a specific layout
    stock: [],
    waste: [],
    score: 0,
    moves: 0,
    startTime: null,
    timerInterval: null,
    isGameWon: false,
    moveHistory: [],
    variantId: 'classic'
};

const TRIPEAKS_VARIANTS = Object.freeze({
    classic: Object.freeze({
        id: 'classic',
        highScoreRuleSetKey: 'default',
        allowWrapAround: true,
        allowSameRank: false,
        revealAllPeaks: false,
        hideBlockedCards: false,
        winMessage: 'You solved TriPeaks!'
    }),
    strict: Object.freeze({
        id: 'strict',
        highScoreRuleSetKey: 'strict-no-wrap',
        allowWrapAround: false,
        allowSameRank: false,
        revealAllPeaks: false,
        hideBlockedCards: false,
        winMessage: 'You solved Strict TriPeaks!'
    }),
    relaxed: Object.freeze({
        id: 'relaxed',
        highScoreRuleSetKey: 'relaxed-wrap-and-pair',
        allowWrapAround: true,
        allowSameRank: true,
        revealAllPeaks: false,
        hideBlockedCards: false,
        winMessage: 'You solved Relaxed TriPeaks!'
    }),
    open: Object.freeze({
        id: 'open',
        highScoreRuleSetKey: 'open-wrap',
        allowWrapAround: true,
        allowSameRank: false,
        revealAllPeaks: true,
        hideBlockedCards: false,
        winMessage: 'You solved Open TriPeaks!'
    })
});

function normalizeTriPeaksVariantId(value) {
    const candidate = String(value || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(TRIPEAKS_VARIANTS, candidate) ? candidate : 'classic';
}

function getTriPeaksVariantFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const fromUrl = params.get('variant');
        if (!fromUrl) return null;
        return normalizeTriPeaksVariantId(fromUrl);
    } catch (err) {
        return null;
    }
}

const forcedTriPeaksVariantId = getTriPeaksVariantFromUrl();
tripeaksState.variantId = forcedTriPeaksVariantId || 'classic';

let tripeaksStateManager = null;
let scheduleTriPeaksSizing = null;

function getActiveTriPeaksVariant() {
    return TRIPEAKS_VARIANTS[normalizeTriPeaksVariantId(tripeaksState.variantId)];
}

function syncTriPeaksVariantSelect() {
    const select = document.getElementById('tripeaks-variant-select');
    if (!select) return;
    select.value = normalizeTriPeaksVariantId(tripeaksState.variantId);
}

function applyTriPeaksVariant(variantId, options = {}) {
    const next = normalizeTriPeaksVariantId(variantId);
    const previous = normalizeTriPeaksVariantId(tripeaksState.variantId);
    tripeaksState.variantId = next;
    syncTriPeaksVariantSelect();
    if (options.startNewGame !== false && next !== previous) {
        initTriPeaksGame();
    }
}

function syncTriPeaksHighScore() {
    const highScoreEl = document.getElementById('tripeaks-high-score');
    if (!highScoreEl) return;
    const variant = getActiveTriPeaksVariant();
    const highScore = CommonUtils.updateHighScore(
        'tripeaks',
        variant.highScoreRuleSetKey,
        tripeaksState.score
    );
    highScoreEl.textContent = highScore;
}

document.addEventListener('DOMContentLoaded', () => {
    CommonUtils.preloadAudio(tripeaksSoundFiles);
    setupTriPeaksEventListeners();
    CommonUtils.initCardScaleControls('tripeaks-card-scale', 'tripeaks-card-scale-value');

    const scaleInput = document.getElementById('tripeaks-card-scale');
    if (scaleInput) {
        scaleInput.addEventListener('input', () => updateUI());
    }

    window.addEventListener('resize', () => updateUI());
    scheduleTriPeaksSizing = CommonUtils.createRafScheduler(ensureTriPeaksSizing);
    window.addEventListener('card-scale:changed', scheduleTriPeaksSizing);

    tripeaksStateManager = new CommonUtils.StateManager({
        gameId: 'tripeaks',
        getState: getTriPeaksSaveState,
        setState: restoreTriPeaksState,
        isWon: () => tripeaksState.isGameWon
    });
    const restored = tripeaksStateManager.load();
    if (!restored) {
        initTriPeaksGame();
    }
});

function initTriPeaksGame() {
    ensureTriPeaksSizing();

    tripeaksState.peaks = [];
    tripeaksState.stock = [];
    tripeaksState.waste = [];
    tripeaksState.score = 0;
    tripeaksState.moves = 0;
    tripeaksState.isGameWon = false;
    tripeaksState.moveHistory = [];

    if (tripeaksState.timerInterval) {
        clearInterval(tripeaksState.timerInterval);
    }
    tripeaksState.startTime = Date.now();

    dealTriPeaks();
    startTimer();
    updateUI();
    updateUndoButtonState();
    CommonUtils.playSound('shuffle');
    if (tripeaksStateManager) {
        tripeaksStateManager.markDirty();
    }
}

function startTimer() {
    tripeaksState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - tripeaksState.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeEl = document.getElementById('tripeaks-time');
        if (timeEl) {
            timeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function getTriPeaksSaveState() {
    return {
        peaks: tripeaksState.peaks,
        stock: tripeaksState.stock,
        waste: tripeaksState.waste,
        score: tripeaksState.score,
        moves: tripeaksState.moves,
        variantId: normalizeTriPeaksVariantId(tripeaksState.variantId),
        moveHistory: tripeaksState.moveHistory,
        elapsedSeconds: Math.floor((Date.now() - tripeaksState.startTime) / 1000),
        isGameWon: tripeaksState.isGameWon
    };
}

function reviveTriPeaksCard(card) {
    if (!card) return card;
    if (typeof CommonUtils !== 'undefined' && typeof CommonUtils.reviveCardObject === 'function') {
        return CommonUtils.reviveCardObject(card);
    }
    if (typeof Card === 'function' && card.suit && card.val) {
        const revived = new Card(card.suit, card.val);
        revived.hidden = !!card.hidden;
        revived.isSplitCard = !!card.isSplitCard;
        if (Number.isFinite(card.rotation)) revived.rotation = card.rotation;
        return revived;
    }
    return card;
}

function restoreTriPeaksState(saved) {
    if (!saved || typeof saved !== 'object') return;
    const savedVariantId = normalizeTriPeaksVariantId(saved.variantId);
    if (forcedTriPeaksVariantId) {
        if (savedVariantId !== forcedTriPeaksVariantId) {
            if (tripeaksStateManager) tripeaksStateManager.clear();
            initTriPeaksGame();
            return;
        }
        tripeaksState.variantId = forcedTriPeaksVariantId;
    } else {
        tripeaksState.variantId = savedVariantId;
    }
    syncTriPeaksVariantSelect();
    tripeaksState.peaks = Array.isArray(saved.peaks)
        ? saved.peaks.map(card => reviveTriPeaksCard(card))
        : [];
    tripeaksState.stock = Array.isArray(saved.stock)
        ? saved.stock.map(card => reviveTriPeaksCard(card))
        : [];
    tripeaksState.waste = Array.isArray(saved.waste)
        ? saved.waste.map(card => reviveTriPeaksCard(card))
        : [];
    tripeaksState.score = Number.isFinite(saved.score) ? saved.score : 0;
    tripeaksState.moves = Number.isFinite(saved.moves) ? saved.moves : 0;
    tripeaksState.moveHistory = Array.isArray(saved.moveHistory)
        ? saved.moveHistory.map(entry => (
            typeof CommonUtils !== 'undefined' && typeof CommonUtils.hydrateSavedValue === 'function'
                ? CommonUtils.hydrateSavedValue(entry)
                : entry
        ))
        : [];
    tripeaksState.isGameWon = false;

    if (tripeaksState.timerInterval) {
        clearInterval(tripeaksState.timerInterval);
    }
    const elapsed = Number.isFinite(saved.elapsedSeconds) ? saved.elapsedSeconds : 0;
    tripeaksState.startTime = Date.now() - elapsed * 1000;
    startTimer();

    updateUI();
    updateUndoButtonState();
}

function dealTriPeaks() {
    const deck = CommonUtils.createShoe(1, SUITS, VALUES);
    const variant = getActiveTriPeaksVariant();

    // TriPeaks layout: 28 cards
    // 3 peaks, each has 3 rows:
    // Row 0: 3 cards (1 per peak)
    // Row 1: 6 cards (2 per peak)
    // Row 2: 9 cards (3 per peak)
    // Row 3: 10 cards (connecting base)

    tripeaksState.peaks = [];
    for (let i = 0; i < TRIPEAKS_PEAK_CARDS; i++) {
        const card = deck.pop();
        card.hidden = variant.revealAllPeaks ? false : i < TRIPEAKS_FACEUP_START_INDEX;
        tripeaksState.peaks.push(card);
    }

    tripeaksState.stock = deck;
    tripeaksState.stock.forEach(card => card.hidden = true);

    // First card to waste
    const firstWaste = tripeaksState.stock.pop();
    firstWaste.hidden = false;
    tripeaksState.waste = [firstWaste];
}

function updateUI() {
    CommonUtils.preserveHorizontalScroll({
        targets: ['tripeaks-scroll', 'tripeaks-area'],
        update: () => {
            updateStock();
            updateWaste();
            updatePeaks();
            updateStats();
            ensureTriPeaksSizing();
            if (scheduleTriPeaksSizing) scheduleTriPeaksSizing();
        },
        beforeNextFrame: () => {
            ensureTriPeaksSizing();
        }
    });
}

function ensureTriPeaksSizing() {
    CommonUtils.ensureScrollableWidth({
        table: 'table',
        wrapper: 'tripeaks-scroll',
        contentSelectors: ['#tripeaks-top-row', '#tripeaks-area']
    });
}

function updateStock() {
    const stockEl = document.getElementById('tripeaks-stock');
    if (!stockEl) return;
    stockEl.innerHTML = '';

    if (tripeaksState.stock.length > 0) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card hidden';
        cardEl.style.cursor = 'pointer';
        cardEl.addEventListener('click', drawFromStock);
        stockEl.appendChild(cardEl);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'pile-placeholder';
        placeholder.textContent = 'Empty';
        stockEl.appendChild(placeholder);
    }
}

function updateWaste() {
    const wasteEl = document.getElementById('tripeaks-waste');
    if (!wasteEl) return;
    wasteEl.innerHTML = '';

    if (tripeaksState.waste.length > 0) {
        const topCard = tripeaksState.waste[tripeaksState.waste.length - 1];
        const cardEl = CommonUtils.createCardEl(topCard);
        wasteEl.appendChild(cardEl);
    }
}

function getTriPeaksMetrics() {
    const styles = getComputedStyle(document.documentElement);
    const baseW = parseFloat(styles.getPropertyValue('--card-w')) || 70;
    const baseH = parseFloat(styles.getPropertyValue('--card-h')) || 100;
    const scale = parseFloat(styles.getPropertyValue('--card-scale')) || 1;
    const cardWidth = baseW * scale;
    const cardHeight = baseH * scale;

    return {
        cardWidth,
        cardHeight,
        hStep: cardWidth * 0.55,
        vStep: cardHeight * 0.45
    };
}

function updatePeaks() {
    const area = document.getElementById('tripeaks-area');
    if (!area) return;
    area.innerHTML = '';

    const metrics = getTriPeaksMetrics();
    const peakSpacing = metrics.cardWidth * 1.65;

    // Layout positions for 28 cards
    const positions = [];

    // Rows 0, 1, 2 for 3 peaks
    for (let row = 0; row < 3; row++) {
        for (let peak = 0; peak < 3; peak++) {
            const rowCount = row + 1;
            for (let i = 0; i < rowCount; i++) {
                const x = peak * peakSpacing + (i - row * 0.5) * metrics.cardWidth;
                const y = row * metrics.vStep;
                positions.push({ x, y, row, peak });
            }
        }
    }
    // Row 3: 10 cards
    for (let i = 0; i < 10; i++) {
        const x = (i - 4.5) * metrics.cardWidth + peakSpacing;
        const y = 3 * metrics.vStep;
        positions.push({ x, y, row: 3, peak: -1 });
    }

    // Center the whole thing
    let minX = Infinity, maxX = -Infinity;
    positions.forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
    });
    const layoutWidth = maxX - minX + metrics.cardWidth;
    const offsetX = -minX;

    area.style.width = `${layoutWidth}px`;

    tripeaksState.peaks.forEach((card, index) => {
        if (!card) return;
        const pos = positions[index];
        const cardEl = CommonUtils.createCardEl(card);
        cardEl.classList.add('tripeaks-card');
        cardEl.dataset.index = index;
        cardEl.style.position = 'absolute';
        cardEl.style.left = `${pos.x + offsetX}px`;
        cardEl.style.top = `${pos.y}px`;

        const exposed = isCardExposed(index);
        if (card.hidden && exposed) {
            card.hidden = false;
            // Update the element because createCardEl uses card.hidden
            const newEl = CommonUtils.createCardEl(card);
            newEl.className = cardEl.className;
            newEl.style.cssText = cardEl.style.cssText;
            newEl.dataset.index = index;
            cardEl.replaceWith(newEl);
            newEl.addEventListener('click', () => handleCardClick(index));
        } else if (!exposed) {
            cardEl.classList.add('blocked');
            if (getActiveTriPeaksVariant().hideBlockedCards) {
                cardEl.classList.add('hidden');
            }
        } else {
            cardEl.style.cursor = 'pointer';
            cardEl.addEventListener('click', () => handleCardClick(index));
        }

        area.appendChild(cardEl);
    });
}

function isCardExposed(index) {
    // TriPeaks overlap rules:
    // A card is blocked if the two cards below it in the layout are present.
    // Layout indices:
    // Row 0: 0, 1, 2
    // Row 1: 3,4 (under 0), 5,6 (under 1), 7,8 (under 2)
    // Row 2: 9,10,11 (under 3,4), 12,13,14 (under 5,6), 15,16,17 (under 7,8)
    // Row 3: 18-27 (under 9-17, connected)

    if (index >= TRIPEAKS_FACEUP_START_INDEX) return true; // Bottom row is always exposed from below

    const overlaps = {
        0: [3, 4], 1: [5, 6], 2: [7, 8],
        3: [9, 10], 4: [10, 11], 5: [12, 13], 6: [13, 14], 7: [15, 16], 8: [16, 17],
        9: [18, 19], 10: [19, 20], 11: [21, 22], 12: [22, 23], 13: [24, 25], 14: [25, 26], 15: [26, 27], 16: [27, 28], // wait, row 3 has 10 cards.
    };

    // Better overlap mapping based on the row-by-row structure:
    // Row 0 (3): 0, 1, 2
    // Row 1 (6): 3,4, 5,6, 7,8
    // Row 2 (9): 9,10,11, 12,13,14, 15,16,17
    // Row 3 (10): 18,19,20,21,22,23,24,25,26,27

    // Let's use a simpler mapping for TriPeaks:
    const map = [
        [3,4], [5,6], [7,8], // row 0 -> row 1
        [9,10], [10,11], [12,13], [13,14], [15,16], [16,17], // row 1 -> row 2
        [18,19], [19,20], [21,22], [22,23], [24,25], [25,26], [26,27], [27,28], // wait this is still tricky.
    ];

    // Standard TriPeaks overlap:
    // Card at row r, index i is blocked by cards at row r+1, index i and i+1
    // if we treat the whole thing as a flattened pyramid. But TriPeaks is 3 pyramids.

    if (index < 3) { // Row 0
        return !tripeaksState.peaks[index * 2 + 3] && !tripeaksState.peaks[index * 2 + 4];
    }
    if (index < 9) { // Row 1
        // card 3: peaks[9,10], card 4: peaks[10,11], card 5: peaks[12,13]...
        const r1Base = 3;
        const r2Base = 9;
        const offset = index - r1Base;
        return !tripeaksState.peaks[r2Base + offset] && !tripeaksState.peaks[r2Base + offset + 1];
    }
    if (index < 18) { // Row 2
        // Row 2 connects to Row 3 (10 cards)
        // 9: [18,19], 10: [19,20], 11: [20,21]...
        const r2Base = 9;
        const r3Base = 18;
        const offset = index - r2Base;
        return !tripeaksState.peaks[r3Base + offset] && !tripeaksState.peaks[r3Base + offset + 1];
    }

    return true;
}

function handleCardClick(index) {
    const card = tripeaksState.peaks[index];
    if (!card || card.hidden || !isCardExposed(index)) return;

    const wasteCard = tripeaksState.waste[tripeaksState.waste.length - 1];
    if (canMoveToWaste(card, wasteCard)) {
        moveToWaste(index);
    }
}

function canMoveToWaste(card, wasteCard) {
    if (!wasteCard) return true;
    const variant = getActiveTriPeaksVariant();
    const diff = Math.abs(card.rank - wasteCard.rank);
    if (variant.allowSameRank && diff === 0) return true;
    if (diff === 1) return true;
    return variant.allowWrapAround && diff === 12;
}

function moveToWaste(index) {
    const card = tripeaksState.peaks[index];
    tripeaksState.peaks[index] = null;
    tripeaksState.waste.push(card);

    tripeaksState.moves++;
    tripeaksState.score += 10; // Simple scoring

    recordMove({
        type: 'move',
        index,
        card,
        scoreDelta: 10
    });

    CommonUtils.playSound('card');
    updateUI();
    checkWinCondition();
}

function drawFromStock() {
    if (tripeaksState.stock.length === 0) return;

    const card = tripeaksState.stock.pop();
    card.hidden = false;
    tripeaksState.waste.push(card);

    tripeaksState.moves++;
    recordMove({
        type: 'draw',
        card
    });

    CommonUtils.playSound('card');
    updateUI();
}

function recordMove(entry) {
    tripeaksState.moveHistory.push(entry);
    if (tripeaksState.moveHistory.length > TRIPEAKS_MAX_HISTORY) {
        tripeaksState.moveHistory.shift();
    }
    updateUndoButtonState();
    if (tripeaksStateManager) {
        tripeaksStateManager.markDirty();
    }
}

function updateUndoButtonState() {
    const btn = document.getElementById('tripeaks-undo');
    if (btn) btn.disabled = tripeaksState.moveHistory.length === 0;
}

function undoLastMove() {
    if (tripeaksState.moveHistory.length === 0) return;

    const entry = tripeaksState.moveHistory.pop();
    if (entry.type === 'move') {
        tripeaksState.peaks[entry.index] = entry.card;
        tripeaksState.waste.pop();
        tripeaksState.score -= entry.scoreDelta;
    } else if (entry.type === 'draw') {
        const card = tripeaksState.waste.pop();
        card.hidden = true;
        tripeaksState.stock.push(card);
    }

    tripeaksState.moves--;
    updateUI();
    updateUndoButtonState();
}

function checkWinCondition() {
    const won = tripeaksState.peaks.every(card => !card);
    if (won) {
        tripeaksState.isGameWon = true;
        clearInterval(tripeaksState.timerInterval);
        CommonUtils.playSound('win');
        CommonUtils.showTableToast(getActiveTriPeaksVariant().winMessage, { variant: 'win', duration: 2500 });
        if (tripeaksStateManager) {
            tripeaksStateManager.clear();
        }
    }
}

function updateStats() {
    document.getElementById('tripeaks-moves').textContent = tripeaksState.moves;
    document.getElementById('tripeaks-score').textContent = tripeaksState.score;
    syncTriPeaksHighScore();
}

function showTriPeaksHint() {
    const wasteCard = tripeaksState.waste[tripeaksState.waste.length - 1];
    for (let i = 0; i < tripeaksState.peaks.length; i++) {
        const card = tripeaksState.peaks[i];
        if (card && !card.hidden && isCardExposed(i) && canMoveToWaste(card, wasteCard)) {
            CommonUtils.showTableToast(`Hint: Move ${card.val}${card.suit}`, { variant: 'warn', duration: 2000 });
            return;
        }
    }
    CommonUtils.showTableToast('Hint: Draw from stock', { variant: 'warn', duration: 2000 });
}

function showTriPeaksHelp() {
    const variant = getActiveTriPeaksVariant();
    const variantNotes = {
        classic: 'Classic mode allows wrap-around (A and K are adjacent).',
        strict: 'Strict mode does not allow wrap-around.',
        relaxed: 'Relaxed mode allows wrap-around and matching the same rank.',
        open: 'Open mode starts with all peak cards visible.'
    };
    const message = [
        'Goal: Clear all peak cards.',
        'Move rule: You may remove an exposed peak card if it is one rank above or below the waste top card.',
        variantNotes[variant.id] || '',
        'Stock: Draw a new waste card from stock when needed.',
        'Winning: The game is won when every peak card is removed.'
    ].filter(Boolean).join('\n');
    if (typeof SolitaireUiFeedback !== 'undefined' && typeof SolitaireUiFeedback.showInfo === 'function') {
        SolitaireUiFeedback.showInfo({ title: 'TriPeaks Rules', message });
        return;
    }
    alert(`TriPeaks Rules\n\n${message}`);
}

function setupTriPeaksEventListeners() {
    document.getElementById('tripeaks-new-game').addEventListener('click', initTriPeaksGame);
    document.getElementById('tripeaks-undo').addEventListener('click', undoLastMove);
    document.getElementById('tripeaks-hint').addEventListener('click', showTriPeaksHint);
    document.getElementById('tripeaks-help')?.addEventListener('click', showTriPeaksHelp);
    document.getElementById('tripeaks-variant-select')?.addEventListener('change', (event) => {
        applyTriPeaksVariant(event.target.value, { startNewGame: true });
        if (tripeaksStateManager) {
            tripeaksStateManager.markDirty();
        }
    });

    const applyTableStyle = () => {
        const select = document.getElementById('table-style-select');
        if (!select) return;
        const style = select.value;
        Array.from(document.body.classList).forEach(cls => {
            if (cls.startsWith('table-')) document.body.classList.remove(cls);
        });
        if (style) document.body.classList.add(`table-${style}`);
    };

    const applyDeckStyle = () => {
        const select = document.getElementById('deck-style-select');
        if (!select) return;
        const style = select.value;
        Array.from(document.body.classList).forEach(cls => {
            if (cls.startsWith('deck-')) document.body.classList.remove(cls);
        });
        if (style) document.body.classList.add(`deck-${style}`);
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

    syncTriPeaksVariantSelect();
}
