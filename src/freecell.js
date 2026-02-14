/**
 * FreeCell Game Controller
 */
const freecellSoundFiles = {
    card: ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav'],
    win: ['win.wav'],
    shuffle: ['shuffle.wav']
};

const freecellVariant = (() => {
    const defaults = {
        stateGameId: 'freecell',
        highScoreGameId: 'freecell',
        ruleSetKey: 'default',
        tableauColumns: 8,
        freeCellCount: 4,
        foundationCount: 4,
        foundationTargetSize: 13,
        deckValues: VALUES,
        deckSuits: SUITS,
        winMessage: 'You solved FreeCell!'
    };
    const incoming = (typeof window !== 'undefined' && window.FreecellVariant && typeof window.FreecellVariant === 'object')
        ? window.FreecellVariant
        : {};
    const tableauColumns = Math.max(1, parseInt(incoming.tableauColumns, 10) || defaults.tableauColumns);
    const freeCellCount = Math.max(1, parseInt(incoming.freeCellCount, 10) || defaults.freeCellCount);
    const foundationCount = Math.max(1, parseInt(incoming.foundationCount, 10) || defaults.foundationCount);
    const foundationTargetSize = Math.max(1, parseInt(incoming.foundationTargetSize, 10) || defaults.foundationTargetSize);
    const deckValues = Array.isArray(incoming.deckValues) && incoming.deckValues.length
        ? incoming.deckValues.slice()
        : defaults.deckValues.slice();
    const deckSuits = Array.isArray(incoming.deckSuits) && incoming.deckSuits.length
        ? incoming.deckSuits.slice()
        : defaults.deckSuits.slice();
    return {
        stateGameId: String(incoming.stateGameId || defaults.stateGameId),
        highScoreGameId: String(incoming.highScoreGameId || defaults.highScoreGameId),
        ruleSetKey: String(incoming.ruleSetKey || defaults.ruleSetKey),
        tableauColumns,
        freeCellCount,
        foundationCount,
        foundationTargetSize,
        deckValues,
        deckSuits,
        winMessage: String(incoming.winMessage || defaults.winMessage)
    };
})();

function createRankOverridesFromValues(values) {
    if (!Array.isArray(values) || !values.length) return null;
    const map = { A: 1 };
    let expectedRank = 2;
    for (const value of values) {
        if (value === 'A') continue;
        const numeric = parseInt(value, 10);
        if (Number.isFinite(numeric) && numeric >= 2 && numeric <= 10) {
            map[value] = numeric;
            expectedRank = numeric + 1;
            continue;
        }
        map[value] = expectedRank;
        expectedRank += 1;
    }
    return map;
}

if (typeof window !== 'undefined' && !window.CardRankOverrides) {
    const derivedRankMap = createRankOverridesFromValues(freecellVariant.deckValues);
    if (derivedRankMap && Number.isFinite(derivedRankMap.C)) {
        window.CardRankOverrides = derivedRankMap;
    }
}

function createEmptyFoundations() {
    return Array.from({ length: freecellVariant.foundationCount }, () => []);
}

function getFreecellFoundationTargetSize() {
    return freecellVariant.foundationTargetSize;
}

function getFreecellFoundationPlaceholderSuit(index) {
    return FREECELL_FOUNDATION_SUITS[index % FREECELL_FOUNDATION_SUITS.length] || '♠';
}

const freecellState = {
    tableau: Array.from({ length: freecellVariant.tableauColumns }, () => []),
    freeCells: Array(freecellVariant.freeCellCount).fill(null),
    foundations: createEmptyFoundations(),
    score: 0,
    moves: 0,
    startTime: null,
    timerInterval: null,
    isGameWon: false,
    moveHistory: []
};

let freecellStateManager = null;

function getFreecellRuleSetKey() {
    return freecellVariant.ruleSetKey;
}

function syncFreecellHighScore() {
    const highScoreEl = document.getElementById('freecell-high-score');
    if (!highScoreEl) return;
    const highScore = CommonUtils.updateHighScore(freecellVariant.highScoreGameId, getFreecellRuleSetKey(), freecellState.score);
    highScoreEl.textContent = highScore;
}

const CARD_HEIGHT = 100;
const STACK_OFFSET = 25;
const STACK_X_OFFSET = 3;
const STACK_X_OFFSET_MAX = 18;
const MAX_HISTORY = 200;
const FREECELL_MIN_TABLEAU_CARDS = 20;
const FREECELL_BASE_TABLEAU_GAP = 12;
const FREECELL_MIN_TABLEAU_GAP = 4;
const FREECELL_BASE_FAN_X = 18;
const FREECELL_MIN_FAN_X = 6;
const FREECELL_TABLEAU_DROP_PADDING = 24;
const FREECELL_SLOT_DROP_PADDING = 18;
const FREECELL_FOUNDATION_DROP_PADDING = 18;
const FREECELL_MOBILE_TABLEAU_DROP_PADDING = 12;
const FREECELL_MOBILE_SLOT_DROP_PADDING = 10;
const FREECELL_MOBILE_FOUNDATION_DROP_PADDING = 10;
const FREECELL_TOP_LABEL = ['F', 'R', 'E', 'E'];
const FREECELL_BOTTOM_LABEL = ['C', 'E', 'L', 'L'];
const FREECELL_FOUNDATION_SUITS = ['♥', '♠', '♦', '♣'];
const FREECELL_MAX_SOLVABLE_DEAL_ATTEMPTS = 8;
const FREECELL_QUICK_CHECK_MAX_STATES = 50000;
const FREECELL_QUICK_CHECK_MAX_DURATION_MS = 5000;
const FREECELL_DEEP_CHECK_MAX_STATES = 1000000;
const FREECELL_DEEP_CHECK_MAX_DURATION_MS = 60000;
const freecellInsolvabilityDetector = (typeof SolitaireInsolvabilityDetector !== 'undefined')
    ? SolitaireInsolvabilityDetector.createFreeCellPreset()
    : null;
const freecellSolvabilityChecker = (typeof SolitaireStateSolvabilityChecker !== 'undefined')
    ? new SolitaireStateSolvabilityChecker(createFreecellSolvabilityAdapter())
    : null;
let freecellCheckWorker = null;
let freecellCheckRequestId = 0;
let freecellCheckSolvedLocked = false;
let freecellCheckUnsolvableLocked = false;
let freecellStoredSolution = null;

const freecellDragState = {
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
    CommonUtils.preloadAudio(freecellSoundFiles);
    setupFreeCellEventListeners();
    CommonUtils.initCardScaleControls('freecell-card-scale', 'freecell-card-scale-value');
    freecellStateManager = new CommonUtils.StateManager({
        gameId: freecellVariant.stateGameId,
        getState: getFreecellSaveState,
        setState: restoreFreecellState,
        isWon: () => freecellState.isGameWon
    });
    const restored = freecellStateManager.load();
    if (!restored) {
        initFreeCellGame();
    }
});

