/**
 * FreeCell Game Controller
 */
const freecellSoundFiles = {
    card: ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav'],
    win: ['win.wav'],
    shuffle: ['shuffle.wav']
};

const freecellState = {
    tableau: Array.from({ length: 8 }, () => []),
    freeCells: Array(4).fill(null),
    foundations: [[], [], [], []],
    score: 0,
    moves: 0,
    startTime: null,
    timerInterval: null,
    isGameWon: false,
    moveHistory: []
};

const CARD_HEIGHT = 100;
const STACK_OFFSET = 25;
const MAX_HISTORY = 200;

// Mobile detection and touch state
const isMobile = window.matchMedia('(max-width: 768px)').matches || 
                navigator.maxTouchPoints > 0 ||
                'ontouchstart' in window;

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
    pickedUpCard: null,  // For mobile touch-to-pickup
    pickedUpSource: null,
    pickedUpElement: null
};

document.addEventListener('DOMContentLoaded', () => {
    CommonUtils.preloadAudio(freecellSoundFiles);
    setupFreeCellEventListeners();
    CommonUtils.initCardScaleControls('freecell-card-scale', 'freecell-card-scale-value');
    initFreeCellGame();
});

function initFreeCellGame() {
    freecellState.tableau = Array.from({ length: 8 }, () => []);
    freecellState.freeCells = Array(4).fill(null);
    freecellState.foundations = [[], [], [], []];
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
}

