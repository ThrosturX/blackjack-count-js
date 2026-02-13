(function () {
    'use strict';

    const TABLEAU_STACK_Y = 26;
    const TABLEAU_STACK_Y_MIN_FACTOR = 0.35;
    const MAX_HISTORY = 220;

    const sounds = {
        card: ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav'],
        win: ['win.wav'],
        shuffle: ['shuffle.wav']
    };

    const RULES = Object.freeze({
        napoleon: Object.freeze({
            id: 'napoleon',
            label: 'Napoleon (Forty Thieves)',
            deckCount: 2,
            foundationSlots: 8,
            tableauDealCounts: Array(10).fill(4),
            faceDownByColumn: Array(10).fill(0),
            buildMode: 'suit',
            sequenceMove: 'single',
            emptyFill: 'any',
            drawCount: 1,
            redeals: 0,
            highScoreRuleSetKey: 'napoleon'
        }),
        josephine: Object.freeze({
            id: 'josephine',
            label: 'Josephine',
            deckCount: 2,
            foundationSlots: 8,
            tableauDealCounts: Array(10).fill(4),
            faceDownByColumn: Array(10).fill(0),
            buildMode: 'suit',
            sequenceMove: 'sequence-suit',
            emptyFill: 'any',
            drawCount: 1,
            redeals: 0,
            highScoreRuleSetKey: 'josephine'
        }),
        alibaba: Object.freeze({
            id: 'alibaba',
            label: 'Alibaba',
            deckCount: 1,
            foundationSlots: 4,
            tableauDealCounts: Array(10).fill(4),
            faceDownByColumn: Array(10).fill(0),
            buildMode: 'suit',
            sequenceMove: 'sequence-suit',
            emptyFill: 'any',
            drawCount: 1,
            redeals: 0,
            highScoreRuleSetKey: 'alibaba'
        }),
        'thieves-of-egypt': Object.freeze({
            id: 'thieves-of-egypt',
            label: 'Thieves of Egypt',
            deckCount: 2,
            foundationSlots: 8,
            tableauDealCounts: [1, 3, 5, 7, 9, 10, 8, 6, 4, 2],
            faceDownByColumn: Array(10).fill(0),
            buildMode: 'alternating',
            sequenceMove: 'sequence-alternating',
            emptyFill: 'king',
            drawCount: 1,
            redeals: 1,
            highScoreRuleSetKey: 'thieves-of-egypt'
        }),
        'rank-and-file': Object.freeze({
            id: 'rank-and-file',
            label: 'Rank and File',
            deckCount: 2,
            foundationSlots: 8,
            tableauDealCounts: Array(10).fill(4),
            faceDownByColumn: Array(10).fill(3),
            buildMode: 'alternating',
            sequenceMove: 'sequence-alternating',
            emptyFill: 'any',
            drawCount: 1,
            redeals: 0,
            highScoreRuleSetKey: 'rank-and-file'
        })
    });

    function normalizeVariantId(value) {
        const candidate = String(value || '').toLowerCase();
        return Object.prototype.hasOwnProperty.call(RULES, candidate) ? candidate : 'napoleon';
    }

    function getVariantFromUrl() {
        try {
            const params = new URLSearchParams(window.location.search || '');
            const variant = params.get('variant');
            if (!variant) return null;
            return normalizeVariantId(variant);
        } catch (err) {
            return null;
        }
    }

    const forcedVariantId = getVariantFromUrl();

    const state = {
        variantId: forcedVariantId || 'napoleon',
        tableau: Array.from({ length: 10 }, () => []),
        stock: [],
        waste: [],
        foundations: [],
        redealsRemaining: 0,
        moves: 0,
        score: 0,
        startTime: null,
        timerInterval: null,
        moveHistory: [],
        selected: null,
        isGameWon: false
    };

    let stateManager = null;
    const scheduleSizing = CommonUtils.createRafScheduler(() => {
        CommonUtils.preserveHorizontalScroll({
            targets: ['forty-scroll'],
            update: () => ensureFortySizing()
        });
    });

    function getRules() {
        return RULES[normalizeVariantId(state.variantId)];
    }

    function getElapsedSeconds() {
        if (!Number.isFinite(state.startTime)) return 0;
        return Math.max(0, Math.floor((Date.now() - state.startTime) / 1000));
    }

    function formatTime(seconds) {
        const value = Number.isFinite(seconds) ? seconds : 0;
        const mins = Math.floor(value / 60);
        const secs = Math.floor(value % 60);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    function cloneCard(card) {
        const cloned = new Card(card.suit, card.val);
        cloned.hidden = !!card.hidden;
        if (Number.isFinite(card.rotation)) cloned.rotation = card.rotation;
        return cloned;
    }

    function cloneColumns(columns) {
        return columns.map((column) => column.map((card) => cloneCard(card)));
    }

    function pushHistoryEntry() {
        const snapshot = {
            tableau: cloneColumns(state.tableau),
            stock: state.stock.map((card) => cloneCard(card)),
            waste: state.waste.map((card) => cloneCard(card)),
            foundations: cloneColumns(state.foundations),
            redealsRemaining: state.redealsRemaining,
            moves: state.moves,
            score: state.score,
            isGameWon: state.isGameWon
        };
        state.moveHistory.push(snapshot);
        if (state.moveHistory.length > MAX_HISTORY) {
            state.moveHistory.shift();
        }
    }

    function restoreHistoryEntry(entry) {
        if (!entry) return;
        state.tableau = cloneColumns(entry.tableau || Array.from({ length: 10 }, () => []));
        state.stock = Array.isArray(entry.stock) ? entry.stock.map((card) => cloneCard(card)) : [];
        state.waste = Array.isArray(entry.waste) ? entry.waste.map((card) => cloneCard(card)) : [];
        state.foundations = cloneColumns(entry.foundations || []);
        state.redealsRemaining = Number.isFinite(entry.redealsRemaining) ? entry.redealsRemaining : getRules().redeals;
        state.moves = Number.isFinite(entry.moves) ? entry.moves : 0;
        state.score = Number.isFinite(entry.score) ? entry.score : 0;
        state.isGameWon = entry.isGameWon === true;
    }

    function applyVariant(variantId, options = {}) {
        const next = normalizeVariantId(variantId);
        const previous = normalizeVariantId(state.variantId);
        state.variantId = next;
        syncVariantSelect();
        syncVariantText();
        ensureFoundationSlots();
        if (options.startNewGame !== false && next !== previous) {
            initGame();
        }
    }

    function syncVariantSelect() {
        const select = document.getElementById('forty-variant-select');
        if (!select) return;
        select.value = normalizeVariantId(state.variantId);
        select.disabled = !!forcedVariantId;
    }

    function syncVariantText() {
        const heading = document.querySelector('header h1');
        if (heading) {
            heading.textContent = getRules().label;
        }
        document.title = `Card Playing Suite - ${getRules().label}`;
    }

    function revealTopIfNeeded(columnIndex) {
        const column = state.tableau[columnIndex];
        if (!column || !column.length) return false;
        const top = column[column.length - 1];
        if (top.hidden) {
            top.hidden = false;
            return true;
        }
        return false;
    }

    function clearSelection() {
        state.selected = null;
    }

    function getTotalCardCount() {
        const tableauCount = state.tableau.reduce((sum, col) => sum + col.length, 0);
        const foundationCount = state.foundations.reduce((sum, pile) => sum + pile.length, 0);
        return tableauCount + foundationCount + state.stock.length + state.waste.length;
    }

    function isRestoreStateValid() {
        const rules = getRules();
        if (!Array.isArray(state.tableau) || state.tableau.length !== 10) return false;
        if (!Array.isArray(state.foundations) || state.foundations.length !== rules.foundationSlots) return false;
        if (!Array.isArray(state.stock) || !Array.isArray(state.waste)) return false;
        return getTotalCardCount() === rules.deckCount * 52;
    }

    function getSaveState() {
        return {
            variantId: normalizeVariantId(state.variantId),
            tableau: state.tableau,
            stock: state.stock,
            waste: state.waste,
            foundations: state.foundations,
            redealsRemaining: state.redealsRemaining,
            moves: state.moves,
            score: state.score,
            elapsedSeconds: getElapsedSeconds(),
            isGameWon: state.isGameWon
        };
    }

    function restoreState(saved) {
        if (!saved || typeof saved !== 'object') return;
        const savedVariant = normalizeVariantId(saved.variantId);

        if (forcedVariantId) {
            if (savedVariant !== forcedVariantId) {
                if (stateManager) stateManager.clear();
                initGame();
                return;
            }
            state.variantId = forcedVariantId;
        } else {
            state.variantId = savedVariant;
        }

        syncVariantSelect();
        syncVariantText();
        ensureFoundationSlots();

        const hydrate = (value) => (
            typeof CommonUtils.hydrateSavedValue === 'function'
                ? CommonUtils.hydrateSavedValue(value)
                : value
        );

        state.tableau = Array.isArray(saved.tableau)
            ? saved.tableau.slice(0, 10).map((col) => (Array.isArray(col) ? hydrate(col) : []))
            : [];
        while (state.tableau.length < 10) {
            state.tableau.push([]);
        }

        const rules = getRules();
        state.foundations = Array.isArray(saved.foundations)
            ? saved.foundations.slice(0, rules.foundationSlots).map((pile) => (Array.isArray(pile) ? hydrate(pile) : []))
            : [];
        while (state.foundations.length < rules.foundationSlots) {
            state.foundations.push([]);
        }

        state.stock = Array.isArray(saved.stock) ? hydrate(saved.stock) : [];
        state.waste = Array.isArray(saved.waste) ? hydrate(saved.waste) : [];
        state.redealsRemaining = Number.isFinite(saved.redealsRemaining) ? Math.max(0, saved.redealsRemaining) : rules.redeals;
        state.moves = Number.isFinite(saved.moves) ? saved.moves : 0;
        state.score = Number.isFinite(saved.score) ? saved.score : 0;
        state.isGameWon = saved.isGameWon === true;
        state.moveHistory = [];
        clearSelection();

        const elapsed = Number.isFinite(saved.elapsedSeconds) ? Math.max(0, saved.elapsedSeconds) : 0;
        state.startTime = Date.now() - elapsed * 1000;

        if (!isRestoreStateValid()) {
            if (stateManager) stateManager.clear();
            initGame();
            return;
        }

        startTimer();
        updateUI();
    }

    function ensureFoundationSlots() {
        const root = document.getElementById('forty-foundations');
        if (!root) return;
        root.innerHTML = '';
        const rules = getRules();
        for (let i = 0; i < rules.foundationSlots; i += 1) {
            const pile = document.createElement('div');
            pile.id = `forty-foundation-${i}`;
            pile.className = 'forty-foundation';
            pile.dataset.index = String(i);
            pile.addEventListener('click', () => handleFoundationClick(i));
            root.appendChild(pile);
        }
    }

    function clearRuntimeState() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        state.tableau = Array.from({ length: 10 }, () => []);
        state.stock = [];
        state.waste = [];
        state.foundations = Array.from({ length: getRules().foundationSlots }, () => []);
        state.redealsRemaining = getRules().redeals;
        state.moves = 0;
        state.score = 0;
        state.startTime = Date.now();
        state.moveHistory = [];
        state.selected = null;
        state.isGameWon = false;
    }

    function dealNewGame() {
        const rules = getRules();
        const deck = CommonUtils.createShoe(rules.deckCount, SUITS, VALUES);
        for (let columnIndex = 0; columnIndex < 10; columnIndex += 1) {
            const dealCount = Number.isFinite(rules.tableauDealCounts[columnIndex]) ? rules.tableauDealCounts[columnIndex] : 0;
            const hiddenCount = Number.isFinite(rules.faceDownByColumn[columnIndex]) ? rules.faceDownByColumn[columnIndex] : 0;
            for (let i = 0; i < dealCount; i += 1) {
                const card = deck.pop();
                if (!card) continue;
                card.hidden = i < hiddenCount;
                state.tableau[columnIndex].push(card);
            }
        }
        state.stock = deck;
        state.stock.forEach((card) => {
            card.hidden = true;
        });
    }

    function initGame() {
        clearRuntimeState();
        ensureFoundationSlots();
        dealNewGame();
        startTimer();
        updateUI();
        CommonUtils.playSound('shuffle');
        if (stateManager) stateManager.markDirty();
    }

    function startTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
        }
        state.timerInterval = setInterval(() => {
            const timeEl = document.getElementById('forty-time');
            if (timeEl) timeEl.textContent = formatTime(getElapsedSeconds());
        }, 1000);
    }

    function normalizeCardState(cards) {
        return Array.isArray(cards) ? cards.filter(Boolean) : [];
    }

    function isAlternating(cardA, cardB) {
        return cardA && cardB && cardA.color !== cardB.color;
    }

    function canStackOnTableau(targetTop, movingCard) {
        const rules = getRules();
        if (!targetTop || !movingCard) return false;
        if (targetTop.hidden) return false;
        if (targetTop.rank !== movingCard.rank + 1) return false;
        if (rules.buildMode === 'suit') {
            return targetTop.suit === movingCard.suit;
        }
        return isAlternating(targetTop, movingCard);
    }

    function isValidSequence(cards) {
        const sequence = normalizeCardState(cards);
        if (sequence.length <= 1) return sequence.length === 1;
        const mode = getRules().sequenceMove;
        for (let i = 0; i < sequence.length - 1; i += 1) {
            const upper = sequence[i];
            const lower = sequence[i + 1];
            if (!upper || !lower || upper.hidden || lower.hidden) return false;
            if (upper.rank !== lower.rank + 1) return false;
            if (mode === 'sequence-suit' && upper.suit !== lower.suit) return false;
            if (mode === 'sequence-alternating' && !isAlternating(upper, lower)) return false;
        }
        return true;
    }

    function canMoveToTableau(cards, targetIndex) {
        const rules = getRules();
        const movingCards = normalizeCardState(cards);
        if (!movingCards.length) return false;
        if (rules.sequenceMove === 'single' && movingCards.length > 1) return false;
        if (!isValidSequence(movingCards)) return false;

        const targetColumn = state.tableau[targetIndex];
        if (!Array.isArray(targetColumn)) return false;
        if (!targetColumn.length) {
            return rules.emptyFill === 'any' || movingCards[0].rank === 13;
        }
        const top = targetColumn[targetColumn.length - 1];
        return canStackOnTableau(top, movingCards[0]);
    }

    function canMoveSingleCardToFoundation(card, foundationIndex) {
        const pile = state.foundations[foundationIndex];
        if (!Array.isArray(pile)) return false;
        if (!pile.length) return card.rank === 1;
        const top = pile[pile.length - 1];
        return top.suit === card.suit && card.rank === top.rank + 1;
    }

    function findFoundationTarget(card) {
        for (let i = 0; i < state.foundations.length; i += 1) {
            if (canMoveSingleCardToFoundation(card, i)) return i;
        }
        return -1;
    }

    function getMovableCardsFromTableau(columnIndex, cardIndex) {
        const column = state.tableau[columnIndex];
        if (!Array.isArray(column) || !column.length) return null;
        if (!(cardIndex >= 0 && cardIndex < column.length)) return null;
        const cards = column.slice(cardIndex);
        if (!cards.length || cards.some((card) => card.hidden)) return null;

        const rules = getRules();
        if (rules.sequenceMove === 'single') {
            if (cardIndex !== column.length - 1) return null;
            return [cards[0]];
        }

        return isValidSequence(cards) ? cards : null;
    }

    function removeFromTableau(columnIndex, count) {
        const column = state.tableau[columnIndex];
        if (!Array.isArray(column) || count <= 0) return [];
        const removed = column.splice(column.length - count, count);
        revealTopIfNeeded(columnIndex);
        return removed;
    }

    function commitMove(success = true) {
        if (!success) return;
        state.moves += 1;
        updateScore();
        clearSelection();
        checkForWin();
        updateUI();
        CommonUtils.playSound('card');
        if (stateManager) stateManager.markDirty();
    }

    function updateScore() {
        const foundationCards = state.foundations.reduce((sum, pile) => sum + pile.length, 0);
        state.score = foundationCards * 10 + Math.max(0, 500 - state.moves * 2);
    }

    function drawFromStock() {
        if (state.isGameWon) return;
        const rules = getRules();
        if (!state.stock.length) {
            if (!state.waste.length || state.redealsRemaining <= 0) return;
            pushHistoryEntry();
            const recycled = state.waste.reverse();
            recycled.forEach((card) => {
                card.hidden = true;
            });
            state.stock = recycled;
            state.waste = [];
            state.redealsRemaining -= 1;
            commitMove(true);
            return;
        }

        pushHistoryEntry();
        const drawCount = Math.max(1, rules.drawCount);
        for (let i = 0; i < drawCount; i += 1) {
            const card = state.stock.pop();
            if (!card) break;
            card.hidden = false;
            state.waste.push(card);
        }
        commitMove(true);
    }

    function moveSelectedToFoundationIfPossible() {
        if (!state.selected || state.selected.cards.length !== 1) return false;
        const card = state.selected.cards[0];
        const target = findFoundationTarget(card);
        if (target < 0) return false;

        pushHistoryEntry();
        if (state.selected.source === 'waste') {
            state.waste.pop();
        } else if (state.selected.source === 'tableau') {
            removeFromTableau(state.selected.columnIndex, 1);
        }
        state.foundations[target].push(card);
        commitMove(true);
        return true;
    }

    function tryAutoFoundationFromWaste() {
        if (!state.waste.length) return false;
        const top = state.waste[state.waste.length - 1];
        const target = findFoundationTarget(top);
        if (target < 0) return false;

        pushHistoryEntry();
        state.waste.pop();
        state.foundations[target].push(top);
        commitMove(true);
        return true;
    }

    function tryAutoFoundationFromTableau(columnIndex) {
        const column = state.tableau[columnIndex];
        if (!column || !column.length) return false;
        const top = column[column.length - 1];
        if (top.hidden) return false;
        const target = findFoundationTarget(top);
        if (target < 0) return false;

        pushHistoryEntry();
        removeFromTableau(columnIndex, 1);
        state.foundations[target].push(top);
        commitMove(true);
        return true;
    }

    function selectWasteTop() {
        if (!state.waste.length) {
            clearSelection();
            updateUI();
            return;
        }
        const topIndex = state.waste.length - 1;
        const top = state.waste[topIndex];
        state.selected = {
            source: 'waste',
            wasteIndex: topIndex,
            cards: [top]
        };
        updateUI();
    }

    function handleWasteClick(event) {
        event.preventDefault();
        if (state.isGameWon) return;
        if (!state.waste.length) {
            clearSelection();
            updateUI();
            return;
        }

        if (state.selected && state.selected.source === 'waste') {
            if (!moveSelectedToFoundationIfPossible()) {
                clearSelection();
                updateUI();
            }
            return;
        }

        selectWasteTop();
    }

    function handleFoundationClick(index) {
        if (!state.selected || state.selected.cards.length !== 1) return;
        const card = state.selected.cards[0];
        if (!canMoveSingleCardToFoundation(card, index)) return;

        pushHistoryEntry();
        if (state.selected.source === 'waste') {
            state.waste.pop();
        } else if (state.selected.source === 'tableau') {
            removeFromTableau(state.selected.columnIndex, 1);
        }
        state.foundations[index].push(card);
        commitMove(true);
    }

    function selectTableauSequence(columnIndex, cardIndex) {
        const cards = getMovableCardsFromTableau(columnIndex, cardIndex);
        if (!cards) {
            clearSelection();
            updateUI();
            return;
        }
        state.selected = {
            source: 'tableau',
            columnIndex,
            cardIndex,
            cards
        };
        updateUI();
    }

    function handleTableauCardClick(columnIndex, cardIndex) {
        if (state.isGameWon) return;
        const column = state.tableau[columnIndex];
        if (!column || !column.length) return;
        const clicked = column[cardIndex];
        if (!clicked || clicked.hidden) return;

        if (!state.selected) {
            selectTableauSequence(columnIndex, cardIndex);
            return;
        }

        if (state.selected.source === 'tableau'
            && state.selected.columnIndex === columnIndex
            && state.selected.cardIndex === cardIndex) {
            if (!moveSelectedToFoundationIfPossible()) {
                clearSelection();
                updateUI();
            }
            return;
        }

        if (state.selected.source === 'waste') {
            if (!canMoveToTableau(state.selected.cards, columnIndex)) {
                selectTableauSequence(columnIndex, cardIndex);
                return;
            }
            pushHistoryEntry();
            const moving = state.waste.pop();
            state.tableau[columnIndex].push(moving);
            commitMove(true);
            return;
        }

        if (state.selected.source === 'tableau') {
            if (state.selected.columnIndex === columnIndex) {
                selectTableauSequence(columnIndex, cardIndex);
                return;
            }
            if (!canMoveToTableau(state.selected.cards, columnIndex)) {
                selectTableauSequence(columnIndex, cardIndex);
                return;
            }

            pushHistoryEntry();
            const count = state.selected.cards.length;
            const moved = removeFromTableau(state.selected.columnIndex, count);
            state.tableau[columnIndex].push(...moved);
            commitMove(true);
            return;
        }
    }

    function handleTableauColumnClick(columnIndex) {
        if (!state.selected) return;
        if (!canMoveToTableau(state.selected.cards, columnIndex)) return;

        pushHistoryEntry();
        if (state.selected.source === 'waste') {
            const card = state.waste.pop();
            state.tableau[columnIndex].push(card);
        } else if (state.selected.source === 'tableau') {
            const moved = removeFromTableau(state.selected.columnIndex, state.selected.cards.length);
            state.tableau[columnIndex].push(...moved);
        }
        commitMove(true);
    }

    function undoMove() {
        if (!state.moveHistory.length || state.isGameWon) return;
        const entry = state.moveHistory.pop();
        restoreHistoryEntry(entry);
        clearSelection();
        updateUI();
        if (stateManager) stateManager.markDirty();
    }

    function checkForWin() {
        const target = getRules().deckCount * 52;
        const foundationCount = state.foundations.reduce((sum, pile) => sum + pile.length, 0);
        if (foundationCount !== target) return;
        state.isGameWon = true;
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        CommonUtils.playSound('win');
        CommonUtils.updateHighScore('forty-thieves', getRules().highScoreRuleSetKey, state.score);
        if (stateManager) stateManager.clear();
        window.setTimeout(() => {
            alert(`You solved ${getRules().label}!`);
        }, 30);
    }

    function renderStock() {
        const stockEl = document.getElementById('forty-stock');
        if (!stockEl) return;
        stockEl.innerHTML = '';

        const canDraw = state.stock.length > 0 || (state.waste.length > 0 && state.redealsRemaining > 0);
        stockEl.classList.toggle('is-disabled', !canDraw);

        const visibleCount = Math.min(3, state.stock.length);
        const start = state.stock.length - visibleCount;
        for (let i = start; i < state.stock.length; i += 1) {
            const card = state.stock[i];
            const cardEl = CommonUtils.createCardEl(card);
            cardEl.style.left = `${(i - start) * 2}px`;
            cardEl.style.top = `${(i - start) * 1}px`;
            cardEl.style.zIndex = String(i - start + 1);
            stockEl.appendChild(cardEl);
        }

        if (!state.stock.length) {
            const placeholder = document.createElement('div');
            placeholder.className = 'forty-foundation-placeholder';
            placeholder.textContent = state.redealsRemaining > 0 ? 'Redeal' : 'Stock';
            stockEl.appendChild(placeholder);
        }
    }

    function renderWaste() {
        const wasteEl = document.getElementById('forty-waste');
        if (!wasteEl) return;
        wasteEl.innerHTML = '';

        if (!state.waste.length) {
            const placeholder = document.createElement('div');
            placeholder.className = 'forty-foundation-placeholder';
            placeholder.textContent = '';
            wasteEl.appendChild(placeholder);
            return;
        }

        const top = state.waste[state.waste.length - 1];
        const cardEl = CommonUtils.createCardEl(top);
        cardEl.classList.toggle('forty-selected', !!state.selected && state.selected.source === 'waste');
        cardEl.addEventListener('click', (event) => {
            event.stopPropagation();
            handleWasteClick(event);
        });
        wasteEl.appendChild(cardEl);
    }

    function getFoundationPlaceholderSuit(index) {
        const suits = ['♥', '♠', '♦', '♣', '♥', '♠', '♦', '♣'];
        const fallback = suits[index] || 'A';
        return fallback;
    }

    function renderFoundations() {
        for (let i = 0; i < state.foundations.length; i += 1) {
            const pileEl = document.getElementById(`forty-foundation-${i}`);
            if (!pileEl) continue;
            pileEl.innerHTML = '';

            const pile = state.foundations[i];
            if (!pile.length) {
                const placeholder = document.createElement('div');
                placeholder.className = 'forty-foundation-placeholder';
                placeholder.textContent = getFoundationPlaceholderSuit(i);
                pileEl.appendChild(placeholder);
                continue;
            }

            const top = pile[pile.length - 1];
            const cardEl = CommonUtils.createCardEl(top);
            pileEl.appendChild(cardEl);
        }
    }

    function renderTableau() {
        const root = document.getElementById('forty-tableau');
        if (!root) return;
        root.innerHTML = '';

        const stackY = CommonUtils.getSolitaireStackOffset(TABLEAU_STACK_Y, { minFactor: TABLEAU_STACK_Y_MIN_FACTOR });

        for (let colIndex = 0; colIndex < state.tableau.length; colIndex += 1) {
            const columnEl = document.createElement('div');
            columnEl.className = 'forty-column';
            columnEl.id = `forty-column-${colIndex}`;
            columnEl.dataset.index = String(colIndex);
            columnEl.addEventListener('click', (event) => {
                if (event.target === columnEl) {
                    handleTableauColumnClick(colIndex);
                }
            });

            const column = state.tableau[colIndex];
            for (let cardIndex = 0; cardIndex < column.length; cardIndex += 1) {
                const card = column[cardIndex];
                const cardEl = CommonUtils.createCardEl(card);
                cardEl.dataset.column = String(colIndex);
                cardEl.dataset.index = String(cardIndex);
                cardEl.style.position = 'absolute';
                cardEl.style.top = `${cardIndex * stackY}px`;
                cardEl.style.left = '0px';
                cardEl.style.zIndex = String(cardIndex + 1);

                const isSelected = !!state.selected
                    && state.selected.source === 'tableau'
                    && state.selected.columnIndex === colIndex
                    && cardIndex >= state.selected.cardIndex;
                if (isSelected) {
                    cardEl.classList.add('forty-selected');
                }

                cardEl.addEventListener('click', (event) => {
                    event.stopPropagation();
                    handleTableauCardClick(colIndex, cardIndex);
                });
                cardEl.addEventListener('dblclick', (event) => {
                    event.stopPropagation();
                    tryAutoFoundationFromTableau(colIndex);
                });

                columnEl.appendChild(cardEl);
            }

            const minHeight = CommonUtils.getStackHeight(Math.max(1, column.length), stackY);
            columnEl.style.minHeight = `${Math.max(210, minHeight)}px`;
            root.appendChild(columnEl);
        }
    }

    function syncHighScore() {
        const highScoreEl = document.getElementById('forty-high-score');
        if (!highScoreEl) return;
        const value = CommonUtils.getHighScore('forty-thieves', getRules().highScoreRuleSetKey);
        highScoreEl.textContent = String(value);
    }

    function updateStats() {
        const movesEl = document.getElementById('forty-moves');
        const scoreEl = document.getElementById('forty-score');
        const timeEl = document.getElementById('forty-time');
        const redealsEl = document.getElementById('forty-redeals');
        if (movesEl) movesEl.textContent = String(state.moves);
        if (scoreEl) scoreEl.textContent = String(state.score);
        if (timeEl) timeEl.textContent = formatTime(getElapsedSeconds());
        if (redealsEl) redealsEl.textContent = String(state.redealsRemaining);
        syncHighScore();
    }

    function updateUndoButton() {
        const undoBtn = document.getElementById('forty-undo');
        if (!undoBtn) return;
        undoBtn.disabled = !state.moveHistory.length || state.isGameWon;
    }

    function updateDrawButton() {
        const drawBtn = document.getElementById('forty-draw');
        if (!drawBtn) return;
        drawBtn.disabled = !(state.stock.length > 0 || (state.waste.length > 0 && state.redealsRemaining > 0)) || state.isGameWon;
    }

    function ensureFortySizing() {
        const tableEl = document.getElementById('table');
        if (!tableEl) return;

        const cardMetrics = CommonUtils.getCardMetrics();
        const baseGap = Math.max(4, Math.round(10 * Math.min(cardMetrics.scale, 1)));
        const fan = Math.max(4, Math.round(14 * Math.min(cardMetrics.scale, 1)));

        tableEl.style.setProperty('--forty-tableau-gap', `${baseGap}px`);
        tableEl.style.setProperty('--forty-fan-x', `${fan}px`);
        tableEl.style.setProperty('--forty-foundation-cols', String(getRules().foundationSlots));

        CommonUtils.ensureScrollableWidth({
            table: 'table',
            wrapper: 'forty-scroll',
            contentSelectors: ['#forty-top-row', '#forty-tableau'],
            enterTolerance: 6,
            exitTolerance: 3
        });
    }

    function updateUI() {
        CommonUtils.preserveHorizontalScroll({
            targets: ['forty-scroll'],
            update: () => {
                renderStock();
                renderWaste();
                renderFoundations();
                renderTableau();
                updateStats();
                updateUndoButton();
                updateDrawButton();
                ensureFortySizing();
            }
        });
    }

    function gatherHintMoves() {
        const moves = [];

        if (state.waste.length) {
            const topWaste = state.waste[state.waste.length - 1];
            if (findFoundationTarget(topWaste) >= 0) {
                moves.push('Move waste to foundation');
            }
            for (let col = 0; col < state.tableau.length; col += 1) {
                if (canMoveToTableau([topWaste], col)) {
                    moves.push(`Move waste to column ${col + 1}`);
                    break;
                }
            }
        }

        for (let col = 0; col < state.tableau.length; col += 1) {
            const column = state.tableau[col];
            if (!column.length) continue;
            const top = column[column.length - 1];
            if (!top.hidden && findFoundationTarget(top) >= 0) {
                moves.push(`Move column ${col + 1} top card to foundation`);
                break;
            }
        }

        for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol += 1) {
            const source = state.tableau[sourceCol];
            if (!source.length) continue;
            for (let idx = 0; idx < source.length; idx += 1) {
                const cards = getMovableCardsFromTableau(sourceCol, idx);
                if (!cards) continue;
                for (let targetCol = 0; targetCol < state.tableau.length; targetCol += 1) {
                    if (targetCol === sourceCol) continue;
                    if (canMoveToTableau(cards, targetCol)) {
                        moves.push(`Move from column ${sourceCol + 1} to column ${targetCol + 1}`);
                        return moves;
                    }
                }
            }
        }

        if (state.stock.length > 0 || (state.waste.length > 0 && state.redealsRemaining > 0)) {
            moves.push('Draw from stock');
        }

        return moves;
    }

    function showHint() {
        if (state.isGameWon) return;
        const hints = gatherHintMoves();
        if (!hints.length) {
            alert('No obvious moves found.');
            return;
        }
        alert(`Hint: ${hints[0]}`);
    }

    function setupEventListeners() {
        const newGameBtn = document.getElementById('forty-new-game');
        const drawBtn = document.getElementById('forty-draw');
        const undoBtn = document.getElementById('forty-undo');
        const hintBtn = document.getElementById('forty-hint');
        const stockEl = document.getElementById('forty-stock');
        const wasteEl = document.getElementById('forty-waste');
        const variantSelect = document.getElementById('forty-variant-select');

        if (newGameBtn) newGameBtn.addEventListener('click', initGame);
        if (drawBtn) drawBtn.addEventListener('click', drawFromStock);
        if (undoBtn) undoBtn.addEventListener('click', undoMove);
        if (hintBtn) hintBtn.addEventListener('click', showHint);
        if (stockEl) stockEl.addEventListener('click', drawFromStock);
        if (wasteEl) wasteEl.addEventListener('click', handleWasteClick);

        if (variantSelect) {
            variantSelect.addEventListener('change', (event) => {
                const requested = normalizeVariantId(event.target.value);
                const next = forcedVariantId || requested;
                applyVariant(next, { startNewGame: true });
                if (stateManager) stateManager.markDirty();
            });
        }

        window.addEventListener('card-scale:changed', scheduleSizing);
        window.addEventListener('resize', scheduleSizing);

        document.addEventListener('click', (event) => {
            if (!state.selected) return;
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.closest('#forty-tableau') || target.closest('#forty-waste') || target.closest('#forty-foundations')) return;
            clearSelection();
            updateUI();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                clearSelection();
                updateUI();
            }
        });

        if (wasteEl) {
            wasteEl.addEventListener('dblclick', (event) => {
                event.preventDefault();
                tryAutoFoundationFromWaste();
            });
        }
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

    document.addEventListener('DOMContentLoaded', () => {
        CommonUtils.preloadAudio(sounds);
        setupEventListeners();
        setupThemeSync();
        CommonUtils.initCardScaleControls('forty-card-scale', 'forty-card-scale-value');

        stateManager = new CommonUtils.StateManager({
            gameId: 'forty-thieves',
            getState: getSaveState,
            setState: restoreState,
            isWon: () => state.isGameWon
        });

        applyVariant(forcedVariantId || state.variantId, { startNewGame: false });
        const restored = stateManager.load();
        if (!restored) {
            initGame();
        }
    });
})();
