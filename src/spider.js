/**
 * Spider Solitaire Game Controller
 */
const spiderSoundFiles = {
    card: ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav'],
    win: ['win.wav'],
    shuffle: ['shuffle.wav']
};

const spiderState = {
    tableau: Array.from({ length: 10 }, () => []),
    stock: [],
    foundations: [],
    score: 0,
    moves: 0,
    startTime: null,
    timerInterval: null,
    isGameWon: false,
    isDealing: false,
    moveHistory: [],
    suitMode: 4
};

const SPIDER_SUIT_MODES = {
    4: { label: '4 Suits', suits: SUITS, deckCount: 2 },
    2: { label: '2 Suits', suits: ['♠', '♥'], deckCount: 4 },
    1: { label: '1 Suit', suits: ['♠'], deckCount: 8 }
};
const SPIDER_FOUNDATION_PLACEHOLDER_SUITS = ['♥', '♠', '♦', '♣', '♥', '♠', '♦', '♣'];
const spiderVariant = (() => {
    const defaults = {
        stateGameId: 'spider',
        highScoreGameId: 'spider',
        ruleSetKey: null,
        forceSuitMode: null,
        showSuitSelector: true,
        allowDealFromStock: true,
        foundationSlots: 8,
        deckCount: null,
        suits: null,
        values: null,
        tableauDealCounts: null,
        faceUpAllDealt: false,
        completeRunLength: 13,
        completeStartValue: 'K',
        enableCheck: true,
        winMessage: 'You solved Spider Solitaire!',
        stockPlaceholderLabel: 'Stock'
    };
    const incoming = (typeof window !== 'undefined' && window.SpiderVariant && typeof window.SpiderVariant === 'object')
        ? window.SpiderVariant
        : {};
    const tableauDealCounts = Array.isArray(incoming.tableauDealCounts)
        ? incoming.tableauDealCounts.map((count) => parseInt(count, 10)).filter((count) => Number.isFinite(count) && count >= 0)
        : null;
    const normalizedFoundationSlots = Math.max(1, parseInt(incoming.foundationSlots, 10) || defaults.foundationSlots);
    return {
        stateGameId: String(incoming.stateGameId || defaults.stateGameId),
        highScoreGameId: String(incoming.highScoreGameId || defaults.highScoreGameId),
        ruleSetKey: incoming.ruleSetKey ? String(incoming.ruleSetKey) : null,
        forceSuitMode: Number.isFinite(parseInt(incoming.forceSuitMode, 10)) ? parseInt(incoming.forceSuitMode, 10) : defaults.forceSuitMode,
        showSuitSelector: incoming.showSuitSelector !== false,
        allowDealFromStock: incoming.allowDealFromStock !== false,
        foundationSlots: normalizedFoundationSlots,
        deckCount: Number.isFinite(parseInt(incoming.deckCount, 10)) ? parseInt(incoming.deckCount, 10) : defaults.deckCount,
        suits: Array.isArray(incoming.suits) && incoming.suits.length ? incoming.suits.slice() : defaults.suits,
        values: Array.isArray(incoming.values) && incoming.values.length ? incoming.values.slice() : defaults.values,
        tableauDealCounts: (tableauDealCounts && tableauDealCounts.length === 10) ? tableauDealCounts : defaults.tableauDealCounts,
        faceUpAllDealt: incoming.faceUpAllDealt === true,
        completeRunLength: Math.max(1, parseInt(incoming.completeRunLength, 10) || defaults.completeRunLength),
        completeStartValue: String(incoming.completeStartValue || defaults.completeStartValue),
        enableCheck: incoming.enableCheck !== false,
        winMessage: String(incoming.winMessage || defaults.winMessage),
        stockPlaceholderLabel: String(incoming.stockPlaceholderLabel || defaults.stockPlaceholderLabel)
    };
})();

function getSpiderSuitConfig() {
    if (spiderVariant.deckCount && Array.isArray(spiderVariant.suits) && spiderVariant.suits.length) {
        return {
            label: 'Custom',
            suits: spiderVariant.suits,
            deckCount: spiderVariant.deckCount,
            values: Array.isArray(spiderVariant.values) && spiderVariant.values.length ? spiderVariant.values : VALUES
        };
    }
    const key = Number.isFinite(spiderState.suitMode) ? spiderState.suitMode : parseInt(spiderState.suitMode, 10);
    if (!SPIDER_SUIT_MODES[key]) {
        spiderState.suitMode = 4;
        return SPIDER_SUIT_MODES[4];
    }
    return SPIDER_SUIT_MODES[key];
}

function syncSpiderSuitUI() {
    const select = document.getElementById('spider-suit-select');
    if (!select) return;
    const container = select.closest('.stats');
    if (container) {
        container.style.display = spiderVariant.showSuitSelector ? '' : 'none';
    }
    if (!spiderVariant.showSuitSelector) return;
    select.value = String(spiderState.suitMode || 4);
}

function getSpiderRuleSetKey() {
    if (spiderVariant.ruleSetKey) return spiderVariant.ruleSetKey;
    const suitMode = Number.isFinite(spiderState.suitMode) ? spiderState.suitMode : parseInt(spiderState.suitMode, 10);
    const normalized = SPIDER_SUIT_MODES[suitMode] ? suitMode : 4;
    return `suits-${normalized}`;
}

function syncSpiderHighScore() {
    const highScoreEl = document.getElementById('spider-high-score');
    if (!highScoreEl) return;
    const highScore = CommonUtils.updateHighScore(spiderVariant.highScoreGameId, getSpiderRuleSetKey(), spiderState.score);
    highScoreEl.textContent = highScore;
}

let spiderStateManager = null;

const SPIDER_CARD_HEIGHT = 100;
const SPIDER_STACK_OFFSET = 24;
const SPIDER_STACK_X_OFFSET = 2.5;
const SPIDER_STACK_X_OFFSET_MAX = 18;
const SPIDER_DROP_PADDING = 40;
const SPIDER_MOBILE_DROP_PADDING = 14;
const SPIDER_COMPLETE_BONUS = 100;
const SPIDER_MAX_HISTORY = 200;
const SPIDER_MIN_TABLEAU_CARDS = 26;
const SPIDER_BASE_TABLEAU_GAP = 12;
const SPIDER_MIN_TABLEAU_GAP = 3;
const SPIDER_BASE_FAN_X = 18;
const SPIDER_MIN_FAN_X = 4;
const SPIDER_FAN_PADDING = 2;
const SPIDER_QUICK_CHECK_LIMITS = {
    1: { maxStates: 9000, maxDurationMs: 5000 },
    2: { maxStates: 7000, maxDurationMs: 5000 },
    4: { maxStates: 5500, maxDurationMs: 5000 }
};
const SPIDER_ATTEMPT_CHECK_LIMITS = {
    1: { maxStates: 55000, maxDurationMs: 60000 },
    2: { maxStates: 45000, maxDurationMs: 60000 },
    4: { maxStates: 35000, maxDurationMs: 60000 }
};
let spiderCheckWorker = null;
let spiderCheckRequestId = 0;
let spiderCheckSolvedLocked = false;
let spiderCheckUnsolvableLocked = false;
let spiderStoredSolution = null;

const spiderDragState = {
    draggedCards: [],
    source: null,
    draggedElements: [],
    dragLayer: null,
    pointerOffsetX: 0,
    pointerOffsetY: 0,
    isDragging: false,
    pendingDrag: null,
    activePointerId: null,
    mobileController: null
};

document.addEventListener('DOMContentLoaded', () => {
    CommonUtils.preloadAudio(spiderSoundFiles);
    setupSpiderEventListeners();
    CommonUtils.initCardScaleControls('spider-card-scale', 'spider-card-scale-value');
    spiderStateManager = new CommonUtils.StateManager({
        gameId: spiderVariant.stateGameId,
        getState: getSpiderSaveState,
        setState: restoreSpiderState,
        isWon: () => spiderState.isGameWon
    });
    const restored = spiderStateManager.load();
    if (!restored) {
        initSpiderGame();
    }
});

