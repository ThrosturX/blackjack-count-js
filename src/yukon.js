/**
 * Yukon Solitaire Game Controller
 * Manages game state, UI updates, and user interactions
 */

const yukonSoundFiles = {
    card: ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav'],
    win: ['win.wav'],
    shuffle: ['shuffle.wav']
};

// Game state
const yukonGameState = {
    tableau: [[], [], [], [], [], [], []],
    foundations: [[], [], [], []],
    score: 0,
    moves: 0,
    startTime: null,
    timerInterval: null,
    isGameWon: false,
    moveHistory: []
};

let yukonStateManager = null;

// Constants
const STACK_OFFSET = 25;
const MAX_HISTORY = 200;
const CARD_HEIGHT = 110;
const DRAG_MOVE_THRESHOLD = 6;
const TABLEAU_DROP_PADDING = 40;
const FOUNDATION_DROP_PADDING = 30;
const MOBILE_TABLEAU_DROP_PADDING = 16;
const MOBILE_FOUNDATION_DROP_PADDING = 16;
const YUKON_COLUMN_CONFIGS = [
    { total: 1, visible: 1 },
    { total: 6, visible: 5 },
    { total: 7, visible: 5 },
    { total: 8, visible: 5 },
    { total: 9, visible: 5 },
    { total: 10, visible: 5 },
    { total: 11, visible: 5 }
];
const YUKON_MIN_TABLEAU_CARDS = YUKON_COLUMN_CONFIGS.reduce((max, column) => Math.max(max, column.total), 1);
let yukonSessionMaxTableauCards = YUKON_MIN_TABLEAU_CARDS;

const dragState = {
    pendingDrag: null,
    draggedCards: [],
    draggedElements: [],
    dragLayer: null,
    pointerOffsetX: 0,
    pointerOffsetY: 0,
    isDragging: false,
    activePointerId: null,
    sourceColumn: null,
    sourceRow: null,
    mobileController: null,
    mobileBindingsAttached: false
};

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    CommonUtils.preloadAudio(yukonSoundFiles);
    setupYukonEventListeners();
    CommonUtils.initCardScaleControls('yukon-card-scale', 'yukon-card-scale-value');
    
    yukonStateManager = new CommonUtils.StateManager({
        gameId: 'yukon',
        getState: getYukonSaveState,
        setState: restoreYukonState,
        isWon: () => yukonGameState.isGameWon
    });
    
    const restored = yukonStateManager.load();
    if (!restored) {
        initYukonGame();
    }
    syncYukonHighScore();
});

