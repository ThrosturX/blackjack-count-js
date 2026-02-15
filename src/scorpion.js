/**
 * Scorpion Solitaire Game Controller
 * Manages game state, UI updates, and user interactions
 */

const scorpionSoundFiles = {
    card: ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav'],
    win: ['win.wav'],
    shuffle: ['shuffle.wav']
};

// Game state
const gameState = {
    tableau: Array.from({ length: 7 }, () => []),
    foundations: [[], [], [], []],
    moves: 0,
    startTime: null,
    timerInterval: null,
    score: 0,
    highScore: 0,
    moveHistory: [],
    isGameWon: false
};

let scorpionStateManager = null;

// Layout constants
const DRAG_MOVE_THRESHOLD = 6;
const STACK_OFFSET_Y = 25;
const STACK_OFFSET_X = 2.5;
const SCORPION_BASE_TABLEAU_GAP = 15;
const SCORPION_MIN_TABLEAU_GAP = 4;
const SCORPION_MIN_TABLEAU_CARDS = 13;
const MAX_HISTORY = 200;

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
    mobileController: null
};

document.addEventListener('DOMContentLoaded', () => {
    // Shared initialization
    CommonUtils.preloadAudio(scorpionSoundFiles);
    CommonUtils.initCardScaleControls('scorpion-card-scale', 'scorpion-card-scale-value');

    scorpionStateManager = new CommonUtils.StateManager({
        gameId: 'scorpion',
        getState: getScorpionSaveState,
        setState: restoreScorpionState,
        isWon: () => gameState.isGameWon
    });

    setupScorpionEventListeners();
    initScorpionThemes();

    const restored = scorpionStateManager.load();
    if (!restored) {
        initScorpionGame();
    }
    syncScorpionHighScore();
});

function setupScorpionEventListeners() {
    document.getElementById('scorpion-new-game').addEventListener('click', () => {
        if (typeof SolitaireCheckModal !== 'undefined') {
            SolitaireCheckModal.showConfirm({
                title: 'New Game',
                message: 'Start a new game? Current progress will be lost.',
                confirmLabel: 'New Game'
            }).then(confirmed => {
                if (confirmed) initScorpionGame();
            });
        }
    });

    document.getElementById('scorpion-undo').addEventListener('click', undoScorpionMove);

    document.getElementById('scorpion-stock').addEventListener('click', dealFromScorpionStock);

    const table = document.getElementById('table');
    table.addEventListener('pointerdown', handleScorpionPointerDown);
    window.addEventListener('pointermove', handleScorpionPointerMove);
    window.addEventListener('pointerup', handleScorpionPointerUp);
    window.addEventListener('pointercancel', handleScorpionPointerCancel);

    document.getElementById('scorpion-hint').addEventListener('click', showScorpionHint);
    document.getElementById('scorpion-help').addEventListener('click', showScorpionHelp);

    // Scaling listener
    document.getElementById('scorpion-card-scale').addEventListener('input', scheduleScorpionSizing);
    window.addEventListener('resize', scheduleScorpionSizing);
}

function initScorpionThemes() {
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
}

function initScorpionGame() {
    ensureMobileController();

    const deck = createShuffledDeck();

    // Reset state
    gameState.tableau = Array.from({ length: 7 }, () => []);
    gameState.stock = [];
    gameState.foundations = [[], [], [], []];
    gameState.moves = 0;
    gameState.score = 0;
    gameState.moveHistory = [];
    gameState.isGameWon = false;
    gameState.startTime = Date.now();

    // Deal 49 cards to 7 columns (7x7)
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 7; col++) {
            const card = deck.pop();
            // First 4 columns: bottom 3 cards are face-down (rows 0, 1, 2)
            if (col < 4 && row < 3) {
                card.hidden = true;
            } else {
                card.hidden = false;
            }
            gameState.tableau[col].push(card);
        }
    }

    // Remaining 3 cards go into stock
    gameState.stock = deck;

    // Stop timer
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    startScorpionTimer();

    renderScorpionGame();
    saveScorpionState();

    CommonUtils.playSound('shuffle');
}

