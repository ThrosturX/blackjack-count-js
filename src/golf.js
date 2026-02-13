/**
 * Golf Solitaire Game Controller
 */

// Import card constants
const { SUITS, VALUES } = (typeof Card !== 'undefined') ? Card : { SUITS: ['♥', '♦', '♣', '♠'], VALUES: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] };

// Import game logic
const GolfLogic = (typeof module !== 'undefined' && module.exports) ? require('./golf-logic') : window.GolfLogic;

// Import shared utilities for drag and drop
const UIHelpers = (typeof module !== 'undefined' && module.exports) ? require('./shared/ui-helpers') : window.UIHelpers;
const MobileSolitaireController = (typeof module !== 'undefined' && module.exports) ? require('./shared/mobile-controller') : window.MobileSolitaireController;

const golfSoundFiles = {
    card: ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav'],
    win: ['win.wav'],
    shuffle: ['shuffle.wav']
};

const GOLF_TABLEAU_COLS = 7;
const GOLF_TABLEAU_ROWS = 5;
const MAX_HISTORY = 200;

// Drag state / UI tuning
const DRAG_MOVE_THRESHOLD = 6;
const CARD_HEIGHT = 100; // Assuming standard card height
const STACK_OFFSET_Y = 25;
const STACK_OFFSET_X = 2.5;
const TABLEAU_DROP_PADDING = 40;
const FOUNDATION_DROP_PADDING = 30;
const MOBILE_TABLEAU_DROP_PADDING = 16;
const MOBILE_FOUNDATION_DROP_PADDING = 16;
const MOBILE_AUTO_MOVE_DOUBLE_TAP_WINDOW_MS = 380;
const BASE_TABLEAU_GAP = 15;
const MIN_TABLEAU_GAP = 4;

// Game state
const golfState = {
    tableau: [],
    stock: [],
    waste: [],
    foundation: [],
    score: 0,
    moves: 0,
    startTime: null,
    timerInterval: null,
    moveHistory: [],
    isGameWon: false,
};

let golfStateManager = null;

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
    mobileController: null,
};
const mobileAutoMoveTapState = {
    key: '',
    at: 0,
};

function getGolfRuleSetKey() {
    return 'standard';
}

function syncGolfHighScore() {
    const highScoreEl = document.getElementById('golf-high-score');
    if (!highScoreEl) return;
    // Golf score is typically lowest possible, so we compare differently
    const currentHighScore = CommonUtils.getHighScore('golf', getGolfRuleSetKey());
    let newHighScore = currentHighScore;
    if (golfState.isGameWon && (currentHighScore === 0 || golfState.score < currentHighScore)) {
        newHighScore = golfState.score;
        CommonUtils.saveHighScore('golf', getGolfRuleSetKey(), newHighScore);
    }
    highScoreEl.textContent = newHighScore === 0 ? '-' : newHighScore;
}