function startTimer() {
    freecellState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - freecellState.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('freecell-time').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function dealFreeCellLayout() {
    const deck = CommonUtils.createShoe(1, SUITS, VALUES);
    freecellState.tableau = Array.from({ length: 8 }, () => []);

    for (let col = 0; col < 8; col++) {
        const cardsInColumn = col < 4 ? 7 : 6;
        for (let row = 0; row < cardsInColumn; row++) {
            const card = deck.pop();
            card.hidden = false;
            freecellState.tableau[col].push(card);
        }
    }
}

function updateUI() {
    updateTableau();
    updateFreeCells();
    updateFoundations();
    updateStats();
}

function updateTableau() {
    const tableauArea = document.getElementById('freecell-tableau');
    if (!tableauArea) return;
    tableauArea.innerHTML = '';

    freecellState.tableau.forEach((column, colIndex) => {
        const columnEl = document.createElement('div');
        columnEl.className = 'freecell-column pile';
        columnEl.id = `freecell-column-${colIndex}`;

        column.forEach((card, rowIndex) => {
            const cardEl = CommonUtils.createCardEl(card);
            cardEl.style.position = 'absolute';
            cardEl.style.top = `${rowIndex * STACK_OFFSET}px`;
            cardEl.style.left = `${rowIndex * 3}px`;
            cardEl.dataset.column = colIndex;
            cardEl.dataset.index = rowIndex;

            cardEl.addEventListener('pointerdown', handlePointerDown);
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
            cardEl.addEventListener('pointerdown', handlePointerDown);
            cardEl.style.cursor = 'pointer';
            slot.appendChild(cardEl);
        } else {
            slot.textContent = '';
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

        if (pile.length > 0) {
            const topCard = pile[pile.length - 1];
            const cardEl = CommonUtils.createCardEl(topCard);
            cardEl.style.cursor = 'default';
            foundationEl.appendChild(cardEl);
        }

        foundationArea.appendChild(foundationEl);
    });
}

function updateStats() {
    document.getElementById('freecell-moves').textContent = freecellState.moves;
    document.getElementById('freecell-score').textContent = freecellState.score;
}

function recordMove(moveEntry) {
    freecellState.moveHistory.push(moveEntry);
    if (freecellState.moveHistory.length > MAX_HISTORY) {
        freecellState.moveHistory.shift();
    }
    updateUndoButtonState();
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
    const cardEl = e.target.closest('.card');
    if (!cardEl) return;

    // On mobile, immediately pick up the card on touch
    if (isMobile) {
        // If there's already a picked up card, try to place it
        if (freecellDragState.pickedUpCard) {
            // Try to place the picked up card
            const clientX = e.clientX;
            const clientY = e.clientY;
            
            // Find drop target
            const targetColIndex = findTableauDropColumn(clientX, clientY);
            if (targetColIndex !== null) {
                const moveResult = attemptTableauMove(targetColIndex);
                if (moveResult.success) {
                    const moveType = freecellDragState.pickedUpSource.startsWith('freeCell') ? 'freeCell-to-tableau' : 
                                    freecellDragState.pickedUpSource === 'waste' ? 'waste-to-tableau' : 
                                    'tableau-to-tableau';
                    
                    applyVariantScore(moveType);
                    freecellState.moves++;
                    recordMove({
                        type: moveType,
                        payload: moveResult.payload,
                        scoreDelta: applyVariantScore(moveType),
                        movesDelta: 1
                    });
                    CommonUtils.playSound('card');
                    updateUI();
                    checkWinCondition();
                    clearPickedUpCard();
                    return;
                }
            }

            const foundationIndex = findFoundationDropPile(clientX, clientY);
            if (foundationIndex !== null) {
                const moveResult = attemptFoundationMove(foundationIndex);
                if (moveResult.success) {
                    const moveType = freecellDragState.pickedUpSource.startsWith('freeCell') ? 'freeCell-to-foundation' : 'tableau-to-foundation';
                    
                    applyVariantScore(moveType);
                    freecellState.moves++;
                    recordMove({
                        type: moveType,
                        payload: moveResult.payload,
                        scoreDelta: applyVariantScore(moveType),
                        movesDelta: 1
                    });
                    CommonUtils.playSound('card');
                    updateUI();
                    checkWinCondition();
                    clearPickedUpCard();
                    return;
                }
            }

            // If no valid drop, reset the pickup
            clearPickedUpCard();
        } else {
            // Pick up the card
            pickupCard(cardEl);
        }
        return;
    }

    // For desktop, continue with drag functionality
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

/**
 * Pick up a card for mobile interaction
 */
function pickupCard(cardEl) {
    // Determine source pile and cards
    if (cardEl.dataset.freeCellIndex !== undefined) {
        const cellIndex = parseInt(cardEl.dataset.freeCellIndex, 10);
        const card = freecellState.freeCells[cellIndex];
        freecellDragState.pickedUpCard = card;
        freecellDragState.pickedUpSource = `freeCell${cellIndex}`;
        freecellDragState.pickedUpElement = cardEl;
    } else if (cardEl.dataset.foundation !== undefined) {
        const foundationIndex = parseInt(cardEl.dataset.foundation, 10);
        const foundationPile = freecellState.foundations[foundationIndex];
        const card = foundationPile[foundationPile.length - 1];
        freecellDragState.pickedUpCard = card;
        freecellDragState.pickedUpSource = 'foundation';
        freecellDragState.pickedUpElement = cardEl;
    } else {
        const col = parseInt(cardEl.dataset.column, 10);
        const index = parseInt(cardEl.dataset.index, 10);
        const tableauPile = freecellState.tableau[col];
        
        // Only allow picking up the top card unless it's a full stack that can be moved
        if (index === tableauPile.length - 1) {
            freecellDragState.pickedUpCard = tableauPile[index];
            freecellDragState.pickedUpSource = 'tableau';
            freecellDragState.pickedUpElement = cardEl;
        } else {
            // Check if we can move the entire stack starting from this index
            const stack = tableauPile.slice(index);
            if (isValidSequence(stack)) {
                freecellDragState.pickedUpCard = stack[0]; // Store the top card of the stack
                freecellDragState.pickedUpSource = 'tableau';
                freecellDragState.pickedUpElement = cardEl;
            } else {
                return; // Cannot pick up this card
            }
        }
    }

    // Visually indicate the card is picked up
    cardEl.style.opacity = '0.7';
    cardEl.style.transform = 'translateY(-10px)';
}

/**
 * Clear the picked up card state
 */
function clearPickedUpCard() {
    if (freecellDragState.pickedUpElement) {
        freecellDragState.pickedUpElement.style.opacity = '';
        freecellDragState.pickedUpElement.style.transform = '';
    }
    freecellDragState.pickedUpCard = null;
    freecellDragState.pickedUpSource = null;
    freecellDragState.pickedUpElement = null;
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

    const layer = document.createElement('div');
    layer.className = 'drag-layer';
    layer.style.position = 'fixed';
    layer.style.left = '0';
    layer.style.top = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '1000';
    layer.style.width = `${rect.width}px`;
    layer.style.height = `${CARD_HEIGHT + (freecellDragState.draggedElements.length - 1) * STACK_OFFSET}px`;

    freecellDragState.draggedElements.forEach((el, idx) => {
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.top = `${idx * STACK_OFFSET}px`;
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

function finishDrag(clientX, clientY) {
    const targetFreeCell = findFreeCellDropTarget(clientX, clientY);
    const targetFoundation = findFoundationDropPile(clientX, clientY);
    const targetColumn = findTableauDropColumn(clientX, clientY);
    let handled = false;
    let moveResult = null;
    const scoreBefore = freecellState.score;
    const movesBefore = freecellState.moves;

    if (targetFreeCell !== null) {
        moveResult = attemptMoveToFreeCell(targetFreeCell);
        handled = moveResult.success;
    } else if (targetFoundation !== null) {
        moveResult = attemptFoundationMove(targetFoundation);
        handled = moveResult.success;
    } else if (targetColumn !== null) {
        moveResult = attemptTableauMove(targetColumn);
        handled = moveResult.success;
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
    
    // Clear mobile pickup state on pointer up
    if (isMobile) {
        clearPickedUpCard();
    }
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
    let bestColumn = null;
    let bestDistance = Infinity;

    document.querySelectorAll('.freecell-column').forEach(column => {
        const rect = UIHelpers.getStackBounds(column, CARD_HEIGHT, STACK_OFFSET);
        const paddedRect = UIHelpers.getRectWithPadding(rect, 30);

        if (UIHelpers.isPointInRect(clientX, clientY, paddedRect)) {
            bestColumn = column;
            bestDistance = -1;
            return;
        }

        const dist = UIHelpers.distanceToRect(clientX, clientY, rect);
        if (dist < bestDistance) {
            bestDistance = dist;
            bestColumn = column;
        }
    });

    if (!bestColumn) return null;
    if (bestDistance <= 30) {
        return parseInt(bestColumn.id.split('-')[2], 10);
    }
    return null;
}

function findFreeCellDropTarget(clientX, clientY) {
    let target = null;
    document.querySelectorAll('.freecell-slot').forEach(slot => {
        const rect = slot.getBoundingClientRect();
        const paddedRect = UIHelpers.getRectWithPadding(rect, 20);
        if (UIHelpers.isPointInRect(clientX, clientY, paddedRect)) {
            target = parseInt(slot.dataset.freecellIndex, 10);
        }
    });
    return target !== null ? target : null;
}

function findFoundationDropPile(clientX, clientY) {
    let target = null;
    document.querySelectorAll('.freecell-foundation').forEach(pile => {
        const rect = pile.getBoundingClientRect();
        const paddedRect = UIHelpers.getRectWithPadding(rect, 20);
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

function checkFreeCellWin() {
    if (freecellState.foundations.every(pile => pile.length === 13)) {
        freecellState.isGameWon = true;
        clearInterval(freecellState.timerInterval);
        CommonUtils.playSound('win');
        CommonUtils.showTableToast('You solved FreeCell!', { variant: 'win', duration: 2500 });
    }
}

function setupFreeCellEventListeners() {
    document.getElementById('freecell-new-game').addEventListener('click', initFreeCellGame);
    const undoBtn = document.getElementById('freecell-undo');
    if (undoBtn) {
        undoBtn.addEventListener('click', undoLastMove);
    }

    document.getElementById('toggle-settings').addEventListener('click', () => {
        const settingsArea = document.getElementById('settings-area');
        const btn = document.getElementById('toggle-settings');
        settingsArea.classList.toggle('collapsed');
        btn.classList.toggle('active');
    });

    const addonsArea = document.getElementById('addons-area');
    const addonsBtn = document.getElementById('toggle-addons');
    addonsBtn.addEventListener('click', () => {
        addonsArea.classList.toggle('collapsed');
        addonsBtn.classList.toggle('active');
    });
    addonsBtn.classList.toggle('active', !addonsArea.classList.contains('collapsed'));

    document.getElementById('toggle-themes').addEventListener('click', () => {
        const themeArea = document.getElementById('theme-area');
        const btn = document.getElementById('toggle-themes');
        themeArea.classList.toggle('collapsed');
        btn.classList.toggle('active');
    });

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
