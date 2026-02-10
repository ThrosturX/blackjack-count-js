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
    moveHistory: []
};

const SPIDER_CARD_HEIGHT = 100;
const SPIDER_STACK_OFFSET = 24;
const SPIDER_DROP_PADDING = 40;
const SPIDER_COMPLETE_BONUS = 100;
const SPIDER_MAX_HISTORY = 200;

const spiderDragState = {
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
    CommonUtils.preloadAudio(spiderSoundFiles);
    setupSpiderEventListeners();
    CommonUtils.initCardScaleControls('spider-card-scale', 'spider-card-scale-value');
    initSpiderGame();
});

function initSpiderGame() {
    spiderState.tableau = Array.from({ length: 10 }, () => []);
    spiderState.stock = [];
    spiderState.foundations = [];
    spiderState.score = 0;
    spiderState.moves = 0;
    spiderState.isGameWon = false;
    spiderState.moveHistory = [];

    if (spiderState.timerInterval) {
        clearInterval(spiderState.timerInterval);
    }
    spiderState.startTime = Date.now();

    dealSpiderLayout();
    startTimer();
    updateUI();
    updateUndoButtonState();
    CommonUtils.playSound('shuffle');
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

function dealSpiderLayout() {
    const deck = CommonUtils.createShoe(2, SUITS, VALUES);
    spiderState.tableau = Array.from({ length: 10 }, () => []);

    for (let col = 0; col < 10; col++) {
        const cardsInColumn = col < 4 ? 6 : 5;
        for (let row = 0; row < cardsInColumn; row++) {
            const card = deck.pop();
            card.hidden = row !== cardsInColumn - 1;
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
}

function updateTableau() {
    const tableauArea = document.getElementById('spider-tableau');
    if (!tableauArea) return;
    tableauArea.innerHTML = '';

    spiderState.tableau.forEach((column, colIndex) => {
        const columnEl = document.createElement('div');
        columnEl.className = 'spider-column pile';
        columnEl.id = `spider-column-${colIndex}`;

        column.forEach((card, rowIndex) => {
            const cardEl = CommonUtils.createCardEl(card);
            cardEl.style.position = 'absolute';
            cardEl.style.top = `${rowIndex * SPIDER_STACK_OFFSET}px`;
            cardEl.style.left = `${rowIndex * 2.5}px`;
            cardEl.dataset.column = colIndex;
            cardEl.dataset.index = rowIndex;

            if (!card.hidden) {
                cardEl.addEventListener('pointerdown', handlePointerDown);
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

    if (spiderState.stock.length > 0) {
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
        placeholder.textContent = 'Stock';
        stockEl.appendChild(placeholder);
    }
}

function updateFoundations() {
    const foundationArea = document.getElementById('spider-foundations');
    if (!foundationArea) return;
    foundationArea.innerHTML = '';

    for (let i = 0; i < 8; i++) {
        const pile = document.createElement('div');
        pile.className = 'spider-foundation pile';
        if (spiderState.foundations[i]) {
            const suit = spiderState.foundations[i];
            const card = new Card(suit, 'K');
            card.rotation = 0;
            const cardEl = CommonUtils.createCardEl(card);
            pile.appendChild(cardEl);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'pile-placeholder';
            placeholder.textContent = 'K-A';
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
}

function recordMove(moveEntry) {
    spiderState.moveHistory.push(moveEntry);
    if (spiderState.moveHistory.length > SPIDER_MAX_HISTORY) {
        spiderState.moveHistory.shift();
    }
    updateUndoButtonState();
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

    // Mobile pickup UX
    if (CommonUtils.isMobile()) {
        const handled = CommonUtils.handleMobilePickup(e, spiderState, spiderDragState, {
            isMovable: (el) => {
                const col = parseInt(el.dataset.column, 10);
                const index = parseInt(el.dataset.index, 10);
                const column = spiderState.tableau[col];
                const sequence = column.slice(index);
                if (!sequence.length || sequence.some(c => c.hidden)) return false;
                if (sequence.length > 1) {
                    for (let i = 0; i < sequence.length - 1; i++) {
                        if (sequence[i].rank !== sequence[i + 1].rank + 1) return false;
                    }
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
            onAttemptDrop: (x, y) => {
                // finishDrag in spider.js doesn't use sourcePile/sourceIndex,
                // it gets source from dataset of draggedElements[0]
                finishDrag(x, y);
                return !spiderDragState.isDragging;
            }
        });
        if (handled) return;
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

    const layer = document.createElement('div');
    layer.className = 'drag-layer';
    layer.style.position = 'fixed';
    layer.style.left = '0';
    layer.style.top = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '1000';
    layer.style.width = `${initialRect.width}px`;
    layer.style.height = `${SPIDER_CARD_HEIGHT + (spiderDragState.draggedElements.length - 1) * SPIDER_STACK_OFFSET}px`;

    spiderDragState.draggedElements.forEach((el, idx) => {
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.top = `${idx * SPIDER_STACK_OFFSET}px`;
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
    if (!spiderDragState.dragLayer) {
        return { x: clientX, y: clientY };
    }
    const rect = spiderDragState.dragLayer.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + Math.min(SPIDER_CARD_HEIGHT / 2, rect.height - 1)
    };
}

function finishDrag(clientX, clientY) {
    const dropPoint = getDropPoint(clientX, clientY);
    const targetColIndex = findTableauDropColumn(dropPoint.x, dropPoint.y);
    let moveResult = null;
    const scoreBefore = spiderState.score;
    const movesBefore = spiderState.moves;

    if (targetColIndex !== null) {
        moveResult = attemptTableauMove(targetColIndex);
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
    if (column.length < 13) return;

    const startIndex = column.length - 13;
    const sequence = column.slice(startIndex);
    const first = sequence[0];

    if (first.hidden || first.val !== 'K') return;
    for (let i = 0; i < sequence.length - 1; i++) {
        const current = sequence[i];
        const next = sequence[i + 1];
    if (current.hidden || next.hidden) return;
    if (current.suit !== next.suit) return;
    if (current.rank !== next.rank + 1) return;
    }

    const removed = column.splice(startIndex, 13);
    spiderState.foundations.push(removed[0].suit);
    spiderState.score += SPIDER_COMPLETE_BONUS;
    const newTop = column[column.length - 1];
    if (newTop && newTop.hidden) {
        newTop.hidden = false;
    }
    return { columnIndex, cards: removed, suit: removed[0].suit };
}

function dealFromStock() {
    if (spiderState.stock.length < 10) return;
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
        for (let col = 0; col < 10; col++) {
            const card = spiderState.stock.pop();
            card.hidden = false;
            spiderState.tableau[col].push(card);
            dealtCards.push({ col, card });

            if (stockEl) {
                const columnEl = document.getElementById(`spider-column-${col}`);
                if (columnEl) {
                    const columnRect = columnEl.getBoundingClientRect();
                    const rowIndex = spiderState.tableau[col].length - 1;
                    const destX = columnRect.left + (rowIndex * 2.5);
                    const destY = columnRect.top + (rowIndex * SPIDER_STACK_OFFSET);
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
    if (spiderState.foundations.length >= 8) {
        spiderState.isGameWon = true;
        clearInterval(spiderState.timerInterval);
        CommonUtils.playSound('win');
        CommonUtils.showTableToast('You solved Spider Solitaire!', { variant: 'win', duration: 2500 });
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
    let bestColumn = null;
    let bestCenterDistance = Infinity;

    document.querySelectorAll('.spider-column').forEach(column => {
        const rect = UIHelpers.getStackBounds(column, SPIDER_CARD_HEIGHT, SPIDER_STACK_OFFSET);
        const paddedRect = UIHelpers.getRectWithPadding(rect, SPIDER_DROP_PADDING);

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

function setupSpiderEventListeners() {
    const newGameBtn = document.getElementById('spider-new-game');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', initSpiderGame);
    }

    const dealBtn = document.getElementById('spider-deal');
    if (dealBtn) {
        dealBtn.addEventListener('click', dealFromStock);
    }
    const undoBtn = document.getElementById('spider-undo');
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
