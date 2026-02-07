/**
 * Solitaire (Klondike) Game Controller
 * Manages game state, UI updates, and user interactions
 */

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
    isGameWon: false
};

// Drag state
const dragState = {
    draggedCards: [],
    sourcePile: null,
    sourceIndex: null,
    draggedElement: null
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
    initGame();
});

/**
 * Initialize a new game
 */
function initGame() {
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

    // Create and shuffle deck
    const deck = CommonUtils.createShoe(1, SUITS, VALUES);

    // Deal tableau (1 card to first column, 2 to second, etc.)
    for (let col = 0; col < 7; col++) {
        for (let row = 0; row <= col; row++) {
            const card = deck.pop();
            if (row === col) {
                card.hidden = false; // Top card is face up
            } else {
                card.hidden = true; // Other cards are face down
            }
            gameState.tableau[col].push(card);
        }
    }

    // Remaining cards go to stock
    gameState.stock = deck;

    // Start timer
    startTimer();

    // Update UI
    updateUI();
    hideWinOverlay();

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
}

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
            cardEl.dataset.column = col;
            cardEl.dataset.index = index;

            // Only allow interaction with face-up cards
            if (!card.hidden) {
                cardEl.draggable = true;
                cardEl.addEventListener('dragstart', handleDragStart);
                cardEl.addEventListener('click', handleCardClick);
                cardEl.style.cursor = 'pointer';
            }

            columnEl.appendChild(cardEl);
        });

        // Make column a drop zone
        columnEl.addEventListener('dragover', handleDragOver);
        columnEl.addEventListener('drop', handleDrop);
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
            foundationEl.appendChild(cardEl);
        } else {
            // Show placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'pile-placeholder';
            placeholder.textContent = foundationEl.dataset.suit;
            foundationEl.appendChild(placeholder);
        }

        // Make foundation a drop zone
        foundationEl.addEventListener('dragover', handleDragOver);
        foundationEl.addEventListener('drop', handleDrop);
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

            // Only top card is draggable
            if (i === gameState.waste.length - 1) {
                cardEl.draggable = true;
                cardEl.dataset.waste = 'true';
                cardEl.addEventListener('dragstart', handleDragStart);
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

    for (let i = 0; i < cardsToDraw; i++) {
        const card = gameState.stock.pop();
        card.hidden = false;
        gameState.waste.push(card);
    }

    gameState.moves++;
    CommonUtils.playSound('card');
    updateUI();
}

/**
 * Recycle waste back to stock
 */
function recycleWaste() {
    if (gameState.waste.length === 0) return;

    // Move all waste cards back to stock (reversed)
    while (gameState.waste.length > 0) {
        const card = gameState.waste.pop();
        card.hidden = true;
        gameState.stock.push(card);
    }

    gameState.score += SolitaireLogic.scoreMove('recycle-waste');
    gameState.moves++;
    CommonUtils.playSound('card');
    updateUI();
}

/**
 * Handle drag start
 */
function handleDragStart(e) {
    const cardEl = e.target;

    // Check if dragging from waste
    if (cardEl.dataset.waste) {
        const card = gameState.waste[gameState.waste.length - 1];
        dragState.draggedCards = [card];
        dragState.sourcePile = 'waste';
        dragState.sourceIndex = gameState.waste.length - 1;
    } else {
        // Dragging from tableau
        const col = parseInt(cardEl.dataset.column);
        const index = parseInt(cardEl.dataset.index);

        // Get all cards from this position to the end
        dragState.draggedCards = gameState.tableau[col].slice(index);
        dragState.sourcePile = 'tableau';
        dragState.sourceIndex = col;
    }

    dragState.draggedElement = cardEl;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', cardEl.innerHTML);

    // Build a custom drag image showing the full stack of cards being dragged
    const dragPreview = document.createElement('div');
    dragPreview.style.position = 'absolute';
    dragPreview.style.top = '-9999px';
    dragPreview.style.left = '-9999px';
    dragPreview.style.pointerEvents = 'none';
    dragPreview.style.zIndex = '10000';

    dragState.draggedCards.forEach((card, i) => {
        const clone = CommonUtils.createCardEl(card);
        clone.style.position = 'absolute';
        clone.style.top = `${i * 25}px`;
        clone.style.left = '0';
        clone.style.margin = '0';
        clone.style.transform = 'none';
        dragPreview.appendChild(clone);
    });

    // Size the container so the browser captures the full stack
    const cardWidth = 70;
    const cardHeight = 100;
    const stackHeight = cardHeight + (dragState.draggedCards.length - 1) * 25;
    dragPreview.style.width = `${cardWidth}px`;
    dragPreview.style.height = `${stackHeight}px`;

    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, cardWidth / 2, 20);

    // Clean up the off-screen element after the browser has captured it
    requestAnimationFrame(() => {
        document.body.removeChild(dragPreview);
    });

    setTimeout(() => {
        cardEl.classList.add('dragging');
    }, 0);
}

