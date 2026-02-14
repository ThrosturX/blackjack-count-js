/**
 * Klondike Solitaire Game Controller
 * Manages game state, UI updates, and user interactions
 */

const DEFAULT_VARIANT_ID = 'classic';
const KLONDIKE_VARIANT_ORDER = ['classic', 'vegas', 'open-towers'];
const KLONDIKE_VARIANTS = {
    classic: {
        id: 'classic',
        label: 'Classic Klondike',
        description: 'Standard Klondike with the draw-count toggle and classic scoring.',
        drawCount: 3,
        startScore: 0,
        allowAnyCardOnEmpty: false,
        lockDrawCount: false,
        scoreOverrides: {}
    },
    vegas: {
        id: 'vegas',
        label: 'Vegas Klondike',
        description: 'Draw 1, start at -52, -1 per draw but +5 per card scored to a foundation.',
        drawCount: 1,
        startScore: -52,
        allowAnyCardOnEmpty: false,
        lockDrawCount: true,
        scoreOverrides: {
            draw: -1,
            'waste-to-foundation': 5,
            'tableau-to-foundation': 5,
            'flip-card': 0
        }
    },
    'open-towers': {
        id: 'open-towers',
        label: 'Open Towers',
        description: 'Any card can start an empty column and flips are worth extra reward.',
        drawCount: 3,
        startScore: 0,
        allowAnyCardOnEmpty: true,
        lockDrawCount: false,
        scoreOverrides: {
            'tableau-to-tableau': 5,
            'flip-card': 10
        }
    }
};
const KLONDIKE_HELP_RULES = {
    classic: 'Classic: Build tableau down by alternating colors, and only Kings may fill empty columns.',
    vegas: 'Vegas: Draw 1 only, start at -52 score, and foundation moves pay out.',
    'open-towers': 'Open Towers: Any rank may fill empty columns and tableau moves score higher.'
};

// Game state
const gameState = {
    tableau: [[], [], [], [], [], [], []],
    foundations: [[], [], [], []],
    stock: [],
    waste: [],
    score: 0,
    moves: 0,
    startTime: null,
    timerInterval: null,
    moveHistory: [],
    drawCount: 3,
    isGameWon: false,
    variantId: DEFAULT_VARIANT_ID,
    variantConfig: KLONDIKE_VARIANTS[DEFAULT_VARIANT_ID]
};

let klondikeStateManager = null;

function getKlondikeRuleSetKey() {
    const variantId = gameState.variantId || DEFAULT_VARIANT_ID;
    const drawCount = Number.isFinite(gameState.drawCount) ? gameState.drawCount : 3;
    return `variant-${variantId}|draw-${drawCount}`;
}

function syncKlondikeHighScore() {
    const highScoreEl = document.getElementById('klondike-high-score');
    if (!highScoreEl) return;
    const highScore = CommonUtils.updateHighScore('klondike', getKlondikeRuleSetKey(), gameState.score);
    highScoreEl.textContent = highScore;
}

// Drag state / UI tuning
const DRAG_MOVE_THRESHOLD = 6;
const CARD_HEIGHT = 100;
const STACK_OFFSET = 25;
const STACK_X_OFFSET = 2.5;
const TABLEAU_DROP_PADDING = 40;
const FOUNDATION_DROP_PADDING = 30;
const MOBILE_TABLEAU_DROP_PADDING = 16;
const MOBILE_FOUNDATION_DROP_PADDING = 16;
const MOBILE_AUTO_MOVE_DOUBLE_TAP_WINDOW_MS = 380;
const MAX_HISTORY = 200;
const MAX_SOLVABLE_DEAL_ATTEMPTS = 12;
const MAX_SIMULATION_ITERATIONS = 1200;
const KLONDIKE_MIN_TABLEAU_CARDS = 13;
const KLONDIKE_BASE_TABLEAU_GAP = 15;
const KLONDIKE_MIN_TABLEAU_GAP = 4;
const KLONDIKE_WASTE_FAN_BASE = 20;
const KLONDIKE_WASTE_FAN_MIN = 8;
const KLONDIKE_QUICK_CHECK_LIMITS = {
    classic: { maxStates: 5000, maxDurationMs: 5000 },
    vegas: { maxStates: 7000, maxDurationMs: 5000 },
    'open-towers': { maxStates: 4500, maxDurationMs: 5000 }
};
const KLONDIKE_ATTEMPT_CHECK_LIMITS = {
    classic: { maxStates: 30000, maxDurationMs: 60000 },
    vegas: { maxStates: 42000, maxDurationMs: 60000 },
    'open-towers': { maxStates: 26000, maxDurationMs: 60000 }
};
const klondikeInsolvabilityDetector = (typeof SolitaireInsolvabilityDetector !== 'undefined')
    ? SolitaireInsolvabilityDetector.createKlondikePreset()
    : null;
let klondikeCheckWorker = null;
let klondikeCheckRequestId = 0;
let klondikeCheckSolvedLocked = false;
let klondikeCheckUnsolvableLocked = false;
let klondikeStoredSolution = null;

const dragState = {
    draggedCards: [],
    sourcePile: null,
    sourceIndex: null,
    draggedElements: [],
    dragLayer: null,
    pointerOffsetX: 0,
    pointerOffsetY: 0,
    isDragging: false,
    pendingDrag: null,
    activePointerId: null,
    hoveredCard: null,
    mobileController: null
};
const mobileAutoMoveTapState = {
    key: '',
    at: 0
};

// Sound files
const soundFiles = {
    card: ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav'],
    win: ['win.wav'],
    shuffle: ['shuffle.wav']
};

// Initialize game on load
document.addEventListener('DOMContentLoaded', () => {
    CommonUtils.preloadAudio(soundFiles);
    setupEventListeners();
    CommonUtils.initCardScaleControls('klondike-card-scale', 'klondike-card-scale-value');
    klondikeStateManager = new CommonUtils.StateManager({
        gameId: 'klondike',
        getState: getKlondikeSaveState,
        setState: restoreKlondikeState,
        isWon: () => gameState.isGameWon
    });
    const restored = klondikeStateManager.load();
    if (!restored) {
        initGame();
    }
});

/**
 * Ensure mobile controller bindings are ready.
 */
function ensureMobileController() {
    if (dragState.mobileController || typeof MobileSolitaireController === 'undefined') return;
    dragState.mobileController = new MobileSolitaireController({
        isMovable: (el) => {
            if (el.dataset.waste) return true;
            if (el.dataset.foundation !== undefined) return true;
            const cardIndex = parseInt(el.dataset.index, 10);
            const col = parseInt(el.dataset.column, 10);
            const column = gameState.tableau[col];
            const card = column ? column[cardIndex] : null;
            return card && !card.hidden;
        },
        getSequence: (el) => {
            if (el.dataset.waste) {
                return [gameState.waste[gameState.waste.length - 1]];
            } else if (el.dataset.foundation !== undefined) {
                const idx = parseInt(el.dataset.foundation, 10);
                const card = gameState.foundations[idx][gameState.foundations[idx].length - 1];
                return card ? [card] : [];
            } else {
                const col = parseInt(el.dataset.column, 10);
                const index = parseInt(el.dataset.index, 10);
                return gameState.tableau[col].slice(index);
            }
        },
        getSource: (el) => {
            if (el.dataset.waste) return { type: 'waste' };
            if (el.dataset.foundation !== undefined) return { type: 'foundation', index: parseInt(el.dataset.foundation, 10) };
            return { type: 'tableau', index: parseInt(el.dataset.column, 10) };
        },
        getElements: (el) => collectDraggedElements(el),
        findDropTarget: (x, y) => {
            const directTarget = UIHelpers.getTargetFromPoint(x, y, [
                {
                    selector: '.foundation-pile',
                    resolve: (el) => ({ type: 'foundation', index: parseInt(el.id.split('-')[1], 10) })
                },
                {
                    selector: '.tableau-column',
                    resolve: (el) => ({ type: 'tableau', index: parseInt(el.id.split('-')[1], 10) })
                }
            ]);
            if (directTarget) return directTarget;

            const colIndex = findTableauDropColumn(x, y);
            if (colIndex !== null) return { type: 'tableau', index: colIndex };
            const foundationIndex = findFoundationDropPile(x, y);
            if (foundationIndex !== null) return { type: 'foundation', index: foundationIndex };
            return null;
        },
        isValidMove: (source, target) => {
            // Setup temporary drag state for validity checks
            dragState.draggedCards = dragState.mobileController.selectedData.cards;
            dragState.sourcePile = source.type;
            dragState.sourceIndex = source.index;

            let valid = false;
            if (target.type === 'tableau') {
                valid = canDropOnTableau(target.index);
            } else if (target.type === 'foundation') {
                valid = canDropOnFoundation(target.index);
            }

            // Cleanup temp state
            dragState.draggedCards = [];
            dragState.sourcePile = null;
            dragState.sourceIndex = null;
            return valid;
        },
        executeMove: (source, target) => {
            // Setup drag state for finishDrag with necessary info
            dragState.draggedCards = dragState.mobileController.selectedData.cards;
            dragState.sourcePile = source.type;
            dragState.sourceIndex = source.index;

            let targetEl = null;
            if (target.type === 'tableau') {
                targetEl = document.getElementById(`tableau-${target.index}`);
            } else if (target.type === 'foundation') {
                targetEl = document.getElementById(`foundation-${target.index}`);
            }

            if (targetEl) {
                const rect = targetEl.getBoundingClientRect();
                // Simulate a drop point near the center of the target element
                const clientX = rect.left + rect.width / 2;
                const clientY = rect.top + rect.height / 2;

                finishDrag(clientX, clientY);
            } else {
                // If for some reason the target element is not found, just reset and update UI
                resetDragState(); // Ensure drag state is clean
                updateUI();
            }
        }
    });

    if (CommonUtils.isMobile() && dragState.mobileController) {
        const table = document.getElementById('klondike-table');
        table.addEventListener('pointerdown', (e) => {
            dragState.mobileController.handlePointerDown(e);
        });
        document.addEventListener('pointermove', (e) => {
            dragState.mobileController.handlePointerMove(e);
        });
        document.addEventListener('pointerup', (e) => {
            dragState.mobileController.handlePointerUp(e);
        });
        document.addEventListener('pointercancel', (e) => {
            dragState.mobileController.handlePointerCancel(e);
        });
    }
}

/**
 * Initialize a new game
 */
function initGame() {
    ensureMobileController();
    cleanupKlondikeCheckWorker();
    resetKlondikeCheckAvailability();

    // Reset state
    gameState.tableau = [[], [], [], [], [], [], []];
    gameState.foundations = [[], [], [], []];
    gameState.stock = [];
    gameState.waste = [];
    gameState.score = 0;
    gameState.moves = 0;
    gameState.moveHistory = [];
    gameState.isGameWon = false;

    // Stop timer
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    gameState.startTime = Date.now();

    applyVariantConfig();

    // Deal a solvable hand (reshuffle up to N times if needed)
    dealSolvableGame();

    // Start timer
    startTimer();

    // Update UI
    updateUI();
    hideWinOverlay();
    updateUndoButtonState();

    CommonUtils.playSound('shuffle');
    if (klondikeStateManager) {
        klondikeStateManager.markDirty();
    }
}

/**
 * Start the game timer
 */