function applyAdaptiveScorpionSpacing() {
    const tableEl = document.getElementById('table');
    const wrapperEl = document.getElementById('scorpion-scroll');
    const tableauEl = document.getElementById('scorpion-tableau');
    if (!tableEl || !wrapperEl || !tableauEl) return;

    const scale = CommonUtils.getUiScaleValue();
    const baseGap = CommonUtils.getSolitaireStackOffset(SCORPION_BASE_TABLEAU_GAP, {
        scale,
        min: SCORPION_MIN_TABLEAU_GAP,
        max: SCORPION_BASE_TABLEAU_GAP
    });

    const styles = getComputedStyle(tableauEl);
    const currentGap = parseFloat(styles.columnGap || styles.gap) || baseGap;
    const availableWidth = wrapperEl.getBoundingClientRect().width || 0;

    const spacing = CommonUtils.resolveAdaptiveSpacing({
        availableWidth,
        contentWidth: tableauEl.scrollWidth,
        currentGap,
        baseGap,
        minGap: SCORPION_MIN_TABLEAU_GAP,
        gapSlots: Math.max(0, gameState.tableau.length - 1)
    });

    tableEl.style.setProperty('--scorpion-tableau-gap', `${spacing.gap}px`);
}

function ensureScorpionSizing() {
    applyAdaptiveScorpionSpacing();
    const offsets = getScorpionStackOffsets();
    const maxCards = Math.max(SCORPION_MIN_TABLEAU_CARDS, getMaxTableauLength());
    const stackHeight = CommonUtils.getStackHeight(maxCards, offsets.y);

    CommonUtils.ensureTableauMinHeight({
        table: 'table',
        topRow: 'scorpion-top-bar',
        stackOffset: offsets.y,
        maxCards
    });

    const tableauArea = document.getElementById('scorpion-tableau');
    if (tableauArea) {
        tableauArea.style.minHeight = `${Math.ceil(stackHeight)}px`;
    }

    CommonUtils.ensureScrollableWidth({
        table: 'table',
        wrapper: 'scorpion-scroll',
        contentSelectors: ['#scorpion-top-bar', '#scorpion-tableau']
    });
}

const scheduleScorpionSizing = CommonUtils.createRafScheduler(ensureScorpionSizing);

function getMaxTableauLength() {
    return gameState.tableau.reduce((max, col) => Math.max(max, col.length), 0);
}