function setupYukonEventListeners() {
    // New game button
    document.getElementById('yukon-new-game').addEventListener('click', initYukonGame);
    
    // Undo button
    document.getElementById('yukon-undo').addEventListener('click', undoYukonMove);
    
    // Hint button
    document.getElementById('yukon-hint').addEventListener('click', showYukonHint);
    document.getElementById('yukon-help')?.addEventListener('click', showYukonHelp);
    
    // Card scale controls
    document.getElementById('yukon-card-scale').addEventListener('input', function() {
        document.documentElement.style.setProperty('--card-scale', this.value);
        document.getElementById('yukon-card-scale-value').textContent = Math.round(this.value * 100) + '%';
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

    window.addEventListener('resize', scheduleYukonSizing);
    document.addEventListener('card-scale:changed', scheduleYukonSizing);
}

function initYukonGame() {
    ensureYukonMobileController();

    yukonGameState.tableau = [[], [], [], [], [], [], []];
    yukonGameState.foundations = [[], [], [], []];
    yukonGameState.score = 0;
    yukonGameState.moves = 0;
    yukonGameState.startTime = Date.now();
    yukonGameState.isGameWon = false;
    yukonGameState.moveHistory = [];

    document.getElementById('yukon-moves').textContent = '0';
    document.getElementById('yukon-score').textContent = '0';
    document.getElementById('yukon-time').textContent = '0:00';
    document.getElementById('yukon-undo').disabled = true;

    if (yukonGameState.timerInterval) {
        clearInterval(yukonGameState.timerInterval);
    }
    yukonGameState.timerInterval = setInterval(updateYukonTimer, 1000);

    const deck = createShuffledDeck();
    dealYukonCards(deck);
    yukonSessionMaxTableauCards = Math.max(YUKON_MIN_TABLEAU_CARDS, getMaxYukonLength());

    renderYukonGame();
    yukonStateManager.save();
}

function createShuffledDeck() {
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    for (const suit of ['♥', '♠', '♦', '♣']) {
        for (const val of values) {
            const card = new Card(suit, val);
            deck.push(card);
        }
    }

    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function dealYukonCards(deck) {
    for (let col = 0; col < 7; col++) {
        const config = YUKON_COLUMN_CONFIGS[col] || { total: col + 1, visible: 1 };
        const hiddenCards = Math.max(0, config.total - config.visible);

        for (let position = 0; position < config.total; position++) {
            const card = deck.pop();
            if (!card) continue;
            card.hidden = position < hiddenCards;
            yukonGameState.tableau[col].push(card);
        }
    }
}

function renderYukonGame() {
    const stackSpacing = CommonUtils
        ? CommonUtils.getSolitaireStackOffset(STACK_OFFSET)
        : STACK_OFFSET;

    for (let i = 0; i < 4; i++) {
        const foundationSlot = document.querySelector(`.foundation-slot[data-pile="foundation-${i}"]`);
        foundationSlot.innerHTML = '';
        if (yukonGameState.foundations[i].length > 0) {
            const topCard = yukonGameState.foundations[i][yukonGameState.foundations[i].length - 1];
            const cardEl = createCardElement(topCard, `foundation-${i}`, -1);
            foundationSlot.appendChild(cardEl);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'empty-slot';
            placeholder.textContent = foundationSlot.dataset.suit || '';
            foundationSlot.appendChild(placeholder);
        }
    }

    const tableauEl = document.getElementById('yukon-tableau');
    tableauEl.innerHTML = '';

    for (let col = 0; col < 7; col++) {
        const columnEl = document.createElement('div');
        columnEl.className = 'tableau-column pile drop-zone';
        columnEl.id = `yukon-tableau-${col}`;
        columnEl.dataset.column = col;

        const columnCards = yukonGameState.tableau[col];
        for (let row = 0; row < columnCards.length; row++) {
            const card = columnCards[row];
            const cardEl = createCardElement(card, `tableau-${col}-${row}`, row);
            cardEl.style.top = `${row * stackSpacing}px`;
            cardEl.style.zIndex = row + 10;
            cardEl.dataset.column = col;
            cardEl.dataset.index = row;

            if (card.hidden) {
                cardEl.classList.add('hidden');
            } else {
                cardEl.classList.add('draggable');
                if (!CommonUtils.isMobile() || !dragState.mobileController) {
                    cardEl.addEventListener('pointerdown', handleYukonPointerDown);
                }
                cardEl.addEventListener('dblclick', handleYukonCardDoubleClick);
            }

            columnEl.appendChild(cardEl);
        }

        tableauEl.appendChild(columnEl);
    }

    document.getElementById('yukon-score').textContent = yukonGameState.score;
    document.getElementById('yukon-moves').textContent = yukonGameState.moves;

    if (!yukonGameState.isGameWon && SolitaireLogic.isGameWon(yukonGameState.foundations)) {
        winYukonGame();
    }

    scheduleYukonSizing();
}

function createCardElement(card, id, position) {
    const cardEl = CommonUtils.createCardEl(card);
    cardEl.id = id;
    cardEl.dataset.card = JSON.stringify(card);
    cardEl.dataset.position = position;
    return cardEl;
}

function handleYukonPointerDown(e) {
    if (e.button !== 0) return;

    if (CommonUtils.isMobile() && dragState.mobileController) {
        if (dragState.mobileController.handlePointerDown(e)) return;
    }

    const cardEl = e.target.closest('.card');
    if (!cardEl || cardEl.classList.contains('hidden')) return;

    dragState.pendingDrag = {
        cardEl,
        startX: e.clientX,
        startY: e.clientY
    };
    dragState.activePointerId = e.pointerId;
    document.addEventListener('pointermove', handleYukonPointerMove);
    document.addEventListener('pointerup', handleYukonPointerUp);
    document.addEventListener('pointercancel', handleYukonPointerCancel);
    if (cardEl.setPointerCapture) {
        cardEl.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
}

function handleYukonCardDoubleClick(e) {
    const cardEl = e.currentTarget || e.target.closest('.card');
    if (!cardEl || cardEl.classList.contains('hidden')) return;

    const col = parseInt(cardEl.dataset.column, 10);
    const row = parseInt(cardEl.dataset.index, 10);
    if (!Number.isFinite(col) || !Number.isFinite(row)) return;

    const column = yukonGameState.tableau[col];
    if (!column || row !== column.length - 1) return;

    const card = column[row];
    if (!card || card.hidden) return;

    const targetFoundation = typeof SolitaireLogic.findAutoFoundationTarget === 'function'
        ? SolitaireLogic.findAutoFoundationTarget(card, yukonGameState.foundations)
        : yukonGameState.foundations.findIndex((pile) => SolitaireLogic.canPlaceOnFoundation(card, pile));

    if (targetFoundation < 0) return;

    column.pop();
    yukonGameState.foundations[targetFoundation].push(card);
    flipExposedHiddenCards(col);

    yukonGameState.moves++;
    yukonGameState.score += 10;
    document.getElementById('yukon-undo').disabled = false;

    CommonUtils.playSound('card');
    renderYukonGame();
    yukonStateManager.save();
}

function handleYukonPointerMove(e) {
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

function handleYukonPointerUp(e) {
    if (dragState.activePointerId !== e.pointerId) return;

    if (dragState.isDragging) {
        finishDrag(e.clientX, e.clientY);
    } else {
        dragState.pendingDrag = null;
    }

    cleanupPointerHandlers(e);
}

function handleYukonPointerCancel(e) {
    if (dragState.activePointerId !== e.pointerId) return;
    resetDragState();
    renderYukonGame();
    cleanupPointerHandlers(e);
}

function startPointerDrag(e) {
    const { cardEl } = dragState.pendingDrag;
    if (!cardEl) return;

    const col = parseInt(cardEl.dataset.column, 10);
    const row = parseInt(cardEl.dataset.index, 10);
    const column = yukonGameState.tableau[col];
    if (!column) return;

    dragState.draggedCards = column.slice(row);
    if (dragState.draggedCards.some(card => card.hidden)) {
        resetDragState();
        return;
    }

    dragState.sourceColumn = col;
    dragState.sourceRow = row;
    dragState.draggedElements = collectDraggedElements(cardEl);
    createDragLayer(e);
    dragState.isDragging = true;
    dragState.pendingDrag = null;
}

function collectDraggedElements(cardEl) {
    const columnEl = document.getElementById(`yukon-tableau-${cardEl.dataset.column}`);
    if (!columnEl) return [];
    const cards = Array.from(columnEl.querySelectorAll('.card'));
    const startIndex = cards.findIndex(el => parseInt(el.dataset.index, 10) === parseInt(cardEl.dataset.index, 10));
    return startIndex >= 0 ? cards.slice(startIndex) : [];
}

function createDragLayer(e) {
    if (dragState.draggedElements.length === 0) return;

    const topCard = dragState.draggedElements[0];
    const rect = topCard.getBoundingClientRect();
    dragState.pointerOffsetX = e.clientX - rect.left;
    dragState.pointerOffsetY = e.clientY - rect.top;

    const offsets = getStackOffsets();
    const layer = document.createElement('div');
    layer.className = 'drag-layer';
    layer.style.position = 'fixed';
    layer.style.left = '0';
    layer.style.top = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '1000';
    layer.style.width = `${rect.width}px`;
    layer.style.height = `${CARD_HEIGHT + (dragState.draggedElements.length - 1) * offsets.y}px`;

    dragState.draggedElements.forEach((el, idx) => {
        el.classList.add('picked-up');
        el.style.position = 'absolute';
        el.style.left = '0';
        el.style.top = `${idx * offsets.y}px`;
        el.style.margin = '0';
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

function finishDrag(clientX, clientY) {
    if (dragState.draggedCards.length === 0) {
        resetDragState();
        return;
    }

    const dropPoint = getDropPoint(clientX, clientY);
    let moved = false;
    const targetCandidates = buildDropTargetCandidates(dropPoint.x, dropPoint.y);

    for (const target of targetCandidates) {
        if (target.type === 'tableau') {
            if (target.index === dragState.sourceColumn) continue;
            moved = applyTableauMove(dragState.sourceColumn, target.index);
            if (moved) break;
            continue;
        }

        moved = applyFoundationMove(dragState.sourceColumn, target.index);
        if (moved) break;
    }

    resetDragState();
    renderYukonGame();
}

function applyTableauMove(fromCol, toCol) {
    if (fromCol === null || fromCol === toCol) return false;
    if (!canDropOnTableau(toCol)) return false;

    const column = yukonGameState.tableau[fromCol];
    const startRow = Number.isFinite(dragState.sourceRow) ? dragState.sourceRow : column.length - dragState.draggedCards.length;
    const cardsToMove = column.slice(startRow);
    column.splice(startRow, cardsToMove.length);
    yukonGameState.tableau[toCol].push(...cardsToMove);

    flipExposedHiddenCards(fromCol);
    yukonGameState.moves++;
    yukonGameState.score += 5;
    document.getElementById('yukon-undo').disabled = false;
    yukonStateManager.save();
    return true;
}

function applyFoundationMove(fromCol, foundationIndex) {
    if (fromCol === null) return false;
    const column = yukonGameState.tableau[fromCol];
    if (!column.length) return false;
    const card = column[column.length - 1];
    if (!card || !SolitaireLogic.canPlaceOnFoundation(card, yukonGameState.foundations[foundationIndex])) {
        return false;
    }

    column.pop();
    yukonGameState.foundations[foundationIndex].push(card);
    flipExposedHiddenCards(fromCol);

    yukonGameState.moves++;
    yukonGameState.score += 10;
    document.getElementById('yukon-undo').disabled = false;
    yukonStateManager.save();
    return true;
}

function canDropOnTableau(targetCol, movingCards = dragState.draggedCards) {
    if (!Array.isArray(movingCards) || movingCards.length === 0) return false;
    const movingCard = movingCards[0];
    const targetPile = yukonGameState.tableau[targetCol];

    if (!targetPile || targetPile.length === 0) {
        return SolitaireLogic.canMoveToEmptyTableau(movingCard, { allowAnyCardOnEmpty: true });
    }

    const topCard = targetPile[targetPile.length - 1];
    if (topCard.hidden) return false;
    return SolitaireLogic.canPlaceOnTableau(movingCard, topCard);
}

function isValidYukonTableauMove(card, toCol) {
    if (!card) return false;
    const targetColumn = yukonGameState.tableau[toCol];
    if (!targetColumn || targetColumn.length === 0) {
        return SolitaireLogic.canMoveToEmptyTableau(card, { allowAnyCardOnEmpty: true });
    }
    const targetCard = targetColumn[targetColumn.length - 1];
    if (targetCard.hidden) return false;
    return SolitaireLogic.canPlaceOnTableau(card, targetCard);
}

function getStackOffsets() {
    return {
        y: CommonUtils.getSolitaireStackOffset(STACK_OFFSET, { minFactor: 0.42 })
    };
}

function getMaxYukonLength() {
    return yukonGameState.tableau.reduce((max, column) => Math.max(max, column.length), 0);
}

function getDropPoint(clientX, clientY) {
    return { x: clientX, y: clientY };
}

function getDirectDropTarget(clientX, clientY) {
    return UIHelpers.getTargetFromPoint(clientX, clientY, [
        {
            selector: '.tableau-column',
            resolve: (el) => ({ type: 'tableau', index: parseInt(el.dataset.column, 10) })
        },
        {
            selector: '.foundation-slot',
            resolve: (el) => ({ type: 'foundation', index: parseInt(el.dataset.pile.split('-')[1], 10) })
        }
    ]);
}

function buildDropTargetCandidates(clientX, clientY) {
    const direct = getDirectDropTarget(clientX, clientY);
    const candidates = [];
    const seen = new Set();
    const addCandidate = (target) => {
        if (!target || !target.type || !Number.isFinite(target.index)) return;
        const key = `${target.type}:${target.index}`;
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push(target);
    };

    addCandidate(direct);
    const tableauIndex = findTableauDropColumn(clientX, clientY);
    if (tableauIndex !== null) {
        addCandidate({ type: 'tableau', index: tableauIndex });
    }
    const foundationIndex = findFoundationDropPile(clientX, clientY);
    if (foundationIndex !== null) {
        addCandidate({ type: 'foundation', index: foundationIndex });
    }

    return candidates;
}

function updateDragIndicators(clientX, clientY) {
    clearDropIndicators();
    if (!dragState.isDragging) return;

    const columnIndex = findTableauDropColumn(clientX, clientY);
    if (columnIndex !== null) {
        const columnEl = document.getElementById(`yukon-tableau-${columnIndex}`);
        if (columnEl) {
            columnEl.classList.add(canDropOnTableau(columnIndex) ? 'drag-over-valid' : 'drag-over-invalid');
        }
        return;
    }

    const foundationIndex = findFoundationDropPile(clientX, clientY);
    if (foundationIndex !== null) {
        const foundationEl = document.querySelector(`.foundation-slot[data-pile="foundation-${foundationIndex}"]`);
        if (foundationEl) {
            foundationEl.classList.add(
                canDropOnFoundation(foundationIndex) ? 'drag-over-valid' : 'drag-over-invalid'
            );
        }
    }
}

function canDropOnFoundation(targetFoundation, movingCards = dragState.draggedCards) {
    if (!Array.isArray(movingCards) || movingCards.length !== 1) return false;
    const movingCard = movingCards[0];
    return SolitaireLogic.canPlaceOnFoundation(movingCard, yukonGameState.foundations[targetFoundation]);
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
    return parseInt(bestColumn.dataset.column, 10);
}

function findFoundationDropPile(clientX, clientY) {
    const padding = CommonUtils.isMobile() ? MOBILE_FOUNDATION_DROP_PADDING : FOUNDATION_DROP_PADDING;
    let bestPile = null;
    let bestDistance = Infinity;

    document.querySelectorAll('.foundation-slot').forEach(slot => {
        const rect = slot.getBoundingClientRect();
        const paddedRect = UIHelpers.getRectWithPadding(rect, padding);
        if (!UIHelpers.isPointInRect(clientX, clientY, paddedRect)) return;

        const dist = UIHelpers.distanceToRect(clientX, clientY, rect);
        if (dist < bestDistance) {
            bestDistance = dist;
            bestPile = slot;
        }
    });

    if (!bestPile) return null;
    return parseInt(bestPile.dataset.pile.split('-')[1], 10);
}

function clearDropIndicators() {
    document.querySelectorAll('.drag-over-valid, .drag-over-invalid').forEach(el => {
        el.classList.remove('drag-over-valid', 'drag-over-invalid');
    });
}

function ensureYukonSizing() {
    CommonUtils.preserveHorizontalScroll({
        targets: ['yukon-scroll'],
        update: () => {
            const offsets = getStackOffsets();
            yukonSessionMaxTableauCards = Math.max(yukonSessionMaxTableauCards, getMaxYukonLength());
            const maxCards = Math.max(YUKON_MIN_TABLEAU_CARDS, yukonSessionMaxTableauCards);
            const stackHeight = CommonUtils.getStackHeight(maxCards, offsets.y);

            CommonUtils.ensureTableauMinHeight({
                table: 'table',
                topRow: 'yukon-foundations',
                stackOffset: offsets.y,
                maxCards,
                cardHeight: CARD_HEIGHT,
                extraBottom: 40
            });

            document.querySelectorAll('.tableau-column').forEach(column => {
                column.style.minHeight = `${Math.ceil(stackHeight)}px`;
            });

            CommonUtils.ensureScrollableWidth({
                table: 'table',
                wrapper: 'yukon-scroll',
                contentSelectors: ['#yukon-foundations', '#yukon-tableau']
            });
        }
    });
}

const scheduleYukonSizing = CommonUtils.createRafScheduler(ensureYukonSizing);

function ensureYukonMobileController() {
    if (dragState.mobileController || typeof MobileSolitaireController === 'undefined') return;

    dragState.mobileController = new MobileSolitaireController({
        isMovable: (el) => {
            if (!el || el.classList.contains('hidden')) return false;
            const col = parseInt(el.dataset.column, 10);
            const idx = parseInt(el.dataset.index, 10);
            const column = yukonGameState.tableau[col];
            const card = column ? column[idx] : null;
            return !!card && !card.hidden;
        },
        getSequence: (el) => {
            const col = parseInt(el.dataset.column, 10);
            const idx = parseInt(el.dataset.index, 10);
            const column = yukonGameState.tableau[col];
            return column ? column.slice(idx) : [];
        },
        getSource: (el) => ({
            type: 'tableau',
            index: parseInt(el.dataset.column, 10)
        }),
        getElements: (el) => collectDraggedElements(el),
        findDropTarget: (x, y) => {
            const directTarget = UIHelpers.getTargetFromPoint(x, y, [
                {
                    selector: '.foundation-slot',
                    resolve: (el) => ({ type: 'foundation', index: parseInt(el.dataset.pile.split('-')[1], 10) })
                },
                {
                    selector: '.tableau-column',
                    resolve: (el) => ({ type: 'tableau', index: parseInt(el.dataset.column, 10) })
                }
            ]);
            if (directTarget) return directTarget;

            const columnIndex = findTableauDropColumn(x, y);
            if (columnIndex !== null) return { type: 'tableau', index: columnIndex };
            const foundationIndex = findFoundationDropPile(x, y);
            if (foundationIndex !== null) return { type: 'foundation', index: foundationIndex };
            return null;
        },
        isValidMove: (source, target) => {
            dragState.draggedCards = dragState.mobileController.selectedData.cards;
            dragState.sourceColumn = source.index;
            const selectedElements = dragState.mobileController.selectedData.elements;
            const firstElement = selectedElements.length > 0 ? selectedElements[0] : null;
            dragState.sourceRow = firstElement ? parseInt(firstElement.dataset.index, 10) : null;

            let valid = false;
            if (target.type === 'tableau') {
                valid = canDropOnTableau(target.index);
            } else if (target.type === 'foundation') {
                valid = canDropOnFoundation(target.index);
            }

            dragState.draggedCards = [];
            dragState.sourceColumn = null;
            dragState.sourceRow = null;
            return valid;
        },
        executeMove: (source, target) => {
            dragState.draggedCards = dragState.mobileController.selectedData.cards;
            dragState.sourceColumn = source.index;
            const firstElement = dragState.mobileController.selectedData.elements[0];
            dragState.sourceRow = firstElement ? parseInt(firstElement.dataset.index, 10) : null;

            let targetEl = null;
            if (target.type === 'tableau') {
                targetEl = document.getElementById(`yukon-tableau-${target.index}`);
            } else if (target.type === 'foundation') {
                targetEl = document.querySelector(`.foundation-slot[data-pile=\"foundation-${target.index}\"]`);
            }

            if (targetEl) {
                const rect = targetEl.getBoundingClientRect();
                finishDrag(rect.left + rect.width / 2, rect.top + rect.height / 2);
            } else {
                resetDragState();
                renderYukonGame();
            }
        }
    });

    if (CommonUtils.isMobile() && !dragState.mobileBindingsAttached) {
        const tableEl = document.getElementById('table');
        if (tableEl) {
            tableEl.addEventListener('pointerdown', (e) => dragState.mobileController.handlePointerDown(e));
        }
        document.addEventListener('pointermove', (e) => dragState.mobileController.handlePointerMove(e));
        document.addEventListener('pointerup', (e) => dragState.mobileController.handlePointerUp(e));
        document.addEventListener('pointercancel', (e) => dragState.mobileController.handlePointerCancel(e));
        dragState.mobileBindingsAttached = true;
    }
}

function resetDragState() {
    dragState.draggedElements.forEach(el => {
        el.classList.remove('picked-up');
        el.style.position = '';
        el.style.left = '';
        el.style.top = '';
        el.style.margin = '';
    });

    if (dragState.dragLayer && dragState.dragLayer.parentNode) {
        dragState.dragLayer.parentNode.removeChild(dragState.dragLayer);
    }

    dragState.dragLayer = null;
    dragState.draggedCards = [];
    dragState.draggedElements = [];
    dragState.isDragging = false;
    dragState.sourceColumn = null;
    dragState.sourceRow = null;
    dragState.pendingDrag = null;
    clearDropIndicators();
}

function cleanupPointerHandlers(e) {
    document.removeEventListener('pointermove', handleYukonPointerMove);
    document.removeEventListener('pointerup', handleYukonPointerUp);
    document.removeEventListener('pointercancel', handleYukonPointerCancel);
    if (e && e.target && e.target.releasePointerCapture) {
        e.target.releasePointerCapture(e.pointerId);
    }
    dragState.activePointerId = null;
}

function flipExposedHiddenCards(col) {
    const column = yukonGameState.tableau[col];
    if (!column || column.length === 0) return;

    const topCard = column[column.length - 1];
    if (topCard.hidden) {
        topCard.hidden = false;
        yukonGameState.score += 5;
    }
}

function updateYukonTimer() {
    if (yukonGameState.startTime && !yukonGameState.isGameWon) {
        const elapsed = Math.floor((Date.now() - yukonGameState.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('yukon-time').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function winYukonGame() {
    if (yukonGameState.isGameWon) return;
    yukonGameState.isGameWon = true;
    if (yukonGameState.timerInterval) {
        clearInterval(yukonGameState.timerInterval);
        yukonGameState.timerInterval = null;
    }
    
    // Add bonus points based on time and moves
    const elapsedSeconds = Math.floor((Date.now() - yukonGameState.startTime) / 1000);
    const timeBonus = Math.max(0, 1000 - elapsedSeconds * 2);
    const movesBonus = Math.max(0, 1000 - yukonGameState.moves * 2);
    const baseWinBonus = 1000;
    
    yukonGameState.score += timeBonus + movesBonus + baseWinBonus;
    
    // Update UI
    document.getElementById('yukon-score').textContent = yukonGameState.score;
    
    const timeText = document.getElementById('yukon-time').textContent;
    CommonUtils.showTableToast(
        `Yukon solved in ${yukonGameState.moves} moves and ${timeText}! Final Score: ${yukonGameState.score}`,
        { variant: 'win', duration: 4000 }
    );
    
    // Sync high score
    syncYukonHighScore();
    
    // Save the won game
    yukonStateManager.save();
}

function undoYukonMove() {
    // Yukon doesn't typically support undo in traditional implementations
    if (confirm("Are you sure you want to restart the game? Yukon doesn't have full undo support.")) {
        initYukonGame();
        CommonUtils.showTableToast('Yukon game restarted.', { variant: 'warn' });
    }
}

function showYukonHint() {
    const hint = getYukonHintMessage();
    if (hint) {
        CommonUtils.showTableToast(hint);
    } else {
        CommonUtils.showTableToast('No obvious moves available. Look for possible sequences.', { variant: 'warn' });
    }
}

function showYukonHelp() {
    const message = [
        'Goal: Build all four foundations from Ace to King by suit.',
        'Tableau: Build down in alternating colors.',
        'Yukon rule: Move any face-up group, even when cards inside that group are not in sequence.',
        'Empty columns: Only Kings can fill an empty tableau column.',
        'Tip: Expose face-down cards quickly to open up new moves.'
    ].join('\n');
    if (typeof SolitaireUiFeedback !== 'undefined' && typeof SolitaireUiFeedback.showHelp === 'function') {
        SolitaireUiFeedback.showHelp({ title: 'Yukon Rules', message });
        return;
    }
    if (typeof SolitaireUiFeedback !== 'undefined' && typeof SolitaireUiFeedback.showInfo === 'function') {
        SolitaireUiFeedback.showInfo({ title: 'Yukon Rules', message });
        return;
    }
    alert(`Yukon Rules\n\n${message}`);
}

function getYukonHintMessage() {
    for (let fromCol = 0; fromCol < 7; fromCol++) {
        const column = yukonGameState.tableau[fromCol];
        if (!column.length) continue;
        for (let row = 0; row < column.length; row++) {
            const card = column[row];
            if (card.hidden) continue;
            const subsequence = column.slice(row);
            if (subsequence.some(c => c.hidden)) continue;

            if (row === column.length - 1) {
                for (let foundationIndex = 0; foundationIndex < 4; foundationIndex++) {
                    if (SolitaireLogic.canPlaceOnFoundation(card, yukonGameState.foundations[foundationIndex])) {
                        return `Try moving ${card.val}${card.suit} to the foundation`;
                    }
                }
            }

            for (let toCol = 0; toCol < 7; toCol++) {
                if (toCol === fromCol) continue;
                if (isValidYukonTableauMove(card, toCol)) {
                    return `Try moving ${card.val}${card.suit} to column ${toCol + 1}`;
                }
            }
        }
    }

    return null;
}

function getYukonSaveState() {
    const serializeCard = (card) => ({
        ...card,
        rank: card.rank,
        color: card.color
    });

    return {
        tableau: yukonGameState.tableau.map(col => 
            col.map(card => serializeCard(card))
        ),
        foundations: yukonGameState.foundations.map(f => 
            f.map(card => serializeCard(card))
        ),
        score: yukonGameState.score,
        moves: yukonGameState.moves,
        startTime: yukonGameState.startTime,
        isGameWon: yukonGameState.isGameWon,
        timestamp: Date.now()
    };
}

function restoreYukonState(savedState) {
    if (!savedState) return false;
    ensureYukonMobileController();
    const normalize = (card) => {
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
    };

    yukonGameState.tableau = savedState.tableau.map(col => 
        col.map(card => normalize(card))
    );
    yukonGameState.foundations = savedState.foundations.map(f => 
        f.map(card => normalize(card))
    );
    yukonGameState.score = savedState.score;
    yukonGameState.moves = savedState.moves;
    yukonGameState.startTime = savedState.startTime;
    yukonGameState.isGameWon = savedState.isGameWon;
    yukonGameState.moveHistory = Array.isArray(savedState.moveHistory) ? savedState.moveHistory.slice() : [];
    yukonSessionMaxTableauCards = Math.max(YUKON_MIN_TABLEAU_CARDS, getMaxYukonLength());
    
    // Restart the timer if game wasn't won
    if (!yukonGameState.isGameWon && yukonGameState.startTime) {
        if (yukonGameState.timerInterval) {
            clearInterval(yukonGameState.timerInterval);
        }
        yukonGameState.timerInterval = setInterval(updateYukonTimer, 1000);
    }
    
    renderYukonGame();
    document.getElementById('yukon-undo').disabled = (yukonGameState.moveHistory.length === 0);
    return true;
}

function syncYukonHighScore() {
    const highScoreEl = document.getElementById('yukon-high-score');
    if (!highScoreEl) return;
    const highScore = CommonUtils.updateHighScore('yukon', 'classic', yukonGameState.score);
    highScoreEl.textContent = highScore;
}