function ensureMobileController() {
    if (spiderDragState.mobileController || typeof MobileSolitaireController === 'undefined') return;
    spiderDragState.mobileController = new MobileSolitaireController({
        isMovable: (el) => {
            const col = parseInt(el.dataset.column, 10);
            const index = parseInt(el.dataset.index, 10);
            const column = spiderState.tableau[col];
            const sequence = column.slice(index);
            if (!sequence.length || sequence.some(c => c.hidden)) return false;
            for (let i = 0; i < sequence.length - 1; i++) {
                if (sequence[i].rank !== sequence[i + 1].rank + 1) return false;
            }
            return true;
        },
        getSequence: (el) => {
            const col = parseInt(el.dataset.column, 10);
            const index = parseInt(el.dataset.index, 10);
            return spiderState.tableau[col].slice(index);
        },
        getSource: (el) => {
            return { type: 'tableau', index: parseInt(el.dataset.column, 10) };
        },
        getElements: (el) => collectDraggedElements(el),
        findDropTarget: (x, y) => {
            const directTarget = UIHelpers.getTargetFromPoint(x, y, [
                {
                    selector: '.spider-column',
                    resolve: (el) => ({ type: 'tableau', index: parseInt(el.id.split('-')[2], 10) })
                }
            ]);
            if (directTarget) return directTarget;

            const colIndex = findTableauDropColumn(x, y);
            if (colIndex !== null) return { type: 'tableau', index: colIndex };
            return null;
        },
        isValidMove: (source, target) => {
            spiderDragState.draggedCards = spiderDragState.mobileController.selectedData.cards;
            if (!spiderDragState.draggedCards.length) {
                spiderDragState.draggedCards = [];
                return false;
            }

            if (target.type !== 'tableau') {
                spiderDragState.draggedCards = [];
                return false;
            }

            if (source.index === target.index) {
                spiderDragState.draggedCards = [];
                return false;
            }

            const movingCard = spiderDragState.draggedCards[0];
            const targetPile = spiderState.tableau[target.index];
            let valid = false;
            if (targetPile.length === 0) {
                valid = true;
            } else {
                const topCard = targetPile[targetPile.length - 1];
                valid = !topCard.hidden && topCard.rank === movingCard.rank + 1;
            }

            spiderDragState.draggedCards = [];
            return valid;
        },
        executeMove: (source, target) => {
            spiderDragState.draggedCards = spiderDragState.mobileController.selectedData.cards;
            spiderDragState.draggedElements = spiderDragState.mobileController.selectedData.elements;
            spiderDragState.source = source;

            let targetEl = null;
            if (target.type === 'tableau') {
                targetEl = document.getElementById(`spider-column-${target.index}`);
            }

            if (targetEl) {
                const rect = targetEl.getBoundingClientRect();
                finishDrag(rect.left + rect.width / 2, rect.top + rect.height / 2);
            } else {
                resetDragState();
                updateUI();
            }
        }
    });

    if (CommonUtils.isMobile() && spiderDragState.mobileController) {
        const table = document.getElementById('table');
        if (table) {
            table.addEventListener('pointerdown', (e) => {
                spiderDragState.mobileController.handlePointerDown(e);
            });
        }
        document.addEventListener('pointermove', (e) => {
            spiderDragState.mobileController.handlePointerMove(e);
        });
        document.addEventListener('pointerup', (e) => {
            spiderDragState.mobileController.handlePointerUp(e);
        });
        document.addEventListener('pointercancel', (e) => {
            spiderDragState.mobileController.handlePointerCancel(e);
        });
    }
}

function initSpiderGame() {
    ensureMobileController();

    spiderState.tableau = Array.from({ length: 10 }, () => []);
    spiderState.stock = [];
    spiderState.foundations = [];
    spiderState.score = 0;
    spiderState.moves = 0;
    spiderState.isGameWon = false;
    spiderState.moveHistory = [];
    if (Number.isFinite(spiderVariant.forceSuitMode) && SPIDER_SUIT_MODES[spiderVariant.forceSuitMode]) {
        spiderState.suitMode = spiderVariant.forceSuitMode;
    }

    if (spiderState.timerInterval) {
        clearInterval(spiderState.timerInterval);
    }
    spiderState.startTime = Date.now();

    dealSpiderLayout();
    startTimer();
    updateUI();
    updateUndoButtonState();
    resetSpiderCheckAvailability();
    CommonUtils.playSound('shuffle');
    if (spiderStateManager) {
        spiderStateManager.markDirty();
    }
}