function getScorpionStackOffsets() {
    return {
        y: CommonUtils.getSolitaireStackOffset(STACK_OFFSET_Y, { minFactor: 0.42 }),
        x: 0 // Scorpion doesn't usually fan X in tableau, but can if needed.
    };
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

function ensureMobileController() {
    if (dragState.mobileController || typeof MobileSolitaireController === 'undefined') return;

    dragState.mobileController = new MobileSolitaireController({
        isMovable: (el) => {
            const col = parseInt(el.dataset.col, 10);
            const row = parseInt(el.dataset.row, 10);
            const column = gameState.tableau[col];
            const card = column ? column[row] : null;
            return card && !card.hidden;
        },
        getSequence: (el) => {
            const col = parseInt(el.dataset.col, 10);
            const row = parseInt(el.dataset.row, 10);
            const column = gameState.tableau[col];
            return column ? column.slice(row) : [];
        },
        getSource: (el) => {
            const col = parseInt(el.dataset.col, 10);
            const row = parseInt(el.dataset.row, 10);
            return { type: 'tableau', index: col, row: row };
        },
        getElements: (el) => {
            const colIndex = parseInt(el.dataset.col, 10);
            const rowIndex = parseInt(el.dataset.row, 10);
            const colEl = document.querySelector(`.tableau-column[data-col="${colIndex}"]`);
            if (!colEl) return [];
            const children = Array.from(colEl.children);
            return children.slice(rowIndex);
        },
        findDropTarget: (x, y) => {
            const directTarget = UIHelpers.getTargetFromPoint(x, y, [
                {
                    selector: '.tableau-column',
                    resolve: (el) => ({ type: 'tableau', index: parseInt(el.dataset.col, 10) })
                }
            ]);
            if (directTarget) return directTarget;

            const colIndex = findTableauDropColumn(x, y);
            if (colIndex !== -1) return { type: 'tableau', index: colIndex };
            return null;
        },
        isValidMove: (source, target) => {
            const movingCard = dragState.mobileController.selectedData.cards[0];
            const targetCol = gameState.tableau[target.index];

            if (targetCol.length === 0) {
                return ScorpionLogic.canMoveToEmptyTableau(movingCard);
            } else {
                const topCard = targetCol[targetCol.length - 1];
                return ScorpionLogic.canPlaceOnTableau(movingCard, topCard);
            }
        },
        executeMove: (source, target) => {
            dragState.draggedCards = dragState.mobileController.selectedData.cards;
            dragState.sourceColumn = source.index;
            dragState.sourceRow = source.row;

            finishScorpionDrag(0, 0, target.index); // clientX/Y ignored if target provided
        }
    });

    // Mobile selection listeners are now handled in the main pointer handlers
}

function renderScorpionGame() {
    const tableauArea = document.getElementById('scorpion-tableau');
    if (!tableauArea) return;

    CommonUtils.preserveHorizontalScroll({
        targets: ['scorpion-scroll'],
        update: () => {
            tableauArea.innerHTML = '';
            const fragment = document.createDocumentFragment();
            const offsets = getScorpionStackOffsets();

            gameState.tableau.forEach((column, colIndex) => {
                const colEl = document.createElement('div');
                colEl.className = 'tableau-column pile';
                colEl.dataset.col = colIndex;
                colEl.id = `scorpion-column-${colIndex}`;

                column.forEach((card, rowIndex) => {
                    const cardEl = CommonUtils.createCardEl(card);
                    if (!cardEl) return;
                    cardEl.dataset.col = colIndex;
                    cardEl.dataset.row = rowIndex;
                    cardEl.style.position = 'absolute';
                    cardEl.style.top = `${rowIndex * offsets.y}px`;
                    cardEl.style.zIndex = rowIndex;

                    if (!card.hidden) {
                        cardEl.style.cursor = 'pointer';
                    }

                    colEl.appendChild(cardEl);
                });

                fragment.appendChild(colEl);
            });

            tableauArea.appendChild(fragment);

            // Re-apply selection if exists (for tap-to-pick persistence)
            if (dragState.mobileController && dragState.mobileController.state === 'SELECTED') {
                dragState.mobileController.selectedData.elements.forEach(oldEl => {
                    const col = oldEl.dataset.col;
                    const row = oldEl.dataset.row;
                    const newEl = document.querySelector(`.card[data-col="${col}"][data-row="${row}"]`);
                    if (newEl) newEl.classList.add('picked-up');
                });
            }
        }
    });

    updateScorpionFoundations();
    updateScorpionStockUI();
    updateScorpionStats();
    scheduleScorpionSizing();
}

function updateScorpionFoundations() {
    const foundationsEl = document.getElementById('scorpion-foundations');
    if (!foundationsEl) return;
    foundationsEl.innerHTML = '';

    for (let i = 0; i < 4; i++) {
        const slot = document.createElement('div');
        slot.className = 'foundation-slot slot';

        const pile = gameState.foundations[i];
        if (pile && pile.length > 0) {
            const topCard = pile[pile.length - 1];
            const cardEl = CommonUtils.createCardEl(topCard);
            slot.appendChild(cardEl);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'empty-slot';
            placeholder.textContent = 'K';
            slot.appendChild(placeholder);
        }
        foundationsEl.appendChild(slot);
    }
}

function checkForScorpionSequences() {
    let clearedCount = 0;
    for (let colIndex = 0; colIndex < gameState.tableau.length; colIndex++) {
        const column = gameState.tableau[colIndex];
        if (column.length < 13) continue;

        // Check the last 13 cards for a complete sequence
        for (let i = 0; i <= column.length - 13; i++) {
            const potential = column.slice(i, i + 13);
            if (ScorpionLogic.isCompleteSequence(potential) && !potential.some(c => c.hidden)) {
                // Move to foundation
                const sequence = column.splice(i, 13);

                // Find empty foundation slot
                let slotIndex = gameState.foundations.findIndex(f => f.length === 0);
                if (slotIndex !== -1) {
                    gameState.foundations[slotIndex] = sequence;

                    recordScorpionMove({
                        type: 'sequence-cleared',
                        payload: {
                            col: colIndex,
                            row: i,
                            cards: sequence,
                            slotIndex: slotIndex
                        }
                    });

                    clearedCount++;
                    CommonUtils.playSound('card'); // Or sequence sound if available

                    // Auto flip if necessary
                    if (column.length > 0 && column[column.length - 1].hidden) {
                        column[column.length - 1].hidden = false;
                        gameState.moveHistory[gameState.moveHistory.length - 1].payload.flipped = true;
                    }
                }
                break; // One sequence per column per move is enough to check
            }
        }
    }
    if (clearedCount > 0) renderScorpionGame();
}

function isScorpionGameWon() {
    // Game is won when all 4 foundation slots are filled
    return gameState.foundations.every(f => f.length === 13);
}

function updateScorpionStockUI() {
    const stockEl = document.getElementById('scorpion-stock');
    if (!stockEl) return;
    stockEl.innerHTML = '';

    if (gameState.stock.length > 0) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card hidden';
        stockEl.appendChild(cardEl);
        stockEl.classList.remove('empty');
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'empty-slot';
        placeholder.textContent = 'None';
        stockEl.appendChild(placeholder);
        stockEl.classList.add('empty');
    }
}

