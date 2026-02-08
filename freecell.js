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
    isGameWon: false
};

const CARD_HEIGHT = 100;
const STACK_OFFSET = 25;

const freecellDragState = {
    draggedCards: [],
    source: null,
    draggedElements: [],
    dragLayer: null,
    pointerOffsetX: 0,
    pointerOffsetY: 0,
    isDragging: false,
    pendingDrag: null,
    activePointerId: null
};

document.addEventListener('DOMContentLoaded', () => {
    CommonUtils.preloadAudio(freecellSoundFiles);
    setupFreeCellEventListeners();
    initFreeCellGame();
});

function initFreeCellGame() {
    freecellState.tableau = Array.from({ length: 8 }, () => []);
    freecellState.freeCells = Array(4).fill(null);
    freecellState.foundations = [[], [], [], []];
    freecellState.score = 0;
    freecellState.moves = 0;
    freecellState.isGameWon = false;

    if (freecellState.timerInterval) {
        clearInterval(freecellState.timerInterval);
    }
    freecellState.startTime = Date.now();

    dealFreeCellLayout();
    startTimer();
    updateUI();
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

function handlePointerDown(e) {
    if (e.button !== 0) return;
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
        el.style.transform = 'none';
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

    if (targetFreeCell !== null) {
        handled = attemptMoveToFreeCell(targetFreeCell).success;
    } else if (targetFoundation !== null) {
        handled = attemptFoundationMove(targetFoundation).success;
    } else if (targetColumn !== null) {
        handled = attemptTableauMove(targetColumn).success;
    }

    cleanupDragVisuals();

    if (handled) {
        CommonUtils.playSound('card');
        freecellState.moves++;
        updateStats();
        checkFreeCellWin();
        updateTableau();
        updateFreeCells();
        updateFoundations();
    } else {
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

    removeDraggedCardsFromSource();
    freecellState.tableau[targetCol].push(...movingCards);
    return { success: true };
}

function attemptMoveToFreeCell(targetIndex) {
    if (freecellDragState.draggedCards.length !== 1) return { success: false };
    if (freecellState.freeCells[targetIndex]) return { success: false };

    const card = freecellDragState.draggedCards[0];
    removeDraggedCardsFromSource();
    freecellState.freeCells[targetIndex] = card;
    return { success: true };
}

function attemptFoundationMove(targetIndex) {
    if (freecellDragState.draggedCards.length !== 1) return { success: false };

    const card = freecellDragState.draggedCards[0];
    const foundation = freecellState.foundations[targetIndex];
    if (!SolitaireLogic.canPlaceOnFoundation(card, foundation)) return { success: false };

    removeDraggedCardsFromSource();
    foundation.push(card);
    freecellState.score += 1;
    return { success: true };
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
        alert('🎉 You solved FreeCell! 🎉');
    }
}

function setupFreeCellEventListeners() {
    document.getElementById('freecell-new-game').addEventListener('click', initFreeCellGame);
}