function startTimer() {
    spiderState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - spiderState.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeEl = document.getElementById('spider-time');
        if (timeEl) {
            timeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function getElapsedSeconds(startTime) {
    if (!Number.isFinite(startTime)) return 0;
    return Math.max(0, Math.floor((Date.now() - startTime) / 1000));
}

function getSpiderSaveState() {
    return {
        tableau: spiderState.tableau,
        stock: spiderState.stock,
        foundations: spiderState.foundations,
        score: spiderState.score,
        moves: spiderState.moves,
        moveHistory: spiderState.moveHistory,
        suitMode: spiderState.suitMode,
        variantId: spiderVariant.stateGameId,
        elapsedSeconds: getElapsedSeconds(spiderState.startTime),
        isGameWon: spiderState.isGameWon
    };
}

function restoreSpiderState(saved) {
    if (!saved || typeof saved !== 'object') return;
    ensureMobileController();

    spiderState.tableau = saved.tableau || Array.from({ length: 10 }, () => []);
    spiderState.stock = saved.stock || [];
    spiderState.foundations = saved.foundations || [];
    spiderState.score = Number.isFinite(saved.score) ? saved.score : 0;
    spiderState.moves = Number.isFinite(saved.moves) ? saved.moves : 0;
    spiderState.moveHistory = Array.isArray(saved.moveHistory) ? saved.moveHistory : [];
    if (Number.isFinite(spiderVariant.forceSuitMode) && SPIDER_SUIT_MODES[spiderVariant.forceSuitMode]) {
        spiderState.suitMode = spiderVariant.forceSuitMode;
    } else {
        spiderState.suitMode = SPIDER_SUIT_MODES[saved.suitMode] ? saved.suitMode : 4;
    }
    spiderState.isGameWon = false;
    spiderState.isDealing = false;

    if (spiderState.timerInterval) {
        clearInterval(spiderState.timerInterval);
    }
    const elapsed = Number.isFinite(saved.elapsedSeconds) ? saved.elapsedSeconds : 0;
    spiderState.startTime = Date.now() - elapsed * 1000;
    startTimer();

    syncSpiderSuitUI();
    updateUI();
    updateUndoButtonState();
    resetSpiderCheckAvailability();
}

function dealSpiderLayout() {
    const config = getSpiderSuitConfig();
    const deckValues = Array.isArray(config.values) && config.values.length ? config.values : VALUES;
    const deck = CommonUtils.createShoe(config.deckCount, config.suits, deckValues);
    spiderState.tableau = Array.from({ length: 10 }, () => []);

    for (let col = 0; col < 10; col++) {
        const cardsInColumn = Array.isArray(spiderVariant.tableauDealCounts)
            ? spiderVariant.tableauDealCounts[col]
            : (col < 4 ? 6 : 5);
        for (let row = 0; row < cardsInColumn; row++) {
            const card = deck.pop();
            card.hidden = spiderVariant.faceUpAllDealt ? false : (row !== cardsInColumn - 1);
            spiderState.tableau[col].push(card);
        }
    }

    spiderState.stock = deck;
}

function updateUI() {
    updateTableau();
    updateStock();
    updateFoundations();
    updateStats();
    scheduleTableauSizing();
}

function getMaxTableauLength() {
    return spiderState.tableau.reduce((max, column) => Math.max(max, column.length), 0);
}

function getStackOffsets() {
    return {
        y: CommonUtils.getSolitaireStackOffset(SPIDER_STACK_OFFSET, { minFactor: 0.4 }),
        x: CommonUtils.getSolitaireStackOffset(SPIDER_STACK_X_OFFSET, {
            min: 1,
            max: Math.min(SPIDER_STACK_X_OFFSET_MAX, SPIDER_STACK_X_OFFSET)
        })
    };
}

function getDesiredSpiderFanReserve(baseFan) {
    const maxCards = Math.max(1, getMaxTableauLength());
    const offsets = getStackOffsets();
    const neededFan = Math.min(
        SPIDER_STACK_X_OFFSET_MAX,
        Math.max(0, (maxCards - 1) * offsets.x)
    ) + SPIDER_FAN_PADDING;
    return CommonUtils.clampNumber(neededFan, SPIDER_MIN_FAN_X, baseFan, baseFan);
}

function applyAdaptiveTableauSpacing() {
    const tableEl = document.getElementById('table');
    const wrapperEl = document.getElementById('spider-scroll');
    const tableauEl = document.getElementById('spider-tableau');
    if (!tableEl || !wrapperEl || !tableauEl) return;

    const scale = CommonUtils.getUiScaleValue();
    const baseGap = CommonUtils.getSolitaireStackOffset(SPIDER_BASE_TABLEAU_GAP, {
        scale,
        min: SPIDER_MIN_TABLEAU_GAP,
        max: SPIDER_BASE_TABLEAU_GAP
    });
    const baseFan = CommonUtils.getSolitaireStackOffset(SPIDER_BASE_FAN_X, {
        scale,
        min: SPIDER_MIN_FAN_X,
        max: SPIDER_BASE_FAN_X
    });

    const styles = getComputedStyle(tableauEl);
    const currentGap = parseFloat(styles.columnGap || styles.gap) || baseGap;
    const currentFan = parseFloat(getComputedStyle(tableEl).getPropertyValue('--spider-fan-x')) || baseFan;
    const availableWidth = wrapperEl.getBoundingClientRect().width || 0;
    const spacing = CommonUtils.resolveAdaptiveSpacing({
        availableWidth,
        contentWidth: tableauEl.scrollWidth,
        currentGap,
        baseGap,
        minGap: SPIDER_MIN_TABLEAU_GAP,
        gapSlots: 9,
        currentFan,
        baseFan: getDesiredSpiderFanReserve(baseFan),
        minFan: SPIDER_MIN_FAN_X,
        fanSlots: 10
    });

    tableEl.style.setProperty('--spider-tableau-gap', `${spacing.gap}px`);
    tableEl.style.setProperty('--spider-fan-x', `${spacing.fan}px`);
}

function ensureTableauSizing() {
    applyAdaptiveTableauSpacing();
    const offsets = getStackOffsets();
    const maxCards = Math.max(SPIDER_MIN_TABLEAU_CARDS, getMaxTableauLength());
    const stackHeight = CommonUtils.getStackHeight(maxCards, offsets.y);
    CommonUtils.ensureTableauMinHeight({
        table: 'table',
        topRow: 'spider-top-row',
        stackOffset: offsets.y,
        maxCards
    });
    const tableauArea = document.getElementById('spider-tableau');
    if (tableauArea) {
        tableauArea.style.minHeight = `${Math.ceil(stackHeight)}px`;
    }
    document.querySelectorAll('.spider-column').forEach(column => {
        column.style.minHeight = `${Math.ceil(stackHeight)}px`;
    });
    CommonUtils.ensureScrollableWidth({
        table: 'table',
        wrapper: 'spider-scroll',
        contentSelectors: ['#spider-top-row', '#spider-tableau'],
        extra: 10
    });
}

const scheduleTableauSizing = CommonUtils.createRafScheduler(ensureTableauSizing);

function updateTableau() {
    const tableauArea = document.getElementById('spider-tableau');
    if (!tableauArea) return;
    tableauArea.innerHTML = '';
    const offsets = getStackOffsets();

    spiderState.tableau.forEach((column, colIndex) => {
        const columnEl = document.createElement('div');
        columnEl.className = 'spider-column pile';
        columnEl.id = `spider-column-${colIndex}`;

        column.forEach((card, rowIndex) => {
            const cardEl = CommonUtils.createCardEl(card);
            cardEl.style.position = 'absolute';
            cardEl.style.top = `${rowIndex * offsets.y}px`;
            cardEl.style.left = `${Math.min(SPIDER_STACK_X_OFFSET_MAX, rowIndex * offsets.x)}px`;
            cardEl.dataset.column = colIndex;
            cardEl.dataset.index = rowIndex;

            if (!card.hidden) {
                if (!CommonUtils.isMobile() || !spiderDragState.mobileController) {
                    cardEl.addEventListener('pointerdown', handlePointerDown);
                }
                cardEl.style.cursor = 'pointer';
            }

            columnEl.appendChild(cardEl);
        });

        tableauArea.appendChild(columnEl);
    });
}

function updateStock() {
    const stockEl = document.getElementById('spider-stock');
    if (!stockEl) return;
    stockEl.innerHTML = '';

    if (spiderVariant.allowDealFromStock && spiderState.stock.length > 0) {
        const rowsLeft = Math.ceil(spiderState.stock.length / 10);
        const stack = document.createElement('div');
        stack.className = 'spider-stock-stack';
        const stackCount = Math.min(5, rowsLeft);
        for (let i = 0; i < stackCount; i++) {
            const cardEl = document.createElement('div');
            cardEl.className = 'card hidden';
            const rot = getStockStackRotation(i, rowsLeft);
            cardEl.style.transform = `translate(${i * 5}px, ${-i * 4}px) rotate(${rot}deg) scale(var(--card-scale))`;
            stack.appendChild(cardEl);
        }
        stack.addEventListener('click', dealFromStock);
        stack.style.cursor = 'pointer';
        stockEl.appendChild(stack);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'pile-placeholder';
        placeholder.textContent = spiderVariant.stockPlaceholderLabel;
        stockEl.appendChild(placeholder);
    }
}

function updateFoundations() {
    const foundationArea = document.getElementById('spider-foundations');
    if (!foundationArea) return;
    foundationArea.innerHTML = '';

    for (let i = 0; i < spiderVariant.foundationSlots; i++) {
        const pile = document.createElement('div');
        pile.className = 'spider-foundation pile';
        if (spiderState.foundations[i]) {
            const suit = spiderState.foundations[i];
            const card = new Card(suit, 'K');
            card.rotation = 0;
            const cardEl = CommonUtils.createCardEl(card);
            pile.appendChild(cardEl);
        } else {
            const placeholderSuit = SPIDER_FOUNDATION_PLACEHOLDER_SUITS[i] || '♠';
            const placeholder = document.createElement('div');
            placeholder.className = 'spider-foundation-placeholder';

            const topRank = document.createElement('span');
            topRank.className = 'spider-foundation-rank spider-foundation-rank-top';
            topRank.textContent = 'K';

            const suitGlyph = document.createElement('span');
            suitGlyph.className = 'spider-foundation-suit';
            suitGlyph.textContent = placeholderSuit;
            if (placeholderSuit === '♥' || placeholderSuit === '♦') {
                suitGlyph.classList.add('is-red');
            }

            const bottomRank = document.createElement('span');
            bottomRank.className = 'spider-foundation-rank spider-foundation-rank-bottom';
            bottomRank.textContent = 'A';

            placeholder.append(topRank, suitGlyph, bottomRank);
            pile.appendChild(placeholder);
        }
        foundationArea.appendChild(pile);
    }
}

function updateStats() {
    const movesEl = document.getElementById('spider-moves');
    const scoreEl = document.getElementById('spider-score');
    if (movesEl) movesEl.textContent = spiderState.moves;
    if (scoreEl) scoreEl.textContent = spiderState.score;
    syncSpiderHighScore();
}

function recordMove(moveEntry) {
    spiderState.moveHistory.push(moveEntry);
    if (spiderState.moveHistory.length > SPIDER_MAX_HISTORY) {
        spiderState.moveHistory.shift();
    }
    updateUndoButtonState();
    if (spiderStateManager) {
        spiderStateManager.markDirty();
    }
}

function updateUndoButtonState() {
    const btn = document.getElementById('spider-undo');
    if (!btn) return;
    btn.disabled = spiderState.moveHistory.length === 0 || spiderState.isDealing;
}

function undoLastMove() {
    if (spiderState.moveHistory.length === 0 || spiderState.isDealing) return;
    const lastMove = spiderState.moveHistory.pop();

    switch (lastMove.type) {
        case 'tableau-to-tableau':
            undoTableauToTableauMove(lastMove.payload);
            break;
        case 'deal-row':
            undoDealRow(lastMove.payload);
            break;
        default:
            console.warn('Unexpected undo move type:', lastMove.type);
    }

    spiderState.score -= lastMove.scoreDelta;
    spiderState.moves = Math.max(0, spiderState.moves - lastMove.movesDelta);
    spiderState.isGameWon = false;
    updateUI();
    updateUndoButtonState();
    if (spiderStateManager) {
        spiderStateManager.markDirty();
    }
}

function undoTableauToTableauMove(payload) {
    if (payload.completed && payload.completed.cards) {
        spiderState.foundations.pop();
        const restoreColumn = spiderState.tableau[payload.completed.columnIndex];
        restoreColumn.push(...payload.completed.cards);
    }

    const target = spiderState.tableau[payload.toCol];
    const moved = target.splice(target.length - payload.count);
    spiderState.tableau[payload.fromCol].push(...moved);

    if (payload.flippedCard) {
        payload.flippedCard.hidden = true;
    }
}

function undoDealRow(payload) {
    const completed = payload.completed || [];
    for (let i = completed.length - 1; i >= 0; i--) {
        const entry = completed[i];
        spiderState.foundations.pop();
        const column = spiderState.tableau[entry.columnIndex];
        column.push(...entry.cards);
    }

    const dealt = payload.dealt || [];
    for (let i = dealt.length - 1; i >= 0; i--) {
        const entry = dealt[i];
        const column = spiderState.tableau[entry.col];
        const card = column.pop();
        if (card) {
            card.hidden = true;
            spiderState.stock.push(card);
        }
    }
}

function getStockStackRotation(index, rowsLeft) {
    const seed = (rowsLeft * 31) + (index * 17);
    const normalized = ((Math.sin(seed) + 1) / 2);
    return (normalized * 6) - 3;
}

function handlePointerDown(e) {
    if (e.button !== 0) return;
    if (CommonUtils.isMobile() && spiderDragState.mobileController) {
        if (spiderDragState.mobileController.handlePointerDown(e)) return;
    }

    const cardEl = e.target.closest('.card');
    if (!cardEl) return;

    spiderDragState.pendingDrag = {
        cardEl,
        startX: e.clientX,
        startY: e.clientY
    };
    spiderDragState.activePointerId = e.pointerId;
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    if (cardEl.setPointerCapture) {
        cardEl.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
}

function handlePointerMove(e) {
    if (spiderDragState.activePointerId !== e.pointerId) return;

    if (spiderDragState.pendingDrag && !spiderDragState.isDragging) {
        const dx = e.clientX - spiderDragState.pendingDrag.startX;
        const dy = e.clientY - spiderDragState.pendingDrag.startY;
        if (Math.hypot(dx, dy) > 6) {
            startPointerDrag(e);
        }
    }

    if (spiderDragState.isDragging) {
        updateDragLayerPosition(e.clientX, e.clientY);
        updateDragIndicators(e.clientX, e.clientY);
    }
}

function handlePointerUp(e) {
    if (spiderDragState.activePointerId !== e.pointerId) return;

    if (spiderDragState.isDragging) {
        finishDrag(e.clientX, e.clientY);
    } else {
        spiderDragState.pendingDrag = null;
    }

    cleanupPointerHandlers();
}

function startPointerDrag(e) {
    const { cardEl } = spiderDragState.pendingDrag || {};
    if (!cardEl) return;

    const sequence = prepareDragSequence(cardEl);
    if (!sequence) {
        spiderDragState.pendingDrag = null;
        return;
    }

    spiderDragState.draggedCards = sequence;
    spiderDragState.draggedElements = collectDraggedElements(cardEl);
    spiderDragState.isDragging = true;
    spiderDragState.pendingDrag = null;
    createDragLayer(e);
}

function prepareDragSequence(cardEl) {
    const col = parseInt(cardEl.dataset.column, 10);
    const index = parseInt(cardEl.dataset.index, 10);
    const column = spiderState.tableau[col];
    const sequence = column.slice(index);

    if (!sequence.length) return null;
    if (sequence.some(card => card.hidden)) return null;

    if (sequence.length > 1) {
        for (let i = 0; i < sequence.length - 1; i++) {
            const current = sequence[i];
            const next = sequence[i + 1];
            if (current.rank !== next.rank + 1) return null;
        }
    }

    return sequence;
}

function collectDraggedElements(cardEl) {
    const columnEl = document.getElementById(`spider-column-${cardEl.dataset.column}`);
    if (!columnEl) return [];
    const cardEls = Array.from(columnEl.querySelectorAll('.card'));
    const startIndex = cardEls.findIndex(el => parseInt(el.dataset.index, 10) >= parseInt(cardEl.dataset.index, 10));
    return startIndex >= 0 ? cardEls.slice(startIndex) : [];
}

function createDragLayer(e) {
    if (spiderDragState.draggedElements.length === 0) return;

    const topCardEl = spiderDragState.draggedElements[0];
    const initialRect = topCardEl.getBoundingClientRect();
    spiderDragState.pointerOffsetX = e.clientX - initialRect.left;
    spiderDragState.pointerOffsetY = e.clientY - initialRect.top;

    const offsets = getStackOffsets();
    const layer = document.createElement('div');
    layer.className = 'drag-layer';
    layer.style.position = 'fixed';
    layer.style.left = '0';
    layer.style.top = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '1000';
    layer.style.width = `${initialRect.width}px`;
    layer.style.height = `${SPIDER_CARD_HEIGHT + (spiderDragState.draggedElements.length - 1) * offsets.y}px`;

    spiderDragState.draggedElements.forEach((el, idx) => {
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.top = `${idx * offsets.y}px`;
        el.style.margin = '0';
        el.style.transform = 'scale(var(--card-scale))';
        el.style.transition = 'none';
        layer.appendChild(el);
    });

    document.body.appendChild(layer);
    spiderDragState.dragLayer = layer;
    updateDragLayerPosition(e.clientX, e.clientY);
}

function updateDragLayerPosition(clientX, clientY) {
    if (!spiderDragState.dragLayer) return;
    spiderDragState.dragLayer.style.left = `${clientX - spiderDragState.pointerOffsetX}px`;
    spiderDragState.dragLayer.style.top = `${clientY - spiderDragState.pointerOffsetY}px`;
}

function getDropPoint(clientX, clientY) {
    if (CommonUtils.isMobile()) {
        return { x: clientX, y: clientY };
    }
    if (!spiderDragState.dragLayer) {
        return { x: clientX, y: clientY };
    }
    const rect = spiderDragState.dragLayer.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + Math.min(SPIDER_CARD_HEIGHT / 2, rect.height - 1)
    };
}

function getDirectDropTarget(clientX, clientY) {
    return UIHelpers.getTargetFromPoint(clientX, clientY, [
        {
            selector: '.spider-column',
            resolve: (el) => ({ type: 'tableau', index: parseInt(el.id.split('-')[2], 10) })
        }
    ]);
}

function buildDropTargetCandidates(clientX, clientY) {
    const candidates = [];
    const seen = new Set();
    const addCandidate = (target) => {
        if (!target || target.type !== 'tableau' || !Number.isFinite(target.index)) return;
        const key = `${target.type}:${target.index}`;
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push(target);
    };

    addCandidate(getDirectDropTarget(clientX, clientY));
    const columnIndex = findTableauDropColumn(clientX, clientY);
    if (columnIndex !== null) addCandidate({ type: 'tableau', index: columnIndex });
    return candidates;
}

function finishDrag(clientX, clientY) {
    const dropPoint = getDropPoint(clientX, clientY);
    let moveResult = null;
    const scoreBefore = spiderState.score;
    const movesBefore = spiderState.moves;
    const targets = buildDropTargetCandidates(dropPoint.x, dropPoint.y);
    for (const target of targets) {
        moveResult = attemptTableauMove(target.index);
        if (moveResult && moveResult.success) {
            break;
        }
    }

    cleanupDragVisuals();

    if (moveResult && moveResult.success) {
        spiderState.moves++;
        spiderState.score += 1;
        CommonUtils.playSound('card');
        recordMove({
            type: 'tableau-to-tableau',
            payload: moveResult.payload,
            scoreDelta: (spiderState.score - scoreBefore),
            movesDelta: (spiderState.moves - movesBefore)
        });
    }

    updateUI();
    checkWinCondition();
}

function cleanupDragVisuals() {
    if (spiderDragState.dragLayer) {
        spiderDragState.dragLayer.remove();
        spiderDragState.dragLayer = null;
    }
    spiderDragState.draggedElements = [];
    clearDropIndicators();
    resetDragState();
}

function cleanupPointerHandlers() {
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    spiderDragState.activePointerId = null;
}

function resetDragState() {
    spiderDragState.draggedCards = [];
    spiderDragState.source = null;
    spiderDragState.pointerOffsetX = 0;
    spiderDragState.pointerOffsetY = 0;
    spiderDragState.isDragging = false;
    spiderDragState.pendingDrag = null;
}

function attemptTableauMove(targetCol) {
    if (spiderDragState.draggedCards.length === 0) return { success: false };
    const movingCard = spiderDragState.draggedCards[0];
    const targetPile = spiderState.tableau[targetCol];
    const sourceCol = parseInt(spiderDragState.draggedElements[0]?.dataset.column, 10);

    if (Number.isNaN(sourceCol)) return { success: false };
    if (sourceCol === targetCol) return { success: false };

    let isValid = false;
    if (targetPile.length === 0) {
        isValid = true;
    } else {
        const topCard = targetPile[targetPile.length - 1];
        isValid = !topCard.hidden && topCard.rank === movingCard.rank + 1;
    }

    if (!isValid) return { success: false };

    const sourcePile = spiderState.tableau[sourceCol];
    const movedCards = spiderDragState.draggedCards.slice();
    spiderState.tableau[sourceCol] = sourcePile.slice(0, -movedCards.length);
    spiderState.tableau[targetCol].push(...movedCards);

    let flippedCard = null;
    const sourceTop = spiderState.tableau[sourceCol][spiderState.tableau[sourceCol].length - 1];
    if (sourceTop && sourceTop.hidden) {
        sourceTop.hidden = false;
        flippedCard = sourceTop;
    }

    const completed = checkForCompletedSequence(targetCol);
    return {
        success: true,
        payload: {
            fromCol: sourceCol,
            toCol: targetCol,
            count: movedCards.length,
            flippedCard,
            completed
        }
    };
}

function checkForCompletedSequence(columnIndex) {
    const column = spiderState.tableau[columnIndex];
    if (column.length < spiderVariant.completeRunLength) return;

    const startIndex = column.length - spiderVariant.completeRunLength;
    const sequence = column.slice(startIndex);
    const first = sequence[0];

    if (first.hidden || first.val !== spiderVariant.completeStartValue) return;
    for (let i = 0; i < sequence.length - 1; i++) {
        const current = sequence[i];
        const next = sequence[i + 1];
    if (current.hidden || next.hidden) return;
    if (current.suit !== next.suit) return;
    if (current.rank !== next.rank + 1) return;
    }

    const removed = column.splice(startIndex, spiderVariant.completeRunLength);
    spiderState.foundations.push(removed[0].suit);
    spiderState.score += SPIDER_COMPLETE_BONUS;
    const newTop = column[column.length - 1];
    if (newTop && newTop.hidden) {
        newTop.hidden = false;
    }
    return { columnIndex, cards: removed, suit: removed[0].suit };
}

function dealFromStock() {
    const dealRowSize = spiderState.tableau.length || 10;
    if (!spiderVariant.allowDealFromStock) return;
    if (spiderState.stock.length < dealRowSize) return;
    if (spiderState.isDealing) return;
    const hasEmptyColumn = spiderState.tableau.some(column => column.length === 0);
    if (hasEmptyColumn) {
        CommonUtils.showTableToast('Fill empty columns before dealing a new row.', { variant: 'warn' });
        return;
    }

    const stockEl = document.getElementById('spider-stock');
    const dealBtn = document.getElementById('spider-deal');
    spiderState.isDealing = true;
    if (dealBtn) dealBtn.disabled = true;
    updateUndoButtonState();
    const scoreBefore = spiderState.score;
    const movesBefore = spiderState.moves;
    const dealtCards = [];
    const completed = [];

    const performDeal = async () => {
        for (let col = 0; col < dealRowSize; col++) {
            const card = spiderState.stock.pop();
            card.hidden = false;
            spiderState.tableau[col].push(card);
            dealtCards.push({ col, card });

            if (stockEl) {
                const columnEl = document.getElementById(`spider-column-${col}`);
                if (columnEl) {
                    const columnRect = columnEl.getBoundingClientRect();
                    const rowIndex = spiderState.tableau[col].length - 1;
                    const offsets = getStackOffsets();
                    const destX = columnRect.left + (rowIndex * offsets.x);
                    const destY = columnRect.top + (rowIndex * offsets.y);
                    await animateDealCard(stockEl, destX, destY);
                }
            }

            const completion = checkForCompletedSequence(col);
            if (completion) {
                completed.push(completion);
            }
            updateTableau();
            updateFoundations();
            CommonUtils.playSound('card');
        }
    };

    performDeal().then(() => {
        spiderState.moves++;
        recordMove({
            type: 'deal-row',
            payload: { dealt: dealtCards, completed },
            scoreDelta: (spiderState.score - scoreBefore),
            movesDelta: (spiderState.moves - movesBefore)
        });
        updateUI();
        checkWinCondition();
        spiderState.isDealing = false;
        if (dealBtn) dealBtn.disabled = false;
        updateUndoButtonState();
    });
}

function checkWinCondition() {
    if (spiderState.foundations.length >= spiderVariant.foundationSlots) {
        spiderState.isGameWon = true;
        clearInterval(spiderState.timerInterval);
        CommonUtils.playSound('win');
        CommonUtils.showTableToast(spiderVariant.winMessage, { variant: 'win', duration: 2500 });
        if (spiderStateManager) {
            spiderStateManager.clear();
        }
    }
}

function animateDealCard(sourceEl, destX, destY) {
    return new Promise(resolve => {
        CommonUtils.animateCardDraw(sourceEl, destX, destY, resolve, { duration: 120 });
    });
}

function updateDragIndicators(clientX, clientY) {
    clearDropIndicators();
    if (!spiderDragState.isDragging) return;

    const dropPoint = getDropPoint(clientX, clientY);
    const columnIndex = findTableauDropColumn(dropPoint.x, dropPoint.y);
    if (columnIndex !== null) {
        const columnEl = document.getElementById(`spider-column-${columnIndex}`);
        if (columnEl) {
            columnEl.classList.add(canDropOnTableau(columnIndex) ? 'drag-over-valid' : 'drag-over-invalid');
        }
    }
}

function canDropOnTableau(targetCol) {
    if (spiderDragState.draggedCards.length === 0) return false;
    const movingCard = spiderDragState.draggedCards[0];
    const targetPile = spiderState.tableau[targetCol];

    if (targetPile.length === 0) return true;
    const topCard = targetPile[targetPile.length - 1];
    return !topCard.hidden && topCard.rank === movingCard.rank + 1;
}

function findTableauDropColumn(clientX, clientY) {
    const offsets = getStackOffsets();
    let bestColumn = null;
    let bestCenterDistance = Infinity;
    const padding = CommonUtils.isMobile() ? SPIDER_MOBILE_DROP_PADDING : SPIDER_DROP_PADDING;

    document.querySelectorAll('.spider-column').forEach(column => {
        const rect = UIHelpers.getStackBounds(column, SPIDER_CARD_HEIGHT, offsets.y);
        const paddedRect = UIHelpers.getRectWithPadding(rect, padding);

        if (!UIHelpers.isPointInRect(clientX, clientY, paddedRect)) return;

        const centerX = (rect.left + rect.right) / 2;
        const dist = Math.abs(centerX - clientX);
        if (dist < bestCenterDistance) {
            bestCenterDistance = dist;
            bestColumn = column;
        }
    });

    if (!bestColumn) return null;
    return parseInt(bestColumn.id.split('-')[2], 10);
}

function clearDropIndicators() {
    document.querySelectorAll('.spider-column').forEach(el => {
        el.classList.remove('drag-over-valid', 'drag-over-invalid');
    });
}

function showSpiderHelp() {
    const suitConfig = getSpiderSuitConfig();
    let title = 'Spider Rules';
    let variantLine = `${suitConfig.label} mode: build down in rank; complete a full same-suit run to clear it.`;

    if (spiderVariant.ruleSetKey === 'simple-simon') {
        title = 'Simple Simon Rules';
        variantLine = 'Simple Simon has no stock deals: build down in rank and clear complete suit runs to foundation.';
    } else if (spiderVariant.ruleSetKey === 'royal-simon') {
        title = 'Royal Simon Rules';
        variantLine = 'Royal Simon uses a 14-rank deck with Knights; complete full same-suit runs from Ace through King to clear.';
    }

    const message = [
        'Goal: Move every card into completed runs.',
        'Tableau: Build cards down by rank.',
        variantLine,
        spiderVariant.allowDealFromStock
            ? 'Stock: Deal one card to each tableau column when no immediate move is available.'
            : 'Stock: This variant does not use stock deals.',
        'Empty columns can hold any card or valid run.'
    ].join('\n');

    if (typeof SolitaireUiFeedback !== 'undefined' && typeof SolitaireUiFeedback.showInfo === 'function') {
        SolitaireUiFeedback.showInfo({ title, message });
        return;
    }
    alert(`${title}\n\n${message}`);
}

function setupSpiderEventListeners() {
    const newGameBtn = document.getElementById('spider-new-game');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', initSpiderGame);
    }

    const suitSelect = document.getElementById('spider-suit-select');
    if (suitSelect) {
        syncSpiderSuitUI();
        if (spiderVariant.showSuitSelector) {
            suitSelect.addEventListener('change', (event) => {
                const nextMode = parseInt(event.target.value, 10);
                spiderState.suitMode = SPIDER_SUIT_MODES[nextMode] ? nextMode : 4;
                syncSpiderSuitUI();
                initSpiderGame();
            });
        }
    }

    const dealBtn = document.getElementById('spider-deal');
    if (dealBtn) {
        dealBtn.style.display = spiderVariant.allowDealFromStock ? '' : 'none';
        if (spiderVariant.allowDealFromStock) {
            dealBtn.addEventListener('click', dealFromStock);
        }
    }
    const undoBtn = document.getElementById('spider-undo');
    if (undoBtn) {
        undoBtn.addEventListener('click', undoLastMove);
    }
    const hintBtn = document.getElementById('spider-hint');
    if (hintBtn) {
        hintBtn.addEventListener('click', showSpiderHint);
    }
    const helpBtn = document.getElementById('spider-help');
    if (helpBtn) {
        helpBtn.addEventListener('click', showSpiderHelp);
    }
    const checkBtn = document.getElementById('spider-check');
    if (checkBtn) {
        checkBtn.style.display = spiderVariant.enableCheck ? '' : 'none';
        if (spiderVariant.enableCheck) {
            checkBtn.addEventListener('click', checkCurrentSpiderSolvability);
        }
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
    window.addEventListener('resize', scheduleTableauSizing);
    window.addEventListener('card-scale:changed', scheduleTableauSizing);
}

function checkCurrentSpiderSolvability() {
    if (!spiderVariant.enableCheck) return;
    if (spiderCheckSolvedLocked || spiderCheckUnsolvableLocked) return;
    startSpiderCheckBusyState();
    runSpiderCheck('quick');
}

function runSpiderCheck(mode) {
    const limits = getSpiderCheckLimits(mode, spiderState.suitMode);
    const snapshot = createSpiderCheckSnapshot();
    const requestId = ++spiderCheckRequestId;
    if (typeof Worker !== 'undefined') {
        runSpiderCheckViaWorker({
            game: 'spider',
            snapshot,
            limits,
            requestId
        }).then((result) => {
            if (!result || requestId !== spiderCheckRequestId) return;
            handleSpiderCheckResult(mode, result, limits, snapshot, { hadWorker: true });
        }).catch(() => {
            runSpiderCheckOnMainThreadWithModal(mode, snapshot, limits, requestId);
        });
        return;
    }
    runSpiderCheckOnMainThreadWithModal(mode, snapshot, limits, requestId);
}

function runSpiderCheckOnMainThreadWithModal(mode, snapshot, limits, requestId) {
    showSpiderCheckModal({
        title: mode === 'attempt' ? 'Prove Solve Running' : 'Quick Check Running',
        message: 'Running on the main thread. The page may become unresponsive until the check finishes.',
        busy: true
    });
    window.setTimeout(() => {
        const fallback = runSpiderCheckOnMainThread(snapshot, limits);
        if (!fallback || requestId !== spiderCheckRequestId) return;
        closeSpiderCheckModal();
        handleSpiderCheckResult(mode, fallback, limits, snapshot, { hadWorker: false });
    }, 0);
}

function getSpiderCheckLimits(mode, suitMode) {
    const normalizedSuitMode = Number(suitMode) === 1 || Number(suitMode) === 2 ? Number(suitMode) : 4;
    const perMode = mode === 'attempt' ? SPIDER_ATTEMPT_CHECK_LIMITS : SPIDER_QUICK_CHECK_LIMITS;
    const selected = perMode[normalizedSuitMode] || perMode[4];
    return {
        maxStates: selected.maxStates,
        maxDurationMs: selected.maxDurationMs,
        relaxedSearch: mode === 'attempt'
    };
}

function handleSpiderCheckResult(mode, result, limits, snapshot, context = {}) {
    const isAttempt = mode === 'attempt';
    console.log(
        `Spider ${isAttempt ? 'Attempt' : 'Quick'} Check: solved=${result.solved}, reason=${result.reason}, statesExplored=${result.statesExplored}, durationMs=${result.durationMs}, maxStates=${limits.maxStates}, maxDurationMs=${limits.maxDurationMs}`
    );
    if (result.solved && result.reason === 'solved') {
        storeSpiderSolution(snapshot, result);
        lockSpiderChecksAsSolvable();
        showSpiderCheckModal({
            title: `${isAttempt ? 'Prove Solve' : 'Quick Check'} Result`,
            message: `A solution path was found (${result.statesExplored} states explored).`,
            busy: false
        });
        return;
    }
    clearSpiderStoredSolution();
    const isLikely = result.reason === 'likely-solved';
    if (result.provenUnsolvable === true) {
        lockSpiderChecksAsUnsolvable();
        showSpiderCheckModal({
            title: `${isAttempt ? 'Prove Solve' : 'Quick Check'} Result`,
            message: `No solution exists from this position (${result.statesExplored} states explored).`,
            busy: false
        });
        return;
    }
    releaseSpiderCheckBusyState();
    if (isLikely) {
        markSpiderCheckAsLikely();
    }
    const inconclusive = result.reason === 'state-limit'
        || result.reason === 'time-limit'
        || result.reason === 'cycle-detected';
    if (!isAttempt) {
        promptSpiderDeepCheck(result);
        return;
    }
    const message = isLikely
        ? 'This position looks promising, but prove solve could not confirm a full winning line yet. Work the tableau more and try prove solve again.'
        : (result.reason === 'cycle-detected'
        ? 'The solver got caught in a loop. Try working the tableau more (build cleaner runs and expose hidden cards), then run check again.'
        : (inconclusive
            ? 'No immediate solution was found within current limits. This does not mean the deck is unsolvable, only that the solution is not immediately obvious.'
            : `No solution was found (${result.reason}, ${result.statesExplored} states). This does not mean the deck is unsolvable, only that the solution is not immediately obvious.`));
    showSpiderCheckModal({
        title: `${isAttempt ? 'Prove Solve' : 'Quick Check'} Result`,
        message,
        busy: false
    });
}

function createSpiderCheckSnapshot() {
    const dealRowSize = spiderState.tableau.length || 10;
    return {
        tableau: spiderState.tableau.map((column) => column.map(cloneSpiderCardForCheck)),
        stock: spiderState.stock.map(cloneSpiderCardForCheck),
        foundations: spiderState.foundations.slice(),
        suitMode: spiderState.suitMode,
        foundationSlots: spiderVariant.foundationSlots,
        completeRunLength: spiderVariant.completeRunLength,
        completeStartRank: parseSpiderRankForCheck(spiderVariant.completeStartValue),
        allowDealFromStock: spiderVariant.allowDealFromStock,
        dealRowSize
    };
}

function cloneSpiderCardForCheck(card) {
    if (!card) return null;
    return {
        suit: card.suit,
        val: card.val,
        rank: Number.isFinite(card.rank) ? card.rank : parseSpiderRankForCheck(card.val),
        hidden: !!card.hidden
    };
}

function parseSpiderRankForCheck(value) {
    if (typeof window !== 'undefined' && window.CardRankOverrides && Number.isFinite(window.CardRankOverrides[value])) {
        return window.CardRankOverrides[value];
    }
    if (value === 'A') return 1;
    if (value === 'J') return 11;
    if (value === 'C') return 12;
    if (value === 'Q') return 12;
    if (value === 'K') return 13;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function runSpiderCheckOnMainThread(snapshot, limits) {
    if (limits && limits.relaxedSearch) {
        return runSpiderRelaxedCheckOnMainThread(snapshot, limits);
    }
    const startedAt = Date.now();
    const fallbackLimits = getSpiderCheckLimits('quick', snapshot.suitMode);
    const maxStates = Number.isFinite(limits.maxStates) ? Math.max(1, limits.maxStates) : fallbackLimits.maxStates;
    const maxDurationMs = Number.isFinite(limits.maxDurationMs) ? Math.max(1, limits.maxDurationMs) : fallbackLimits.maxDurationMs;
    const foundationSlots = Number.isFinite(snapshot.foundationSlots) ? Math.max(1, snapshot.foundationSlots) : spiderVariant.foundationSlots;
    const dealRowSize = Number.isFinite(snapshot.dealRowSize) ? Math.max(1, snapshot.dealRowSize) : (snapshot.tableau.length || 10);
    const allowDealFromStock = snapshot.allowDealFromStock !== false;
    const state = {
        tableau: snapshot.tableau.map((column) => column.map((card) => Object.assign({}, card))),
        stock: snapshot.stock.map((card) => Object.assign({}, card)),
        foundations: snapshot.foundations.slice()
    };
    const initialHidden = countSpiderHiddenCards(state.tableau);
    const initialFoundations = state.foundations.length;
    const startKey = normalizeSpiderSimulationState(state);
    const seenStates = new Set([startKey]);
    const solutionMoves = [];
    const solutionStateKeys = [startKey];
    let iterations = 0;
    let cycleDetected = false;

    while (iterations < maxStates) {
        if ((Date.now() - startedAt) >= maxDurationMs) {
            return { solved: false, reason: 'time-limit', statesExplored: iterations, prunedStates: 0, durationMs: Date.now() - startedAt, maxStates, maxDurationMs };
        }

        iterations++;
        const completed = completeSpiderSequences(state);
        if (state.foundations.length >= foundationSlots) {
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
        if (completed > 0) {
            solutionMoves.push({ type: 'complete-sequence' });
            const key = normalizeSpiderSimulationState(state);
            if (seenStates.has(key)) {
                cycleDetected = true;
                break;
            }
            seenStates.add(key);
            solutionStateKeys.push(key);
            continue;
        }

        const move = findSpiderHeuristicMove(state);
        if (move) {
            const moving = state.tableau[move.from].splice(move.startIndex);
            state.tableau[move.to].push(...moving);
            const sourceTop = state.tableau[move.from][state.tableau[move.from].length - 1];
            if (sourceTop && sourceTop.hidden) {
                sourceTop.hidden = false;
            }
            solutionMoves.push({ type: 'tableau-to-tableau', from: move.from, to: move.to });
            const key = normalizeSpiderSimulationState(state);
            if (seenStates.has(key)) {
                cycleDetected = true;
                break;
            }
            seenStates.add(key);
            solutionStateKeys.push(key);
            continue;
        }

        if (allowDealFromStock && state.stock.length >= dealRowSize && !state.tableau.some((column) => column.length === 0)) {
            for (let col = 0; col < dealRowSize; col++) {
                const dealt = state.stock.pop();
                if (!dealt) break;
                dealt.hidden = false;
                state.tableau[col].push(dealt);
            }
            solutionMoves.push({ type: 'deal-row' });
            const key = normalizeSpiderSimulationState(state);
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

    const hiddenRevealed = initialHidden - countSpiderHiddenCards(state.tableau);
    const foundationProgress = state.foundations.length - initialFoundations;
    const likely = foundationProgress >= 2 || hiddenRevealed >= 12 || (foundationProgress >= 1 && hiddenRevealed >= 8);
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

function runSpiderRelaxedCheckOnMainThread(snapshot, limits) {
    const startedAt = Date.now();
    const fallbackLimits = getSpiderCheckLimits('attempt', snapshot.suitMode);
    const maxStates = Number.isFinite(limits.maxStates) ? Math.max(1, limits.maxStates) : fallbackLimits.maxStates;
    const maxDurationMs = Number.isFinite(limits.maxDurationMs) ? Math.max(1, limits.maxDurationMs) : fallbackLimits.maxDurationMs;
    const foundationSlots = Number.isFinite(snapshot.foundationSlots) ? Math.max(1, snapshot.foundationSlots) : spiderVariant.foundationSlots;
    const dealRowSize = Number.isFinite(snapshot.dealRowSize) ? Math.max(1, snapshot.dealRowSize) : (snapshot.tableau.length || 10);
    const allowDealFromStock = snapshot.allowDealFromStock !== false;
    const startState = cloneSpiderCheckState({
        tableau: snapshot.tableau,
        stock: snapshot.stock,
        foundations: snapshot.foundations
    });
    const initialHidden = countSpiderHiddenCards(startState.tableau);
    const initialFoundations = startState.foundations.length;
    const startKey = normalizeSpiderSimulationState(startState);
    const frontier = [{
        state: startState,
        key: startKey,
        moves: [],
        stateKeys: [startKey],
        lastMove: null,
        depth: 0,
        score: scoreSpiderSearchState(startState)
    }];
    const seenStateDepth = new Map([[startKey, 0]]);
    let iterations = 0;
    let bestHiddenRevealed = 0;
    let bestFoundationProgress = 0;

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
        const current = popBestSpiderSearchNode(frontier);
        const knownCurrentDepth = seenStateDepth.get(current.key);
        if (knownCurrentDepth !== undefined && knownCurrentDepth < current.depth) {
            continue;
        }
        const state = cloneSpiderCheckState(current.state);
        const moves = current.moves.slice();
        const stateKeys = current.stateKeys.slice();
        let lastMove = current.lastMove;
        let depth = current.depth;

        const completed = completeSpiderSequences(state);
        if (completed > 0) {
            const afterComplete = normalizeSpiderSimulationState(state);
            const nextDepth = depth + 1;
            const knownDepth = seenStateDepth.get(afterComplete);
            if (knownDepth !== undefined && knownDepth <= nextDepth) {
                continue;
            }
            seenStateDepth.set(afterComplete, nextDepth);
            moves.push({ type: 'complete-sequence' });
            stateKeys.push(afterComplete);
            depth = nextDepth;
            lastMove = { type: 'complete-sequence' };
        }

        if (state.foundations.length >= foundationSlots) {
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

        const hiddenRevealed = initialHidden - countSpiderHiddenCards(state.tableau);
        const foundationProgress = state.foundations.length - initialFoundations;
        if (hiddenRevealed > bestHiddenRevealed) bestHiddenRevealed = hiddenRevealed;
        if (foundationProgress > bestFoundationProgress) bestFoundationProgress = foundationProgress;

        const candidateMoves = listSpiderHeuristicMoves(state, {
            maxMoves: 22,
            blockedReverse: lastMove
        });
        if (allowDealFromStock && state.stock.length >= dealRowSize && !state.tableau.some((column) => column.length === 0)) {
            candidateMoves.push({ type: 'deal-row' });
        }

        for (let i = 0; i < candidateMoves.length; i++) {
            const move = candidateMoves[i];
            const nextState = cloneSpiderCheckState(state);
            if (!applySpiderSimulationMove(nextState, move)) continue;
            const nextKey = normalizeSpiderSimulationState(nextState);
            const nextDepth = depth + 1;
            const knownDepth = seenStateDepth.get(nextKey);
            if (knownDepth !== undefined && knownDepth <= nextDepth) continue;
            seenStateDepth.set(nextKey, nextDepth);
            frontier.push({
                state: nextState,
                key: nextKey,
                moves: moves.concat([move]),
                stateKeys: stateKeys.concat([nextKey]),
                lastMove: move,
                depth: nextDepth,
                score: scoreSpiderSearchState(nextState) + (Number.isFinite(move.score) ? move.score * 0.2 : 0)
            });
        }
    }

    const likely = bestFoundationProgress >= 2
        || bestHiddenRevealed >= 12
        || (bestFoundationProgress >= 1 && bestHiddenRevealed >= 8);
    return {
        solved: likely,
        reason: likely ? 'likely-solved' : (iterations >= maxStates ? 'state-limit' : 'exhausted'),
        statesExplored: iterations,
        prunedStates: 0,
        durationMs: Date.now() - startedAt,
        maxStates,
        maxDurationMs
    };
}

function countSpiderHiddenCards(tableau) {
    return tableau.reduce((sum, column) => sum + column.reduce((colSum, card) => colSum + (card.hidden ? 1 : 0), 0), 0);
}

function serializeSpiderSimulationCard(card, includeHidden = true) {
    if (!card) return '__';
    const rank = Number.isFinite(card.rank) ? card.rank : String(card.rank || '?');
    const suit = card.suit || '?';
    if (!includeHidden) return `${rank}${suit}`;
    return `${rank}${suit}${card.hidden ? 'h' : 'u'}`;
}

function serializeSpiderSimulationPile(pile, includeHidden = true) {
    if (!pile || pile.length === 0) return '';
    return pile.map((card) => serializeSpiderSimulationCard(card, includeHidden)).join(',');
}

function normalizeSpiderSimulationState(state) {
    const tableau = state.tableau.map((column) => serializeSpiderSimulationPile(column, true)).join('|');
    return `${tableau}#${serializeSpiderSimulationPile(state.stock, true)}#${state.foundations.join(',')}`;
}

function cloneSpiderCheckState(state) {
    return {
        tableau: state.tableau.map((column) => column.map((card) => Object.assign({}, card))),
        stock: state.stock.map((card) => Object.assign({}, card)),
        foundations: state.foundations.slice()
    };
}

function completeSpiderSequences(state) {
    let completed = 0;
    for (let col = 0; col < state.tableau.length; col++) {
        while (true) {
            const column = state.tableau[col];
            if (!column || column.length < spiderVariant.completeRunLength) break;
            const start = column.length - spiderVariant.completeRunLength;
            const seq = column.slice(start);
            const first = seq[0];
            if (!first || first.hidden || first.val !== spiderVariant.completeStartValue) break;
            let valid = true;
            for (let i = 0; i < seq.length - 1; i++) {
                const current = seq[i];
                const next = seq[i + 1];
                if (!current || !next || current.hidden || next.hidden || current.suit !== next.suit || current.rank !== next.rank + 1) {
                    valid = false;
                    break;
                }
            }
            if (!valid) break;
            const removed = column.splice(start, spiderVariant.completeRunLength);
            state.foundations.push(removed[0].suit);
            const newTop = column[column.length - 1];
            if (newTop && newTop.hidden) {
                newTop.hidden = false;
            }
            completed++;
        }
    }
    return completed;
}

function findSpiderHeuristicMove(state) {
    const moves = listSpiderHeuristicMoves(state, { maxMoves: 1 });
    return moves.length ? moves[0] : null;
}

function findSpiderHintMove(state) {
    const reversePair = getReverseSpiderHintPair();
    if (!reversePair) {
        return findSpiderHeuristicMove(state);
    }
    const withoutReverse = findSpiderHeuristicMoveWithExclusion(state, reversePair.from, reversePair.to);
    if (withoutReverse) return withoutReverse;
    return findSpiderHeuristicMove(state);
}

function getReverseSpiderHintPair() {
    const history = spiderState.moveHistory;
    const lastMove = history[history.length - 1];
    if (!lastMove || lastMove.type !== 'tableau-to-tableau' || !lastMove.payload) return null;
    if (!Number.isFinite(lastMove.payload.fromCol) || !Number.isFinite(lastMove.payload.toCol)) return null;
    return { from: lastMove.payload.toCol, to: lastMove.payload.fromCol };
}

function findSpiderHeuristicMoveWithExclusion(state, blockedFrom, blockedTo) {
    const moves = listSpiderHeuristicMoves(state, {
        maxMoves: 1,
        blockedReverse: { type: 'tableau-to-tableau', from: blockedFrom, to: blockedTo }
    });
    return moves.length ? moves[0] : null;
}

function isSpiderMovableSequence(sequence) {
    if (!sequence || sequence.length === 0) return false;
    if (sequence.some((card) => !card || card.hidden)) return false;
    for (let i = 0; i < sequence.length - 1; i++) {
        if (sequence[i].rank !== sequence[i + 1].rank + 1) return false;
    }
    return true;
}

function scoreSpiderMove(source, moving, ontoEmpty) {
    let score = moving.length * 10;
    if (ontoEmpty) score -= 5;
    const revealIndex = source.length - moving.length - 1;
    if (revealIndex >= 0) {
        const revealCard = source[revealIndex];
        if (revealCard && revealCard.hidden) score += 40;
    }
    const sameSuitRun = moving.every((card, index) => index === 0 || card.suit === moving[index - 1].suit);
    if (sameSuitRun) score += 25;
    return score;
}

function scoreSpiderSearchState(state) {
    const hiddenCards = countSpiderHiddenCards(state.tableau);
    const completed = state.foundations.length;
    const emptyColumns = state.tableau.reduce((sum, pile) => sum + (pile.length === 0 ? 1 : 0), 0);
    return (completed * 220) + ((54 - hiddenCards) * 10) + (emptyColumns * 8) - state.stock.length;
}

function popBestSpiderSearchNode(frontier) {
    let bestIndex = 0;
    let bestScore = frontier[0].score;
    for (let i = 1; i < frontier.length; i++) {
        if (frontier[i].score > bestScore) {
            bestScore = frontier[i].score;
            bestIndex = i;
        }
    }
    const selected = frontier[bestIndex];
    frontier.splice(bestIndex, 1);
    return selected;
}

function listSpiderHeuristicMoves(state, options = {}) {
    const maxMoves = Number.isFinite(options.maxMoves) ? Math.max(1, options.maxMoves) : Infinity;
    const blockedReverse = options.blockedReverse || null;
    const moves = [];
    for (let from = 0; from < state.tableau.length; from++) {
        const source = state.tableau[from];
        if (!source || source.length === 0) continue;
        for (let startIndex = source.length - 1; startIndex >= 0; startIndex--) {
            const moving = source.slice(startIndex);
            if (!isSpiderMovableSequence(moving)) continue;
            const lead = moving[0];
            for (let to = 0; to < state.tableau.length; to++) {
                if (to === from) continue;
                if (blockedReverse
                    && blockedReverse.type === 'tableau-to-tableau'
                    && blockedReverse.from === from
                    && blockedReverse.to === to) {
                    continue;
                }
                const target = state.tableau[to];
                const ontoEmpty = !target || target.length === 0;
                if (!ontoEmpty) {
                    const top = target[target.length - 1];
                    if (top.hidden || top.rank !== lead.rank + 1) continue;
                }
                let score = scoreSpiderMove(source, moving, ontoEmpty);
                if (!ontoEmpty) {
                    const top = target[target.length - 1];
                    if (top && top.suit === lead.suit) {
                        score += 12;
                    } else {
                        score -= 3;
                    }
                }
                if (startIndex > 0 && source[startIndex - 1] && source[startIndex - 1].hidden) {
                    score += 20;
                }
                if (ontoEmpty && startIndex === 0 && source.length > 1) {
                    score -= 8;
                }
                moves.push({
                    type: 'tableau-to-tableau',
                    from,
                    to,
                    startIndex,
                    count: moving.length,
                    score
                });
            }
        }
    }
    moves.sort((a, b) => (b.score || 0) - (a.score || 0));
    if (moves.length > maxMoves) {
        return moves.slice(0, maxMoves);
    }
    return moves;
}

function applySpiderSimulationMove(state, move) {
    const dealRowSize = state.tableau.length || 10;
    if (!move) return false;
    if (move.type === 'tableau-to-tableau') {
        const source = state.tableau[move.from];
        const target = state.tableau[move.to];
        if (!source || !target || source.length === 0) return false;
        const startIndex = Number.isFinite(move.startIndex) ? move.startIndex : source.length - 1;
        const moved = source.splice(startIndex);
        if (!moved.length) return false;
        target.push(...moved);
        const sourceTop = source[source.length - 1];
        if (sourceTop && sourceTop.hidden) sourceTop.hidden = false;
        return true;
    }
    if (move.type === 'deal-row') {
        if (state.stock.length < dealRowSize || state.tableau.some((column) => column.length === 0)) return false;
        for (let col = 0; col < dealRowSize; col++) {
            const dealt = state.stock.pop();
            if (!dealt) return false;
            dealt.hidden = false;
            state.tableau[col].push(dealt);
        }
        return true;
    }
    return false;
}

function runSpiderCheckViaWorker(payload, onStarted) {
    return new Promise((resolve, reject) => {
        if (typeof Worker === 'undefined') {
            reject(new Error('Web Worker unavailable.'));
            return;
        }
        if (!spiderCheckWorker) {
            spiderCheckWorker = new Worker('shared/solitaire-check-worker.js');
        }
        const worker = spiderCheckWorker;
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
            cleanupSpiderCheckWorker();
            reject(new Error('Spider worker failed.'));
        };
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        try {
            worker.postMessage(payload);
        } catch (err) {
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
            cleanupSpiderCheckWorker();
            reject(err instanceof Error ? err : new Error('Spider worker failed.'));
            return;
        }
        if (typeof onStarted === 'function') {
            onStarted();
        }
    });
}

function cleanupSpiderCheckWorker() {
    spiderCheckRequestId++;
    if (!spiderCheckWorker) return;
    try {
        spiderCheckWorker.terminate();
    } catch (err) {
        // Ignore terminate failures.
    }
    spiderCheckWorker = null;
}

function getSolitaireCheckModalApi() {
    if (typeof SolitaireCheckModal !== 'undefined') return SolitaireCheckModal;
    return null;
}

function showSpiderCheckModal(options = {}) {
    const modal = getSolitaireCheckModalApi();
    if (!modal) return;
    modal.showInfo(options);
}

function closeSpiderCheckModal() {
    const modal = getSolitaireCheckModalApi();
    if (!modal) return;
    modal.close();
}

function getSpiderCheckButton() {
    return document.getElementById('spider-check');
}

function startSpiderCheckBusyState() {
    const button = getSpiderCheckButton();
    if (!button) return;
    button.disabled = true;
    if (!spiderCheckSolvedLocked && !spiderCheckUnsolvableLocked) {
        button.classList.remove('check-solved');
        button.classList.remove('check-unsolvable');
    }
}

function releaseSpiderCheckBusyState() {
    if (spiderCheckSolvedLocked || spiderCheckUnsolvableLocked) return;
    const button = getSpiderCheckButton();
    if (!button) return;
    button.disabled = false;
    button.textContent = 'Check';
    button.classList.remove('check-solved');
    button.classList.remove('check-unsolvable');
}

function markSpiderCheckAsLikely() {
    const button = getSpiderCheckButton();
    if (!button) return;
    button.disabled = false;
    button.textContent = 'Likely';
    button.classList.add('check-solved');
    button.classList.remove('check-unsolvable');
}

function lockSpiderChecksAsSolvable() {
    spiderCheckSolvedLocked = true;
    spiderCheckUnsolvableLocked = false;
    const button = getSpiderCheckButton();
    if (!button) return;
    button.disabled = true;
    button.textContent = 'SOLVABLE';
    button.classList.add('check-solved');
    button.classList.remove('check-unsolvable');
}

function lockSpiderChecksAsUnsolvable() {
    spiderCheckSolvedLocked = false;
    spiderCheckUnsolvableLocked = true;
    const button = getSpiderCheckButton();
    if (!button) return;
    button.disabled = true;
    button.textContent = 'Unsolvable';
    button.classList.remove('check-solved');
    button.classList.add('check-unsolvable');
}

function resetSpiderCheckAvailability() {
    spiderCheckSolvedLocked = false;
    spiderCheckUnsolvableLocked = false;
    clearSpiderStoredSolution();
    const button = getSpiderCheckButton();
    if (button) {
        button.disabled = false;
        button.textContent = 'Check';
        button.classList.remove('check-solved');
        button.classList.remove('check-unsolvable');
    }
    closeSpiderCheckModal();
}

function promptSpiderDeepCheck(result) {
    const needsTableauWork = result && result.reason === 'cycle-detected';
    const likely = result && result.reason === 'likely-solved';
    const message = needsTableauWork
        ? 'The solver got stuck in a loop. Try improving the tableau first (organize runs, reveal cards, and create space), then run a deeper solve attempt.'
        : (likely
            ? 'Quick check sees promising progress, but it is not proven yet. Run Prove Solve for a stricter answer?'
            : 'Quick check found no immediate solution. Run Prove Solve?');
    const modal = getSolitaireCheckModalApi();
    if (!modal) {
        showSpiderCheckModal({
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
            startSpiderCheckBusyState();
            runSpiderCheck('attempt');
        }
    });
}

function storeSpiderSolution(snapshot, result) {
    const moves = Array.isArray(result.solutionMoves) ? result.solutionMoves.slice() : [];
    if (!moves.length) {
        spiderStoredSolution = null;
        return;
    }
    const stateKeys = Array.isArray(result.solutionStateKeys) && result.solutionStateKeys.length
        ? result.solutionStateKeys.slice()
        : [normalizeSpiderSimulationState({
            tableau: snapshot.tableau.map((column) => column.map((card) => Object.assign({}, card))),
            stock: snapshot.stock.map((card) => Object.assign({}, card)),
            foundations: snapshot.foundations.slice()
        })];
    spiderStoredSolution = { moves, stateKeys };
}

function clearSpiderStoredSolution() {
    spiderStoredSolution = null;
}

function getStoredSpiderHint() {
    if (!spiderStoredSolution || !Array.isArray(spiderStoredSolution.moves) || !spiderStoredSolution.moves.length) {
        return null;
    }
    const snapshot = createSpiderCheckSnapshot();
    const state = {
        tableau: snapshot.tableau.map((column) => column.map((card) => Object.assign({}, card))),
        stock: snapshot.stock.map((card) => Object.assign({}, card)),
        foundations: snapshot.foundations.slice()
    };
    const key = normalizeSpiderSimulationState(state);
    const stepIndex = spiderStoredSolution.stateKeys.indexOf(key);
    if (stepIndex < 0 || stepIndex >= spiderStoredSolution.moves.length) return null;
    return spiderStoredSolution.moves[stepIndex];
}

function formatSpiderHintMove(move) {
    if (!move || !move.type) return 'Try improving a descending run and revealing a hidden card.';
    if (move.type === 'complete-sequence') return 'Complete a full same-suit run.';
    if (move.type === 'tableau-to-tableau') return `Move a run from column ${move.from + 1} to column ${move.to + 1}.`;
    if (move.type === 'deal-row') return 'Deal a new row from stock.';
    return 'Try the next legal forward move.';
}

function showSpiderHint() {
    const storedHint = getStoredSpiderHint();
    if (storedHint) {
        CommonUtils.showTableToast(`Hint: ${formatSpiderHintMove(storedHint)}`, { variant: 'warn', containerId: 'table', duration: 2400 });
        return;
    }
    const snapshot = createSpiderCheckSnapshot();
    const state = {
        tableau: snapshot.tableau.map((column) => column.map((card) => Object.assign({}, card))),
        stock: snapshot.stock.map((card) => Object.assign({}, card)),
        foundations: snapshot.foundations.slice()
    };
    if (completeSpiderSequences(state) > 0) {
        CommonUtils.showTableToast('Hint: Complete a full same-suit run.', { variant: 'warn', containerId: 'table', duration: 2400 });
        return;
    }
    const move = findSpiderHintMove(state);
    if (move) {
        CommonUtils.showTableToast(`Hint: Move a run from column ${move.from + 1} to column ${move.to + 1}.`, { variant: 'warn', containerId: 'table', duration: 2400 });
        return;
    }
    if (spiderVariant.allowDealFromStock && state.stock.length >= (state.tableau.length || 10) && !state.tableau.some((column) => column.length === 0)) {
        CommonUtils.showTableToast('Hint: Deal a new row from stock.', { variant: 'warn', containerId: 'table', duration: 2400 });
        return;
    }
    CommonUtils.showTableToast('Hint: No clear move found.', { variant: 'warn', containerId: 'table', duration: 2200 });
}