document.addEventListener('DOMContentLoaded', () => {
    CommonUtils.preloadAudio(golfSoundFiles);
    setupGolfEventListeners();
    CommonUtils.initCardScaleControls('golf-card-scale', 'golf-card-scale-value');
    golfStateManager = new CommonUtils.StateManager({
        gameId: 'golf',
        getState: getGolfSaveState,
        setState: restoreGolfState,
        isWon: () => golfState.isGameWon
    });
    const restored = golfStateManager.load();
    if (!restored) {
        initGolfGame();
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
            const cardIndex = parseInt(el.dataset.index, 10);
            const col = parseInt(el.dataset.column, 10);
            const column = golfState.tableau[col];
            const card = column ? column[cardIndex] : null;
            return card && cardIndex === column.length - 1; // Only top card of tableau is movable
        },
        getSequence: (el) => {
            if (el.dataset.waste) {
                return [golfState.waste[golfState.waste.length - 1]];
            } else {
                const col = parseInt(el.dataset.column, 10);
                const index = parseInt(el.dataset.index, 10);
                return [golfState.tableau[col][index]];
            }
        },
        getSource: (el) => {
            if (el.dataset.waste) return { type: 'waste' };
            return { type: 'tableau', index: parseInt(el.dataset.column, 10) };
        },
        getElements: (el) => collectDraggedElements(el),
        findDropTarget: (x, y) => {
            const directTarget = UIHelpers.getTargetFromPoint(x, y, [
                {
                    selector: '.foundation-pile',
                    resolve: (el) => ({ type: 'foundation', index: 0 }) // Only one foundation pile
                },
                {
                    selector: '.tableau-column',
                    resolve: (el) => ({ type: 'tableau', index: parseInt(el.id.split('-')[1], 10) })
                }
            ]);
            if (directTarget) return directTarget;

            const foundationEl = document.getElementById('golf-foundation');
            const foundationRect = foundationEl ? foundationEl.getBoundingClientRect() : null;

            if (foundationRect && UIHelpers.isPointInRect(x, y, UIHelpers.getRectWithPadding(foundationRect, FOUNDATION_DROP_PADDING))) {
                return { type: 'foundation', index: 0 };
            }
            return null;
        },
        isValidMove: (source, target) => {
            dragState.draggedCards = dragState.mobileController.selectedData.cards;
            dragState.sourcePile = source.type;
            dragState.sourceIndex = source.index;

            let valid = false;
            if (target.type === 'foundation') {
                valid = canDropOnFoundation();
            }

            dragState.draggedCards = [];
            dragState.sourcePile = null;
            dragState.sourceIndex = null;
            return valid;
        },
        executeMove: (source, target) => {
            dragState.draggedCards = dragState.mobileController.selectedData.cards;
            dragState.sourcePile = source.type;
            dragState.sourceIndex = source.index;

            let targetEl = null;
            if (target.type === 'foundation') {
                targetEl = document.getElementById('golf-foundation');
            }

            if (targetEl) {
                const rect = targetEl.getBoundingClientRect();
                const clientX = rect.left + rect.width / 2;
                const clientY = rect.top + rect.height / 2;

                finishDrag(clientX, clientY);
            } else {
                resetDragState();
                updateUI();
            }
        }
    });

    if (CommonUtils.isMobile() && dragState.mobileController) {
        const table = document.getElementById('golf-table');
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

function initGolfGame() {
    ensureMobileController();

    golfState.tableau = [];
    golfState.stock = [];
    golfState.waste = [];
    golfState.foundation = []; // Changed to array
    golfState.score = 0;
    golfState.moves = 0;
    golfState.isGameWon = false;
    golfState.moveHistory = [];

    if (golfState.timerInterval) {
        clearInterval(golfState.timerInterval);
    }
    golfState.startTime = Date.now();

    dealGolfLayout();
    startTimer();
    updateUI();
    hideWinOverlay();
    updateUndoButtonState();
    CommonUtils.playSound('shuffle');
    if (golfStateManager) {
        golfStateManager.markDirty();
    }
}

function startTimer() {
    golfState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - golfState.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('golf-time').textContent =
            `${minutes}:${seconds.toString().padStart(2, '0')}`; // ID updated to golf-time
    }, 1000);
}

function getElapsedSeconds(startTime) {
    if (!Number.isFinite(startTime)) return 0;
    return Math.max(0, Math.floor((Date.now() - startTime) / 1000));
}

function getGolfSaveState() {
    return {
        tableau: golfState.tableau,
        stock: golfState.stock,
        waste: golfState.waste,
        foundation: golfState.foundation,
        score: golfState.score,
        moves: golfState.moves,
        moveHistory: golfState.moveHistory,
        elapsedSeconds: getElapsedSeconds(golfState.startTime),
        isGameWon: golfState.isGameWon
    };
}