function startTimer() {
    gameState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('time-display').textContent =
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function getElapsedSeconds(startTime) {
    if (!Number.isFinite(startTime)) return 0;
    return Math.max(0, Math.floor((Date.now() - startTime) / 1000));
}

function getKlondikeSaveState() {
    return {
        tableau: gameState.tableau,
        foundations: gameState.foundations,
        stock: gameState.stock,
        waste: gameState.waste,
        score: gameState.score,
        moves: gameState.moves,
        moveHistory: gameState.moveHistory,
        drawCount: gameState.drawCount,
        variantId: gameState.variantId,
        elapsedSeconds: getElapsedSeconds(gameState.startTime),
        isGameWon: gameState.isGameWon
    };
}

function syncVariantUI() {
    const variant = getActiveVariantConfig();
    gameState.variantConfig = variant;

    const drawSelect = document.getElementById('draw-count-select');
    if (drawSelect) {
        drawSelect.value = gameState.drawCount.toString();
        drawSelect.disabled = !!variant.lockDrawCount;
    }
    const variantSelect = document.getElementById('variant-select');
    if (variantSelect) {
        variantSelect.value = gameState.variantId;
    }
    updateVariantDescription(variant.description);
}

function restoreKlondikeState(saved) {
    if (!saved || typeof saved !== 'object') return;
    ensureMobileController();
    cleanupKlondikeCheckWorker();
    resetKlondikeCheckAvailability();

    gameState.tableau = saved.tableau || [[], [], [], [], [], [], []];
    gameState.foundations = saved.foundations || [[], [], [], []];
    gameState.stock = saved.stock || [];
    gameState.waste = saved.waste || [];
    gameState.score = Number.isFinite(saved.score) ? saved.score : 0;
    gameState.moves = Number.isFinite(saved.moves) ? saved.moves : 0;
    gameState.moveHistory = Array.isArray(saved.moveHistory) ? saved.moveHistory : [];
    gameState.isGameWon = false;

    gameState.variantId = saved.variantId || DEFAULT_VARIANT_ID;
    const variant = getActiveVariantConfig();
    const savedDraw = Number.isFinite(saved.drawCount) ? saved.drawCount : variant.drawCount;
    gameState.drawCount = variant.lockDrawCount ? variant.drawCount : savedDraw;
    syncVariantUI();

    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    const elapsed = Number.isFinite(saved.elapsedSeconds) ? saved.elapsedSeconds : 0;
    gameState.startTime = Date.now() - elapsed * 1000;
    startTimer();

    updateUI();
    hideWinOverlay();
    updateUndoButtonState();
}

/**
 * Update the entire UI
 */
function updateUI() {
    updateTableau();
    updateFoundations();
    updateStock();
    updateWaste();
    updateStats();
    scheduleTableauSizing();
}

function getMaxTableauLength() {
    return gameState.tableau.reduce((max, column) => Math.max(max, column.length), 0);
}

function getStackOffsets() {
    return {
        y: CommonUtils.getSolitaireStackOffset(STACK_OFFSET, { minFactor: 0.42 }),
        x: CommonUtils.getSolitaireStackOffset(STACK_X_OFFSET, { min: 1, max: STACK_X_OFFSET })
    };
}

function getWasteFanOffset() {
    return CommonUtils.getSolitaireStackOffset(KLONDIKE_WASTE_FAN_BASE, {
        min: KLONDIKE_WASTE_FAN_MIN,
        max: KLONDIKE_WASTE_FAN_BASE
    });
}

function applyAdaptiveTableauGap() {
    const tableEl = document.getElementById('klondike-table');
    const wrapperEl = document.getElementById('klondike-scroll');
    const tableauEl = document.getElementById('tableau-area');
    if (!tableEl || !wrapperEl || !tableauEl) return;

    const scale = CommonUtils.getUiScaleValue();
    const baseGap = CommonUtils.getSolitaireStackOffset(KLONDIKE_BASE_TABLEAU_GAP, {
        scale,
        min: KLONDIKE_MIN_TABLEAU_GAP,
        max: KLONDIKE_BASE_TABLEAU_GAP
    });
    const currentGap = parseFloat(getComputedStyle(tableauEl).columnGap || getComputedStyle(tableauEl).gap) || baseGap;
    const availableWidth = wrapperEl.getBoundingClientRect().width || 0;
    const gapSlots = 6;
    const requiredAtBase = tableauEl.scrollWidth + Math.max(0, (baseGap - currentGap) * gapSlots);
    let overflow = Math.max(0, requiredAtBase - availableWidth);
    const nextGap = CommonUtils.consumeOverflowWithSpacing(
        overflow,
        baseGap,
        KLONDIKE_MIN_TABLEAU_GAP,
        gapSlots
    ).value;

    tableEl.style.setProperty('--klondike-tableau-gap', `${nextGap}px`);
    tableEl.style.setProperty('--klondike-waste-fan-x', `${getWasteFanOffset()}px`);
}

function ensureTableauSizing() {
    applyAdaptiveTableauGap();
    const offsets = getStackOffsets();
    const maxCards = Math.max(KLONDIKE_MIN_TABLEAU_CARDS, getMaxTableauLength());
    const stackHeight = CommonUtils.getStackHeight(maxCards, offsets.y);
    CommonUtils.ensureTableauMinHeight({
        table: 'klondike-table',
        topRow: 'top-row',
        stackOffset: offsets.y,
        maxCards
    });
    const tableauArea = document.getElementById('tableau-area');
    if (tableauArea) {
        tableauArea.style.minHeight = `${Math.ceil(stackHeight)}px`;
    }
    document.querySelectorAll('.tableau-column').forEach(column => {
        column.style.minHeight = `${Math.ceil(stackHeight)}px`;
    });
    CommonUtils.ensureScrollableWidth({
        table: 'klondike-table',
        wrapper: 'klondike-scroll',
        contentSelectors: ['#top-row', '#tableau-area']
    });
}

const scheduleTableauSizing = CommonUtils.createRafScheduler(ensureTableauSizing);

/**
 * Update tableau columns
 */
function updateTableau() {
    const offsets = getStackOffsets();
    for (let col = 0; col < 7; col++) {
        const columnEl = document.getElementById(`tableau-${col}`);
        columnEl.innerHTML = '';
        const fragment = document.createDocumentFragment();

        const cards = gameState.tableau[col];
        cards.forEach((card, index) => {
            const cardEl = CommonUtils.createCardEl(card);
            cardEl.style.position = 'absolute';
            cardEl.style.top = `${index * offsets.y}px`;
            cardEl.style.left = `${index * offsets.x}px`;
            cardEl.dataset.column = col;
            cardEl.dataset.index = index;

            // Only allow interaction with face-up cards
            if (!card.hidden) {
                /* Stop attaching pointerdown to individual cards on mobile
                 * (so the container can catch everything) ; Credit: Grok
                 */
                if (!CommonUtils.isMobile() || !dragState.mobileController) {
                    cardEl.addEventListener('pointerdown', handlePointerDown);
                }
                cardEl.addEventListener('click', handleCardClick);
                cardEl.style.cursor = 'pointer';
            }

            fragment.appendChild(cardEl);
        });
        columnEl.appendChild(fragment);
    }
}

/**
 * Update foundation piles
 */
function updateFoundations() {
    for (let i = 0; i < 4; i++) {
        const foundationEl = document.getElementById(`foundation-${i}`);
        foundationEl.innerHTML = '';

        const cards = gameState.foundations[i];
        if (cards.length > 0) {
            const topCard = cards[cards.length - 1];
            const cardEl = CommonUtils.createCardEl(topCard);
            cardEl.dataset.foundation = i;
            if (!CommonUtils.isMobile() || !dragState.mobileController) {
                cardEl.addEventListener('pointerdown', handlePointerDown);
            }
            cardEl.style.cursor = 'pointer';
            foundationEl.appendChild(cardEl);
        } else {
            // Show placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'pile-placeholder';
            placeholder.textContent = foundationEl.dataset.suit;
            foundationEl.appendChild(placeholder);
        }

    }
}

/**
 * Update stock pile
 */
function updateStock() {
    const stockEl = document.getElementById('stock-pile');
    stockEl.innerHTML = '';

    if (gameState.stock.length > 0) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card hidden';
        cardEl.style.cursor = 'pointer';
        cardEl.addEventListener('click', drawFromStock);
        stockEl.appendChild(cardEl);
    } else {
        // Show recycle icon if waste has cards
        if (gameState.waste.length > 0) {
            const recycleEl = document.createElement('div');
            recycleEl.className = 'pile-placeholder recycle';
            recycleEl.textContent = '↻';
            recycleEl.style.cursor = 'pointer';
            recycleEl.style.fontSize = '3rem';
            recycleEl.addEventListener('click', recycleWaste);
            stockEl.appendChild(recycleEl);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'pile-placeholder';
            placeholder.textContent = 'Stock';
            stockEl.appendChild(placeholder);
        }
    }
}

/**
 * Update waste pile
 */
function updateWaste() {
    const wasteEl = document.getElementById('waste-pile');
    wasteEl.innerHTML = '';

    if (gameState.waste.length > 0) {
        const visibleCount = gameState.drawCount === 3 ? 3 : 1;
        CommonUtils.renderWasteFanPile({
            containerEl: wasteEl,
            waste: gameState.waste,
            visibleCount,
            fanOffset: getWasteFanOffset(),
            onCard: ({ cardEl, isTop }) => {
                // Only top card responds to drag.
                if (!isTop) return;
                cardEl.dataset.waste = 'true';
                if (!CommonUtils.isMobile() || !dragState.mobileController) {
                    cardEl.addEventListener('pointerdown', handlePointerDown);
                }
                cardEl.addEventListener('click', handleCardClick);
                cardEl.style.cursor = 'pointer';
                cardEl.style.zIndex = 10;
            }
        });
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'pile-placeholder';
        placeholder.textContent = '';
        wasteEl.appendChild(placeholder);
    }
}

/**
 * Update score and stats display
 */
function updateStats() {
    document.getElementById('score-display').textContent = gameState.score;
    document.getElementById('moves-display').textContent = gameState.moves;
    syncKlondikeHighScore();
}

/**
 * Draw cards from stock to waste
 */
function drawFromStock() {
    if (gameState.stock.length === 0) return;

    const drawCount = gameState.drawCount;
    const cardsToDraw = Math.min(drawCount, gameState.stock.length);
    const drawnCards = [];

    for (let i = 0; i < cardsToDraw; i++) {
        const card = gameState.stock.pop();
        card.hidden = false;
        gameState.waste.push(card);
        drawnCards.push(card);
    }

    gameState.moves++;
    const drawScore = applyVariantScore('draw');
    recordMove({
        type: 'draw',
        payload: { cards: drawnCards.slice() },
        scoreDelta: drawScore,
        movesDelta: 1
    });
    CommonUtils.playSound('card');
    updateUI();
}

/**
 * Recycle waste back to stock
 */
function recycleWaste() {
    if (gameState.waste.length === 0) return;

    // Move all waste cards back to stock (reversed)
    const recycledCards = gameState.waste.slice();
    while (gameState.waste.length > 0) {
        const card = gameState.waste.pop();
        card.hidden = true;
        gameState.stock.push(card);
    }

    const recycleScore = applyVariantScore('recycle-waste');
    gameState.moves++;
    recordMove({
        type: 'recycle',
        payload: { cards: recycledCards.slice() },
        scoreDelta: recycleScore,
        movesDelta: 1
    });
    CommonUtils.playSound('card');
    updateUI();
}

/**
 * Handle pointer down to initiate a drag
 */