function updateScorpionStats() {
    document.getElementById('scorpion-moves').textContent = gameState.moves;
    document.getElementById('scorpion-score').textContent = gameState.score;
    syncScorpionHighScore();
}

function recordScorpionMove(moveEntry) {
    gameState.moveHistory.push(moveEntry);
    if (gameState.moveHistory.length > MAX_HISTORY) gameState.moveHistory.shift();
    updateScorpionUndoButton();
    if (scorpionStateManager) scorpionStateManager.markDirty();
}

function updateScorpionUndoButton() {
    const btn = document.getElementById('scorpion-undo');
    if (btn) btn.disabled = gameState.moveHistory.length === 0;
}

function handleScorpionPointerDown(e) {
    if (e.button !== 0) return;

    const isTouch = e.pointerType === 'touch' || CommonUtils.isMobile();
    if (isTouch && dragState.mobileController) {
        if (dragState.mobileController.handlePointerDown(e)) return;
    }

    const cardEl = e.target.closest('.card');
    if (!cardEl) return;

    const colIndex = parseInt(cardEl.dataset.col, 10);
    const rowIndex = parseInt(cardEl.dataset.row, 10);

    // Guard against non-tableau cards (foundation slots)
    if (isNaN(colIndex) || isNaN(rowIndex)) return;

    const column = gameState.tableau[colIndex];
    if (!column) return;

    const sequence = column.slice(rowIndex);
    if (sequence.length === 0 || sequence.some(card => card.hidden)) return;

    dragState.pendingDrag = {
        cardEl,
        startX: e.clientX,
        startY: e.clientY
    };
    dragState.activePointerId = e.pointerId;

    if (cardEl.setPointerCapture) {
        cardEl.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
}

function startScorpionDrag(e) {
    const { cardEl } = dragState.pendingDrag;
    if (!cardEl) return;

    const colIndex = parseInt(cardEl.dataset.col, 10);
    const rowIndex = parseInt(cardEl.dataset.row, 10);
    const column = gameState.tableau[colIndex];
    const sequence = column.slice(rowIndex);

    dragState.draggedCards = sequence;
    dragState.sourceColumn = colIndex;
    dragState.sourceRow = rowIndex;

    const rect = cardEl.getBoundingClientRect();
    dragState.pointerOffsetX = e.clientX - rect.left;
    dragState.pointerOffsetY = e.clientY - rect.top;

    // Collect elements
    const colEl = document.querySelector(`.tableau-column[data-col="${colIndex}"]`);
    const children = Array.from(colEl.children);
    dragState.draggedElements = children.slice(rowIndex);

    // Create drag layer
    dragState.dragLayer = document.createElement('div');
    dragState.dragLayer.className = 'drag-layer';
    dragState.dragLayer.style.position = 'fixed';
    dragState.dragLayer.style.left = '0';
    dragState.dragLayer.style.top = '0';
    dragState.dragLayer.style.width = '100%';
    dragState.dragLayer.style.height = '100%';
    dragState.dragLayer.style.pointerEvents = 'none';
    dragState.dragLayer.style.zIndex = '1000';
    document.body.appendChild(dragState.dragLayer);

    const offsets = getScorpionStackOffsets();

    dragState.draggedElements.forEach((el, i) => {
        el.style.visibility = 'hidden';
        const clone = el.cloneNode(true);
        clone.style.visibility = 'visible';
        clone.style.position = 'absolute';
        clone.style.top = `${i * offsets.y}px`;
        clone.style.left = '0';
        clone.style.zIndex = 1000 + i;
        dragState.dragLayer.appendChild(clone);
    });

    dragState.isDragging = true;
    dragState.pendingDrag = null;
    updateDragLayerPosition(e.clientX, e.clientY);
}

function handleScorpionPointerMove(e) {
    if (dragState.activePointerId !== e.pointerId) {
        if (CommonUtils.isMobile() && dragState.mobileController) {
            dragState.mobileController.handlePointerMove(e);
        }
        return;
    }

    if (dragState.isDragging) {
        updateDragLayerPosition(e.clientX, e.clientY);
        updateDropIndicators(e.clientX, e.clientY);
    } else if (dragState.pendingDrag) {
        // Threshold check for starting drag
        const dist = Math.hypot(e.clientX - dragState.pendingDrag.startX, e.clientY - dragState.pendingDrag.startY);
        if (dist > DRAG_MOVE_THRESHOLD) {
            startScorpionDrag(e);
        }
    }
}

function updateDragLayerPosition(clientX, clientY) {
    if (!dragState.dragLayer) return;
    const x = clientX - dragState.pointerOffsetX;
    const y = clientY - dragState.pointerOffsetY;

    // Move the entire drag layer or its container
    dragState.dragLayer.style.transform = `translate(${x}px, ${y}px)`;
}

function handleScorpionPointerUp(e) {
    if (dragState.activePointerId !== e.pointerId) {
        if (CommonUtils.isMobile() && dragState.mobileController) {
            dragState.mobileController.handlePointerUp(e);
        }
        return;
    }

    dragState.pendingDrag = null;

    if (dragState.isDragging) {
        finishScorpionDrag(e.clientX, e.clientY);
    }

    dragState.activePointerId = null;
    dragState.isDragging = false;
}

function handleScorpionPointerCancel(e) {
    if (dragState.activePointerId !== e.pointerId) {
        if (CommonUtils.isMobile() && dragState.mobileController) {
            dragState.mobileController.handlePointerCancel(e);
        }
        return;
    }
    resetScorpionDragState();
}

function resetScorpionDragState() {
    if (dragState.dragLayer) {
        dragState.dragLayer.remove();
        dragState.dragLayer = null;
    }
    if (dragState.draggedElements) {
        dragState.draggedElements.forEach(el => el.style.visibility = 'visible');
        dragState.draggedElements = [];
    }
    dragState.isDragging = false;
    dragState.activePointerId = null;
    dragState.pendingDrag = null;
    clearScorpionDropIndicators();
    renderScorpionGame();
}

function finishScorpionDrag(clientX, clientY, forcedTargetCol = -1) {
    const dropCol = forcedTargetCol !== -1 ? forcedTargetCol : findTableauDropColumn(clientX, clientY);
    let moved = false;

    if (dropCol !== -1 && dropCol !== dragState.sourceColumn) {
        const targetColumn = gameState.tableau[dropCol];
        const movingCard = dragState.draggedCards[0];

        let valid = false;
        if (targetColumn.length === 0) {
            valid = ScorpionLogic.canMoveToEmptyTableau(movingCard);
        } else {
            const topCard = targetColumn[targetColumn.length - 1];
            valid = ScorpionLogic.canPlaceOnTableau(movingCard, topCard);
        }

        if (valid) {
            const cardsToMove = gameState.tableau[dragState.sourceColumn].splice(dragState.sourceRow);

            recordScorpionMove({
                type: 'tableau-to-tableau',
                payload: {
                    fromCol: dragState.sourceColumn,
                    toCol: dropCol,
                    cards: cardsToMove,
                    flipped: false
                }
            });

            gameState.tableau[dropCol].push(...cardsToMove);

            // Auto flip new top card
            const sourceCol = gameState.tableau[dragState.sourceColumn];
            if (sourceCol.length > 0 && sourceCol[sourceCol.length - 1].hidden) {
                sourceCol[sourceCol.length - 1].hidden = false;
                gameState.moveHistory[gameState.moveHistory.length - 1].payload.flipped = true;
                CommonUtils.playSound('card');
            }

            gameState.moves++;
            moved = true;
            CommonUtils.playSound('card');

            checkForScorpionSequences();

            if (isScorpionGameWon()) {
                handleScorpionWin();
            }
        }
    }

    // Cleanup
    if (dragState.dragLayer) {
        dragState.dragLayer.remove();
        dragState.dragLayer = null;
    }
    dragState.draggedCards = [];
    dragState.draggedElements = [];

    renderScorpionGame();
    if (moved) saveScorpionState();
    clearDropIndicators();
}

function dealFromScorpionStock() {
    if (gameState.stock.length === 0) return;

    // Deal 3 cards to first 3 columns
    const dealtCards = [];
    for (let i = 0; i < 3; i++) {
        if (gameState.stock.length > 0) {
            const card = gameState.stock.pop();
            card.hidden = false;
            gameState.tableau[i].push(card);
            dealtCards.push({ col: i, card });
        }
    }

    recordScorpionMove({
        type: 'deal-stock',
        payload: { dealt: dealtCards }
    });

    gameState.moves++;
    CommonUtils.playSound('card');
    checkForScorpionSequences();

    if (isScorpionGameWon()) {
        handleScorpionWin();
    }

    renderScorpionGame();
    saveScorpionState();
}

function findTableauDropColumn(x, y) {
    const cols = document.querySelectorAll('.tableau-column');
    for (const col of cols) {
        const rect = col.getBoundingClientRect();
        // Check if cursor is over column area
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom + 500) {
            return parseInt(col.dataset.col);
        }
    }
    return -1;
}