function reviveGolfCard(card) {
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

function restoreGolfState(saved) {
    if (!saved || typeof saved !== 'object') return;
    ensureMobileController();

    golfState.tableau = Array.isArray(saved.tableau)
        ? saved.tableau.map((column) => (Array.isArray(column) ? column.map((card) => reviveGolfCard(card)) : []))
        : [];
    golfState.stock = Array.isArray(saved.stock) ? saved.stock.map((card) => reviveGolfCard(card)) : [];
    golfState.waste = Array.isArray(saved.waste) ? saved.waste.map((card) => reviveGolfCard(card)) : [];
    golfState.foundation = Array.isArray(saved.foundation) ? saved.foundation.map((card) => reviveGolfCard(card)) : [];
    golfState.score = Number.isFinite(saved.score) ? saved.score : 0;
    golfState.moves = Number.isFinite(saved.moves) ? saved.moves : 0;
    golfState.moveHistory = Array.isArray(saved.moveHistory)
        ? saved.moveHistory.map((entry) => (
            typeof CommonUtils !== 'undefined' && typeof CommonUtils.hydrateSavedValue === 'function'
                ? CommonUtils.hydrateSavedValue(entry)
                : entry
        ))
        : [];
    golfState.isGameWon = false;

    if (golfState.timerInterval) {
        clearInterval(golfState.timerInterval);
    }
    const elapsed = Number.isFinite(saved.elapsedSeconds) ? saved.elapsedSeconds : 0;
    golfState.startTime = Date.now() - elapsed * 1000;
    startTimer();

    updateUI();
    hideWinOverlay();
    updateUndoButtonState();
}

function dealGolfLayout() {
    const deck = CommonUtils.createShoe(1, SUITS, VALUES);
    golfState.tableau = [];
    golfState.stock = [];
    golfState.waste = [];
    golfState.foundation = [];

    // Deal tableau
    for (let col = 0; col < GOLF_TABLEAU_COLS; col++) {
        const column = [];
        for (let row = 0; row < GOLF_TABLEAU_ROWS; row++) {
            const card = deck.pop();
            card.hidden = false;
            column.push(card);
        }
        golfState.tableau.push(column);
    }

    // Deal first card to foundation
    if (deck.length > 0) {
        const card = deck.pop();
        card.hidden = false;
        golfState.foundation.push(card);
    }

    // Remaining cards go to stock
    golfState.stock = deck;
}

/**
 * Update the entire UI
 */
const scheduleTableauSizing = CommonUtils.createRafScheduler(ensureTableauSizing);

function updateUI() {
    const scrollContainer = document.getElementById('golf-scroll');
    const tableauArea = document.getElementById('golf-tableau-area');
    const previousContainerScrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
    const previousTableauScrollLeft = tableauArea ? tableauArea.scrollLeft : 0;

    updateTableau();
    updateFoundation();
    updateStock();
    updateWaste();
    updateStats();
    scheduleTableauSizing();

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
}

function getMaxTableauLength() {
    return golfState.tableau.reduce((max, column) => Math.max(max, column.length), 0);
}

function getStackOffsets() {
    return {
        y: CommonUtils.getSolitaireStackOffset(STACK_OFFSET_Y, { minFactor: 0.42 }),
        x: CommonUtils.getSolitaireStackOffset(STACK_OFFSET_X, { min: 1, max: STACK_OFFSET_X })
    };
}

function ensureTableauSizing() {
    applyAdaptiveTableauGap();
    const offsets = getStackOffsets();
    const maxCards = Math.max(GOLF_TABLEAU_ROWS, getMaxTableauLength());
    const stackHeight = CommonUtils.getStackHeight(maxCards, offsets.y);
    CommonUtils.ensureTableauMinHeight({
        table: 'golf-table',
        topRow: 'golf-top-row',
        stackOffset: offsets.y,
        maxCards
    });
    const tableauArea = document.getElementById('golf-tableau-area');
    if (tableauArea) {
        tableauArea.style.minHeight = `${Math.ceil(stackHeight)}px`;
    }
    document.querySelectorAll('.tableau-column').forEach(column => {
        column.style.minHeight = `${Math.ceil(stackHeight)}px`;
    });
    CommonUtils.ensureScrollableWidth({
        table: 'golf-table',
        wrapper: 'golf-scroll',
        contentSelectors: ['#golf-top-row', '#golf-tableau-area']
    });
}

function applyAdaptiveTableauGap() {
    const tableEl = document.getElementById('golf-table');
    const wrapperEl = document.getElementById('golf-scroll');
    const tableauEl = document.getElementById('golf-tableau-area');
    if (!tableEl || !wrapperEl || !tableauEl) return;

    const scale = CommonUtils.getUiScaleValue();
    const baseGap = CommonUtils.getSolitaireStackOffset(BASE_TABLEAU_GAP, {
        scale,
        min: MIN_TABLEAU_GAP,
        max: BASE_TABLEAU_GAP
    });
    const currentGap = parseFloat(getComputedStyle(tableauEl).columnGap || getComputedStyle(tableauEl).gap) || baseGap;
    const availableWidth = wrapperEl.getBoundingClientRect().width || 0;
    const gapSlots = GOLF_TABLEAU_COLS - 1;
    const requiredAtBase = tableauEl.scrollWidth + Math.max(0, (baseGap - currentGap) * gapSlots);
    let overflow = Math.max(0, requiredAtBase - availableWidth);
    const nextGap = CommonUtils.consumeOverflowWithSpacing(
        overflow,
        baseGap,
        MIN_TABLEAU_GAP,
        gapSlots
    ).value;

    tableEl.style.setProperty('--golf-tableau-gap', `${nextGap}px`);
}

function updateStock() {
    const stockEl = document.getElementById('golf-stock');
    if (!stockEl) return;
    stockEl.innerHTML = '';

    if (golfState.stock.length > 0) {
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
    const wasteEl = document.getElementById('golf-waste');
    if (!wasteEl) return;
    wasteEl.innerHTML = '';

    if (golfState.waste.length > 0) {
        const card = golfState.waste[golfState.waste.length - 1];
        const cardEl = CommonUtils.createCardEl(card);
        cardEl.style.cursor = 'pointer';
        if (!CommonUtils.isMobile() || !dragState.mobileController) {
            cardEl.addEventListener('pointerdown', handlePointerDown);
        }
        cardEl.addEventListener('click', handleCardClick);
        wasteEl.appendChild(cardEl);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'pile-placeholder';
        placeholder.textContent = 'Waste';
        wasteEl.appendChild(placeholder);
    }
}

function updateFoundation() {
    const foundationEl = document.getElementById('golf-foundation');
    if (!foundationEl) return;
    foundationEl.innerHTML = '';

    if (golfState.foundation.length > 0) {
        const card = golfState.foundation[golfState.foundation.length - 1];
        const cardEl = CommonUtils.createCardEl(card);
        cardEl.dataset.foundation = 'true';
        if (!CommonUtils.isMobile() || !dragState.mobileController) {
            cardEl.addEventListener('pointerdown', handlePointerDown);
        }
        cardEl.addEventListener('click', handleCardClick);
        foundationEl.appendChild(cardEl);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'pile-placeholder';
        placeholder.textContent = 'Foundation';
        foundationEl.appendChild(placeholder);
    }
}

function updateTableau() {
    const offsets = getStackOffsets();
    for (let col = 0; col < GOLF_TABLEAU_COLS; col++) {
        const columnEl = document.getElementById(`golf-column-${col}`);
        columnEl.innerHTML = '';
        const fragment = document.createDocumentFragment();

        const column = golfState.tableau[col] || [];
        column.forEach((card, index) => {
            const cardEl = CommonUtils.createCardEl(card);
            cardEl.style.position = 'absolute';
            cardEl.style.top = `${index * offsets.y}px`;
            cardEl.style.left = `${index * offsets.x}px`;
            cardEl.dataset.column = col;
            cardEl.dataset.index = index;

            // Only allow interaction with face-up cards (which are all cards in Golf)
            if (!card.hidden) {
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

function updateStats() {
    document.getElementById('golf-moves').textContent = golfState.moves;
    document.getElementById('golf-score').textContent = golfState.score;
    syncGolfHighScore();
}

function drawFromStock() {
    if (golfState.stock.length === 0) return;

    const card = golfState.stock.pop();
    card.hidden = false;
    golfState.waste.push(card);
    golfState.moves++;

    recordMove({
        type: 'draw-stock',
        payload: { card },
        scoreDelta: GolfLogic.scoreMove('draw-stock'),
        movesDelta: 1,
    });

    CommonUtils.playSound('card');
    updateUI();
}

// Drag and Drop Functions (from Klondike, adapted for Golf)

function handlePointerDown(e) {
    if (e.button !== 0) return;

    if (CommonUtils.isMobile() && dragState.mobileController) {
        if (dragState.mobileController.handlePointerDown(e)) {
            return;
        }
    }

    const cardEl = e.target.closest(".card");
    if (!cardEl) return;

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
        const card = golfState.waste[golfState.waste.length - 1];
        dragState.draggedCards = [card];
        dragState.sourcePile = 'waste';
        dragState.sourceIndex = golfState.waste.length - 1;
    } else if (cardEl.dataset.foundation) {
        const card = golfState.foundation[golfState.foundation.length - 1];
        dragState.draggedCards = card ? [card] : [];
        dragState.sourcePile = 'foundation';
        dragState.sourceIndex = 0; // Only one foundation pile
    } else {
        const col = parseInt(cardEl.dataset.column, 10);
        const index = parseInt(cardEl.dataset.index, 10);
        dragState.draggedCards = [golfState.tableau[col][index]];
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
    if (cardEl.dataset.waste || cardEl.dataset.foundation) {
        return [cardEl];
    }

    const columnEl = document.getElementById(`golf-column-${cardEl.dataset.column}`);
    if (!columnEl) return [];

    // For Golf, only the top card is draggable from tableau
    return [cardEl];
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
    layer.style.height = `${CARD_HEIGHT}px`; // Only one card is dragged at a time

    dragState.draggedElements.forEach((el, idx) => {
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.top = '0';
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
            selector: '.foundation-pile',
            resolve: (el) => ({ type: 'foundation', index: 0 }) // Only one foundation pile
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
    const foundationIndex = findFoundationDropPile(clientX, clientY);
    if (foundationIndex !== null) {
        addCandidate({ type: 'foundation', index: foundationIndex });
    }
    return candidates;
}

function finishDrag(clientX, clientY) {
    const scoreBeforeDrag = golfState.score;
    const movesBeforeDrag = golfState.moves;
    let movePayload = null;
    let moveType = '';
    let moveResult = { success: false };

    const dropPoint = getDropPoint(clientX, clientY);
    const targetCandidates = buildDropTargetCandidates(dropPoint.x, dropPoint.y);
    for (const target of targetCandidates) {
        if (target.type === 'foundation') {
            moveResult = attemptFoundationMove();
            if (!moveResult.success) continue;
            if (dragState.sourcePile === 'waste') {
                moveType = 'waste-to-foundation';
            } else if (dragState.sourcePile === 'tableau') {
                moveType = 'tableau-to-foundation';
            }
            movePayload = moveResult.payload;
            break;
        }
    }

    cleanupDragVisuals();

    if (moveResult.success) {
        golfState.score += GolfLogic.scoreMove(moveType);
        golfState.moves++;
        const scoreDelta = golfState.score - scoreBeforeDrag;
        recordMove({
            type: moveType,
            payload: movePayload,
            scoreDelta,
            movesDelta: golfState.moves - movesBeforeDrag
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

function attemptFoundationMove() {
    if (dragState.draggedCards.length !== 1) return { success: false };

    const movingCard = dragState.draggedCards[0];
    const foundationPile = golfState.foundation;

    const isValid = GolfLogic.canPlaceOnFoundation(movingCard, foundationPile[foundationPile.length - 1]);

    if (isValid) {
        // Remove card from source
        if (dragState.sourcePile === 'waste') {
            golfState.waste.pop();
        } else if (dragState.sourcePile === 'tableau') {
            const sourceCol = dragState.sourceIndex;
            golfState.tableau[sourceCol].pop();
        }

        // Add card to foundation
        golfState.foundation.push(movingCard);
        return {
            success: true,
            payload: {
                fromPile: dragState.sourcePile,
                fromColumn: dragState.sourcePile === 'tableau' ? dragState.sourceIndex : null,
                cards: [movingCard],
            }
        };
    }

    return { success: false };
}

function handleCardClick(e) {
    if (CommonUtils.isMobile() && dragState.mobileController && dragState.mobileController.state === "SELECTED") {
        const selectedCardEl = e.target.closest(".card");
        if (selectedCardEl) {
            const selectedCard = selectedCardEl.dataset.waste
                ? golfState.waste[golfState.waste.length - 1]
                : null;
            const selectedCol = selectedCardEl.dataset.column !== undefined
                ? parseInt(selectedCardEl.dataset.column, 10)
                : null;
            const selectedCardInCol = selectedCol !== null && golfState.tableau[selectedCol]
                ? golfState.tableau[selectedCol][parseInt(selectedCardEl.dataset.index, 10)]
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
        card = golfState.waste[golfState.waste.length - 1];
        sourcePile = "waste";
    } else if (cardEl.dataset.column !== undefined) {
        const col = parseInt(cardEl.dataset.column);
        const index = parseInt(cardEl.dataset.index);
        const tableau = golfState.tableau[col];

        // Only allow clicking the top card
        if (index !== tableau.length - 1) return;

        card = tableau[index];
        sourcePile = "tableau";
        sourceIndex = col;
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

    // Attempt to move to foundation
    if (GolfLogic.canPlaceOnFoundation(card, golfState.foundation[golfState.foundation.length - 1])) {
        const scoreBeforeMove = golfState.score;
        // Remove from source
        if (sourcePile === "waste") {
            golfState.waste.pop();
        } else if (sourcePile === "tableau") {
            golfState.tableau[sourceIndex].pop();
        }

        // Add to foundation
        golfState.foundation.push(card);

        const moveType = sourcePile === "waste" ? "waste-to-foundation" : "tableau-to-foundation";
        golfState.score += GolfLogic.scoreMove(moveType);
        golfState.moves++;

        const scoreDelta = golfState.score - scoreBeforeMove;
        recordMove({
            type: moveType,
            payload: { card, fromPile: sourcePile, fromColumn: sourceIndex },
            scoreDelta,
            movesDelta: 1,
        });

        CommonUtils.playSound("card");
        updateUI();
        checkWinCondition();
    }
}

function checkWinCondition() {
    if (GolfLogic.isGameWon(golfState.tableau)) {
        golfState.isGameWon = true;
        clearInterval(golfState.timerInterval);
        CommonUtils.playSound('win');
        showWinOverlay();
        if (golfStateManager) {
            golfStateManager.clear();
        }
        syncGolfHighScore();
    }
}

function hideWinOverlay() {
    document.getElementById('golf-win-overlay').classList.add('hidden');
}

function showWinOverlay() {
    const overlay = document.getElementById('golf-win-overlay');
    document.getElementById('final-score').textContent = golfState.score;
    document.getElementById('final-time').textContent = document.getElementById('golf-time').textContent;
    overlay.classList.remove('hidden');
}

function autoComplete() {
    let movesMade = 0;
    let maxIterations = 100; // Prevent infinite loop

    while (maxIterations-- > 0) {
        // Find a card that can be moved to the foundation
        let cardToMove = null;
        let source = null;
        let sourceCol = null;

        // Check waste pile first
        if (golfState.waste.length > 0) {
            const wasteCard = golfState.waste[golfState.waste.length - 1];
            if (GolfLogic.canPlaceOnFoundation(wasteCard, golfState.foundation[golfState.foundation.length - 1])) {
                cardToMove = wasteCard;
                source = 'waste';
            }
        }

        // Check tableau piles
        if (!cardToMove) {
            for (let col = 0; col < GOLF_TABLEAU_COLS; col++) {
                const column = golfState.tableau[col];
                if (column.length > 0) {
                    const topCard = column[column.length - 1];
                    if (GolfLogic.canPlaceOnFoundation(topCard, golfState.foundation[golfState.foundation.length - 1])) {
                        cardToMove = topCard;
                        source = 'tableau';
                        sourceCol = col;
                        break;
                    }
                }
            }
        }

        if (cardToMove) {
            const scoreBeforeMove = golfState.score;
            // Remove from source
            if (source === 'waste') {
                golfState.waste.pop();
            } else if (source === 'tableau') {
                golfState.tableau[sourceCol].pop();
            }

            // Add to foundation
            golfState.foundation.push(cardToMove);

            const moveType = source === 'waste' ? 'waste-to-foundation' : 'tableau-to-foundation';
            golfState.score += GolfLogic.scoreMove(moveType);
            golfState.moves++;
            movesMade++;

            const scoreDelta = golfState.score - scoreBeforeMove;
            recordMove({
                type: moveType,
                payload: { card: cardToMove, fromPile: source, fromColumn: sourceCol },
                scoreDelta,
                movesDelta: 1,
            });

            CommonUtils.playSound('card');
        } else {
            break; // No more auto moves
        }
    }

    updateUI();
    checkWinCondition();

    if (movesMade > 0) {
        CommonUtils.showTableToast(`Auto-completed ${movesMade} moves.`, { variant: 'info', duration: 2200, containerId: 'golf-table' });
    } else {
        CommonUtils.showTableToast('No auto-complete moves available.', { variant: 'info', duration: 2200, containerId: 'golf-table' });
    }
}

function recordMove(moveEntry) {
    golfState.moveHistory.push(moveEntry);
    if (golfState.moveHistory.length > MAX_HISTORY) {
        golfState.moveHistory.shift();
    }
    updateUndoButtonState();
    if (golfStateManager) {
        golfStateManager.markDirty();
    }
}

function updateUndoButtonState() {
    const btn = document.getElementById('golf-undo');
    if (!btn) return;
    btn.disabled = golfState.moveHistory.length === 0;
}

function undoLastMove() {
    if (golfState.moveHistory.length === 0) return;

    const lastMove = golfState.moveHistory.pop();

    golfState.score -= lastMove.scoreDelta;
    golfState.moves = Math.max(0, golfState.moves - lastMove.movesDelta);
    golfState.isGameWon = false;
    hideWinOverlay();

    switch (lastMove.type) {
        case 'draw-stock':
            const drawnCard = golfState.waste.pop();
            if (drawnCard) {
                drawnCard.hidden = true;
                golfState.stock.push(drawnCard);
            }
            break;
        case 'tableau-to-foundation':
        case 'waste-to-foundation':
            const cardFromFoundation = golfState.foundation.pop();
            if (lastMove.payload.fromPile === 'waste') {
                golfState.waste.push(cardFromFoundation);
            } else if (lastMove.payload.fromPile === 'tableau') {
                golfState.tableau[lastMove.payload.fromColumn].push(cardFromFoundation);
            }
            break;
    }

    updateUI();
    updateUndoButtonState();
    if (golfStateManager) {
        golfStateManager.markDirty();
    }
}

function findFoundationDropPile(clientX, clientY) {
    const foundationEl = document.getElementById('golf-foundation');
    if (!foundationEl) return null;

    const rect = foundationEl.getBoundingClientRect();
    const paddedRect = UIHelpers.getRectWithPadding(rect, FOUNDATION_DROP_PADDING);

    if (UIHelpers.isPointInRect(clientX, clientY, paddedRect)) {
        return 0; // Only one foundation pile
    }
    return null;
}

function canDropOnFoundation() {
    if (dragState.draggedCards.length !== 1) return false;
    const movingCard = dragState.draggedCards[0];
    const foundationPile = golfState.foundation;
    return GolfLogic.canPlaceOnFoundation(movingCard, foundationPile[foundationPile.length - 1]);
}

function clearDropIndicators() {
    document.querySelectorAll('.foundation-pile').forEach(el => {
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

function showHint() {
    // Check waste pile first
    if (golfState.waste.length > 0) {
        const wasteCard = golfState.waste[golfState.waste.length - 1];
        if (GolfLogic.canPlaceOnFoundation(wasteCard, golfState.foundation[golfState.foundation.length - 1])) {
            CommonUtils.showTableToast(
                `Hint: Move ${wasteCard.val}${wasteCard.suit} from waste to foundation!`,
                { variant: 'warn', duration: 2200, containerId: 'golf-table' }
            );
            return;
        }
    }

    // Check tableau piles
    for (let col = 0; col < GOLF_TABLEAU_COLS; col++) {
        const column = golfState.tableau[col];
        if (column.length > 0) {
            const topCard = column[column.length - 1];
            if (GolfLogic.canPlaceOnFoundation(topCard, golfState.foundation[golfState.foundation.length - 1])) {
                CommonUtils.showTableToast(
                    `Hint: Move ${topCard.val}${topCard.suit} from column ${col + 1} to foundation!`,
                    { variant: 'warn', duration: 2200, containerId: 'golf-table' }
                );
                return;
            }
        }
    }

    // Check if we can draw from stock
    if (golfState.stock.length > 0) {
        CommonUtils.showTableToast(
            'Hint: Draw a card from the stock pile.',
            { variant: 'warn', duration: 2200, containerId: 'golf-table' }
        );
        return;
    }

    CommonUtils.showTableToast(
        'Hint: No moves available. This game might be stuck.',
        { variant: 'warn', duration: 2200, containerId: 'golf-table' }
    );
}

function setupGolfEventListeners() {
    document.getElementById('golf-new-game').addEventListener('click', initGolfGame);
    document.getElementById('new-game-from-win').addEventListener('click', initGolfGame);
    document.getElementById('golf-undo').addEventListener('click', undoLastMove);
    document.getElementById('golf-hint').addEventListener('click', showHint);
    document.getElementById('golf-auto-complete').addEventListener('click', autoComplete);

    // Theme controls (already handled by CommonUtils, but need to sync on load/addons change)
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

    const scheduleThemeSync = () => {
        requestAnimationFrame(syncThemeClasses);
    };

    // Initial sync
    scheduleThemeSync();

    if (window.AddonLoader && window.AddonLoader.ready) {
        window.AddonLoader.ready.then(scheduleThemeSync);
    } else {
        scheduleThemeSync();
    }
    window.addEventListener('addons:changed', syncThemeClasses);
    window.addEventListener('resize', scheduleTableauSizing); // Use scheduled sizing
    window.addEventListener('card-scale:changed', scheduleTableauSizing);

    // Drag and drop global event listeners
    if (!CommonUtils.isMobile() || !dragState.mobileController) {
        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", handlePointerUp);
        document.addEventListener("pointercancel", cleanupPointerHandlers);
    }
    attachTableauHoverHandlers();
}

// No solvability check worker for Golf (simpler game)
// Removed checkCurrentGolfSolvability and resetGolfCheckAvailability.))