function handlePointerDown(e) {
    if (e.button !== 0) return;

    // Mobile pickup UX (always allow mobile controller to handle pointerdown)
    if (CommonUtils.isMobile() && dragState.mobileController) {
        // The mobile controller handles deselection on empty space, so no early return here.
        // It will return true if it handled the event (e.g., selection or drop).
        if (dragState.mobileController.handlePointerDown(e)) {
            return;
        }
    }

    const cardEl = e.target.closest(".card");
    if (!cardEl) return; // If it wasn't a mobile interaction and no card was clicked, do nothing.

    dragState.pendingDrag = {
        cardEl,
        startX: e.clientX,
        startY: e.clientY
    };
    dragState.activePointerId = e.pointerId;
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    if (cardEl.setPointerCapture) {
        cardEl.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
}

function handlePointerMove(e) {
    if (dragState.activePointerId !== e.pointerId) return;

    if (dragState.pendingDrag && !dragState.isDragging) {
        const dx = e.clientX - dragState.pendingDrag.startX;
        const dy = e.clientY - dragState.pendingDrag.startY;
        if (Math.hypot(dx, dy) > DRAG_MOVE_THRESHOLD) {
            startPointerDrag(e);
        }
    }

    if (dragState.isDragging) {
        updateDragLayerPosition(e.clientX, e.clientY);
        updateDragIndicators(e.clientX, e.clientY);
    }
}

function handlePointerUp(e) {
    if (dragState.activePointerId !== e.pointerId) return;

    if (dragState.isDragging) {
        finishDrag(e.clientX, e.clientY);
    } else {
        dragState.pendingDrag = null;
    }

    cleanupPointerHandlers();
}

function startPointerDrag(e) {
    const { cardEl } = dragState.pendingDrag;
    if (!cardEl) return;

    clearHoveredCard();

    // Determine source pile and cards
    if (cardEl.dataset.waste) {
        const card = gameState.waste[gameState.waste.length - 1];
        dragState.draggedCards = [card];
        dragState.sourcePile = 'waste';
        dragState.sourceIndex = gameState.waste.length - 1;
    } else if (cardEl.dataset.foundation !== undefined) {
        const foundationIndex = parseInt(cardEl.dataset.foundation, 10);
        const foundationPile = gameState.foundations[foundationIndex];
        const card = foundationPile[foundationPile.length - 1];
        dragState.draggedCards = card ? [card] : [];
        dragState.sourcePile = 'foundation';
        dragState.sourceIndex = foundationIndex;
    } else {
        const col = parseInt(cardEl.dataset.column, 10);
        const index = parseInt(cardEl.dataset.index, 10);
        dragState.draggedCards = gameState.tableau[col].slice(index);
        dragState.sourcePile = 'tableau';
        dragState.sourceIndex = col;
    }

    // Collect actual DOM elements for the stack
    dragState.draggedElements = collectDraggedElements(cardEl);

    createDragLayer(e);
    dragState.isDragging = true;
    dragState.pendingDrag = null;
}

function collectDraggedElements(cardEl) {
    if (cardEl.dataset.waste) {
        return [cardEl];
    }
    if (cardEl.dataset.foundation !== undefined) {
        return [cardEl];
    }

    const columnEl = document.getElementById(`tableau-${cardEl.dataset.column}`);
    if (!columnEl) return [];

    const cardEls = Array.from(columnEl.querySelectorAll('.card'));
    const startIndex = cardEls.findIndex(el => parseInt(el.dataset.index, 10) >= parseInt(cardEl.dataset.index, 10));
    return startIndex >= 0 ? cardEls.slice(startIndex) : [];
}

function createDragLayer(e) {
    if (dragState.draggedElements.length === 0) return;

    const topCardEl = dragState.draggedElements[0];
    const initialRect = topCardEl.getBoundingClientRect();
    dragState.pointerOffsetX = e.clientX - initialRect.left;
    dragState.pointerOffsetY = e.clientY - initialRect.top;

    const offsets = getStackOffsets();
    const layer = document.createElement('div');
    layer.className = 'drag-layer';
    layer.style.position = 'fixed';
    layer.style.left = '0';
    layer.style.top = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '1000';
    layer.style.width = `${initialRect.width}px`;
    layer.style.height = `${CARD_HEIGHT + (dragState.draggedElements.length - 1) * offsets.y}px`;

    dragState.draggedElements.forEach((el, idx) => {
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.top = `${idx * offsets.y}px`;
        el.style.margin = '0';
        el.style.transform = 'scale(var(--card-scale))';
        el.style.transition = 'none';
        layer.appendChild(el);
    });

    document.body.appendChild(layer);
    dragState.dragLayer = layer;
    updateDragLayerPosition(e.clientX, e.clientY);
}

function updateDragLayerPosition(clientX, clientY) {
    if (!dragState.dragLayer) return;
    dragState.dragLayer.style.left = `${clientX - dragState.pointerOffsetX}px`;
    dragState.dragLayer.style.top = `${clientY - dragState.pointerOffsetY}px`;
}

function getDropPoint(clientX, clientY) {
    if (CommonUtils.isMobile()) {
        return { x: clientX, y: clientY };
    }
    if (!dragState.dragLayer) {
        return { x: clientX, y: clientY };
    }
    const rect = dragState.dragLayer.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + Math.min(CARD_HEIGHT / 2, rect.height - 1);
    return { x, y };
}

function getDirectDropTarget(clientX, clientY) {
    return UIHelpers.getTargetFromPoint(clientX, clientY, [
        {
            selector: '.tableau-column',
            resolve: (el) => ({ type: 'tableau', index: parseInt(el.id.split('-')[1], 10) })
        },
        {
            selector: '.foundation-pile',
            resolve: (el) => ({ type: 'foundation', index: parseInt(el.id.split('-')[1], 10) })
        }
    ]);
}

function buildDropTargetCandidates(clientX, clientY) {
    const direct = getDirectDropTarget(clientX, clientY);
    const candidates = [];
    const seen = new Set();
    const addCandidate = (target) => {
        if (!target || !Number.isFinite(target.index) || !target.type) return;
        const key = `${target.type}:${target.index}`;
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push(target);
    };

    addCandidate(direct);
    const targetColIndex = findTableauDropColumn(clientX, clientY);
    if (targetColIndex !== null) {
        addCandidate({ type: 'tableau', index: targetColIndex });
    }
    const foundationIndex = findFoundationDropPile(clientX, clientY);
    if (foundationIndex !== null) {
        addCandidate({ type: 'foundation', index: foundationIndex });
    }

    return candidates;
}

function finishDrag(clientX, clientY) {
    const scoreBeforeDrag = gameState.score;
    const movesBeforeDrag = gameState.moves;
    let movePayload = null;
    let moveType = '';
    let moveResult = { success: false };

    const dropPoint = getDropPoint(clientX, clientY);
    const targetCandidates = buildDropTargetCandidates(dropPoint.x, dropPoint.y);
    for (const target of targetCandidates) {
        if (target.type === 'tableau') {
            moveResult = attemptTableauMove(target.index);
            if (!moveResult.success) continue;
            if (dragState.sourcePile === 'waste') {
                moveType = 'waste-to-tableau';
            } else if (dragState.sourcePile === 'foundation') {
                moveType = 'foundation-to-tableau';
            } else {
                moveType = 'tableau-to-tableau';
            }
            movePayload = moveResult.payload;
            break;
        }

        moveResult = attemptFoundationMove(target.index);
        if (!moveResult.success) continue;
        if (dragState.sourcePile === 'waste') {
            moveType = 'waste-to-foundation';
        } else if (dragState.sourcePile === 'foundation') {
            moveType = 'foundation-to-foundation';
        } else {
            moveType = 'tableau-to-foundation';
        }
        movePayload = moveResult.payload;
        break;
    }

    cleanupDragVisuals();

    if (moveResult.success) {
        applyVariantScore(moveType);
        gameState.moves++;
        const scoreDelta = gameState.score - scoreBeforeDrag;
        recordMove({
            type: moveType,
            payload: movePayload,
            scoreDelta,
            movesDelta: gameState.moves - movesBeforeDrag
        });
        CommonUtils.playSound('card');
        updateUI();
        checkWinCondition();
    } else {
        updateUI();
    }

    resetDragState();
}

function cleanupDragVisuals() {
    if (dragState.dragLayer) {
        dragState.dragLayer.remove();
        dragState.dragLayer = null;
    }
    dragState.draggedElements = [];
    clearDropIndicators();
}

function cleanupPointerHandlers() {
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    clearHoveredCard();
    dragState.activePointerId = null;
}

function resetDragState() {
    dragState.draggedCards = [];
    dragState.sourcePile = null;
    dragState.sourceIndex = null;
    dragState.pointerOffsetX = 0;
    dragState.pointerOffsetY = 0;
    dragState.isDragging = false;
    dragState.pendingDrag = null;
}

/**
 * Attempt to move cards to tableau
 */
function attemptTableauMove(targetCol) {
    if (dragState.draggedCards.length === 0) return { success: false };

    const movingCard = dragState.draggedCards[0];
    const targetPile = gameState.tableau[targetCol];

    let isValid = false;

    if (targetPile.length === 0) {
        // Empty column - use variant-aware rule
        isValid = canMoveToEmptyTableauForVariant(movingCard);
    } else {
        // Check if can place on top card
        const topCard = targetPile[targetPile.length - 1];
        isValid = !topCard.hidden && SolitaireLogic.canPlaceOnTableau(movingCard, topCard);
    }

    if (isValid) {
        const cardsMoved = dragState.draggedCards.slice();
        let flippedCard = null;

        // Remove cards from source
        if (dragState.sourcePile === 'waste') {
            gameState.waste.pop();
        } else if (dragState.sourcePile === 'foundation') {
            if (cardsMoved.length !== 1) return { success: false };
            const sourceFoundation = dragState.sourceIndex;
            gameState.foundations[sourceFoundation].pop();
        } else if (dragState.sourcePile === 'tableau') {
            const sourceCol = dragState.sourceIndex;
            gameState.tableau[sourceCol] = gameState.tableau[sourceCol].slice(0, -dragState.draggedCards.length);

            // Flip top card if it's hidden
            if (gameState.tableau[sourceCol].length > 0) {
                const topCard = gameState.tableau[sourceCol][gameState.tableau[sourceCol].length - 1];
                if (topCard.hidden) {
                    topCard.hidden = false;
                    flippedCard = topCard;
                    applyVariantScore('flip-card');
                }
            }
        }

        // Add cards to target
        gameState.tableau[targetCol].push(...cardsMoved);

        return {
            success: true,
            payload: {
                fromPile: dragState.sourcePile,
                fromColumn: dragState.sourcePile === 'tableau' ? dragState.sourceIndex : null,
                fromFoundation: dragState.sourcePile === 'foundation' ? dragState.sourceIndex : null,
                toColumn: targetCol,
                cards: cardsMoved,
                flippedCard
            }
        };
    }

    return { success: false };
}

/**
 * Attempt to move card to foundation
 */
function attemptFoundationMove(targetFoundation) {
    if (dragState.draggedCards.length !== 1) return { success: false };

    const movingCard = dragState.draggedCards[0];
    const foundationPile = gameState.foundations[targetFoundation];

    const isValid = SolitaireLogic.canPlaceOnFoundation(movingCard, foundationPile);

    if (isValid) {
        let flippedCard = null;

        // Remove card from source
        if (dragState.sourcePile === 'waste') {
            gameState.waste.pop();
        } else if (dragState.sourcePile === 'foundation') {
            const sourceFoundation = dragState.sourceIndex;
            if (sourceFoundation === targetFoundation) return { success: false };
            gameState.foundations[sourceFoundation].pop();
        } else if (dragState.sourcePile === 'tableau') {
            const sourceCol = dragState.sourceIndex;
            gameState.tableau[sourceCol].pop();

            // Flip top card if it's hidden
            if (gameState.tableau[sourceCol].length > 0) {
                const topCard = gameState.tableau[sourceCol][gameState.tableau[sourceCol].length - 1];
                if (topCard.hidden) {
                    topCard.hidden = false;
                    flippedCard = topCard;
                    applyVariantScore('flip-card');
                }
            }
        }

        // Add card to foundation
        gameState.foundations[targetFoundation].push(movingCard);
        return {
            success: true,
            payload: {
                fromPile: dragState.sourcePile,
                fromColumn: dragState.sourcePile === 'tableau' ? dragState.sourceIndex : null,
                fromFoundation: dragState.sourcePile === 'foundation' ? dragState.sourceIndex : null,
                foundationIndex: targetFoundation,
                cards: [movingCard],
                flippedCard
            }
        };
    }

    return { success: false };
}

/**
 * Handle card click (for auto-move to foundation)
 */
function handleCardClick(e) {
    // If mobile controller is active, this click might be part of a tap-to-select/drop, so don't auto-move.
    // The mobile controller handles drop and will call executeMove which includes foundation moves.
    if (CommonUtils.isMobile() && dragState.mobileController && dragState.mobileController.state === "SELECTED") {
        const selectedCardEl = e.target.closest(".card");
        if (selectedCardEl) {
            const selectedCard = selectedCardEl.dataset.waste
                ? gameState.waste[gameState.waste.length - 1]
                : null;
            const selectedCol = selectedCardEl.dataset.column !== undefined
                ? parseInt(selectedCardEl.dataset.column, 10)
                : null;
            const selectedCardInCol = selectedCol !== null && gameState.tableau[selectedCol]
                ? gameState.tableau[selectedCol][parseInt(selectedCardEl.dataset.index, 10)]
                : null;
            const sourcePile = selectedCardEl.dataset.waste ? 'waste' : (selectedCol !== null ? 'tableau' : null);
            const sourceIndex = selectedCol !== null ? selectedCol : -1;
            const card = selectedCard || selectedCardInCol;
            if (sourcePile && card) {
                mobileAutoMoveTapState.key = `${sourcePile}:${sourceIndex}:${card.val}${card.suit}`;
                mobileAutoMoveTapState.at = Date.now();
            }
        }
        return; // Let the mobile controller handle it
    }

    const cardEl = e.target.closest(".card");
    if (!cardEl) return;

    let card = null;
    let sourcePile = null;
    let sourceIndex = null;

    // Determine source
    if (cardEl.dataset.waste) {
        card = gameState.waste[gameState.waste.length - 1];
        sourcePile = "waste";
    } else if (cardEl.dataset.column !== undefined) {
        const col = parseInt(cardEl.dataset.column);
        const index = parseInt(cardEl.dataset.index);
        const tableau = gameState.tableau[col];

        // Only allow clicking the top card
        if (index !== tableau.length - 1) return;

        card = tableau[index];
        sourcePile = "tableau";
        sourceIndex = col;
    } else if (cardEl.dataset.foundation !== undefined) {
        // Clicking on a foundation card should not trigger auto-move to foundation
        // but should allow pickup from foundation in mobile. For desktop, it does nothing.
        return;
    }

    if (!card) return;

    if (CommonUtils.isMobile()) {
        const now = Date.now();
        const tapKey = `${sourcePile}:${sourceIndex ?? -1}:${card.val}${card.suit}`;
        const isSecondTap = mobileAutoMoveTapState.key === tapKey
            && (now - mobileAutoMoveTapState.at) <= MOBILE_AUTO_MOVE_DOUBLE_TAP_WINDOW_MS;
        mobileAutoMoveTapState.key = tapKey;
        mobileAutoMoveTapState.at = now;
        if (!isSecondTap) {
            return;
        }
    }

    // Try to auto-move to foundation using preferred suit-order targeting.
    const targetFoundation = SolitaireLogic.findAutoFoundationTarget(card, gameState.foundations);
    if (targetFoundation === -1) return;

    // Remove from source
    if (sourcePile === "waste") {
        gameState.waste.pop();
    } else if (sourcePile === "tableau") {
        gameState.tableau[sourceIndex].pop();

        // Flip top card if hidden
        if (gameState.tableau[sourceIndex].length > 0) {
            const topCard = gameState.tableau[sourceIndex][gameState.tableau[sourceIndex].length - 1];
            if (topCard.hidden) {
                topCard.hidden = false;
                applyVariantScore("flip-card");
            }
        }
    }

    // Add to foundation
    gameState.foundations[targetFoundation].push(card);

    const moveType = sourcePile === "waste" ? "waste-to-foundation" : "tableau-to-foundation";
    applyVariantScore(moveType);
    gameState.moves++;

    CommonUtils.playSound("card");
    updateUI();
    checkWinCondition();
}

/**
 * Check if game is won
 */
function checkWinCondition() {
    if (SolitaireLogic.isGameWon(gameState.foundations)) {
        gameState.isGameWon = true;
        clearInterval(gameState.timerInterval);
        showWinOverlay();
        CommonUtils.playSound('win');
        if (klondikeStateManager) {
            klondikeStateManager.clear();
        }
    }
}

/**
 * Show win overlay
 */
function showWinOverlay() {
    const overlay = document.getElementById('win-overlay');
    document.getElementById('final-score').textContent = gameState.score;
    document.getElementById('final-time').textContent = document.getElementById('time-display').textContent;
    overlay.classList.remove('hidden');
}

/**
 * Hide win overlay
 */
function hideWinOverlay() {
    document.getElementById('win-overlay').classList.add('hidden');
}

/**
 * Auto-complete (move all possible cards to foundations)
 */
function autoComplete() {
    let movesMade = 0;
    let maxIterations = 100; // Prevent infinite loop

    while (maxIterations-- > 0) {
        const autoMoves = SolitaireLogic.getAutoMoves(gameState);

        if (autoMoves.length === 0) break;

        // Execute first auto move
        const move = autoMoves[0];

        if (move.fromPile === 'waste') {
            const card = gameState.waste.pop();
            const foundationIndex = parseInt(move.toPile.split('-')[1]);
            gameState.foundations[foundationIndex].push(card);
            applyVariantScore('waste-to-foundation');
        } else if (move.fromPile.startsWith('tableau')) {
            const col = parseInt(move.fromPile.split('-')[1]);
            const card = gameState.tableau[col].pop();
            const foundationIndex = parseInt(move.toPile.split('-')[1]);
            gameState.foundations[foundationIndex].push(card);
            applyVariantScore('tableau-to-foundation');

            // Flip top card if hidden
            if (gameState.tableau[col].length > 0) {
                const topCard = gameState.tableau[col][gameState.tableau[col].length - 1];
                if (topCard.hidden) {
                    topCard.hidden = false;
                    applyVariantScore('flip-card');
                }
            }
        }

        gameState.moves++;
        movesMade++;
        CommonUtils.playSound('card');
    }

    updateUI();
    checkWinCondition();
}

function checkCurrentKlondikeSolvability() {
    if (klondikeCheckSolvedLocked || klondikeCheckUnsolvableLocked) return;
    startKlondikeCheckBusyState();
    runKlondikeCheck('quick');
}

function runKlondikeCheck(mode) {
    const limits = getKlondikeCheckLimits(mode);
    const snapshot = createKlondikeCheckSnapshot();
    const requestId = ++klondikeCheckRequestId;
    if (typeof Worker !== 'undefined') {
        runKlondikeCheckViaWorker({
            game: 'klondike',
            snapshot,
            limits,
            requestId
        }).then((result) => {
            if (!result || requestId !== klondikeCheckRequestId) return;
            handleKlondikeCheckResult(mode, result, limits, snapshot, { hadWorker: true });
        }).catch(() => {
            runKlondikeCheckOnMainThreadWithModal(mode, snapshot, limits, requestId);
        });
        return;
    }
    runKlondikeCheckOnMainThreadWithModal(mode, snapshot, limits, requestId);
}

function runKlondikeCheckOnMainThreadWithModal(mode, snapshot, limits, requestId) {
    showKlondikeCheckModal({
        title: mode === 'attempt' ? 'Prove Solve Running' : 'Quick Check Running',
        message: 'Running on the main thread. The page may become unresponsive until the check finishes.',
        busy: true
    });
    window.setTimeout(() => {
        const fallback = runKlondikeCheckOnMainThread(snapshot, limits);
        if (!fallback || requestId !== klondikeCheckRequestId) return;
        closeKlondikeCheckModal();
        handleKlondikeCheckResult(mode, fallback, limits, snapshot, { hadWorker: false });
    }, 0);
}

function getKlondikeCheckLimits(mode) {
    const variantId = gameState.variantId || DEFAULT_VARIANT_ID;
    const perVariant = mode === 'attempt' ? KLONDIKE_ATTEMPT_CHECK_LIMITS : KLONDIKE_QUICK_CHECK_LIMITS;
    const selected = perVariant[variantId] || perVariant[DEFAULT_VARIANT_ID];
    return {
        maxStates: selected.maxStates,
        maxDurationMs: selected.maxDurationMs,
        relaxedSearch: mode === 'attempt'
    };
}

function handleKlondikeCheckResult(mode, result, limits, snapshot, context = {}) {
    const isAttempt = mode === 'attempt';
    console.log(
        `Klondike ${isAttempt ? 'Attempt' : 'Quick'} Check: solved=${result.solved}, reason=${result.reason}, statesExplored=${result.statesExplored}, durationMs=${result.durationMs}, maxStates=${limits.maxStates}, maxDurationMs=${limits.maxDurationMs}`
    );
    if (result.solved && result.reason === 'solved') {
        storeKlondikeSolution(snapshot, result);
        lockKlondikeChecksAsSolvable();
        showKlondikeCheckModal({
            title: `${isAttempt ? 'Prove Solve' : 'Quick Check'} Result`,
            message: `A solution path was found (${result.statesExplored} states explored).`,
            busy: false
        });
        return;
    }

    clearKlondikeStoredSolution();
    const isLikely = result.reason === 'likely-solved';
    if (result.provenUnsolvable === true) {
        lockKlondikeChecksAsUnsolvable();
        showKlondikeCheckModal({
            title: `${isAttempt ? 'Prove Solve' : 'Quick Check'} Result`,
            message: `No solution exists from this position (${result.statesExplored} states explored).`,
            busy: false
        });
        return;
    }

    releaseKlondikeCheckBusyState();
    if (isLikely) {
        markKlondikeCheckAsLikely();
    }
    const inconclusive = result.reason === 'state-limit'
        || result.reason === 'time-limit'
        || result.reason === 'cycle-detected';
    if (!isAttempt) {
        promptKlondikeDeepCheck(result);
        return;
    }
    const message = isLikely
        ? 'This position looks promising, but prove solve could not confirm a full winning line yet. Work the tableau more and try prove solve again.'
        : (result.reason === 'cycle-detected'
        ? 'The solver got caught in a loop. Try working the tableau more (reveal hidden cards and clear blockers), then run check again.'
        : (inconclusive
            ? 'No immediate solution was found within current limits. This does not mean the deck is unsolvable, only that the solution is not immediately obvious.'
            : `No solution was found (${result.reason}, ${result.statesExplored} states). This does not mean the deck is unsolvable, only that the solution is not immediately obvious.`));
    showKlondikeCheckModal({
        title: `${isAttempt ? 'Prove Solve' : 'Quick Check'} Result`,
        message,
        busy: false
    });
}

function createKlondikeCheckSnapshot() {
    const variant = getActiveVariantConfig();
    return {
        tableau: gameState.tableau.map(column => column.map(cloneCardForSimulation)),
        foundations: gameState.foundations.map(pile => pile.map(cloneCardForSimulation)),
        stock: gameState.stock.map(cloneCardForSimulation),
        waste: gameState.waste.map(cloneCardForSimulation),
        drawCount: gameState.drawCount,
        allowAnyCardOnEmpty: !!variant.allowAnyCardOnEmpty
    };
}

function runKlondikeCheckOnMainThread(snapshot, limits) {
    if (limits && limits.relaxedSearch) {
        return runKlondikeRelaxedCheckOnMainThread(snapshot, limits);
    }
    const state = cloneGameStateForSimulation(snapshot);
    const drawCount = Number.isFinite(snapshot.drawCount) ? snapshot.drawCount : 3;
    const variantOptions = { allowAnyCardOnEmpty: !!snapshot.allowAnyCardOnEmpty };
    const fallbackLimits = getKlondikeCheckLimits('quick');
    const maxStates = Number.isFinite(limits.maxStates) ? Math.max(1, limits.maxStates) : fallbackLimits.maxStates;
    const maxDurationMs = Number.isFinite(limits.maxDurationMs) ? Math.max(1, limits.maxDurationMs) : fallbackLimits.maxDurationMs;
    const startedAt = Date.now();
    const initialHidden = countHiddenCards(state.tableau);
    const initialFoundationCount = countFoundationCards(state.foundations);
    const startKey = normalizeKlondikeSimulationState(state);
    const seenStates = new Set([startKey]);
    const solutionMoves = [];
    const solutionStateKeys = [startKey];
    let iterations = 0;
    let cycleDetected = false;

    while (iterations < maxStates) {
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
        const moved = applySimulationAutoMoves(state);
        if (SolitaireLogic.isGameWon(state.foundations)) {
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
        if (moved) {
            solutionMoves.push({ type: 'auto-foundation' });
            const key = normalizeKlondikeSimulationState(state);
            if (seenStates.has(key)) {
                cycleDetected = true;
                break;
            }
            seenStates.add(key);
            solutionStateKeys.push(key);
            continue;
        }
        if (applySimulationTableauMove(state, variantOptions)) {
            solutionMoves.push({ type: 'tableau-to-tableau' });
            const key = normalizeKlondikeSimulationState(state);
            if (seenStates.has(key)) {
                cycleDetected = true;
                break;
            }
            seenStates.add(key);
            solutionStateKeys.push(key);
            continue;
        }
        if (applySimulationWasteToTableauMove(state, variantOptions)) {
            solutionMoves.push({ type: 'waste-to-tableau' });
            const key = normalizeKlondikeSimulationState(state);
            if (seenStates.has(key)) {
                cycleDetected = true;
                break;
            }
            seenStates.add(key);
            solutionStateKeys.push(key);
            continue;
        }
        if (state.stock.length > 0) {
            simulateDrawFromStock(state, drawCount);
            solutionMoves.push({ type: 'draw-stock', count: drawCount });
            const key = normalizeKlondikeSimulationState(state);
            if (seenStates.has(key)) {
                cycleDetected = true;
                break;
            }
            seenStates.add(key);
            solutionStateKeys.push(key);
            continue;
        }
        if (state.waste.length > 0) {
            simulateRecycleWaste(state);
            solutionMoves.push({ type: 'recycle-waste' });
            const key = normalizeKlondikeSimulationState(state);
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

    const hiddenRevealed = initialHidden - countHiddenCards(state.tableau);
    const foundationProgress = countFoundationCards(state.foundations) - initialFoundationCount;
    const likelySolvable = hiddenRevealed >= 6 || foundationProgress >= 4 || (hiddenRevealed + foundationProgress) >= 8;
    return {
        solved: likelySolvable,
        reason: likelySolvable ? 'likely-solved' : (cycleDetected ? 'cycle-detected' : (iterations >= maxStates ? 'state-limit' : 'exhausted')),
        statesExplored: iterations,
        prunedStates: 0,
        durationMs: Date.now() - startedAt,
        maxStates,
        maxDurationMs
    };
}

function runKlondikeRelaxedCheckOnMainThread(snapshot, limits) {
    const drawCount = Number.isFinite(snapshot.drawCount) ? snapshot.drawCount : 3;
    const variantOptions = { allowAnyCardOnEmpty: !!snapshot.allowAnyCardOnEmpty };
    const fallbackLimits = getKlondikeCheckLimits('attempt');
    const maxStates = Number.isFinite(limits.maxStates) ? Math.max(1, limits.maxStates) : fallbackLimits.maxStates;
    const maxDurationMs = Number.isFinite(limits.maxDurationMs) ? Math.max(1, limits.maxDurationMs) : fallbackLimits.maxDurationMs;
    const startedAt = Date.now();
    const startState = cloneGameStateForSimulation(snapshot);
    const initialHidden = countHiddenCards(startState.tableau);
    const initialFoundationCount = countFoundationCards(startState.foundations);
    const startKey = normalizeKlondikeSimulationState(startState);
    const frontier = [{
        state: startState,
        key: startKey,
        moves: [],
        stateKeys: [startKey],
        lastMove: null,
        depth: 0,
        score: scoreKlondikeSearchState(startState)
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
        const current = popBestKlondikeSearchNode(frontier);
        const knownCurrentDepth = seenStateDepth.get(current.key);
        if (knownCurrentDepth !== undefined && knownCurrentDepth < current.depth) {
            continue;
        }
        const state = cloneGameStateForSimulation(current.state);
        const moves = current.moves.slice();
        const stateKeys = current.stateKeys.slice();
        const lastMove = current.lastMove;
        const depth = current.depth;

        if (SolitaireLogic.isGameWon(state.foundations)) {
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

        const hiddenRevealed = initialHidden - countHiddenCards(state.tableau);
        const foundationProgress = countFoundationCards(state.foundations) - initialFoundationCount;
        if (hiddenRevealed > bestHiddenRevealed) bestHiddenRevealed = hiddenRevealed;
        if (foundationProgress > bestFoundationProgress) bestFoundationProgress = foundationProgress;

        const candidateMoves = [];
        candidateMoves.push(...listSimulationTableauToFoundationMoves(state));
        candidateMoves.push(...listSimulationWasteToFoundationMoves(state));
        const tableauMoves = listSimulationTableauMoves(state, variantOptions, {
            requireRevealHidden: false,
            prioritizeRevealHidden: true,
            allowSequences: true
        });
        candidateMoves.push(...tableauMoves);
        const wasteMoves = listSimulationWasteToTableauMoves(state, variantOptions);
        candidateMoves.push(...wasteMoves);
        candidateMoves.push(...listSimulationFoundationToTableauMoves(state, variantOptions));
        if (state.stock.length > 0) {
            candidateMoves.push({ type: 'draw-stock', count: drawCount });
        }
        if (state.waste.length > 0) {
            candidateMoves.push({ type: 'recycle-waste' });
        }

        for (let i = 0; i < candidateMoves.length; i++) {
            const move = candidateMoves[i];
            if (isReverseKlondikeSearchMove(lastMove, move)) {
                continue;
            }
            const nextState = cloneGameStateForSimulation(state);
            if (!applySimulationKlondikeMove(nextState, move, drawCount, variantOptions)) {
                continue;
            }
            const nextKey = normalizeKlondikeSimulationState(nextState);
            const nextDepth = depth + 1;
            const knownDepth = seenStateDepth.get(nextKey);
            if (knownDepth !== undefined && knownDepth <= nextDepth) {
                continue;
            }
            seenStateDepth.set(nextKey, nextDepth);
            frontier.push({
                state: nextState,
                key: nextKey,
                moves: moves.concat([move]),
                stateKeys: stateKeys.concat([nextKey]),
                lastMove: move,
                depth: nextDepth,
                score: scoreKlondikeSearchState(nextState)
            });
        }
    }

    const likelySolvable = bestHiddenRevealed >= 6
        || bestFoundationProgress >= 4
        || (bestHiddenRevealed + bestFoundationProgress) >= 8;
    return {
        solved: likelySolvable,
        reason: likelySolvable ? 'likely-solved' : (iterations >= maxStates ? 'state-limit' : 'exhausted'),
        statesExplored: iterations,
        prunedStates: 0,
        durationMs: Date.now() - startedAt,
        maxStates,
        maxDurationMs
    };
}

function scoreKlondikeSearchState(state) {
    const foundationCards = countFoundationCards(state.foundations);
    const hiddenCards = countHiddenCards(state.tableau);
    const emptyColumns = state.tableau.reduce((sum, pile) => sum + (pile.length === 0 ? 1 : 0), 0);
    return (foundationCards * 100) + ((28 - hiddenCards) * 14) + (emptyColumns * 8) - (state.stock.length * 0.5);
}

function popBestKlondikeSearchNode(frontier) {
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

function isReverseKlondikeSearchMove(previousMove, nextMove) {
    if (!previousMove || !nextMove) return false;
    if (previousMove.type === 'tableau-to-tableau' && nextMove.type === 'tableau-to-tableau') {
        return previousMove.sourceCol === nextMove.targetCol
            && previousMove.targetCol === nextMove.sourceCol;
    }
    if (previousMove.type === 'tableau-to-foundation' && nextMove.type === 'foundation-to-tableau') {
        return previousMove.sourceCol === nextMove.targetCol
            && previousMove.foundationIndex === nextMove.foundationIndex;
    }
    if (previousMove.type === 'foundation-to-tableau' && nextMove.type === 'tableau-to-foundation') {
        return previousMove.targetCol === nextMove.sourceCol
            && previousMove.foundationIndex === nextMove.foundationIndex;
    }
    return false;
}

function runKlondikeCheckViaWorker(payload, onStarted) {
    return new Promise((resolve, reject) => {
        if (typeof Worker === 'undefined') {
            reject(new Error('Web Worker unavailable.'));
            return;
        }
        if (!klondikeCheckWorker) {
            klondikeCheckWorker = new Worker('shared/solitaire-check-worker.js');
        }
        const worker = klondikeCheckWorker;
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
            cleanupKlondikeCheckWorker();
            reject(new Error('Klondike worker failed.'));
        };
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        try {
            worker.postMessage(payload);
        } catch (err) {
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('error', onError);
            cleanupKlondikeCheckWorker();
            reject(err instanceof Error ? err : new Error('Klondike worker failed.'));
            return;
        }
        if (typeof onStarted === 'function') {
            onStarted();
        }
    });
}

function cleanupKlondikeCheckWorker() {
    klondikeCheckRequestId++;
    if (!klondikeCheckWorker) return;
    try {
        klondikeCheckWorker.terminate();
    } catch (err) {
        // Ignore terminate failures.
    }
    klondikeCheckWorker = null;
}

function getSolitaireCheckModalApi() {
    if (typeof SolitaireCheckModal !== 'undefined') return SolitaireCheckModal;
    return null;
}

function showKlondikeCheckModal(options = {}) {
    const modal = getSolitaireCheckModalApi();
    if (!modal) return;
    modal.showInfo(options);
}

function closeKlondikeCheckModal() {
    const modal = getSolitaireCheckModalApi();
    if (!modal) return;
    modal.close();
}

function getKlondikeCheckButton() {
    return document.getElementById('klondike-check');
}

function startKlondikeCheckBusyState() {
    const button = getKlondikeCheckButton();
    if (!button) return;
    button.disabled = true;
    if (!klondikeCheckSolvedLocked && !klondikeCheckUnsolvableLocked) {
        button.classList.remove('check-solved');
        button.classList.remove('check-unsolvable');
    }
}

function releaseKlondikeCheckBusyState() {
    if (klondikeCheckSolvedLocked || klondikeCheckUnsolvableLocked) return;
    const button = getKlondikeCheckButton();
    if (!button) return;
    button.disabled = false;
    button.textContent = 'Check';
    button.classList.remove('check-solved');
    button.classList.remove('check-unsolvable');
}

function markKlondikeCheckAsLikely() {
    const button = getKlondikeCheckButton();
    if (!button) return;
    button.disabled = false;
    button.textContent = 'Likely';
    button.classList.add('check-solved');
    button.classList.remove('check-unsolvable');
}

function lockKlondikeChecksAsSolvable() {
    klondikeCheckSolvedLocked = true;
    klondikeCheckUnsolvableLocked = false;
    const button = getKlondikeCheckButton();
    if (!button) return;
    button.disabled = true;
    button.textContent = 'SOLVABLE';
    button.classList.add('check-solved');
    button.classList.remove('check-unsolvable');
}

function lockKlondikeChecksAsUnsolvable() {
    klondikeCheckSolvedLocked = false;
    klondikeCheckUnsolvableLocked = true;
    const button = getKlondikeCheckButton();
    if (!button) return;
    button.disabled = true;
    button.textContent = 'Unsolvable';
    button.classList.remove('check-solved');
    button.classList.add('check-unsolvable');
}

function resetKlondikeCheckAvailability() {
    klondikeCheckSolvedLocked = false;
    klondikeCheckUnsolvableLocked = false;
    clearKlondikeStoredSolution();
    const button = getKlondikeCheckButton();
    if (!button) return;
    button.disabled = false;
    button.textContent = 'Check';
    button.classList.remove('check-solved');
    button.classList.remove('check-unsolvable');
    closeKlondikeCheckModal();
}

function promptKlondikeDeepCheck(result) {
    const needsTableauWork = result && result.reason === 'cycle-detected';
    const likely = result && result.reason === 'likely-solved';
    const message = needsTableauWork
        ? 'The solver got stuck in a loop. Try working the tableau first (reveal hidden cards and free blocked moves), then run a deeper solve attempt.'
        : (likely
            ? 'Quick check sees promising progress, but it is not proven yet. Run Prove Solve for a stricter answer?'
            : 'Quick check found no immediate solution. Run Prove Solve?');
    const modal = getSolitaireCheckModalApi();
    if (!modal) {
        showKlondikeCheckModal({
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
            startKlondikeCheckBusyState();
            runKlondikeCheck('attempt');
        }
    });
}

function storeKlondikeSolution(snapshot, result) {
    const moves = Array.isArray(result.solutionMoves) ? result.solutionMoves.slice() : [];
    if (!moves.length) {
        klondikeStoredSolution = null;
        return;
    }
    const stateKeys = Array.isArray(result.solutionStateKeys) && result.solutionStateKeys.length
        ? result.solutionStateKeys.slice()
        : [normalizeKlondikeSimulationState(cloneGameStateForSimulation(snapshot))];
    klondikeStoredSolution = { moves, stateKeys };
}

function clearKlondikeStoredSolution() {
    klondikeStoredSolution = null;
}

function getStoredKlondikeHint() {
    if (!klondikeStoredSolution || !Array.isArray(klondikeStoredSolution.moves) || !klondikeStoredSolution.moves.length) {
        return null;
    }
    const currentKey = normalizeKlondikeSimulationState(cloneGameStateForSimulation(createKlondikeCheckSnapshot()));
    const stepIndex = klondikeStoredSolution.stateKeys.indexOf(currentKey);
    if (stepIndex < 0 || stepIndex >= klondikeStoredSolution.moves.length) return null;
    return klondikeStoredSolution.moves[stepIndex];
}

function formatKlondikeHintMove(move) {
    if (!move || !move.type) return 'Try a move that reveals a hidden card.';
    if (move.type === 'auto-foundation') return 'Move an available card to the foundation.';
    if (move.type === 'tableau-to-tableau') return 'Move a tableau stack to reveal a hidden card.';
    if (move.type === 'waste-to-tableau') return 'Move waste top card to tableau.';
    if (move.type === 'draw-stock') return 'Draw from stock.';
    if (move.type === 'recycle-waste') return 'Recycle waste into stock.';
    return 'Try the next legal forward move.';
}

function cardHintId(card) {
    if (!card) return '';
    return `${card.val || ''}${card.suit || ''}`;
}

function isReverseOfRecentKlondikeMove({ fromPile, fromIndex, move, card }) {
    if (!move || move.type !== 'tableau') return false;
    const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
    if (!lastMove || lastMove.type !== 'tableau-to-tableau' || !lastMove.payload) return false;
    if (fromPile !== 'tableau') return false;
    if (lastMove.payload.fromColumn !== move.index) return false;
    if (lastMove.payload.toColumn !== fromIndex) return false;
    const movedCards = Array.isArray(lastMove.payload.cards) ? lastMove.payload.cards : [];
    if (!movedCards.length) return true;
    const movedIds = movedCards.map(cardHintId);
    return movedIds.includes(cardHintId(card));
}

/**
 * Show hint
 */
function showHint() {
    const storedHint = getStoredKlondikeHint();
    if (storedHint) {
        CommonUtils.showTableToast(
            `Hint: ${formatKlondikeHintMove(storedHint)}`,
            { variant: 'warn', duration: 2200, containerId: 'klondike-table' }
        );
        return;
    }

    // Find a valid move
    const autoMoves = SolitaireLogic.getAutoMoves(gameState);

    if (autoMoves.length > 0) {
        CommonUtils.showTableToast(
            `Hint: Move ${autoMoves[0].card.val}${autoMoves[0].card.suit} to foundation!`,
            { variant: 'warn', duration: 2200, containerId: 'klondike-table' }
        );
        return;
    }

    // Check for tableau moves
    for (let col = 0; col < 7; col++) {
        const tableau = gameState.tableau[col];
        if (tableau.length > 0) {
            const topCard = tableau[tableau.length - 1];
            if (!topCard.hidden) {
                const validMoves = SolitaireLogic.getValidMoves(topCard, gameState, getVariantOptions());
                const filteredMoves = validMoves.filter((move) => !isReverseOfRecentKlondikeMove({
                    fromPile: 'tableau',
                    fromIndex: col,
                    move,
                    card: topCard
                }));
                const candidateMoves = filteredMoves.length > 0 ? filteredMoves : validMoves;
                if (candidateMoves.length > 0) {
                    const move = candidateMoves[0];
                    CommonUtils.showTableToast(
                        `Hint: Move ${topCard.val}${topCard.suit} to ${move.type} ${move.index + 1}`,
                        { variant: 'warn', duration: 2200, containerId: 'klondike-table' }
                    );
                    return;
                }
            }
        }
    }

    // Check waste
    if (gameState.waste.length > 0) {
        const wasteCard = gameState.waste[gameState.waste.length - 1];
        const validMoves = SolitaireLogic.getValidMoves(wasteCard, gameState, getVariantOptions());
        const filteredMoves = validMoves.filter((move) => !isReverseOfRecentKlondikeMove({
            fromPile: 'waste',
            fromIndex: -1,
            move,
            card: wasteCard
        }));
        const candidateMoves = filteredMoves.length > 0 ? filteredMoves : validMoves;
        if (candidateMoves.length > 0) {
            const move = candidateMoves[0];
            CommonUtils.showTableToast(
                `Hint: Move ${wasteCard.val}${wasteCard.suit} from waste to ${move.type} ${move.index + 1}`,
                { variant: 'warn', duration: 2200, containerId: 'klondike-table' }
            );
            return;
        }
    }

    CommonUtils.showTableToast(
        'Hint: Try drawing from the stock or recycling the waste pile!',
        { variant: 'warn', duration: 2200, containerId: 'klondike-table' }
    );
}

function showKlondikeHelp() {
    const variantId = gameState.variantId || DEFAULT_VARIANT_ID;
    const variant = getActiveVariantConfig();
    const drawCount = Number.isFinite(gameState.drawCount) ? gameState.drawCount : variant.drawCount;
    const message = [
        'Goal: Move all cards to the foundations from Ace to King by suit.',
        'Tableau: Build down in alternating colors.',
        variant.allowAnyCardOnEmpty
            ? 'Empty columns: Any card can be placed on an empty tableau column.'
            : 'Empty columns: Only Kings can be placed on an empty tableau column.',
        `Stock: Draw ${drawCount} card${drawCount === 1 ? '' : 's'} at a time.`,
        KLONDIKE_HELP_RULES[variantId] || ''
    ].filter(Boolean).join('\n');
    if (typeof SolitaireUiFeedback !== 'undefined' && typeof SolitaireUiFeedback.showHelp === 'function') {
        SolitaireUiFeedback.showHelp({ title: `${variant.label} Rules`, message });
        return;
    }
    if (typeof SolitaireUiFeedback !== 'undefined' && typeof SolitaireUiFeedback.showInfo === 'function') {
        SolitaireUiFeedback.showInfo({ title: `${variant.label} Rules`, message });
        return;
    }
    alert(`${variant.label} Rules\n\n${message}`);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // New game buttons
    document.getElementById('new-game-btn').addEventListener('click', initGame);
    document.getElementById('new-game-from-win').addEventListener('click', initGame);

    // Hint and auto-complete
    document.getElementById('hint-btn').addEventListener('click', showHint);
    document.getElementById('auto-complete-btn').addEventListener('click', autoComplete);
    const checkBtn = document.getElementById('klondike-check');
    if (checkBtn) {
        checkBtn.addEventListener('click', checkCurrentKlondikeSolvability);
    }
    const helpBtn = document.getElementById('klondike-help');
    if (helpBtn) {
        helpBtn.addEventListener('click', showKlondikeHelp);
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

    window.addEventListener('resize', scheduleTableauSizing);
    window.addEventListener('card-scale:changed', scheduleTableauSizing);

    // Draw count
    document.getElementById('draw-count-select').addEventListener('change', (e) => {
        gameState.drawCount = parseInt(e.target.value);
        updateStats();
        if (klondikeStateManager) {
            klondikeStateManager.markDirty();
        }
    });

    populateVariantSelect();

    document.getElementById('undo-btn').addEventListener('click', undoLastMove);
    attachTableauHoverHandlers();
}

/* --- Drag, hover & undo helpers --- */

function updateDragIndicators(clientX, clientY) {
    clearDropIndicators();
    if (!dragState.isDragging) return;

    const dropPoint = getDropPoint(clientX, clientY);
    const columnIndex = findTableauDropColumn(dropPoint.x, dropPoint.y);
    if (columnIndex !== null) {
        const columnEl = document.getElementById(`tableau-${columnIndex}`);
        if (columnEl) {
            columnEl.classList.add(canDropOnTableau(columnIndex) ? 'drag-over-valid' : 'drag-over-invalid');
        }
        return;
    }

    const foundationIndex = findFoundationDropPile(dropPoint.x, dropPoint.y);
    if (foundationIndex !== null) {
        const foundationEl = document.getElementById(`foundation-${foundationIndex}`);
        if (foundationEl) {
            foundationEl.classList.add(canDropOnFoundation(foundationIndex) ? 'drag-over-valid' : 'drag-over-invalid');
        }
    }
}

function canDropOnTableau(targetCol) {
    if (dragState.draggedCards.length === 0) return false;
    const movingCard = dragState.draggedCards[0];
    const targetPile = gameState.tableau[targetCol];

    if (targetPile.length === 0) {
        return canMoveToEmptyTableauForVariant(movingCard);
    }

    const topCard = targetPile[targetPile.length - 1];
    return !topCard.hidden && SolitaireLogic.canPlaceOnTableau(movingCard, topCard);
}

function canDropOnFoundation(targetFoundation) {
    if (dragState.draggedCards.length !== 1) return false;
    const movingCard = dragState.draggedCards[0];
    return SolitaireLogic.canPlaceOnFoundation(movingCard, gameState.foundations[targetFoundation]);
}

function findTableauDropColumn(clientX, clientY) {
    const offsets = getStackOffsets();
    let bestColumn = null;
    let bestCenterDistance = Infinity;
    const padding = CommonUtils.isMobile() ? MOBILE_TABLEAU_DROP_PADDING : TABLEAU_DROP_PADDING;

    document.querySelectorAll('.tableau-column').forEach(column => {
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
    return parseInt(bestColumn.id.split('-')[1], 10);
}

function findFoundationDropPile(clientX, clientY) {
    let bestPile = null;
    let bestDistance = Infinity;
    const padding = CommonUtils.isMobile() ? MOBILE_FOUNDATION_DROP_PADDING : FOUNDATION_DROP_PADDING;

    document.querySelectorAll('.foundation-pile').forEach(pile => {
        const rect = pile.getBoundingClientRect();
        const paddedRect = UIHelpers.getRectWithPadding(rect, padding);

        if (UIHelpers.isPointInRect(clientX, clientY, paddedRect)) {
            bestPile = pile;
            bestDistance = -1;
            return;
        }

        const dist = UIHelpers.distanceToRect(clientX, clientY, rect);
        if (dist < bestDistance) {
            bestDistance = dist;
            bestPile = pile;
        }
    });

    if (!bestPile) return null;
    if (bestDistance <= padding) {
        return parseInt(bestPile.id.split('-')[1], 10);
    }
    return null;
}

function clearDropIndicators() {
    document.querySelectorAll('.tableau-column, .foundation-pile').forEach(el => {
        el.classList.remove('drag-over-valid', 'drag-over-invalid');
    });
}


function attachTableauHoverHandlers() {
    document.querySelectorAll('.tableau-column').forEach(column => {
        if (column.dataset.hoverAttached === 'true') return;
        column.dataset.hoverAttached = 'true';
        column.addEventListener('pointermove', () => handleTableauColumnHover(column));
        column.addEventListener('pointerleave', () => clearHoveredCard());
    });
}

function handleTableauColumnHover(columnEl) {
    const visibleCards = columnEl.querySelectorAll('.card:not(.hidden)');
    if (visibleCards.length === 0) {
        clearHoveredCard();
        return;
    }
    const topCard = visibleCards[visibleCards.length - 1];
    setHoveredCard(topCard);
}

function setHoveredCard(cardEl) {
    if (dragState.hoveredCard === cardEl) return;
    clearHoveredCard();
    dragState.hoveredCard = cardEl;
    cardEl.classList.add('card-hovered');
}

function clearHoveredCard() {
    if (!dragState.hoveredCard) return;
    dragState.hoveredCard.classList.remove('card-hovered');
    dragState.hoveredCard = null;
}

function recordMove(moveEntry) {
    gameState.moveHistory.push(moveEntry);
    if (gameState.moveHistory.length > MAX_HISTORY) {
        gameState.moveHistory.shift();
    }
    updateUndoButtonState();
    if (klondikeStateManager) {
        klondikeStateManager.markDirty();
    }
}

function updateUndoButtonState() {
    const btn = document.getElementById('undo-btn');
    if (!btn) return;
    btn.disabled = gameState.moveHistory.length === 0;
}

function undoLastMove() {
    if (gameState.moveHistory.length === 0) return;

    const lastMove = gameState.moveHistory.pop();

    switch (lastMove.type) {
        case 'draw':
            undoDrawMove(lastMove.payload);
            break;
        case 'recycle':
            undoRecycleMove(lastMove.payload);
            break;
        case 'tableau-to-tableau':
            undoTableauToTableauMove(lastMove.payload);
            break;
        case 'waste-to-tableau':
            undoWasteToTableauMove(lastMove.payload);
            break;
        case 'tableau-to-foundation':
            undoTableauToFoundationMove(lastMove.payload);
            break;
        case 'waste-to-foundation':
            undoWasteToFoundationMove(lastMove.payload);
            break;
        case 'foundation-to-tableau':
            undoFoundationToTableauMove(lastMove.payload);
            break;
        case 'foundation-to-foundation':
            undoFoundationToFoundationMove(lastMove.payload);
            break;
        default:
            console.warn('Unexpected undo move type:', lastMove.type);
    }

    gameState.score -= lastMove.scoreDelta;
    gameState.moves = Math.max(0, gameState.moves - lastMove.movesDelta);
    gameState.isGameWon = false;
    hideWinOverlay();
    updateUI();
    updateUndoButtonState();
    if (klondikeStateManager) {
        klondikeStateManager.markDirty();
    }
}

function undoDrawMove(payload) {
    for (let i = 0; i < payload.cards.length && gameState.waste.length > 0; i++) {
        const card = gameState.waste.pop();
        card.hidden = true;
        gameState.stock.push(card);
    }
}

function undoRecycleMove(payload) {
    for (let i = 0; i < payload.cards.length && gameState.stock.length > 0; i++) {
        const card = gameState.stock.pop();
        card.hidden = false;
        gameState.waste.push(card);
    }
}

function undoTableauToTableauMove(payload) {
    const targetPile = gameState.tableau[payload.toColumn];
    const movedCards = targetPile.splice(targetPile.length - payload.cards.length);
    gameState.tableau[payload.fromColumn].push(...movedCards);
    if (payload.flippedCard) {
        payload.flippedCard.hidden = true;
    }
}

function undoWasteToTableauMove(payload) {
    const targetPile = gameState.tableau[payload.toColumn];
    const movedCard = targetPile.pop();
    movedCard.hidden = false;
    gameState.waste.push(movedCard);
}

function undoTableauToFoundationMove(payload) {
    const foundationPile = gameState.foundations[payload.foundationIndex];
    const movedCard = foundationPile.pop();
    gameState.tableau[payload.fromColumn].push(movedCard);
    if (payload.flippedCard) {
        payload.flippedCard.hidden = true;
    }
}

function undoWasteToFoundationMove(payload) {
    const foundationPile = gameState.foundations[payload.foundationIndex];
    const movedCard = foundationPile.pop();
    movedCard.hidden = false;
    gameState.waste.push(movedCard);
}

function undoFoundationToTableauMove(payload) {
    const targetPile = gameState.tableau[payload.toColumn];
    const movedCard = targetPile.pop();
    if (!movedCard) return;
    const foundationIndex = payload.fromFoundation;
    if (foundationIndex === null || foundationIndex === undefined) return;
    gameState.foundations[foundationIndex].push(movedCard);
}

function undoFoundationToFoundationMove(payload) {
    const targetPile = gameState.foundations[payload.foundationIndex];
    const movedCard = targetPile.pop();
    if (!movedCard) return;
    const sourceFoundation = payload.fromFoundation;
    if (sourceFoundation === null || sourceFoundation === undefined) return;
    gameState.foundations[sourceFoundation].push(movedCard);
}

function dealSolvableGame() {
    let staticDeadlockSkips = 0;
    for (let attempt = 1; attempt <= MAX_SOLVABLE_DEAL_ATTEMPTS; attempt++) {
        const deck = CommonUtils.createShoe(1, SUITS, VALUES);
        dealDeck(deck);

        if (isDealRapidlyInsolvable(gameState)) {
            staticDeadlockSkips++;
            continue;
        }

        if (isDealLikelySolvable(gameState)) {
            if (attempt > 1) {
                console.debug(`Klondike: solvable deal found after ${attempt} attempts.`);
            }
            console.log(`Klondike: discarded ${staticDeadlockSkips} candidate deals via rapid deadlock detection.`);
            return;
        }
    }
    console.log(`Klondike: discarded ${staticDeadlockSkips} candidate deals via rapid deadlock detection.`);
    console.warn(`Klondike: Unable to find a likely solvable deal after ${MAX_SOLVABLE_DEAL_ATTEMPTS} attempts (${staticDeadlockSkips} rejected by rapid deadlock checks).`);
}

function isDealRapidlyInsolvable(state) {
    if (!klondikeInsolvabilityDetector) return false;
    const result = klondikeInsolvabilityDetector.evaluate(state);
    return result.isLikelyInsolvable;
}

function dealDeck(deck) {
    gameState.tableau = [[], [], [], [], [], [], []];
    gameState.foundations = [[], [], [], []];
    gameState.waste = [];

    for (let col = 0; col < 7; col++) {
        for (let row = 0; row <= col; row++) {
            const card = deck.pop();
            if (row === col) {
                card.hidden = false;
            } else {
                card.hidden = true;
            }
            gameState.tableau[col].push(card);
        }
    }

    gameState.stock = deck;
}

function isDealLikelySolvable(state) {
    const clone = cloneGameStateForSimulation(state);
    return simulateSolvability(clone, state.drawCount);
}

function cloneGameStateForSimulation(state) {
    return {
        tableau: state.tableau.map(column => column.map(cloneCardForSimulation)),
        foundations: state.foundations.map(pile => pile.map(cloneCardForSimulation)),
        stock: state.stock.map(cloneCardForSimulation),
        waste: state.waste.map(cloneCardForSimulation)
    };
}

function cloneCardForSimulation(card) {
    const cloned = new Card(card.suit, card.val);
    cloned.hidden = card.hidden;
    cloned.rotation = card.rotation;
    cloned.isSplitCard = card.isSplitCard;
    return cloned;
}

function simulateSolvability(state, drawCount) {
    let iterations = 0;
    const initialHidden = countHiddenCards(state.tableau);
    const initialFoundationCount = countFoundationCards(state.foundations);
    const variantOptions = getVariantOptions();

    while (iterations < MAX_SIMULATION_ITERATIONS) {
        iterations++;

        const moved = applySimulationAutoMoves(state);
        if (SolitaireLogic.isGameWon(state.foundations)) return true;
        if (moved) continue;

        if (applySimulationTableauMove(state, variantOptions)) {
            continue;
        }

        if (applySimulationWasteToTableauMove(state, variantOptions)) {
            continue;
        }

        if (state.stock.length > 0) {
            simulateDrawFromStock(state, drawCount);
            continue;
        }

        if (state.waste.length > 0) {
            simulateRecycleWaste(state);
            continue;
        }

        break;
    }

    if (SolitaireLogic.isGameWon(state.foundations)) return true;
    const hiddenRevealed = initialHidden - countHiddenCards(state.tableau);
    const foundationProgress = countFoundationCards(state.foundations) - initialFoundationCount;
    return hiddenRevealed >= 6 || foundationProgress >= 4 || (hiddenRevealed + foundationProgress) >= 8;
}

function applySimulationAutoMoves(state) {
    let moved = false;

    while (true) {
        const autoMoves = SolitaireLogic.getAutoMoves(state);
        if (autoMoves.length === 0) break;
        applySimulationAutoMove(state, autoMoves[0]);
        moved = true;
    }

    return moved;
}

function applySimulationAutoMove(state, move) {
    const foundationIndex = parseInt(move.toPile.split('-')[1], 10);
    let card = null;

    if (move.fromPile === 'waste') {
        card = state.waste.pop();
    } else if (move.fromPile.startsWith('tableau')) {
        const sourceCol = parseInt(move.fromPile.split('-')[1], 10);
        card = state.tableau[sourceCol].pop();
        if (state.tableau[sourceCol].length > 0) {
            const topCard = state.tableau[sourceCol][state.tableau[sourceCol].length - 1];
            if (topCard.hidden) topCard.hidden = false;
        }
    }

    if (card) {
        state.foundations[foundationIndex].push(card);
    }
}

function simulateDrawFromStock(state, drawCount) {
    const cardsToDraw = Math.min(drawCount, state.stock.length);
    for (let i = 0; i < cardsToDraw; i++) {
        const card = state.stock.pop();
        card.hidden = false;
        state.waste.push(card);
    }
}

function simulateRecycleWaste(state) {
    while (state.waste.length > 0) {
        const card = state.waste.pop();
        card.hidden = true;
        state.stock.push(card);
    }
}

function countHiddenCards(tableau) {
    return tableau.reduce((sum, column) => {
        return sum + column.reduce((colSum, card) => colSum + (card.hidden ? 1 : 0), 0);
    }, 0);
}

function countFoundationCards(foundations) {
    return foundations.reduce((sum, pile) => sum + pile.length, 0);
}

function serializeSimulationCard(card, includeHidden) {
    if (!card) return '__';
    const rank = Number.isFinite(card.rank) ? card.rank : String(card.rank || '?');
    const suit = card.suit || '?';
    if (!includeHidden) return `${rank}${suit}`;
    return `${rank}${suit}${card.hidden ? 'h' : 'u'}`;
}

function serializeSimulationPile(pile, includeHidden) {
    if (!pile || pile.length === 0) return '';
    return pile.map((card) => serializeSimulationCard(card, includeHidden)).join(',');
}

function normalizeKlondikeSimulationState(state) {
    return state.tableau.map((col) => serializeSimulationPile(col, true)).join('|')
        + '#'
        + state.foundations.map((pile) => serializeSimulationPile(pile, false)).join('|')
        + '#'
        + serializeSimulationPile(state.stock, true)
        + '#'
        + serializeSimulationPile(state.waste, false);
}

function isMovableSimulationTableauSequence(pile, startIndex) {
    if (!pile || startIndex < 0 || startIndex >= pile.length) return false;
    for (let i = startIndex; i < pile.length; i++) {
        if (!pile[i] || pile[i].hidden) return false;
    }
    for (let i = startIndex; i < pile.length - 1; i++) {
        const current = pile[i];
        const next = pile[i + 1];
        if (!SolitaireLogic.canPlaceOnTableau(next, current)) return false;
    }
    return true;
}

function listSimulationTableauMoves(state, options, config = {}) {
    const requireRevealHidden = config.requireRevealHidden !== false;
    const prioritizeRevealHidden = config.prioritizeRevealHidden !== false;
    const allowSequences = !!config.allowSequences;
    const moves = [];
    for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol++) {
        const sourcePile = state.tableau[sourceCol];
        if (sourcePile.length === 0) continue;
        const startIndexes = allowSequences
            ? Array.from({ length: sourcePile.length }, (_, idx) => idx)
            : [sourcePile.length - 1];
        for (let s = 0; s < startIndexes.length; s++) {
            const startIndex = startIndexes[s];
            if (!isMovableSimulationTableauSequence(sourcePile, startIndex)) continue;
            const movingCard = sourcePile[startIndex];
            const movingCount = sourcePile.length - startIndex;
            const wouldRevealHidden = startIndex > 0 && sourcePile[startIndex - 1].hidden;
            if (requireRevealHidden && !wouldRevealHidden) continue;
            for (let targetCol = 0; targetCol < state.tableau.length; targetCol++) {
                if (targetCol === sourceCol) continue;
                const targetPile = state.tableau[targetCol];
                let isValid = false;
                if (targetPile.length === 0) {
                    isValid = SolitaireLogic.canMoveToEmptyTableau(movingCard, options);
                } else {
                    const topCard = targetPile[targetPile.length - 1];
                    if (!topCard.hidden) {
                        isValid = SolitaireLogic.canPlaceOnTableau(movingCard, topCard);
                    }
                }
                if (!isValid) continue;
                moves.push({
                    type: 'tableau-to-tableau',
                    sourceCol,
                    targetCol,
                    startIndex,
                    count: movingCount,
                    revealsHidden: wouldRevealHidden
                });
            }
        }
    }
    if (prioritizeRevealHidden) {
        moves.sort((a, b) => Number(b.revealsHidden) - Number(a.revealsHidden));
    }
    return moves;
}

function listSimulationWasteToTableauMoves(state, options) {
    if (state.waste.length === 0) return [];
    const movingCard = state.waste[state.waste.length - 1];
    const moves = [];
    for (let targetCol = 0; targetCol < state.tableau.length; targetCol++) {
        const targetPile = state.tableau[targetCol];
        let isValid = false;
        if (targetPile.length === 0) {
            isValid = SolitaireLogic.canMoveToEmptyTableau(movingCard, options);
        } else {
            const topCard = targetPile[targetPile.length - 1];
            if (!topCard.hidden) {
                isValid = SolitaireLogic.canPlaceOnTableau(movingCard, topCard);
            }
        }
        if (isValid) {
            moves.push({ type: 'waste-to-tableau', targetCol });
        }
    }
    return moves;
}

function listSimulationTableauToFoundationMoves(state) {
    const moves = [];
    for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol++) {
        const pile = state.tableau[sourceCol];
        if (!pile || pile.length === 0) continue;
        const card = pile[pile.length - 1];
        if (!card || card.hidden) continue;
        for (let foundationIndex = 0; foundationIndex < state.foundations.length; foundationIndex++) {
            if (SolitaireLogic.canPlaceOnFoundation(card, state.foundations[foundationIndex])) {
                moves.push({ type: 'tableau-to-foundation', sourceCol, foundationIndex });
            }
        }
    }
    return moves;
}

function listSimulationWasteToFoundationMoves(state) {
    if (!state.waste || state.waste.length === 0) return [];
    const card = state.waste[state.waste.length - 1];
    const moves = [];
    for (let foundationIndex = 0; foundationIndex < state.foundations.length; foundationIndex++) {
        if (SolitaireLogic.canPlaceOnFoundation(card, state.foundations[foundationIndex])) {
            moves.push({ type: 'waste-to-foundation', foundationIndex });
        }
    }
    return moves;
}

function listSimulationFoundationToTableauMoves(state, options) {
    const moves = [];
    for (let foundationIndex = 0; foundationIndex < state.foundations.length; foundationIndex++) {
        const foundation = state.foundations[foundationIndex];
        if (!foundation || foundation.length === 0) continue;
        const card = foundation[foundation.length - 1];
        for (let targetCol = 0; targetCol < state.tableau.length; targetCol++) {
            const targetPile = state.tableau[targetCol];
            let isValid = false;
            if (targetPile.length === 0) {
                isValid = SolitaireLogic.canMoveToEmptyTableau(card, options);
            } else {
                const topCard = targetPile[targetPile.length - 1];
                if (!topCard.hidden) {
                    isValid = SolitaireLogic.canPlaceOnTableau(card, topCard);
                }
            }
            if (isValid) {
                moves.push({ type: 'foundation-to-tableau', foundationIndex, targetCol });
            }
        }
    }
    return moves;
}

function applySimulationTableauMoveBySpec(state, move) {
    const sourcePile = state.tableau[move.sourceCol];
    const targetPile = state.tableau[move.targetCol];
    if (!sourcePile || !targetPile || sourcePile.length === 0) return false;
    const startIndex = Number.isFinite(move.startIndex) ? move.startIndex : sourcePile.length - 1;
    const count = Number.isFinite(move.count) ? move.count : (sourcePile.length - startIndex);
    const movingCards = sourcePile.slice(startIndex);
    if (!movingCards.length || movingCards.length !== count) return false;
    sourcePile.splice(startIndex, count);
    targetPile.push(...movingCards);
    const newTop = sourcePile[sourcePile.length - 1];
    if (newTop && newTop.hidden) {
        newTop.hidden = false;
    }
    return true;
}

function applySimulationWasteToTableauMoveBySpec(state, move) {
    if (state.waste.length === 0) return false;
    const targetPile = state.tableau[move.targetCol];
    if (!targetPile) return false;
    targetPile.push(state.waste.pop());
    return true;
}

function applySimulationKlondikeMove(state, move, drawCount, options) {
    if (!move) return false;
    if (move.type === 'tableau-to-tableau') {
        return applySimulationTableauMoveBySpec(state, move);
    }
    if (move.type === 'tableau-to-foundation') {
        const sourcePile = state.tableau[move.sourceCol];
        if (!sourcePile || sourcePile.length === 0) return false;
        const card = sourcePile.pop();
        if (!card) return false;
        state.foundations[move.foundationIndex].push(card);
        const newTop = sourcePile[sourcePile.length - 1];
        if (newTop && newTop.hidden) newTop.hidden = false;
        return true;
    }
    if (move.type === 'waste-to-foundation') {
        if (!state.waste || state.waste.length === 0) return false;
        const card = state.waste.pop();
        if (!card) return false;
        state.foundations[move.foundationIndex].push(card);
        return true;
    }
    if (move.type === 'foundation-to-tableau') {
        const foundation = state.foundations[move.foundationIndex];
        const targetPile = state.tableau[move.targetCol];
        if (!foundation || foundation.length === 0 || !targetPile) return false;
        targetPile.push(foundation.pop());
        return true;
    }
    if (move.type === 'waste-to-tableau') {
        return applySimulationWasteToTableauMoveBySpec(state, move);
    }
    if (move.type === 'draw-stock') {
        if (state.stock.length === 0) return false;
        simulateDrawFromStock(state, drawCount);
        return true;
    }
    if (move.type === 'recycle-waste') {
        if (state.waste.length === 0) return false;
        simulateRecycleWaste(state);
        return true;
    }
    if (move.type === 'auto-foundation') {
        return applySimulationAutoMoves(state);
    }
    return false;
}

function applySimulationTableauMove(state, options) {
    const moves = listSimulationTableauMoves(state, options, {
        requireRevealHidden: true,
        prioritizeRevealHidden: true
    });
    if (!moves.length) return false;
    return applySimulationTableauMoveBySpec(state, moves[0]);
}

function applySimulationWasteToTableauMove(state, options) {
    const moves = listSimulationWasteToTableauMoves(state, options);
    if (!moves.length) return false;
    return applySimulationWasteToTableauMoveBySpec(state, moves[0]);
}

function getActiveVariantConfig() {
    return KLONDIKE_VARIANTS[gameState.variantId] || KLONDIKE_VARIANTS[DEFAULT_VARIANT_ID];
}

function getVariantOptions() {
    const variant = getActiveVariantConfig();
    return {
        allowAnyCardOnEmpty: !!variant.allowAnyCardOnEmpty
    };
}

function applyVariantConfig() {
    const variant = getActiveVariantConfig();
    gameState.variantConfig = variant;

    if (variant.lockDrawCount) {
        gameState.drawCount = variant.drawCount;
    } else if (!gameState.drawCount) {
        gameState.drawCount = variant.drawCount;
    }

    const drawSelect = document.getElementById('draw-count-select');
    if (drawSelect) {
        drawSelect.value = gameState.drawCount.toString();
        drawSelect.disabled = !!variant.lockDrawCount;
    }

    gameState.score = variant.startScore || 0;
    updateVariantDescription(variant.description);
}

function updateVariantDescription(text) {
    const descEl = document.getElementById('variant-description');
    if (descEl) {
        descEl.textContent = text || '';
    }
}

function populateVariantSelect() {
    const select = document.getElementById('variant-select');
    if (!select) return;

    select.innerHTML = '';
    KLONDIKE_VARIANT_ORDER.forEach(variantId => {
        const variant = KLONDIKE_VARIANTS[variantId];
        if (!variant) return;
        const option = document.createElement('option');
        option.value = variant.id;
        option.textContent = variant.label;
        select.appendChild(option);
    });

    select.value = gameState.variantId;

    select.addEventListener('change', (event) => {
        handleVariantChange(event.target.value);
    });
}

function handleVariantChange(variantId) {
    if (!KLONDIKE_VARIANTS[variantId]) return;
    gameState.variantId = variantId;
    const select = document.getElementById('variant-select');
    if (select) {
        select.value = variantId;
    }
    initGame();
}

function getVariantScore(moveType) {
    const variant = getActiveVariantConfig();
    const baseScore = SolitaireLogic.scoreMove(moveType);
    if (variant.scoreOverrides && Object.prototype.hasOwnProperty.call(variant.scoreOverrides, moveType)) {
        return variant.scoreOverrides[moveType];
    }
    return baseScore;
}

function applyVariantScore(moveType) {
    const delta = getVariantScore(moveType);
    gameState.score += delta;
    return delta;
}

function canMoveToEmptyTableauForVariant(card) {
    const variant = getActiveVariantConfig();
    if (variant.allowAnyCardOnEmpty) {
        return !!card;
    }
    return SolitaireLogic.canMoveToEmptyTableau(card);
}