function updateDropIndicators(x, y) {
    clearDropIndicators();
    const colIndex = findTableauDropColumn(x, y);
    if (colIndex !== -1 && colIndex !== dragState.sourceColumn) {
        const colEl = document.querySelector(`.tableau-column[data-col="${colIndex}"]`);
        const targetColumn = gameState.tableau[colIndex];
        const movingCard = dragState.draggedCards[0];

        let valid = false;
        if (targetColumn.length === 0) {
            valid = ScorpionLogic.canMoveToEmptyTableau(movingCard);
        } else {
            const topCard = targetColumn[targetColumn.length - 1];
            valid = ScorpionLogic.canPlaceOnTableau(movingCard, topCard);
        }

        colEl.classList.add(valid ? 'drag-over-valid' : 'drag-over-invalid');
    }
}

function clearDropIndicators() {
    document.querySelectorAll('.tableau-column').forEach(el => {
        el.classList.remove('drag-over-valid', 'drag-over-invalid');
    });
}

function handleScorpionPointerCancel(e) {
    if (dragState.activePointerId !== e.pointerId) return;
    if (dragState.dragLayer) dragState.dragLayer.remove();
    dragState.dragLayer = null;
    dragState.activePointerId = null;
    dragState.isDragging = false;
    renderScorpionGame();
}