/**
 * Handle drag over
 */
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

/**
 * Handle drop
 */
function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const targetEl = e.currentTarget;
    let isValid = false;
    let moveType = '';

    // Determine target pile
    if (targetEl.classList.contains('tableau-column')) {
        const targetCol = parseInt(targetEl.id.split('-')[1]);
        isValid = attemptTableauMove(targetCol);
        moveType = dragState.sourcePile === 'waste' ? 'waste-to-tableau' : 'tableau-to-tableau';
    } else if (targetEl.classList.contains('foundation-pile')) {
        const targetFoundation = parseInt(targetEl.id.split('-')[1]);
        isValid = attemptFoundationMove(targetFoundation);
        moveType = dragState.sourcePile === 'waste' ? 'waste-to-foundation' : 'tableau-to-foundation';
    }

    if (isValid) {
        gameState.score += SolitaireLogic.scoreMove(moveType);
        gameState.moves++;
        CommonUtils.playSound('card');
        updateUI();
        checkWinCondition();
    }

    // Clear drag state
    if (dragState.draggedElement) {
        dragState.draggedElement.classList.remove('dragging');
    }
    dragState.draggedCards = [];
    dragState.sourcePile = null;
    dragState.sourceIndex = null;
    dragState.draggedElement = null;

    return false;
}

/**
 * Attempt to move cards to tableau
 */
function attemptTableauMove(targetCol) {
    if (dragState.draggedCards.length === 0) return false;

    const movingCard = dragState.draggedCards[0];
    const targetPile = gameState.tableau[targetCol];

    let isValid = false;

    if (targetPile.length === 0) {
        // Empty column - only Kings allowed
        isValid = SolitaireLogic.canMoveToEmptyTableau(movingCard);
    } else {
        // Check if can place on top card
        const topCard = targetPile[targetPile.length - 1];
        isValid = !topCard.hidden && SolitaireLogic.canPlaceOnTableau(movingCard, topCard);
    }

    if (isValid) {
        // Remove cards from source
        if (dragState.sourcePile === 'waste') {
            gameState.waste.pop();
        } else if (dragState.sourcePile === 'tableau') {
            const sourceCol = dragState.sourceIndex;
            gameState.tableau[sourceCol] = gameState.tableau[sourceCol].slice(0, -dragState.draggedCards.length);

            // Flip top card if it's hidden
            if (gameState.tableau[sourceCol].length > 0) {
                const topCard = gameState.tableau[sourceCol][gameState.tableau[sourceCol].length - 1];
                if (topCard.hidden) {
                    topCard.hidden = false;
                    gameState.score += SolitaireLogic.scoreMove('flip-card');
                }
            }
        }

        // Add cards to target
        gameState.tableau[targetCol].push(...dragState.draggedCards);
        return true;
    }

    return false;
}

/**
 * Attempt to move card to foundation
 */
function attemptFoundationMove(targetFoundation) {
    if (dragState.draggedCards.length !== 1) return false; // Only single cards to foundation

    const movingCard = dragState.draggedCards[0];
    const foundationPile = gameState.foundations[targetFoundation];

    const isValid = SolitaireLogic.canPlaceOnFoundation(movingCard, foundationPile);

    if (isValid) {
        // Remove card from source
        if (dragState.sourcePile === 'waste') {
            gameState.waste.pop();
        } else if (dragState.sourcePile === 'tableau') {
            const sourceCol = dragState.sourceIndex;
            gameState.tableau[sourceCol].pop();

            // Flip top card if it's hidden
            if (gameState.tableau[sourceCol].length > 0) {
                const topCard = gameState.tableau[sourceCol][gameState.tableau[sourceCol].length - 1];
                if (topCard.hidden) {
                    topCard.hidden = false;
                    gameState.score += SolitaireLogic.scoreMove('flip-card');
                }
            }
        }

        // Add card to foundation
        gameState.foundations[targetFoundation].push(movingCard);
        return true;
    }

    return false;
}

