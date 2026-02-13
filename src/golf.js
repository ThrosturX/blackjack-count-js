(function () {
    'use strict';

    const GOLF_TABLEAU_COLS = 7;
    const GOLF_TABLEAU_ROWS = 5;
    const TABLEAU_STACK_Y = 25;
    const TABLEAU_STACK_X = 2.5;
    const MAX_HISTORY = 240;

    const GOLF_SUITS = (typeof SUITS !== 'undefined') ? SUITS : ['♥', '♦', '♣', '♠'];
    const GOLF_VALUES = (typeof VALUES !== 'undefined') ? VALUES : ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const GolfRules = (window.GolfLogic || null);

    const soundFiles = {
        card: ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav'],
        win: ['win.wav'],
        shuffle: ['shuffle.wav']
    };

    const state = {
        tableau: [],
        stock: [],
        waste: [],
        foundation: [],
        score: 0,
        moves: 0,
        startTime: null,
        timerInterval: null,
        moveHistory: [],
        isGameWon: false
    };

    let stateManager = null;
    const scheduleSizing = CommonUtils.createRafScheduler(ensureGolfSizing);

    function formatTime(seconds) {
        const value = Number.isFinite(seconds) ? seconds : 0;
        const mins = Math.floor(value / 60);
        const secs = Math.floor(value % 60);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    function getElapsedSeconds(startTime) {
        if (!Number.isFinite(startTime)) return 0;
        return Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    }

    function getTotalCardCount() {
        const tableauCount = state.tableau.reduce((sum, col) => sum + (Array.isArray(col) ? col.length : 0), 0);
        return tableauCount + state.stock.length + state.waste.length + state.foundation.length;
    }

    function isPlayableState() {
        if (!Array.isArray(state.tableau) || state.tableau.length !== GOLF_TABLEAU_COLS) return false;
        if (!state.tableau.every((col) => Array.isArray(col))) return false;
        if (!Array.isArray(state.stock) || !Array.isArray(state.waste) || !Array.isArray(state.foundation)) return false;
        if (state.foundation.length < 1) return false;
        return getTotalCardCount() === 52;
    }

    function reviveCard(card) {
        if (!card) return card;
        if (typeof CommonUtils.reviveCardObject === 'function') {
            return CommonUtils.reviveCardObject(card);
        }
        return card;
    }

    function getSaveState() {
        return {
            tableau: state.tableau,
            stock: state.stock,
            waste: state.waste,
            foundation: state.foundation,
            score: state.score,
            moves: state.moves,
            moveHistory: state.moveHistory,
            elapsedSeconds: getElapsedSeconds(state.startTime),
            isGameWon: state.isGameWon
        };
    }

    function restoreState(saved) {
        if (!saved || typeof saved !== 'object') return;

        state.tableau = Array.isArray(saved.tableau)
            ? saved.tableau.slice(0, GOLF_TABLEAU_COLS).map((col) => (Array.isArray(col) ? col.map(reviveCard) : []))
            : [];
        while (state.tableau.length < GOLF_TABLEAU_COLS) {
            state.tableau.push([]);
        }

        state.stock = Array.isArray(saved.stock) ? saved.stock.map(reviveCard) : [];
        state.waste = Array.isArray(saved.waste) ? saved.waste.map(reviveCard) : [];
        state.foundation = Array.isArray(saved.foundation) ? saved.foundation.map(reviveCard) : [];

        state.score = Number.isFinite(saved.score) ? saved.score : 0;
        state.moves = Number.isFinite(saved.moves) ? saved.moves : 0;
        state.moveHistory = Array.isArray(saved.moveHistory)
            ? saved.moveHistory.map((entry) => (
                typeof CommonUtils.hydrateSavedValue === 'function'
                    ? CommonUtils.hydrateSavedValue(entry)
                    : entry
            ))
            : [];
        state.isGameWon = false;

        const elapsed = Number.isFinite(saved.elapsedSeconds) ? saved.elapsedSeconds : 0;
        state.startTime = Date.now() - elapsed * 1000;

        if (!isPlayableState()) {
            if (stateManager) stateManager.clear();
            initGame();
            return;
        }

        startTimer();
        updateUI();
        hideWinOverlay();
        updateUndoButtonState();
    }

    function clearRuntimeState() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        state.tableau = Array.from({ length: GOLF_TABLEAU_COLS }, () => []);
        state.stock = [];
        state.waste = [];
        state.foundation = [];
        state.score = 0;
        state.moves = 0;
        state.moveHistory = [];
        state.isGameWon = false;
        state.startTime = Date.now();
    }

    function dealNewGame() {
        const deck = CommonUtils.createShoe(1, GOLF_SUITS, GOLF_VALUES);

        for (let col = 0; col < GOLF_TABLEAU_COLS; col += 1) {
            for (let row = 0; row < GOLF_TABLEAU_ROWS; row += 1) {
                const card = deck.pop();
                if (!card) continue;
                card.hidden = false;
                state.tableau[col].push(card);
            }
        }

        const starter = deck.pop();
        if (starter) {
            starter.hidden = false;
            state.foundation.push(starter);
        }

        state.stock = deck;
        state.stock.forEach((card) => {
            card.hidden = true;
        });
    }

    function initGame() {
        clearRuntimeState();
        dealNewGame();
        startTimer();
        updateUI();
        hideWinOverlay();
        updateUndoButtonState();
        CommonUtils.playSound('shuffle');
        if (stateManager) stateManager.markDirty();
    }

    function startTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        state.timerInterval = setInterval(() => {
            const timeEl = document.getElementById('golf-time');
            if (!timeEl) return;
            timeEl.textContent = formatTime(getElapsedSeconds(state.startTime));
        }, 1000);
    }

    function syncHighScore() {
        const highEl = document.getElementById('golf-high-score');
        if (!highEl) return;
        const key = 'standard';
        const current = CommonUtils.getHighScore('golf', key);
        if (state.isGameWon && (current === 0 || state.score < current)) {
            CommonUtils.saveHighScore('golf', key, state.score);
        }
        const latest = CommonUtils.getHighScore('golf', key);
        highEl.textContent = latest === 0 ? '-' : String(latest);
    }

    function updateStats() {
        const movesEl = document.getElementById('golf-moves');
        const scoreEl = document.getElementById('golf-score');
        const timeEl = document.getElementById('golf-time');
        if (movesEl) movesEl.textContent = String(state.moves);
        if (scoreEl) scoreEl.textContent = String(state.score);
        if (timeEl) timeEl.textContent = formatTime(getElapsedSeconds(state.startTime));
        syncHighScore();
    }

    function ensureTableauColumns() {
        const root = document.getElementById('golf-tableau');
        if (!root) return;
        for (let i = 0; i < GOLF_TABLEAU_COLS; i += 1) {
            const id = `golf-column-${i}`;
            if (document.getElementById(id)) continue;
            const col = document.createElement('div');
            col.id = id;
            col.className = 'tableau-column';
            root.appendChild(col);
        }
    }

    function getStackOffsets() {
        return {
            y: CommonUtils.getSolitaireStackOffset(TABLEAU_STACK_Y, { minFactor: 0.42 }),
            x: CommonUtils.getSolitaireStackOffset(TABLEAU_STACK_X, { min: 1, max: TABLEAU_STACK_X })
        };
    }

    function ensureGolfSizing() {
        const offsets = getStackOffsets();
        const maxCards = Math.max(GOLF_TABLEAU_ROWS, ...state.tableau.map((col) => col.length));
        const stackHeight = CommonUtils.getStackHeight(maxCards, offsets.y);

        CommonUtils.ensureTableauMinHeight({
            table: 'golf-table',
            topRow: 'golf-top-row',
            stackOffset: offsets.y,
            maxCards
        });

        const area = document.getElementById('golf-tableau-area');
        if (area) area.style.minHeight = `${Math.ceil(stackHeight)}px`;
        document.querySelectorAll('#golf-tableau .tableau-column').forEach((col) => {
            col.style.minHeight = `${Math.ceil(stackHeight)}px`;
        });

        CommonUtils.ensureScrollableWidth({
            table: 'golf-table',
            wrapper: 'golf-scroll',
            contentSelectors: ['#golf-top-row', '#golf-tableau']
        });
    }

    function updateStock() {
        const stockEl = document.getElementById('golf-stock');
        if (!stockEl) return;
        stockEl.innerHTML = '';

        if (state.stock.length === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'pile-placeholder';
            placeholder.textContent = 'Empty';
            stockEl.appendChild(placeholder);
            return;
        }

        const cardEl = document.createElement('div');
        cardEl.className = 'card hidden';
        cardEl.style.cursor = 'pointer';
        cardEl.addEventListener('click', drawFromStock);
        stockEl.appendChild(cardEl);
    }

    function updateWaste() {
        const wasteEl = document.getElementById('golf-waste');
        if (!wasteEl) return;
        wasteEl.innerHTML = '';

        if (state.waste.length === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'pile-placeholder';
            placeholder.textContent = 'Waste';
            wasteEl.appendChild(placeholder);
            return;
        }

        const top = state.waste[state.waste.length - 1];
        const cardEl = CommonUtils.createCardEl(top);
        cardEl.dataset.source = 'waste';
        cardEl.style.cursor = 'pointer';
        cardEl.addEventListener('click', () => tryMoveWasteToFoundation());
        cardEl.addEventListener('dblclick', () => tryMoveWasteToFoundation());
        wasteEl.appendChild(cardEl);
    }

    function updateFoundation() {
        const foundationEl = document.getElementById('golf-foundation');
        if (!foundationEl) return;
        foundationEl.innerHTML = '';

        if (state.foundation.length === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'pile-placeholder';
            placeholder.textContent = 'Foundation';
            foundationEl.appendChild(placeholder);
            return;
        }

        const card = state.foundation[state.foundation.length - 1];
        const cardEl = CommonUtils.createCardEl(card);
        cardEl.dataset.source = 'foundation';
        foundationEl.appendChild(cardEl);
    }

    function updateTableau() {
        ensureTableauColumns();
        const offsets = getStackOffsets();

        for (let col = 0; col < GOLF_TABLEAU_COLS; col += 1) {
            const colEl = document.getElementById(`golf-column-${col}`);
            if (!colEl) continue;
            colEl.innerHTML = '';

            const cards = state.tableau[col] || [];
            cards.forEach((card, idx) => {
                const cardEl = CommonUtils.createCardEl(card);
                cardEl.style.position = 'absolute';
                cardEl.style.top = `${idx * offsets.y}px`;
                cardEl.style.left = `${idx * offsets.x}px`;
                cardEl.dataset.column = String(col);
                cardEl.dataset.index = String(idx);

                if (idx === cards.length - 1) {
                    cardEl.classList.add('top-card');
                    cardEl.style.cursor = 'pointer';
                    cardEl.addEventListener('click', () => tryMoveTableauToFoundation(col));
                    cardEl.addEventListener('dblclick', () => tryMoveTableauToFoundation(col));
                }

                colEl.appendChild(cardEl);
            });
        }
    }

    function updateUI() {
        CommonUtils.preserveHorizontalScroll({
            targets: ['golf-scroll', 'golf-tableau-area'],
            update: () => {
                updateStock();
                updateWaste();
                updateFoundation();
                updateTableau();
                updateStats();
                scheduleSizing();
            }
        });
    }

    function canMoveToFoundation(card) {
        if (!card || !GolfRules || typeof GolfRules.canPlaceOnFoundation !== 'function') return false;
        const top = state.foundation.length ? state.foundation[state.foundation.length - 1] : null;
        return GolfRules.canPlaceOnFoundation(card, top);
    }

    function getMoveScore(type) {
        if (!GolfRules || typeof GolfRules.scoreMove !== 'function') return 0;
        return GolfRules.scoreMove(type);
    }

    function recordMove(entry) {
        state.moveHistory.push(entry);
        if (state.moveHistory.length > MAX_HISTORY) {
            state.moveHistory.shift();
        }
        updateUndoButtonState();
        if (stateManager) stateManager.markDirty();
    }

    function completeMove(moveType, payload, scoreDelta) {
        state.moves += 1;
        state.score += scoreDelta;
        recordMove({
            type: moveType,
            payload,
            scoreDelta,
            movesDelta: 1
        });
        CommonUtils.playSound('card');
        updateUI();
        checkWinCondition();
    }

    function drawFromStock() {
        if (state.isGameWon || state.stock.length === 0) return;
        const card = state.stock.pop();
        card.hidden = false;
        state.waste.push(card);
        completeMove('draw-stock', { card }, getMoveScore('draw-stock'));
    }

    function tryMoveWasteToFoundation() {
        if (state.isGameWon || state.waste.length === 0) return false;
        const card = state.waste[state.waste.length - 1];
        if (!canMoveToFoundation(card)) return false;
        state.waste.pop();
        state.foundation.push(card);
        completeMove('waste-to-foundation', { card, fromPile: 'waste' }, getMoveScore('waste-to-foundation'));
        return true;
    }

    function tryMoveTableauToFoundation(columnIndex) {
        if (state.isGameWon) return false;
        const column = state.tableau[columnIndex];
        if (!column || column.length === 0) return false;

        const card = column[column.length - 1];
        if (!canMoveToFoundation(card)) return false;

        column.pop();
        state.foundation.push(card);
        completeMove('tableau-to-foundation', {
            card,
            fromPile: 'tableau',
            fromColumn: columnIndex
        }, getMoveScore('tableau-to-foundation'));
        return true;
    }

    function updateUndoButtonState() {
        const btn = document.getElementById('golf-undo');
        if (!btn) return;
        btn.disabled = state.moveHistory.length === 0;
    }

    function undoLastMove() {
        if (!state.moveHistory.length) return;
        const move = state.moveHistory.pop();
        state.score -= move.scoreDelta;
        state.moves = Math.max(0, state.moves - move.movesDelta);
        state.isGameWon = false;
        hideWinOverlay();

        if (move.type === 'draw-stock') {
            const card = state.waste.pop();
            if (card) {
                card.hidden = true;
                state.stock.push(card);
            }
        } else if (move.type === 'waste-to-foundation') {
            const card = state.foundation.pop();
            if (card) state.waste.push(card);
        } else if (move.type === 'tableau-to-foundation') {
            const card = state.foundation.pop();
            if (card && Number.isFinite(move.payload.fromColumn)) {
                state.tableau[move.payload.fromColumn].push(card);
            }
        }

        updateUndoButtonState();
        updateUI();
        if (stateManager) stateManager.markDirty();
    }

    function showHint() {
        if (state.isGameWon) return;

        if (state.waste.length > 0) {
            const wasteCard = state.waste[state.waste.length - 1];
            if (canMoveToFoundation(wasteCard)) {
                CommonUtils.showTableToast(
                    `Hint: Move ${wasteCard.val}${wasteCard.suit} from waste to foundation.`,
                    { variant: 'warn', duration: 2200, containerId: 'golf-table' }
                );
                return;
            }
        }

        for (let col = 0; col < GOLF_TABLEAU_COLS; col += 1) {
            const column = state.tableau[col];
            if (!column || !column.length) continue;
            const top = column[column.length - 1];
            if (canMoveToFoundation(top)) {
                CommonUtils.showTableToast(
                    `Hint: Move ${top.val}${top.suit} from column ${col + 1} to foundation.`,
                    { variant: 'warn', duration: 2200, containerId: 'golf-table' }
                );
                return;
            }
        }

        if (state.stock.length > 0) {
            CommonUtils.showTableToast('Hint: Draw a card from stock.', {
                variant: 'warn', duration: 2200, containerId: 'golf-table'
            });
            return;
        }

        CommonUtils.showTableToast('No moves available.', {
            variant: 'warn', duration: 2200, containerId: 'golf-table'
        });
    }

    function autoComplete() {
        if (state.isGameWon) return;

        let moved = 0;
        let progress = true;
        while (progress) {
            progress = false;
            if (tryMoveWasteToFoundation()) {
                moved += 1;
                progress = true;
                continue;
            }
            for (let col = 0; col < GOLF_TABLEAU_COLS; col += 1) {
                if (tryMoveTableauToFoundation(col)) {
                    moved += 1;
                    progress = true;
                    break;
                }
            }
        }

        if (moved === 0) {
            CommonUtils.showTableToast('No auto-complete moves available.', {
                variant: 'info', duration: 2200, containerId: 'golf-table'
            });
        } else {
            CommonUtils.showTableToast(`Auto-completed ${moved} move${moved === 1 ? '' : 's'}.`, {
                variant: 'info', duration: 2200, containerId: 'golf-table'
            });
        }
    }

    function checkWinCondition() {
        if (!Array.isArray(state.tableau) || state.tableau.length !== GOLF_TABLEAU_COLS) return;
        const won = state.tableau.every((col) => Array.isArray(col) && col.length === 0);
        if (!won) return;

        state.isGameWon = true;
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        showWinOverlay();
        syncHighScore();
        if (stateManager) stateManager.clear();
    }

    function showWinOverlay() {
        const overlay = document.getElementById('golf-win-overlay');
        if (!overlay) return;
        const finalScore = document.getElementById('final-score');
        const finalTime = document.getElementById('final-time');
        if (finalScore) finalScore.textContent = String(state.score);
        if (finalTime) finalTime.textContent = formatTime(getElapsedSeconds(state.startTime));
        overlay.classList.remove('hidden');
        CommonUtils.playSound('win');
    }

    function hideWinOverlay() {
        const overlay = document.getElementById('golf-win-overlay');
        if (!overlay) return;
        overlay.classList.add('hidden');
    }

    function setupThemeSync() {
        const syncThemeClasses = () => {
            const tableSelect = document.getElementById('table-style-select');
            if (tableSelect) {
                Array.from(document.body.classList).forEach((cls) => {
                    if (cls.startsWith('table-')) document.body.classList.remove(cls);
                });
                if (tableSelect.value) {
                    document.body.classList.add(`table-${tableSelect.value}`);
                }
            }

            const deckSelect = document.getElementById('deck-style-select');
            if (deckSelect) {
                Array.from(document.body.classList).forEach((cls) => {
                    if (cls.startsWith('deck-')) document.body.classList.remove(cls);
                });
                if (deckSelect.value) {
                    document.body.classList.add(`deck-${deckSelect.value}`);
                }
            }
        };

        const tableSelect = document.getElementById('table-style-select');
        if (tableSelect) tableSelect.addEventListener('change', syncThemeClasses);
        const deckSelect = document.getElementById('deck-style-select');
        if (deckSelect) deckSelect.addEventListener('change', syncThemeClasses);

        requestAnimationFrame(syncThemeClasses);
        if (window.AddonLoader && window.AddonLoader.ready) {
            window.AddonLoader.ready.then(() => requestAnimationFrame(syncThemeClasses));
        }
        window.addEventListener('addons:changed', syncThemeClasses);
    }

    function setupEvents() {
        document.getElementById('golf-new-game')?.addEventListener('click', initGame);
        document.getElementById('new-game-from-win')?.addEventListener('click', initGame);
        document.getElementById('golf-undo')?.addEventListener('click', undoLastMove);
        document.getElementById('golf-hint')?.addEventListener('click', showHint);
        document.getElementById('golf-auto-complete')?.addEventListener('click', autoComplete);

        window.addEventListener('resize', scheduleSizing);
        window.addEventListener('card-scale:changed', scheduleSizing);

        const overlay = document.getElementById('golf-win-overlay');
        if (overlay) {
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) hideWinOverlay();
            });
        }

        setupThemeSync();
    }

    function bootstrap() {
        CommonUtils.preloadAudio(soundFiles);
        setupEvents();
        CommonUtils.initCardScaleControls('golf-card-scale', 'golf-card-scale-value');

        stateManager = new CommonUtils.StateManager({
            gameId: 'golf',
            getState: getSaveState,
            setState: restoreState,
            isWon: () => state.isGameWon
        });

        const restored = stateManager.load();
        if (!restored || !isPlayableState()) {
            if (stateManager) stateManager.clear();
            initGame();
        }
    }

    document.addEventListener('DOMContentLoaded', bootstrap);
})();