function undoScorpionMove() {
    if (gameState.moveHistory.length === 0) return;

    const lastMove = gameState.moveHistory.pop();

    switch (lastMove.type) {
        case 'tableau-to-tableau':
            const targetCol = gameState.tableau[lastMove.payload.toCol];
            const movedCards = targetCol.splice(targetCol.length - lastMove.payload.cards.length);
            gameState.tableau[lastMove.payload.fromCol].push(...movedCards);

            if (lastMove.payload.flipped) {
                const sourceCol = gameState.tableau[lastMove.payload.fromCol];
                if (sourceCol.length > 0) {
                    sourceCol[sourceCol.length - 1].hidden = true;
                }
            }
            break;

        case 'deal-stock':
            if (lastMove.payload.dealt) {
                // Use a clone to avoid reversing the original history payload
                [...lastMove.payload.dealt].reverse().forEach(entry => {
                    const card = gameState.tableau[entry.col].pop();
                    if (card) {
                        card.hidden = true;
                        gameState.stock.push(card);
                    }
                });
            }
            break;

        case 'sequence-cleared':
            // Pull from foundation and insert back into tableau at correct row
            const sequence = gameState.foundations[lastMove.payload.slotIndex];
            gameState.foundations[lastMove.payload.slotIndex] = [];
            gameState.tableau[lastMove.payload.col].splice(lastMove.payload.row, 0, ...sequence);

            if (lastMove.payload.flipped) {
                const col = gameState.tableau[lastMove.payload.col];
                const aboveRow = lastMove.payload.row - 1;
                if (aboveRow >= 0 && col[aboveRow]) {
                    col[aboveRow].hidden = true;
                }
            }
            // Recurse to undo the move that triggered the sequence clear
            undoScorpionMove();
            return; // Exit here as recursion handles the rest
    }

    gameState.moves = Math.max(0, gameState.moves - 1);
    renderScorpionGame();
    saveScorpionState();
    CommonUtils.playSound('card');
}