/**
 * Handle card click (for auto-move to foundation)
 */
function handleCardClick(e) {
    const cardEl = e.target.closest('.card');
    if (!cardEl) return;

    let card = null;
    let sourcePile = null;
    let sourceIndex = null;

    // Determine source
    if (cardEl.dataset.waste) {
        card = gameState.waste[gameState.waste.length - 1];
        sourcePile = 'waste';
    } else if (cardEl.dataset.column !== undefined) {
        const col = parseInt(cardEl.dataset.column);
        const index = parseInt(cardEl.dataset.index);
        const tableau = gameState.tableau[col];

        // Only allow clicking the top card
        if (index !== tableau.length - 1) return;

        card = tableau[index];
        sourcePile = 'tableau';
        sourceIndex = col;
    }

    if (!card) return;

    // Try to auto-move to foundation
    for (let i = 0; i < 4; i++) {
        if (SolitaireLogic.canPlaceOnFoundation(card, gameState.foundations[i])) {
            // Remove from source
            if (sourcePile === 'waste') {
                gameState.waste.pop();
            } else if (sourcePile === 'tableau') {
                gameState.tableau[sourceIndex].pop();

                // Flip top card if hidden
                if (gameState.tableau[sourceIndex].length > 0) {
                    const topCard = gameState.tableau[sourceIndex][gameState.tableau[sourceIndex].length - 1];
                    if (topCard.hidden) {
                        topCard.hidden = false;
                        gameState.score += SolitaireLogic.scoreMove('flip-card');
                    }
                }
            }

            // Add to foundation
            gameState.foundations[i].push(card);

            const moveType = sourcePile === 'waste' ? 'waste-to-foundation' : 'tableau-to-foundation';
            gameState.score += SolitaireLogic.scoreMove(moveType);
            gameState.moves++;

            CommonUtils.playSound('card');
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
            gameState.score += SolitaireLogic.scoreMove('waste-to-foundation');
        } else if (move.fromPile.startsWith('tableau')) {
            const col = parseInt(move.fromPile.split('-')[1]);
            const card = gameState.tableau[col].pop();
            const foundationIndex = parseInt(move.toPile.split('-')[1]);
            gameState.foundations[foundationIndex].push(card);
            gameState.score += SolitaireLogic.scoreMove('tableau-to-foundation');

            // Flip top card if hidden
            if (gameState.tableau[col].length > 0) {
                const topCard = gameState.tableau[col][gameState.tableau[col].length - 1];
                if (topCard.hidden) {
                    topCard.hidden = false;
                    gameState.score += SolitaireLogic.scoreMove('flip-card');
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
        alert(`Hint: Move ${autoMoves[0].card.val}${autoMoves[0].card.suit} to foundation!`);
        return;
    }

    // Check for tableau moves
    for (let col = 0; col < 7; col++) {
        const tableau = gameState.tableau[col];
        if (tableau.length > 0) {
            const topCard = tableau[tableau.length - 1];
            if (!topCard.hidden) {
                const validMoves = SolitaireLogic.getValidMoves(topCard, gameState);
                if (validMoves.length > 0) {
                    const move = validMoves[0];
                    alert(`Hint: Move ${topCard.val}${topCard.suit} to ${move.type} ${move.index + 1}`);
                    return;
                }
            }
        }
    }

    // Check waste
    if (gameState.waste.length > 0) {
        const wasteCard = gameState.waste[gameState.waste.length - 1];
        const validMoves = SolitaireLogic.getValidMoves(wasteCard, gameState);
        if (validMoves.length > 0) {
            const move = validMoves[0];
            alert(`Hint: Move ${wasteCard.val}${wasteCard.suit} from waste to ${move.type} ${move.index + 1}`);
            return;
        }
    }

    alert('Hint: Try drawing from the stock or recycling the waste pile!');
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

    // Draw count
    document.getElementById('draw-count-select').addEventListener('change', (e) => {
        gameState.drawCount = parseInt(e.target.value);
    });
}
