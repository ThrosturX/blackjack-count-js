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

// Drag state / UI tuning
const DRAG_MOVE_THRESHOLD = 6;
const CARD_HEIGHT = 100;
const STACK_OFFSET = 25;
const TABLEAU_DROP_PADDING = 40;
const FOUNDATION_DROP_PADDING = 30;
const MAX_HISTORY = 200;
const MAX_SOLVABLE_DEAL_ATTEMPTS = 12;
const MAX_SIMULATION_ITERATIONS = 1200;
const KLONDIKE_MIN_TABLEAU_CARDS = 13;

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
    initGame();
});

/**
 * Initialize a new game
 */
function initGame() {
    // Initialize mobile controller if not already done
    if (!dragState.mobileController && typeof MobileSolitaireController !== 'undefined') {
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

function ensureTableauSizing() {
    const maxCards = Math.max(KLONDIKE_MIN_TABLEAU_CARDS, getMaxTableauLength());
    const stackHeight = CommonUtils.getStackHeight(maxCards, STACK_OFFSET);
    CommonUtils.ensureTableauMinHeight({
        table: 'klondike-table',
        topRow: 'top-row',
        stackOffset: STACK_OFFSET,
        maxCards
    });
    const tableauArea = document.getElementById('tableau-area');
    if (tableauArea) {
        tableauArea.style.minHeight = `${Math.ceil(stackHeight)}px`;
    }
    document.querySelectorAll('.tableau-column').forEach(column => {
        column.style.minHeight = `${Math.ceil(stackHeight)}px`;
    });
}

const scheduleTableauSizing = CommonUtils.createRafScheduler(ensureTableauSizing);

/**
 * Update tableau columns
 */
function updateTableau() {
    for (let col = 0; col < 7; col++) {
        const columnEl = document.getElementById(`tableau-${col}`);
        columnEl.innerHTML = '';

        const cards = gameState.tableau[col];
        cards.forEach((card, index) => {
            const cardEl = CommonUtils.createCardEl(card);
            cardEl.style.position = 'absolute';
            cardEl.style.top = `${index * 25}px`;
            cardEl.style.left = `${index * 2.5}px`;
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

            columnEl.appendChild(cardEl);
        });
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
        // Show top card (or top 3 cards if draw 3)
        const displayCount = Math.min(3, gameState.waste.length);
        const startIndex = gameState.waste.length - displayCount;

        for (let i = startIndex; i < gameState.waste.length; i++) {
            const card = gameState.waste[i];
            const cardEl = CommonUtils.createCardEl(card);
            cardEl.style.position = 'absolute';
            cardEl.style.left = `${(i - startIndex) * 20}px`;

            // Only top card responds to drag
            if (i === gameState.waste.length - 1) {
                cardEl.dataset.waste = 'true';
                if (!CommonUtils.isMobile() || !dragState.mobileController) {
                    cardEl.addEventListener('pointerdown', handlePointerDown);
                } 
                cardEl.addEventListener('click', handleCardClick);
                cardEl.style.cursor = 'pointer';
                cardEl.style.zIndex = 10;
            }

            wasteEl.appendChild(cardEl);
        }
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'pile-placeholder';
        placeholder.textContent = 'Waste';
        wasteEl.appendChild(placeholder);
    }
}

/**
 * Update score and stats display
 */
function updateStats() {
    document.getElementById('score-display').textContent = gameState.score;
    document.getElementById('moves-display').textContent = gameState.moves;
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

    const layer = document.createElement('div');
    layer.className = 'drag-layer';
    layer.style.position = 'fixed';
    layer.style.left = '0';
    layer.style.top = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '1000';
    layer.style.width = `${initialRect.width}px`;
    layer.style.height = `${CARD_HEIGHT + (dragState.draggedElements.length - 1) * STACK_OFFSET}px`;

    dragState.draggedElements.forEach((el, idx) => {
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.top = `${idx * STACK_OFFSET}px`;
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
    if (!dragState.dragLayer) {
        return { x: clientX, y: clientY };
    }
    const rect = dragState.dragLayer.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + Math.min(CARD_HEIGHT / 2, rect.height - 1);
    return { x, y };
}

function finishDrag(clientX, clientY) {
    const scoreBeforeDrag = gameState.score;
    const movesBeforeDrag = gameState.moves;
    let movePayload = null;
    let moveType = '';
    let moveResult = { success: false };

    const dropPoint = getDropPoint(clientX, clientY);
    const targetColIndex = findTableauDropColumn(dropPoint.x, dropPoint.y);
    if (targetColIndex !== null) {
        moveResult = attemptTableauMove(targetColIndex);
        if (moveResult.success) {
            if (dragState.sourcePile === 'waste') {
                moveType = 'waste-to-tableau';
            } else if (dragState.sourcePile === 'foundation') {
                moveType = 'foundation-to-tableau';
            } else {
                moveType = 'tableau-to-tableau';
            }
            movePayload = moveResult.payload;
        }
    }

    if (!moveResult.success) {
        const foundationIndex = findFoundationDropPile(dropPoint.x, dropPoint.y);
        if (foundationIndex !== null) {
            moveResult = attemptFoundationMove(foundationIndex);
            if (moveResult.success) {
                if (dragState.sourcePile === 'waste') {
                    moveType = 'waste-to-foundation';
                } else if (dragState.sourcePile === 'foundation') {
                    moveType = 'foundation-to-foundation';
                } else {
                    moveType = 'tableau-to-foundation';
                }
                movePayload = moveResult.payload;
            }
        }
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

    // Try to auto-move to foundation
    for (let i = 0; i < 4; i++) {
        if (SolitaireLogic.canPlaceOnFoundation(card, gameState.foundations[i])) {
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
            gameState.foundations[i].push(card);

            const moveType = sourcePile === "waste" ? "waste-to-foundation" : "tableau-to-foundation";
            applyVariantScore(moveType);
            gameState.moves++;

            CommonUtils.playSound("card");
            updateUI();
            checkWinCondition();
            return;
        }
    }
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

/**
 * Show hint
 */
function showHint() {
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
                if (validMoves.length > 0) {
                    const move = validMoves[0];
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
        if (validMoves.length > 0) {
            const move = validMoves[0];
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

    // Settings toggles
    document.getElementById('toggle-game').addEventListener('click', () => {
        const gameArea = document.getElementById('game-area');
        const btn = document.getElementById('toggle-game');
        gameArea.classList.toggle('collapsed');
        btn.classList.toggle('active');
    });

    document.getElementById('toggle-settings').addEventListener('click', () => {
        const settingsArea = document.getElementById('settings-area');
        const btn = document.getElementById('toggle-settings');
        settingsArea.classList.toggle('collapsed');
        btn.classList.toggle('active');
    });

    document.getElementById('toggle-themes').addEventListener('click', () => {
        const themeArea = document.getElementById('theme-area');
        const btn = document.getElementById('toggle-themes');
        themeArea.classList.toggle('collapsed');
        btn.classList.toggle('active');
    });

    const addonsArea = document.getElementById('addons-area');
    const addonsBtn = document.getElementById('toggle-addons');
    addonsBtn.addEventListener('click', () => {
        addonsArea.classList.toggle('collapsed');
        addonsBtn.classList.toggle('active');
    });
    addonsBtn.classList.toggle('active', !addonsArea.classList.contains('collapsed'));

    document.getElementById('toggle-stats').addEventListener('click', () => {
        const statsArea = document.getElementById('stats-area');
        const btn = document.getElementById('toggle-stats');
        statsArea.classList.toggle('collapsed');
        btn.classList.toggle('active');
    });

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
    let bestColumn = null;
    let bestCenterDistance = Infinity;

    document.querySelectorAll('.tableau-column').forEach(column => {
        const rect = UIHelpers.getStackBounds(column, CARD_HEIGHT, STACK_OFFSET);
        const paddedRect = UIHelpers.getRectWithPadding(rect, TABLEAU_DROP_PADDING);

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

    document.querySelectorAll('.foundation-pile').forEach(pile => {
        const rect = pile.getBoundingClientRect();
        const paddedRect = UIHelpers.getRectWithPadding(rect, FOUNDATION_DROP_PADDING);

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
    if (bestDistance <= FOUNDATION_DROP_PADDING) {
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
    for (let attempt = 1; attempt <= MAX_SOLVABLE_DEAL_ATTEMPTS; attempt++) {
        const deck = CommonUtils.createShoe(1, SUITS, VALUES);
        dealDeck(deck);
        if (isDealLikelySolvable(gameState)) {
            if (attempt > 1) {
                console.debug(`Klondike: solvable deal found after ${attempt} attempts.`);
            }
            return;
        }
    }
    console.warn(`Klondike: Unable to find a likely solvable deal after ${MAX_SOLVABLE_DEAL_ATTEMPTS} attempts.`);
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

function applySimulationTableauMove(state, options) {
    for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol++) {
        const sourcePile = state.tableau[sourceCol];
        if (sourcePile.length === 0) continue;
        const movingCard = sourcePile[sourcePile.length - 1];
        if (movingCard.hidden) continue;

        const wouldRevealHidden = sourcePile.length > 1 && sourcePile[sourcePile.length - 2].hidden;

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

            if (!wouldRevealHidden) {
                continue;
            }

            sourcePile.pop();
            targetPile.push(movingCard);
            const newTop = sourcePile[sourcePile.length - 1];
            if (newTop && newTop.hidden) {
                newTop.hidden = false;
            }
            return true;
        }
    }
    return false;
}

function applySimulationWasteToTableauMove(state, options) {
    if (state.waste.length === 0) return false;
    const movingCard = state.waste[state.waste.length - 1];
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
            state.waste.pop();
            targetPile.push(movingCard);
            return true;
        }
    }
    return false;
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
