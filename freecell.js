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

let freecellStateManager = null;

const CARD_HEIGHT = 100;
const STACK_OFFSET = 25;
const MAX_HISTORY = 200;
const FREECELL_MIN_TABLEAU_CARDS = 20;

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
        gameId: 'freecell',
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

    freecellState.tableau = saved.tableau || Array.from({ length: 8 }, () => []);
    freecellState.freeCells = saved.freeCells || Array(4).fill(null);
    freecellState.foundations = saved.foundations || [[], [], [], []];
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
    scheduleTableauSizing();
}

function getMaxTableauLength() {
    return freecellState.tableau.reduce((max, column) => Math.max(max, column.length), 0);
}

function ensureTableauSizing() {
    const maxCards = Math.max(FREECELL_MIN_TABLEAU_CARDS, getMaxTableauLength());
    const stackHeight = CommonUtils.getStackHeight(maxCards, STACK_OFFSET);
    CommonUtils.ensureTableauMinHeight({
        table: 'table',
        topRow: 'freecell-top-row',
        stackOffset: STACK_OFFSET,
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
        contentSelectors: ['#freecell-top-row', '#freecell-tableau']
    });
}

const scheduleTableauSizing = CommonUtils.createRafScheduler(ensureTableauSizing);

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
        if (freecellStateManager) {
            freecellStateManager.clear();
        }
    }
}

function setupFreeCellEventListeners() {
    document.getElementById('freecell-new-game').addEventListener('click', initFreeCellGame);
    const undoBtn = document.getElementById('freecell-undo');
    if (undoBtn) {
        undoBtn.addEventListener('click', undoLastMove);
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