function ensureMobileController() {
    if (freecellDragState.mobileController || typeof MobileSolitaireController === 'undefined') return;
    freecellDragState.mobileController = new MobileSolitaireController({
        isMovable: (el) => {
            if (el.dataset.freecell !== undefined) {
                return !!freecellState.freeCells[parseInt(el.dataset.freecell, 10)];
            }
            const colIndex = parseInt(el.dataset.column, 10);
            const rowIndex = parseInt(el.dataset.index, 10);
            const column = freecellState.tableau[colIndex];
            return getTableauSequence(column, rowIndex) !== null;
        },
        getSequence: (el) => {
            if (el.dataset.freecell !== undefined) {
                return [freecellState.freeCells[parseInt(el.dataset.freecell, 10)]];
            }
            const colIndex = parseInt(el.dataset.column, 10);
            const rowIndex = parseInt(el.dataset.index, 10);
            return getTableauSequence(freecellState.tableau[colIndex], rowIndex) || [];
        },
        getSource: (el) => {
            if (el.dataset.freecell !== undefined) {
                return { type: 'freecell', index: parseInt(el.dataset.freecell, 10) };
            }
            return {
                type: 'tableau',
                index: parseInt(el.dataset.column, 10),
                startIndex: parseInt(el.dataset.index, 10)
            };
        },
        getElements: (el) => collectDraggedElements(el),
        findDropTarget: (x, y) => {
            const directTarget = UIHelpers.getTargetFromPoint(x, y, [
                {
                    selector: '.freecell-slot',
                    resolve: (el) => ({ type: 'freecell', index: parseInt(el.dataset.freecellIndex, 10) })
                },
                {
                    selector: '.freecell-foundation',
                    resolve: (el) => ({ type: 'foundation', index: parseInt(el.dataset.foundationIndex, 10) })
                },
                {
                    selector: '.freecell-column',
                    resolve: (el) => ({ type: 'tableau', index: parseInt(el.id.split('-')[2], 10) })
                }
            ]);
            if (directTarget) return directTarget;

            const freeCellIndex = findFreeCellDropTarget(x, y);
            if (freeCellIndex !== null) return { type: 'freecell', index: freeCellIndex };
            const foundationIndex = findFoundationDropPile(x, y);
            if (foundationIndex !== null) return { type: 'foundation', index: foundationIndex };
            const columnIndex = findTableauDropColumn(x, y);
            if (columnIndex !== null) return { type: 'tableau', index: columnIndex };
            return null;
        },
        isValidMove: (source, target) => {
            freecellDragState.draggedCards = freecellDragState.mobileController.selectedData.cards;
            freecellDragState.source = source;

            let valid = false;
            if (target.type === 'freecell') {
                valid = freecellDragState.draggedCards.length === 1
                    && !freecellState.freeCells[target.index];
            } else if (target.type === 'foundation') {
                valid = freecellDragState.draggedCards.length === 1
                    && SolitaireLogic.canPlaceOnFoundation(
                        freecellDragState.draggedCards[0],
                        freecellState.foundations[target.index]
                    );
            } else if (target.type === 'tableau') {
                if (freecellDragState.draggedCards.length > 0) {
                    const targetPile = freecellState.tableau[target.index];
                    if (targetPile.length === 0) {
                        valid = true;
                    } else {
                        const topCard = targetPile[targetPile.length - 1];
                        valid = !topCard.hidden
                            && SolitaireLogic.canPlaceOnTableau(freecellDragState.draggedCards[0], topCard);
                    }
                }
            }

            freecellDragState.draggedCards = [];
            freecellDragState.source = null;
            return valid;
        },
        executeMove: (source, target) => {
            freecellDragState.draggedCards = freecellDragState.mobileController.selectedData.cards;
            freecellDragState.source = source;
            freecellDragState.draggedElements = freecellDragState.mobileController.selectedData.elements;

            let targetEl = null;
            if (target.type === 'tableau') {
                targetEl = document.getElementById(`freecell-column-${target.index}`);
            } else if (target.type === 'foundation') {
                targetEl = document.getElementById(`freecell-foundation-${target.index}`);
            } else if (target.type === 'freecell') {
                targetEl = document.getElementById(`freecell-cell-${target.index}`);
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

    if (CommonUtils.isMobile() && freecellDragState.mobileController) {
        const table = document.getElementById('table');
        if (table) {
            table.addEventListener('pointerdown', (e) => {
                freecellDragState.mobileController.handlePointerDown(e);
            });
        }
        document.addEventListener('pointermove', (e) => {
            freecellDragState.mobileController.handlePointerMove(e);
        });
        document.addEventListener('pointerup', (e) => {
            freecellDragState.mobileController.handlePointerUp(e);
        });
        document.addEventListener('pointercancel', (e) => {
            freecellDragState.mobileController.handlePointerCancel(e);
        });
    }
}

function initFreeCellGame() {
    ensureMobileController();
    cleanupFreecellCheckWorker();
    resetFreecellCheckAvailability();

    freecellState.tableau = Array.from({ length: freecellVariant.tableauColumns }, () => []);
    freecellState.freeCells = Array(freecellVariant.freeCellCount).fill(null);
    freecellState.foundations = createEmptyFoundations();
    freecellState.score = 0;
    freecellState.moves = 0;
    freecellState.isGameWon = false;
    freecellState.moveHistory = [];

    if (freecellState.timerInterval) {
        clearInterval(freecellState.timerInterval);
    }
    freecellState.startTime = Date.now();

    dealFreeCellLayout();
    startTimer();
    updateUI();
    updateUndoButtonState();
    CommonUtils.playSound('shuffle');
    if (freecellStateManager) {
        freecellStateManager.markDirty();
    }
}

function startTimer() {
    freecellState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - freecellState.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('freecell-time').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function getElapsedSeconds(startTime) {
    if (!Number.isFinite(startTime)) return 0;
    return Math.max(0, Math.floor((Date.now() - startTime) / 1000));
}

function getFreecellSaveState() {
    return {
        tableau: freecellState.tableau,
        freeCells: freecellState.freeCells,
        foundations: freecellState.foundations,
        score: freecellState.score,
        moves: freecellState.moves,
        moveHistory: freecellState.moveHistory,
        elapsedSeconds: getElapsedSeconds(freecellState.startTime),
        isGameWon: freecellState.isGameWon
    };
}

function restoreFreecellState(saved) {
    if (!saved || typeof saved !== 'object') return;
    ensureMobileController();
    cleanupFreecellCheckWorker();
    resetFreecellCheckAvailability();

    freecellState.tableau = saved.tableau || Array.from({ length: freecellVariant.tableauColumns }, () => []);
    freecellState.freeCells = saved.freeCells || Array(freecellVariant.freeCellCount).fill(null);
    freecellState.foundations = saved.foundations || createEmptyFoundations();
    freecellState.score = Number.isFinite(saved.score) ? saved.score : 0;
    freecellState.moves = Number.isFinite(saved.moves) ? saved.moves : 0;
    freecellState.moveHistory = Array.isArray(saved.moveHistory) ? saved.moveHistory : [];
    freecellState.isGameWon = false;

    if (freecellState.timerInterval) {
        clearInterval(freecellState.timerInterval);
    }
    const elapsed = Number.isFinite(saved.elapsedSeconds) ? saved.elapsedSeconds : 0;
    freecellState.startTime = Date.now() - elapsed * 1000;
    startTimer();

    updateUI();
    updateUndoButtonState();
}

function dealFreeCellLayout() {
    let discardedDeals = 0;
    for (let attempt = 1; attempt <= FREECELL_MAX_SOLVABLE_DEAL_ATTEMPTS; attempt++) {
        const deck = CommonUtils.createShoe(1, freecellVariant.deckSuits, freecellVariant.deckValues);
        const candidateTableau = buildFreecellTableauFromDeck(deck);
        if (isFreecellDealRapidlyInsolvable(candidateTableau)) {
            discardedDeals++;
            continue;
        }
        freecellState.tableau = candidateTableau;
        console.log(`FreeCell: discarded ${discardedDeals} candidate deals via rapid deadlock detection.`);
        return;
    }

    // Fallback: keep gameplay non-blocking even if all sampled deals are rejected.
    const fallbackDeck = CommonUtils.createShoe(1, freecellVariant.deckSuits, freecellVariant.deckValues);
    freecellState.tableau = buildFreecellTableauFromDeck(fallbackDeck);
    console.log(`FreeCell: discarded ${discardedDeals} candidate deals via rapid deadlock detection.`);
    console.warn(`FreeCell: Unable to find a clear rapid-solvable deal after ${FREECELL_MAX_SOLVABLE_DEAL_ATTEMPTS} attempts.`);
}

function buildFreecellTableauFromDeck(deck) {
    const tableau = Array.from({ length: freecellVariant.tableauColumns }, () => []);
    const baseCardsPerColumn = Math.floor(deck.length / freecellVariant.tableauColumns);
    const remainder = deck.length % freecellVariant.tableauColumns;
    for (let col = 0; col < freecellVariant.tableauColumns; col++) {
        const cardsInColumn = baseCardsPerColumn + (col < remainder ? 1 : 0);
        for (let row = 0; row < cardsInColumn; row++) {
            const card = deck.pop();
            card.hidden = false;
            tableau[col].push(card);
        }
    }
    return tableau;
}

function isFreecellDealRapidlyInsolvable(tableau) {
    if (!freecellInsolvabilityDetector) return false;
    const result = freecellInsolvabilityDetector.evaluate({
        tableau,
        freeCells: Array(freecellVariant.freeCellCount).fill(null),
        foundations: createEmptyFoundations()
    });
    return result.isLikelyInsolvable;
}

function updateUI() {
    configureFreecellLayout();
    updateTableau();
    updateFreeCells();
    updateFoundations();
    updateStats();
    scheduleTableauSizing();
}

function configureFreecellLayout() {
    const topRowEl = document.getElementById('freecell-top-row');
    const tableauEl = document.getElementById('freecell-tableau');
    const freeCellsEl = document.getElementById('freecell-freecells');
    const foundationsEl = document.getElementById('freecell-foundations');
    if (!topRowEl || !tableauEl || !freeCellsEl || !foundationsEl) return;

    const colTemplate = 'calc(var(--scaled-card-w) + var(--freecell-fan-x, 18px))';
    topRowEl.style.gridTemplateColumns = `repeat(${freecellVariant.tableauColumns}, ${colTemplate})`;
    tableauEl.style.gridTemplateColumns = `repeat(${freecellVariant.tableauColumns}, ${colTemplate})`;
    freeCellsEl.style.gridTemplateColumns = `repeat(${freecellVariant.freeCellCount}, ${colTemplate})`;
    foundationsEl.style.gridTemplateColumns = `repeat(${freecellVariant.foundationCount}, ${colTemplate})`;

    const occupiedColumns = freecellVariant.freeCellCount + freecellVariant.foundationCount;
    const middleGapColumns = Math.max(0, freecellVariant.tableauColumns - occupiedColumns);
    const freeCellStart = 1;
    const freeCellEnd = freeCellStart + freecellVariant.freeCellCount;
    const foundationStart = freeCellEnd + middleGapColumns;
    const foundationEnd = foundationStart + freecellVariant.foundationCount;
    freeCellsEl.style.gridColumn = `${freeCellStart} / ${freeCellEnd}`;
    foundationsEl.style.gridColumn = `${foundationStart} / ${foundationEnd}`;
}

function getMaxTableauLength() {
    return freecellState.tableau.reduce((max, column) => Math.max(max, column.length), 0);
}

function getStackOffsets() {
    return {
        y: CommonUtils.getSolitaireStackOffset(STACK_OFFSET, { minFactor: 0.42 }),
        x: CommonUtils.getSolitaireStackOffset(STACK_X_OFFSET, {
            min: 1,
            max: Math.min(STACK_X_OFFSET_MAX, STACK_X_OFFSET)
        })
    };
}

function applyAdaptiveTableauSpacing() {
    const tableEl = document.getElementById('table');
    const wrapperEl = document.getElementById('freecell-scroll');
    const tableauEl = document.getElementById('freecell-tableau');
    if (!tableEl || !wrapperEl || !tableauEl) return;

    const scale = CommonUtils.getUiScaleValue();
    const baseGap = CommonUtils.getSolitaireStackOffset(FREECELL_BASE_TABLEAU_GAP, {
        scale,
        min: FREECELL_MIN_TABLEAU_GAP,
        max: FREECELL_BASE_TABLEAU_GAP
    });
    const baseFan = CommonUtils.getSolitaireStackOffset(FREECELL_BASE_FAN_X, {
        scale,
        min: FREECELL_MIN_FAN_X,
        max: FREECELL_BASE_FAN_X
    });

    const styles = getComputedStyle(tableauEl);
    const currentGap = parseFloat(styles.columnGap || styles.gap) || baseGap;
    const currentFan = parseFloat(getComputedStyle(tableEl).getPropertyValue('--freecell-fan-x')) || baseFan;
    const availableWidth = wrapperEl.getBoundingClientRect().width || 0;
    const spacing = CommonUtils.resolveAdaptiveSpacing({
        availableWidth,
        contentWidth: tableauEl.scrollWidth,
        currentGap,
        baseGap,
        minGap: FREECELL_MIN_TABLEAU_GAP,
        gapSlots: Math.max(0, freecellState.tableau.length - 1),
        currentFan,
        baseFan,
        minFan: FREECELL_MIN_FAN_X,
        fanSlots: freecellState.tableau.length
    });

    tableEl.style.setProperty('--freecell-tableau-gap', `${spacing.gap}px`);
    tableEl.style.setProperty('--freecell-fan-x', `${spacing.fan}px`);
}

function ensureTableauSizing() {
    applyAdaptiveTableauSpacing();
    const offsets = getStackOffsets();
    const maxCards = Math.max(FREECELL_MIN_TABLEAU_CARDS, getMaxTableauLength());
    const stackHeight = CommonUtils.getStackHeight(maxCards, offsets.y);
    CommonUtils.ensureTableauMinHeight({
        table: 'table',
        topRow: 'freecell-top-row',
        stackOffset: offsets.y,
        maxCards
    });
    const tableauArea = document.getElementById('freecell-tableau');
    if (tableauArea) {
        tableauArea.style.minHeight = `${Math.ceil(stackHeight)}px`;
    }
    const columnMinHeight = stackHeight;
    document.querySelectorAll('.freecell-column').forEach(column => {
        column.style.minHeight = `${Math.ceil(columnMinHeight)}px`;
    });
    CommonUtils.ensureScrollableWidth({
        table: 'table',
        wrapper: 'freecell-scroll',
        contentSelectors: ['#freecell-top-row', '#freecell-tableau'],
        extra: 10
    });
}

const scheduleTableauSizing = CommonUtils.createRafScheduler(ensureTableauSizing);

function updateTableau() {
    const tableauArea = document.getElementById('freecell-tableau');
    if (!tableauArea) return;
    tableauArea.innerHTML = '';
    const offsets = getStackOffsets();

    freecellState.tableau.forEach((column, colIndex) => {
        const columnEl = document.createElement('div');
        columnEl.className = 'freecell-column pile';
        columnEl.id = `freecell-column-${colIndex}`;

        column.forEach((card, rowIndex) => {
            const cardEl = CommonUtils.createCardEl(card);
            cardEl.style.position = 'absolute';
            cardEl.style.top = `${rowIndex * offsets.y}px`;
            cardEl.style.left = `${Math.min(STACK_X_OFFSET_MAX, rowIndex * offsets.x)}px`;
            cardEl.dataset.column = colIndex;
            cardEl.dataset.index = rowIndex;

            if (!CommonUtils.isMobile() || !freecellDragState.mobileController) {
                cardEl.addEventListener('pointerdown', handlePointerDown);
            }
            cardEl.style.cursor = 'pointer';

            columnEl.appendChild(cardEl);
        });

        tableauArea.appendChild(columnEl);
    });
}

function updateFreeCells() {
    const freecellArea = document.getElementById('freecell-freecells');
    if (!freecellArea) return;
    freecellArea.innerHTML = '';

    freecellState.freeCells.forEach((card, index) => {
        const slot = document.createElement('div');
        slot.className = 'freecell-slot pile';
        slot.id = `freecell-cell-${index}`;
        slot.dataset.freecellIndex = index;

        if (card) {
            const cardEl = CommonUtils.createCardEl(card);
            cardEl.dataset.freecell = index;
            if (!CommonUtils.isMobile() || !freecellDragState.mobileController) {
                cardEl.addEventListener('pointerdown', handlePointerDown);
            }
            cardEl.style.cursor = 'pointer';
            slot.appendChild(cardEl);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'freecell-slot-placeholder';

            const top = document.createElement('span');
            top.className = 'freecell-slot-letter freecell-slot-letter-top';
            top.textContent = FREECELL_TOP_LABEL[index] || '';

            const bottom = document.createElement('span');
            bottom.className = 'freecell-slot-letter freecell-slot-letter-bottom';
            bottom.textContent = FREECELL_BOTTOM_LABEL[index] || '';

            placeholder.appendChild(top);
            placeholder.appendChild(bottom);
            slot.appendChild(placeholder);
        }

        freecellArea.appendChild(slot);
    });
}

function updateFoundations() {
    const foundationArea = document.getElementById('freecell-foundations');
    if (!foundationArea) return;
    foundationArea.innerHTML = '';

    freecellState.foundations.forEach((pile, index) => {
        const foundationEl = document.createElement('div');
        foundationEl.className = 'freecell-foundation pile';
        foundationEl.id = `freecell-foundation-${index}`;
        foundationEl.dataset.foundationIndex = index;
        foundationEl.dataset.suit = getFreecellFoundationPlaceholderSuit(index);

        if (pile.length > 0) {
            const topCard = pile[pile.length - 1];
            const cardEl = CommonUtils.createCardEl(topCard);
            cardEl.style.cursor = 'default';
            foundationEl.appendChild(cardEl);
        } else {
            const suit = getFreecellFoundationPlaceholderSuit(index);
            const placeholder = document.createElement('div');
            placeholder.className = 'freecell-foundation-placeholder';
            placeholder.textContent = suit;
            if (suit === '♥' || suit === '♦') {
                placeholder.classList.add('is-red');
            }
            foundationEl.appendChild(placeholder);
        }

        foundationArea.appendChild(foundationEl);
    });
}

function updateStats() {
    document.getElementById('freecell-moves').textContent = freecellState.moves;
    document.getElementById('freecell-score').textContent = freecellState.score;
    syncFreecellHighScore();
}

function recordMove(moveEntry) {
    freecellState.moveHistory.push(moveEntry);
    if (freecellState.moveHistory.length > MAX_HISTORY) {
        freecellState.moveHistory.shift();
    }
    updateUndoButtonState();
    if (freecellStateManager) {
        freecellStateManager.markDirty();
    }
}

function updateUndoButtonState() {
    const btn = document.getElementById('freecell-undo');
    if (!btn) return;
    btn.disabled = freecellState.moveHistory.length === 0;
}

function undoLastMove() {
    if (freecellState.moveHistory.length === 0) return;
    const lastMove = freecellState.moveHistory.pop();

    switch (lastMove.type) {
        case 'tableau-to-tableau':
            undoTableauToTableauMove(lastMove.payload);
            break;
        case 'tableau-to-freecell':
            undoTableauToFreecellMove(lastMove.payload);
            break;
        case 'freecell-to-tableau':
            undoFreecellToTableauMove(lastMove.payload);
            break;
        case 'freecell-to-freecell':
            undoFreecellToFreecellMove(lastMove.payload);
            break;
        case 'tableau-to-foundation':
            undoTableauToFoundationMove(lastMove.payload);
            break;
        case 'freecell-to-foundation':
            undoFreecellToFoundationMove(lastMove.payload);
            break;
        default:
            console.warn('Unexpected undo move type:', lastMove.type);
    }

    freecellState.score -= lastMove.scoreDelta;
    freecellState.moves = Math.max(0, freecellState.moves - lastMove.movesDelta);
    freecellState.isGameWon = false;
    updateUI();
    updateUndoButtonState();
    if (freecellStateManager) {
        freecellStateManager.markDirty();
    }
}

function undoTableauToTableauMove(payload) {
    const target = freecellState.tableau[payload.to.index];
    const moved = target.splice(target.length - payload.count);
    freecellState.tableau[payload.from.index].push(...moved);
}

function undoTableauToFreecellMove(payload) {
    const card = freecellState.freeCells[payload.to.index];
    freecellState.freeCells[payload.to.index] = null;
    if (card) {
        freecellState.tableau[payload.from.index].push(card);
    }
}

function undoFreecellToTableauMove(payload) {
    const target = freecellState.tableau[payload.to.index];
    const card = target.pop();
    if (card) {
        freecellState.freeCells[payload.from.index] = card;
    }
}

function undoFreecellToFreecellMove(payload) {
    const card = freecellState.freeCells[payload.to.index];
    freecellState.freeCells[payload.to.index] = null;
    if (card) {
        freecellState.freeCells[payload.from.index] = card;
    }
}

function undoTableauToFoundationMove(payload) {
    const card = freecellState.foundations[payload.to.index].pop();
    if (card) {
        freecellState.tableau[payload.from.index].push(card);
    }
}

function undoFreecellToFoundationMove(payload) {
    const card = freecellState.foundations[payload.to.index].pop();
    if (card) {
        freecellState.freeCells[payload.from.index] = card;
    }
}

function handlePointerDown(e) {
    if (e.button !== 0) return;
    if (CommonUtils.isMobile() && freecellDragState.mobileController) {
        if (freecellDragState.mobileController.handlePointerDown(e)) return;
    }

    const cardEl = e.target.closest('.card');
    if (!cardEl) return;

    freecellDragState.pendingDrag = {
        cardEl,
        startX: e.clientX,
        startY: e.clientY
    };
    freecellDragState.activePointerId = e.pointerId;
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    if (cardEl.setPointerCapture) {
        cardEl.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
}

function handlePointerMove(e) {
    if (freecellDragState.activePointerId !== e.pointerId) return;

    if (freecellDragState.pendingDrag && !freecellDragState.isDragging) {
        const dx = e.clientX - freecellDragState.pendingDrag.startX;
        const dy = e.clientY - freecellDragState.pendingDrag.startY;
        if (Math.hypot(dx, dy) > 6) {
            startPointerDrag(e);
        }
    }

    if (freecellDragState.isDragging) {
        updateDragLayerPosition(e.clientX, e.clientY);
    }
}

function handlePointerUp(e) {
    if (freecellDragState.activePointerId !== e.pointerId) return;

    if (freecellDragState.isDragging) {
        finishDrag(e.clientX, e.clientY);
    } else {
        freecellDragState.pendingDrag = null;
    }

    cleanupPointerHandlers();
}

function startPointerDrag(e) {
    const { cardEl } = freecellDragState.pendingDrag || {};
    if (!cardEl) return;

    const sequence = prepareDragSequence(cardEl);
    if (!sequence) {
        freecellDragState.pendingDrag = null;
        return;
    }

    freecellDragState.draggedCards = sequence;
    freecellDragState.draggedElements = collectDraggedElements(cardEl);
    freecellDragState.isDragging = true;
    freecellDragState.pendingDrag = null;
    createDragLayer(e);
}

function prepareDragSequence(cardEl) {
    if (cardEl.dataset.freecell !== undefined) {
        const cellIndex = parseInt(cardEl.dataset.freecell, 10);
        const card = freecellState.freeCells[cellIndex];
        if (!card) return null;
        freecellDragState.source = { type: 'freecell', index: cellIndex };
        return [card];
    }

    const columnIndex = parseInt(cardEl.dataset.column, 10);
    const cardIndex = parseInt(cardEl.dataset.index, 10);
    const column = freecellState.tableau[columnIndex];
    const sequence = getTableauSequence(column, cardIndex);
    if (!sequence) return null;
    freecellDragState.source = {
        type: 'tableau',
        index: columnIndex,
        startIndex: cardIndex
    };
    return sequence;
}

function collectDraggedElements(cardEl) {
    if (cardEl.dataset.freecell !== undefined) {
        return [cardEl];
    }

    const columnEl = document.getElementById(`freecell-column-${cardEl.dataset.column}`);
    if (!columnEl) return [];

    const cardEls = Array.from(columnEl.querySelectorAll('.card'));
    const startIdx = cardEls.findIndex(el => parseInt(el.dataset.index, 10) >= parseInt(cardEl.dataset.index, 10));
    return startIdx >= 0 ? cardEls.slice(startIdx) : [];
}

function createDragLayer(e) {
    if (freecellDragState.draggedElements.length === 0) return;

    const topCardEl = freecellDragState.draggedElements[0];
    const rect = topCardEl.getBoundingClientRect();
    freecellDragState.pointerOffsetX = e.clientX - rect.left;
    freecellDragState.pointerOffsetY = e.clientY - rect.top;

    const offsets = getStackOffsets();
    const layer = document.createElement('div');
    layer.className = 'drag-layer';
    layer.style.position = 'fixed';
    layer.style.left = '0';
    layer.style.top = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '1000';
    layer.style.width = `${rect.width}px`;
    layer.style.height = `${CARD_HEIGHT + (freecellDragState.draggedElements.length - 1) * offsets.y}px`;

    freecellDragState.draggedElements.forEach((el, idx) => {
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.top = `${idx * offsets.y}px`;
        el.style.margin = '0';
        el.style.transform = 'scale(var(--card-scale))';
        el.style.transition = 'none';
        layer.appendChild(el);
    });

    document.body.appendChild(layer);
    freecellDragState.dragLayer = layer;
    updateDragLayerPosition(e.clientX, e.clientY);
}

function updateDragLayerPosition(clientX, clientY) {
    if (!freecellDragState.dragLayer) return;
    freecellDragState.dragLayer.style.left = `${clientX - freecellDragState.pointerOffsetX}px`;
    freecellDragState.dragLayer.style.top = `${clientY - freecellDragState.pointerOffsetY}px`;
}

function getDirectDropTarget(clientX, clientY) {
    return UIHelpers.getTargetFromPoint(clientX, clientY, [
        {
            selector: '.freecell-slot',
            resolve: (el) => ({ type: 'freecell', index: parseInt(el.dataset.freecellIndex, 10) })
        },
        {
            selector: '.freecell-foundation',
            resolve: (el) => ({ type: 'foundation', index: parseInt(el.dataset.foundationIndex, 10) })
        },
        {
            selector: '.freecell-column',
            resolve: (el) => ({ type: 'tableau', index: parseInt(el.id.split('-')[2], 10) })
        }
    ]);
}

function buildDropTargetCandidates(clientX, clientY) {
    const candidates = [];
    const seen = new Set();
    const addCandidate = (target) => {
        if (!target || !target.type || !Number.isFinite(target.index)) return;
        const key = `${target.type}:${target.index}`;
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push(target);
    };

    addCandidate(getDirectDropTarget(clientX, clientY));
    const freeCellIndex = findFreeCellDropTarget(clientX, clientY);
    if (freeCellIndex !== null) addCandidate({ type: 'freecell', index: freeCellIndex });
    const foundationIndex = findFoundationDropPile(clientX, clientY);
    if (foundationIndex !== null) addCandidate({ type: 'foundation', index: foundationIndex });
    const tableauIndex = findTableauDropColumn(clientX, clientY);
    if (tableauIndex !== null) addCandidate({ type: 'tableau', index: tableauIndex });
    return candidates;
}

function finishDrag(clientX, clientY) {
    let handled = false;
    let moveResult = null;
    const scoreBefore = freecellState.score;
    const movesBefore = freecellState.moves;
    const targets = buildDropTargetCandidates(clientX, clientY);

    for (const target of targets) {
        if (target.type === 'freecell') {
            moveResult = attemptMoveToFreeCell(target.index);
        } else if (target.type === 'foundation') {
            moveResult = attemptFoundationMove(target.index);
        } else {
            moveResult = attemptTableauMove(target.index);
        }
        if (moveResult && moveResult.success) {
            handled = true;
            break;
        }
    }

    cleanupDragVisuals();

    if (handled) {
        CommonUtils.playSound('card');
        freecellState.moves++;
        const scoreDelta = freecellState.score - scoreBefore;
        const movesDelta = freecellState.moves - movesBefore;
        if (moveResult && moveResult.moveType) {
            recordMove({
                type: moveResult.moveType,
                payload: moveResult.payload,
                scoreDelta,
                movesDelta
            });
        }
        updateStats();
        checkFreeCellWin();
        updateTableau();
        updateFreeCells();
        updateFoundations();
    } else {
        if (moveResult && moveResult.reason === 'limit') {
            CommonUtils.showTableToast(
                `Need more free cells to move ${freecellDragState.draggedCards.length} cards.`,
                { variant: 'warn' }
            );
        }
        updateTableau();
        updateFreeCells();
        updateFoundations();
    }

    resetDragState();
}

function cleanupDragVisuals() {
    if (freecellDragState.dragLayer) {
        freecellDragState.dragLayer.remove();
        freecellDragState.dragLayer = null;
    }
    freecellDragState.draggedElements = [];
}

function cleanupPointerHandlers() {
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    freecellDragState.activePointerId = null;
}

function resetDragState() {
    freecellDragState.draggedCards = [];
    freecellDragState.source = null;
    freecellDragState.pointerOffsetX = 0;
    freecellDragState.pointerOffsetY = 0;
    freecellDragState.isDragging = false;
    freecellDragState.draggedElements = [];
}

function getMaxMovableCards(targetCol, movingCount) {
    const emptyFreeCells = freecellState.freeCells.filter(card => !card).length;
    let emptyColumns = freecellState.tableau.filter(column => column.length === 0).length;

    if (freecellState.tableau[targetCol].length === 0) {
        emptyColumns -= 1;
    }

    if (freecellDragState.source && freecellDragState.source.type === 'tableau') {
        const sourceColumn = freecellState.tableau[freecellDragState.source.index];
        if (sourceColumn && sourceColumn.length === movingCount) {
            emptyColumns += 1;
        }
    }

    emptyColumns = Math.max(0, emptyColumns);
    return (emptyFreeCells + 1) * Math.pow(2, emptyColumns);
}

function attemptTableauMove(targetCol) {
    if (freecellDragState.draggedCards.length === 0) return { success: false };

    const movingCards = freecellDragState.draggedCards.slice();
    const targetPile = freecellState.tableau[targetCol];
    const baseCard = movingCards[0];
    let isValid = false;

    if (targetPile.length === 0) {
        isValid = true;
    } else {
        const topCard = targetPile[targetPile.length - 1];
        isValid = !topCard.hidden && SolitaireLogic.canPlaceOnTableau(baseCard, topCard);
    }

    if (!isValid) return { success: false };

    const maxMovable = getMaxMovableCards(targetCol, movingCards.length);
    if (movingCards.length > maxMovable) {
        return { success: false, reason: 'limit', max: maxMovable };
    }

    removeDraggedCardsFromSource();
    freecellState.tableau[targetCol].push(...movingCards);
    const moveType = freecellDragState.source.type === 'freecell'
        ? 'freecell-to-tableau'
        : 'tableau-to-tableau';
    return {
        success: true,
        moveType,
        payload: {
            from: { ...freecellDragState.source },
            to: { type: 'tableau', index: targetCol },
            count: movingCards.length
        }
    };
}

function attemptMoveToFreeCell(targetIndex) {
    if (freecellDragState.draggedCards.length !== 1) return { success: false };
    if (freecellState.freeCells[targetIndex]) return { success: false };

    const card = freecellDragState.draggedCards[0];
    removeDraggedCardsFromSource();
    freecellState.freeCells[targetIndex] = card;
    const moveType = freecellDragState.source.type === 'freecell'
        ? 'freecell-to-freecell'
        : 'tableau-to-freecell';
    return {
        success: true,
        moveType,
        payload: {
            from: { ...freecellDragState.source },
            to: { type: 'freecell', index: targetIndex },
            count: 1
        }
    };
}

function attemptFoundationMove(targetIndex) {
    if (freecellDragState.draggedCards.length !== 1) return { success: false };

    const card = freecellDragState.draggedCards[0];
    const foundation = freecellState.foundations[targetIndex];
    if (!SolitaireLogic.canPlaceOnFoundation(card, foundation)) return { success: false };

    removeDraggedCardsFromSource();
    foundation.push(card);
    freecellState.score += 1;
    const moveType = freecellDragState.source.type === 'freecell'
        ? 'freecell-to-foundation'
        : 'tableau-to-foundation';
    return {
        success: true,
        moveType,
        payload: {
            from: { ...freecellDragState.source },
            to: { type: 'foundation', index: targetIndex },
            count: 1
        }
    };
}

function removeDraggedCardsFromSource() {
    if (!freecellDragState.source) return;

    if (freecellDragState.source.type === 'tableau') {
        const column = freecellState.tableau[freecellDragState.source.index];
        const startIndex = freecellDragState.source.startIndex || (column.length - freecellDragState.draggedCards.length);
        column.splice(startIndex, freecellDragState.draggedCards.length);
    } else if (freecellDragState.source.type === 'freecell') {
        freecellState.freeCells[freecellDragState.source.index] = null;
    }
}

function findTableauDropColumn(clientX, clientY) {
    const offsets = getStackOffsets();
    let bestColumn = null;
    let bestCenterDistance = Infinity;
    const padding = CommonUtils.isMobile() ? FREECELL_MOBILE_TABLEAU_DROP_PADDING : FREECELL_TABLEAU_DROP_PADDING;

    document.querySelectorAll('.freecell-column').forEach(column => {
        const rect = UIHelpers.getStackBounds(column, CARD_HEIGHT, offsets.y);
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

function findFreeCellDropTarget(clientX, clientY) {
    const padding = CommonUtils.isMobile() ? FREECELL_MOBILE_SLOT_DROP_PADDING : FREECELL_SLOT_DROP_PADDING;
    let target = null;
    document.querySelectorAll('.freecell-slot').forEach(slot => {
        const rect = slot.getBoundingClientRect();
        const paddedRect = UIHelpers.getRectWithPadding(rect, padding);
        if (UIHelpers.isPointInRect(clientX, clientY, paddedRect)) {
            target = parseInt(slot.dataset.freecellIndex, 10);
        }
    });
    return target !== null ? target : null;
}

function findFoundationDropPile(clientX, clientY) {
    const padding = CommonUtils.isMobile() ? FREECELL_MOBILE_FOUNDATION_DROP_PADDING : FREECELL_FOUNDATION_DROP_PADDING;
    let target = null;
    document.querySelectorAll('.freecell-foundation').forEach(pile => {
        const rect = pile.getBoundingClientRect();
        const paddedRect = UIHelpers.getRectWithPadding(rect, padding);
        if (UIHelpers.isPointInRect(clientX, clientY, paddedRect)) {
            target = parseInt(pile.dataset.foundationIndex, 10);
        }
    });
    return target !== null ? target : null;
}

function getTableauSequence(column, startIndex) {
    if (!column || startIndex < 0 || startIndex >= column.length) return null;
    const sequence = column.slice(startIndex);
    for (let i = 1; i < sequence.length; i++) {
        if (!SolitaireLogic.canPlaceOnTableau(sequence[i], sequence[i - 1])) {
            return null;
        }
    }
    return sequence;
}

function checkCurrentFreecellSolvability() {
    if (freecellCheckSolvedLocked || freecellCheckUnsolvableLocked) return;
    if (!freecellSolvabilityChecker) {
        console.warn('FreeCell Check: Shared solvability checker is unavailable.');
        CommonUtils.showTableToast('Solvability checker unavailable.', { variant: 'warn', containerId: 'table' });
        return;
    }
    startCheckButtonsBusyState();
    runFreecellCheck('quick');
}

function runFreecellCheck(mode) {
    const isAttempt = mode === 'attempt';
    const limits = isAttempt
        ? { maxStates: FREECELL_DEEP_CHECK_MAX_STATES, maxDurationMs: FREECELL_DEEP_CHECK_MAX_DURATION_MS }
        : { maxStates: FREECELL_QUICK_CHECK_MAX_STATES, maxDurationMs: FREECELL_QUICK_CHECK_MAX_DURATION_MS };
    const snapshot = createFreecellSolvabilitySnapshot();
    const requestId = ++freecellCheckRequestId;
    const hasWorkerSupport = typeof Worker !== 'undefined';
    if (hasWorkerSupport) {
        runCheckViaWorker({
            game: 'freecell',
            snapshot,
            limits,
            requestId
        }).then((result) => {
            if (!result || requestId !== freecellCheckRequestId) return;
            handleFreecellCheckResult(mode, result, limits, snapshot, { hadWorker: true });
        }).catch(() => {
            runFreecellCheckOnMainThread(mode, snapshot, limits, requestId);
        });
        return;
    }
    runFreecellCheckOnMainThread(mode, snapshot, limits, requestId);
}

function runFreecellCheckOnMainThread(mode, snapshot, limits, requestId) {
    showQuickCheckOverlay({
        title: mode === 'attempt' ? 'Prove Solve Running' : 'Quick Check Running',
        message: 'Running on the main thread. The page may become unresponsive until the check finishes.',
        busy: true
    });
    window.setTimeout(() => {
        const result = freecellSolvabilityChecker.check(snapshot, limits);
        if (!result || requestId !== freecellCheckRequestId) return;
        if (!result.solved && result.reason === 'exhausted') {
            result.provenUnsolvable = true;
        }
        closeQuickCheckOverlay();
        handleFreecellCheckResult(mode, result, limits, snapshot, { hadWorker: false });
    }, 0);
}

function handleFreecellCheckResult(mode, result, limits, snapshot, context = {}) {
    const isAttempt = mode === 'attempt';
    console.log(
        `FreeCell ${isAttempt ? 'Attempt' : 'Quick'} Check: solved=${result.solved}, reason=${result.reason}, statesExplored=${result.statesExplored}, prunedStates=${result.prunedStates || 0}, durationMs=${result.durationMs}, maxStates=${limits.maxStates}, maxDurationMs=${limits.maxDurationMs}`
    );

    if (result.solved && result.reason === 'solved') {
        storeFreecellSolution(snapshot, result);
        lockFreecellChecksAsSolvable();
        showQuickCheckOverlay({
            title: `${isAttempt ? 'Prove Solve' : 'Quick Check'} Result`,
            message: `A solution path was found (${result.statesExplored} states explored).`,
            busy: false
        });
        return;
    }

    clearStoredFreecellSolution();
    if (result.provenUnsolvable === true) {
        lockFreecellChecksAsUnsolvable();
        showQuickCheckOverlay({
            title: `${isAttempt ? 'Prove Solve' : 'Quick Check'} Result`,
            message: `No solution exists from this position (${result.statesExplored} states explored).`,
            busy: false
        });
        return;
    }

    releaseCheckButtonsFromBusyState();
    const inconclusive = result.reason === 'state-limit'
        || result.reason === 'time-limit'
        || result.reason === 'cycle-detected';
    const message = result.reason === 'cycle-detected'
        ? 'The solver got caught in a loop. Try working the tableau more (open lanes, move blockers, expose key cards), then run check again.'
        : (inconclusive
            ? 'No immediate solution was found within current limits. This does not mean the deck is unsolvable, only that the solution is not immediately obvious.'
            : `No solution was found (${result.reason}, ${result.statesExplored} states). This does not mean the deck is unsolvable, only that the solution is not immediately obvious.`);
    if (!isAttempt) {
        promptFreecellDeepCheck(result);
        return;
    }
    showQuickCheckOverlay({ title: `${isAttempt ? 'Prove Solve' : 'Quick Check'} Result`, message, busy: false });
}

function getCheckButton() {
    return document.getElementById('freecell-check');
}

function startCheckButtonsBusyState() {
    const button = getCheckButton();
    if (!button) return;
    button.disabled = true;
    if (!freecellCheckSolvedLocked && !freecellCheckUnsolvableLocked) {
        button.classList.remove('check-solved');
        button.classList.remove('check-unsolvable');
    }
}

function promptFreecellDeepCheck(result) {
    const needsTableauWork = result && result.reason === 'cycle-detected';
    const message = needsTableauWork
        ? 'The solver got stuck in a loop. Try working the tableau first (open lanes, free blockers, and expose useful cards), then run a deeper solve attempt.'
        : 'Quick check found no immediate solution. Run a deeper solve attempt?';
    const modal = getSolitaireCheckModalApi();
    if (!modal) {
        showQuickCheckOverlay({
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
            startCheckButtonsBusyState();
            runFreecellCheck('attempt');
        }
    });
}

function storeFreecellSolution(snapshot, result) {
    const moves = Array.isArray(result.solutionMoves) ? result.solutionMoves.slice() : [];
    if (!moves.length) {
        freecellStoredSolution = null;
        return;
    }
    const stateKeys = Array.isArray(result.solutionStateKeys) && result.solutionStateKeys.length
        ? result.solutionStateKeys.slice()
        : [normalizeFreecellHintState(snapshot)];
    freecellStoredSolution = { moves, stateKeys };
}

function clearStoredFreecellSolution() {
    freecellStoredSolution = null;
}

function showFreecellHint() {
    if (showStoredFreecellHint()) return;
    const snapshot = createFreecellSolvabilitySnapshot();
    const moves = listFreecellSolvabilityMoves(snapshot);
    if (!moves.length) {
        CommonUtils.showTableToast('Hint: No clear move found.', { variant: 'warn', containerId: 'table', duration: 2200 });
        return;
    }
    const filteredMoves = moves.filter((move) => !isReverseOfRecentFreecellMove(move));
    const selected = filteredMoves.length ? filteredMoves[0] : moves[0];
    const hint = formatFreecellHintMove(selected);
    CommonUtils.showTableToast(`Hint: ${hint}`, { variant: 'warn', containerId: 'table', duration: 2600 });
}

function isReverseOfRecentFreecellMove(move) {
    if (!move || !move.type) return false;
    const history = freecellState.moveHistory;
    const lastMove = history[history.length - 1];
    if (!lastMove || !lastMove.payload || !lastMove.type) return false;

    if (lastMove.type === 'tableau-to-tableau' && move.type === 'tableau-to-tableau') {
        return move.sourceCol === lastMove.payload.to.index
            && move.targetCol === lastMove.payload.from.index;
    }
    if (lastMove.type === 'tableau-to-freecell' && move.type === 'freecell-to-tableau') {
        return move.cellIndex === lastMove.payload.to.index
            && move.targetCol === lastMove.payload.from.index;
    }
    if (lastMove.type === 'freecell-to-tableau' && move.type === 'tableau-to-freecell') {
        return move.sourceCol === lastMove.payload.to.index
            && move.cellIndex === lastMove.payload.from.index;
    }
    return false;
}

function showStoredFreecellHint() {
    if (!freecellStoredSolution || !Array.isArray(freecellStoredSolution.moves) || !freecellStoredSolution.moves.length) {
        return false;
    }
    const currentKey = normalizeFreecellHintState();
    const stateKeys = Array.isArray(freecellStoredSolution.stateKeys) ? freecellStoredSolution.stateKeys : [];
    const stepIndex = stateKeys.indexOf(currentKey);
    if (stepIndex < 0 || stepIndex >= freecellStoredSolution.moves.length) {
        return false;
    }
    const hint = formatFreecellHintMove(freecellStoredSolution.moves[stepIndex]);
    CommonUtils.showTableToast(`Hint: ${hint}`, { variant: 'warn', containerId: 'table', duration: 2600 });
    return true;
}

function formatFreecellHintMove(move) {
    if (!move || !move.type) return 'Try moving a low-risk card forward.';
    if (move.type === 'tableau-to-foundation') return `Move top card from tableau ${move.sourceCol + 1} to foundation.`;
    if (move.type === 'freecell-to-foundation') return `Move free cell ${move.cellIndex + 1} card to foundation.`;
    if (move.type === 'tableau-to-freecell') return `Move top card from tableau ${move.sourceCol + 1} to free cell ${move.cellIndex + 1}.`;
    if (move.type === 'freecell-to-tableau') return `Move free cell ${move.cellIndex + 1} card to tableau ${move.targetCol + 1}.`;
    if (move.type === 'tableau-to-tableau') return `Move sequence from tableau ${move.sourceCol + 1} to tableau ${move.targetCol + 1}.`;
    return 'Try the next legal forward move.';
}

function normalizeFreecellHintState(snapshot) {
    const base = snapshot || createFreecellSolvabilitySnapshot();
    const state = {
        tableau: base.tableau.map((column) => column.map(cloneCardForSolvability)),
        freeCells: base.freeCells.map((card) => (card ? cloneCardForSolvability(card) : null)),
        foundations: base.foundations.map((pile) => pile.map(cloneCardForSolvability))
    };
    applyForcedSafeFoundationClosure(state);
    const tableauKey = state.tableau.map((column) => column.map(toCardIdForSolvability).join(',')).join('|');
    const freeCellsKey = state.freeCells.map((card) => (card ? toCardIdForSolvability(card) : '_')).join(',');
    const foundationKey = state.foundations.map((pile) => String(pile.length)).join(',');
    return `T:${tableauKey}|C:${freeCellsKey}|F:${foundationKey}`;
}

function lockFreecellChecksAsUnsolvable() {
    freecellCheckUnsolvableLocked = true;
    freecellCheckSolvedLocked = false;
    const button = getCheckButton();
    if (!button) return;
    button.disabled = true;
    button.textContent = 'Unsolvable';
    button.classList.remove('check-solved');
    button.classList.add('check-unsolvable');
}

function lockFreecellChecksAsSolvable() {
    freecellCheckSolvedLocked = true;
    freecellCheckUnsolvableLocked = false;
    const button = getCheckButton();
    if (!button) return;
    button.disabled = true;
    button.textContent = 'SOLVABLE';
    button.classList.add('check-solved');
    button.classList.remove('check-unsolvable');
}

function releaseCheckButtonsFromBusyState() {
    if (freecellCheckSolvedLocked || freecellCheckUnsolvableLocked) return;
    const button = getCheckButton();
    if (!button) return;
    button.disabled = false;
    button.textContent = 'Check';
    button.classList.remove('check-solved');
    button.classList.remove('check-unsolvable');
}

function resetFreecellCheckAvailability() {
    freecellCheckSolvedLocked = false;
    freecellCheckUnsolvableLocked = false;
    clearStoredFreecellSolution();
    const button = getCheckButton();
    if (button) {
        button.disabled = false;
        button.textContent = 'Check';
        button.classList.remove('check-solved');
        button.classList.remove('check-unsolvable');
    }
    closeQuickCheckOverlay();
}

function getSolitaireCheckModalApi() {
    if (typeof SolitaireCheckModal !== 'undefined') return SolitaireCheckModal;
    return null;
}

function showQuickCheckOverlay(options = {}) {
    const modal = getSolitaireCheckModalApi();
    if (!modal) return;
    modal.showInfo(options);
}

function closeQuickCheckOverlay() {
    const modal = getSolitaireCheckModalApi();
    if (!modal) return;
    modal.close();
}

function cleanupFreecellCheckWorker() {
    freecellCheckRequestId++;
    if (freecellCheckWorker) {
        try {
            freecellCheckWorker.terminate();
        } catch (err) {
            // Ignore terminate failures.
        }
        freecellCheckWorker = null;
    }
}

function runCheckViaWorker(payload, onStarted) {
    return new Promise((resolve, reject) => {
        if (typeof Worker === 'undefined') {
            reject(new Error('Web Worker is not available.'));
            return;
        }
        if (!freecellCheckWorker) {
            freecellCheckWorker = new Worker('shared/solitaire-check-worker.js');
        }
        const worker = freecellCheckWorker;
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
        const onError = (event) => {
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
            cleanupFreecellCheckWorker();
            reject(event instanceof ErrorEvent ? event.error || new Error(event.message) : new Error('Worker execution failed.'));
        };
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        try {
            worker.postMessage(payload);
        } catch (err) {
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
            cleanupFreecellCheckWorker();
            reject(err instanceof Error ? err : new Error('Worker execution failed.'));
            return;
        }
        if (typeof onStarted === 'function') {
            onStarted();
        }
    });
}

function createFreecellSolvabilitySnapshot() {
    return {
        tableau: freecellState.tableau.map(column => column.map(cloneCardForSolvability)),
        freeCells: freecellState.freeCells.map(card => (card ? cloneCardForSolvability(card) : null)),
        foundations: freecellState.foundations.map(pile => pile.map(cloneCardForSolvability)),
        foundationTargetSize: getFreecellFoundationTargetSize(),
        foundationCount: freecellVariant.foundationCount
    };
}

function cloneCardForSolvability(card) {
    if (!card) return null;
    return {
        suit: card.suit,
        val: card.val,
        rank: Number.isFinite(card.rank) ? card.rank : parseCardRank(card.val),
        color: card.color || getCardColor(card.suit),
        hidden: false
    };
}

function parseCardRank(value) {
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

function getCardColor(suit) {
    return (suit === '♥' || suit === '♦') ? 'red' : 'black';
}

function createFreecellSolvabilityAdapter() {
    const foundationTargetSize = getFreecellFoundationTargetSize();
    return {
        isSolved: (state) => state.foundations.every(pile => pile.length === foundationTargetSize),
        prepareState: (state) => {
            applyForcedSafeFoundationClosure(state);
            return state;
        },
        shouldPrune: (state) => {
            if (state.foundations.every(pile => pile.length === foundationTargetSize)) return false;
            return !hasAnyFreecellForwardMove(state);
        },
        normalizeState: (state) => {
            const tableauKey = state.tableau
                .map(column => column.map(toCardIdForSolvability).join(','))
                .join('|');
            const freeCellsKey = state.freeCells
                .map(card => (card ? toCardIdForSolvability(card) : '_'))
                .join(',');
            const foundationKey = state.foundations
                .map(pile => String(pile.length))
                .join(',');
            return `T:${tableauKey}|C:${freeCellsKey}|F:${foundationKey}`;
        },
        listMoves: (state) => listFreecellSolvabilityMoves(state),
        applyMove: (state, move) => applyFreecellSolvabilityMove(state, move)
    };
}

function toCardIdForSolvability(card) {
    return `${card.suit}${card.val}`;
}

function listFreecellSolvabilityMoves(state) {
    const moves = [];

    for (let cellIndex = 0; cellIndex < state.freeCells.length; cellIndex++) {
        const card = state.freeCells[cellIndex];
        if (!card) continue;
        for (let foundationIndex = 0; foundationIndex < state.foundations.length; foundationIndex++) {
            if (SolitaireLogic.canPlaceOnFoundation(card, state.foundations[foundationIndex])) {
                moves.push({ type: 'freecell-to-foundation', cellIndex, foundationIndex, priority: 4 });
            }
        }
    }

    for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol++) {
        const column = state.tableau[sourceCol];
        if (!column || column.length === 0) continue;
        const top = column[column.length - 1];
        for (let foundationIndex = 0; foundationIndex < state.foundations.length; foundationIndex++) {
            if (SolitaireLogic.canPlaceOnFoundation(top, state.foundations[foundationIndex])) {
                moves.push({ type: 'tableau-to-foundation', sourceCol, foundationIndex, priority: 4 });
            }
        }
    }

    const emptyCellIndex = state.freeCells.findIndex(cell => !cell);
    if (emptyCellIndex !== -1) {
        for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol++) {
            const column = state.tableau[sourceCol];
            if (!column || column.length === 0) continue;
            moves.push({ type: 'tableau-to-freecell', sourceCol, cellIndex: emptyCellIndex, priority: 2 });
        }
    }

    for (let cellIndex = 0; cellIndex < state.freeCells.length; cellIndex++) {
        const card = state.freeCells[cellIndex];
        if (!card) continue;
        for (let targetCol = 0; targetCol < state.tableau.length; targetCol++) {
            const target = state.tableau[targetCol];
            if (!target || target.length === 0) {
                moves.push({ type: 'freecell-to-tableau', cellIndex, targetCol, priority: 2 });
                continue;
            }
            const top = target[target.length - 1];
            if (SolitaireLogic.canPlaceOnTableau(card, top)) {
                moves.push({ type: 'freecell-to-tableau', cellIndex, targetCol, priority: 2 });
            }
        }
    }

    for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol++) {
        const source = state.tableau[sourceCol];
        if (!source || source.length === 0) continue;

        for (let startIndex = source.length - 1; startIndex >= 0; startIndex--) {
            const sequence = getSolverTableauSequence(source, startIndex);
            if (!sequence) continue;
            const movingCount = sequence.length;

            for (let targetCol = 0; targetCol < state.tableau.length; targetCol++) {
                if (targetCol === sourceCol) continue;
                if (!canPlaceSolverSequenceOnTableau(sequence[0], state.tableau[targetCol])) continue;
                const maxMovable = getSolverMaxMovableCards(state, sourceCol, targetCol, movingCount);
                if (movingCount > maxMovable) continue;
                moves.push({
                    type: 'tableau-to-tableau',
                    sourceCol,
                    targetCol,
                    startIndex,
                    count: movingCount,
                    priority: movingCount > 1 ? 3 : 1
                });
            }
        }
    }

    moves.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return moves;
}

function applyFreecellSolvabilityMove(state, move) {
    if (!move || !move.type) return null;
    const next = {
        tableau: state.tableau.map(column => column.slice()),
        freeCells: state.freeCells.slice(),
        foundations: state.foundations.map(pile => pile.slice())
    };

    switch (move.type) {
        case 'tableau-to-foundation': {
            const source = next.tableau[move.sourceCol];
            if (!source || source.length === 0) return null;
            const card = source.pop();
            next.foundations[move.foundationIndex].push(card);
            return next;
        }
        case 'freecell-to-foundation': {
            const card = next.freeCells[move.cellIndex];
            if (!card) return null;
            next.freeCells[move.cellIndex] = null;
            next.foundations[move.foundationIndex].push(card);
            return next;
        }
        case 'tableau-to-freecell': {
            const source = next.tableau[move.sourceCol];
            if (!source || source.length === 0) return null;
            if (next.freeCells[move.cellIndex]) return null;
            next.freeCells[move.cellIndex] = source.pop();
            return next;
        }
        case 'freecell-to-tableau': {
            const card = next.freeCells[move.cellIndex];
            if (!card) return null;
            const target = next.tableau[move.targetCol];
            if (!target) return null;
            next.freeCells[move.cellIndex] = null;
            target.push(card);
            return next;
        }
        case 'tableau-to-tableau': {
            const source = next.tableau[move.sourceCol];
            const target = next.tableau[move.targetCol];
            if (!source || !target) return null;
            const moving = source.splice(move.startIndex, move.count);
            if (!moving || moving.length === 0) return null;
            target.push(...moving);
            return next;
        }
        default:
            return null;
    }
}

function getSolverTableauSequence(column, startIndex) {
    if (!column || startIndex < 0 || startIndex >= column.length) return null;
    const sequence = column.slice(startIndex);
    for (let i = 1; i < sequence.length; i++) {
        if (!SolitaireLogic.canPlaceOnTableau(sequence[i], sequence[i - 1])) {
            return null;
        }
    }
    return sequence;
}

function canPlaceSolverSequenceOnTableau(baseCard, targetPile) {
    if (!baseCard) return false;
    if (!Array.isArray(targetPile) || targetPile.length === 0) return true;
    const top = targetPile[targetPile.length - 1];
    return SolitaireLogic.canPlaceOnTableau(baseCard, top);
}

function getSolverMaxMovableCards(state, sourceCol, targetCol, movingCount) {
    const emptyFreeCells = state.freeCells.filter(card => !card).length;
    let emptyColumns = state.tableau.filter(column => column.length === 0).length;

    if (state.tableau[targetCol].length === 0) {
        emptyColumns -= 1;
    }

    const sourceColumn = state.tableau[sourceCol];
    if (sourceColumn && sourceColumn.length === movingCount) {
        emptyColumns += 1;
    }

    emptyColumns = Math.max(0, emptyColumns);
    return (emptyFreeCells + 1) * Math.pow(2, emptyColumns);
}

function applyForcedSafeFoundationClosure(state) {
    while (true) {
        const move = findForcedSafeFoundationMove(state);
        if (!move) break;
        if (move.from === 'freecell') {
            const card = state.freeCells[move.sourceIndex];
            if (!card) continue;
            state.freeCells[move.sourceIndex] = null;
            state.foundations[move.foundationIndex].push(card);
        } else {
            const source = state.tableau[move.sourceIndex];
            if (!source || source.length === 0) continue;
            const card = source.pop();
            if (!card) continue;
            state.foundations[move.foundationIndex].push(card);
        }
    }
}

function findForcedSafeFoundationMove(state) {
    const candidates = [];

    for (let cellIndex = 0; cellIndex < state.freeCells.length; cellIndex++) {
        const card = state.freeCells[cellIndex];
        if (!card) continue;
        const foundationIndex = findFoundationTargetForCard(state, card);
        if (foundationIndex === -1) continue;
        if (!isSafeFoundationPromotion(card, state.foundations)) continue;
        candidates.push({ from: 'freecell', sourceIndex: cellIndex, foundationIndex, rank: card.rank });
    }

    for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol++) {
        const source = state.tableau[sourceCol];
        if (!source || source.length === 0) continue;
        const card = source[source.length - 1];
        const foundationIndex = findFoundationTargetForCard(state, card);
        if (foundationIndex === -1) continue;
        if (!isSafeFoundationPromotion(card, state.foundations)) continue;
        candidates.push({ from: 'tableau', sourceIndex: sourceCol, foundationIndex, rank: card.rank });
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.rank - b.rank);
    return candidates[0];
}

function findFoundationTargetForCard(state, card) {
    for (let foundationIndex = 0; foundationIndex < state.foundations.length; foundationIndex++) {
        if (SolitaireLogic.canPlaceOnFoundation(card, state.foundations[foundationIndex])) {
            return foundationIndex;
        }
    }
    return -1;
}

function isSafeFoundationPromotion(card, foundations) {
    if (!card || !Number.isFinite(card.rank)) return false;
    if (card.rank <= 2) return true;

    const bySuit = getFoundationRanksBySuit(foundations);
    const rank = card.rank;

    if (card.suit === '♥') {
        return Math.min(bySuit['♠'], bySuit['♣']) >= rank - 1 && bySuit['♦'] >= rank - 2;
    }
    if (card.suit === '♦') {
        return Math.min(bySuit['♠'], bySuit['♣']) >= rank - 1 && bySuit['♥'] >= rank - 2;
    }
    if (card.suit === '♠') {
        return Math.min(bySuit['♥'], bySuit['♦']) >= rank - 1 && bySuit['♣'] >= rank - 2;
    }
    if (card.suit === '♣') {
        return Math.min(bySuit['♥'], bySuit['♦']) >= rank - 1 && bySuit['♠'] >= rank - 2;
    }
    return false;
}

function getFoundationRanksBySuit(foundations) {
    const ranks = { '♥': 0, '♦': 0, '♠': 0, '♣': 0 };
    for (const pile of foundations) {
        if (!pile || pile.length === 0) continue;
        const top = pile[pile.length - 1];
        if (!top || !top.suit || !Number.isFinite(top.rank)) continue;
        ranks[top.suit] = top.rank;
    }
    return ranks;
}

function hasAnyFreecellForwardMove(state) {
    for (let cellIndex = 0; cellIndex < state.freeCells.length; cellIndex++) {
        const card = state.freeCells[cellIndex];
        if (!card) continue;
        for (let foundationIndex = 0; foundationIndex < state.foundations.length; foundationIndex++) {
            if (SolitaireLogic.canPlaceOnFoundation(card, state.foundations[foundationIndex])) {
                return true;
            }
        }
    }

    for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol++) {
        const column = state.tableau[sourceCol];
        if (!column || column.length === 0) continue;
        const top = column[column.length - 1];
        for (let foundationIndex = 0; foundationIndex < state.foundations.length; foundationIndex++) {
            if (SolitaireLogic.canPlaceOnFoundation(top, state.foundations[foundationIndex])) {
                return true;
            }
        }
    }

    const emptyCellIndex = state.freeCells.findIndex(cell => !cell);
    if (emptyCellIndex !== -1 && state.tableau.some(column => column && column.length > 0)) {
        return true;
    }

    for (let cellIndex = 0; cellIndex < state.freeCells.length; cellIndex++) {
        const card = state.freeCells[cellIndex];
        if (!card) continue;
        for (let targetCol = 0; targetCol < state.tableau.length; targetCol++) {
            const target = state.tableau[targetCol];
            if (!target || target.length === 0) return true;
            const top = target[target.length - 1];
            if (SolitaireLogic.canPlaceOnTableau(card, top)) return true;
        }
    }

    for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol++) {
        const source = state.tableau[sourceCol];
        if (!source || source.length === 0) continue;
        for (let startIndex = source.length - 1; startIndex >= 0; startIndex--) {
            const sequence = getSolverTableauSequence(source, startIndex);
            if (!sequence) continue;
            const movingCount = sequence.length;
            for (let targetCol = 0; targetCol < state.tableau.length; targetCol++) {
                if (targetCol === sourceCol) continue;
                if (!canPlaceSolverSequenceOnTableau(sequence[0], state.tableau[targetCol])) continue;
                const maxMovable = getSolverMaxMovableCards(state, sourceCol, targetCol, movingCount);
                if (movingCount <= maxMovable) return true;
            }
        }
    }

    return false;
}

function checkFreeCellWin() {
    if (freecellState.foundations.every(pile => pile.length === getFreecellFoundationTargetSize())) {
        freecellState.isGameWon = true;
        clearInterval(freecellState.timerInterval);
        CommonUtils.playSound('win');
        CommonUtils.showTableToast(freecellVariant.winMessage, { variant: 'win', duration: 2500 });
        if (freecellStateManager) {
            freecellStateManager.clear();
        }
    }
}

function showFreecellHelp() {
    const isCavalier = freecellVariant.ruleSetKey === 'cavalier';
    const title = isCavalier ? 'Cavalier FreeCell Rules' : 'FreeCell Rules';
    const message = [
        'Goal: Build all foundations up by suit, starting from Ace.',
        'Tableau: Build down in alternating colors.',
        'Free cells: Each open free cell can hold one card.',
        isCavalier
            ? 'Cavalier uses a 56-card deck (2-A plus Knight), 10 tableau columns, and 14-card foundations.'
            : 'Classic FreeCell uses 8 tableau columns and standard 13-card foundations.',
        'Any card may move to an empty tableau column.',
        'You can move ordered sequences when enough free cells/empty columns are available.'
    ].join('\n');
    if (typeof SolitaireUiFeedback !== 'undefined' && typeof SolitaireUiFeedback.showHelp === 'function') {
        SolitaireUiFeedback.showHelp({ title, message });
        return;
    }
    if (typeof SolitaireUiFeedback !== 'undefined' && typeof SolitaireUiFeedback.showInfo === 'function') {
        SolitaireUiFeedback.showInfo({ title, message });
        return;
    }
    alert(`${title}\n\n${message}`);
}

function setupFreeCellEventListeners() {
    document.getElementById('freecell-new-game').addEventListener('click', initFreeCellGame);
    const undoBtn = document.getElementById('freecell-undo');
    if (undoBtn) {
        undoBtn.addEventListener('click', undoLastMove);
    }
    const hintBtn = document.getElementById('freecell-hint');
    if (hintBtn) {
        hintBtn.addEventListener('click', showFreecellHint);
    }
    const checkBtn = document.getElementById('freecell-check');
    if (checkBtn) {
        checkBtn.addEventListener('click', checkCurrentFreecellSolvability);
    }
    const helpBtn = document.getElementById('freecell-help');
    if (helpBtn) {
        helpBtn.addEventListener('click', showFreecellHelp);
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