function handleScorpionWin() {
    clearInterval(gameState.timerInterval);
    const timeStr = document.getElementById('scorpion-time').textContent;
    const finalScore = calculateScorpionScore();

    gameState.highScore = CommonUtils.updateHighScore('scorpion', 'default', finalScore);
    syncScorpionHighScore();

    CommonUtils.playSound('win');

    const message = `You won Scorpion Solitaire!\nMoves: ${gameState.moves}\nTime: ${timeStr}\nScore: ${finalScore}`;
    if (typeof SolitaireUiFeedback !== 'undefined') {
        SolitaireUiFeedback.showInfo({
            title: "Congratulations!",
            message: message,
            variant: 'win'
        });
    }
}

function calculateScorpionScore() {
    // Basic scoring: 500 base - moves * 2 - timeSeconds
    const base = 500;
    const timeSpent = Math.floor((Date.now() - gameState.startTime) / 1000);
    return Math.max(0, base - (gameState.moves * 2) - Math.floor(timeSpent / 5));
}

function startScorpionTimer() {
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    gameState.timerInterval = setInterval(() => {
        const elapsed = getElapsedSeconds();
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        document.getElementById('scorpion-time').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function getElapsedSeconds() {
    if (!Number.isFinite(gameState.startTime)) return 0;
    return Math.max(0, Math.floor((Date.now() - gameState.startTime) / 1000));
}

function syncScorpionHighScore() {
    gameState.highScore = CommonUtils.getHighScore('scorpion', 'default');
    const el = document.getElementById('scorpion-high-score');
    if (el) el.textContent = gameState.highScore;
}

function getScorpionSaveState() {
    return {
        tableau: gameState.tableau,
        stock: gameState.stock,
        foundations: gameState.foundations,
        moves: gameState.moves,
        score: gameState.score,
        moveHistory: gameState.moveHistory,
        elapsedSeconds: getElapsedSeconds(),
        isGameWon: gameState.isGameWon
    };
}

function restoreScorpionState(state) {
    if (!state) return;
    ensureMobileController();

    gameState.tableau = state.tableau || Array.from({ length: 7 }, () => []);
    gameState.stock = state.stock || [];
    gameState.foundations = state.foundations || [[], [], [], []];
    gameState.moves = state.moves || 0;
    gameState.score = state.score || 0;
    gameState.moveHistory = state.moveHistory || [];
    gameState.isGameWon = state.isGameWon || false;

    const elapsed = state.elapsedSeconds || 0;
    gameState.startTime = Date.now() - elapsed * 1000;

    startScorpionTimer();
    renderScorpionGame();
    updateScorpionUndoButton();
}

function showScorpionHelp() {
    const helpText = `
        Scorpion Solitaire Rules:
        - Build 4 suited sequences from King to Ace down the tableau.
        - You can move any face-up card or sequence, regardless of cards on top.
        - Build down in suit (e.g., 9 of Hearts on 10 of Hearts).
        - Only Kings can fill empty columns.
        - Click the stock to deal the remaining 3 cards to the first 3 columns.
    `;
    if (typeof SolitaireUiFeedback !== 'undefined') {
        SolitaireUiFeedback.showHelp({ message: helpText });
    }
}

function showScorpionHint() {
    const hint = "Look for opportunities to expose face-down cards or move Kings to empty columns.";
    if (typeof SolitaireUiFeedback !== 'undefined') {
        SolitaireUiFeedback.showInfo({
            title: "Hint",
            message: hint
        });
    }
}

function saveScorpionState() {
    if (scorpionStateManager) scorpionStateManager.save();
}
