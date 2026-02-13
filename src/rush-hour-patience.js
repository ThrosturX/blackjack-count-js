(function () {
    'use strict';

    const TABLEAU_COLUMNS = 7;
    const TABLEAU_STACK_Y = 26;
    const TABLEAU_STACK_Y_MIN_FACTOR = 0.35;
    const MAX_HISTORY = 220;
    const SUIT_ORDER = ['♥', '♦', '♣', '♠'];
    const BASE_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const KNIGHT_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'C', 'Q', 'K'];

    const HELP_TEXT = `You are a taxi driver completing fares across four city districts represented by the four card suits. Your goal is to finish all eight fare contracts—two per district—by delivering passengers in street-number order from Ace upward. The game uses a standard deck, optionally expanded with four Knight cards (one per suit) that rank between Jack and Queen.
Seven tableau columns represent city streets. Only the bottom face-up card in each column can be picked up. Build these columns downward in alternating colors to free up passengers beneath. When a street card moves to the queue or to a fare contract, the card beneath flips face-up as a new passenger steps to the curb. The stock pile is your queue of waiting passengers. You may draw from it up to three times total. After the third draw, the top passenger must be placed immediately onto a street or into a completed fare—they will leave if ignored again.
Fare contracts are the foundation piles. Start the first contract in each district with an Ace or Two for short local trips. Start the second contract with an Eight for long cross-town rides. Build each contract upward in the same suit until complete.
When any contract reaches the Seven card, rush hour begins. Now each stock draw pulls three passengers at once. You must place the topmost immediately; the other two wait in your backseat and block further draws until you complete a contract, which clears the backseat.
Optional taxi stands (one or two empty spots) let you temporarily park a single passenger to untangle difficult sequences. Too many stands remove tension—limit to two maximum.
You win by completing all eight contracts. You lose if the stock empties twice (passengers gave up) or if no legal moves remain with passengers still waiting. Every draw risks passenger impatience; every completed fare earns breathing room. Plan routes carefully—especially during rush hour.`;

    const sounds = {
        card: ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav'],
        win: ['win.wav'],
        shuffle: ['shuffle.wav']
    };

    const state = {
        settings: {
            knightsEnabled: true,
            standCount: 2,
            jokersEnabled: false,
            jokerCount: 2,
            jokerPassMode: 'consume'
        },
        tableau: Array.from({ length: TABLEAU_COLUMNS }, () => []),
        stock: [],
        waste: [],
        stands: [null, null],
        backseatQueue: [],
        contracts: [],
        removedPassengers: 0,
        stockPass: 1,
        stockEmptyCount: 0,
        mustPlaceWaste: false,
        rushHourActive: false,
        moves: 0,
        score: 0,
        startTime: null,
        timerInterval: null,
        moveHistory: [],
        selected: null,
        isGameWon: false,
        isGameLost: false,
        resultMessage: ''
    };

    let stateManager = null;
    const dragState = {
        active: null
    };
    const scheduleSizing = CommonUtils.createRafScheduler(() => {
        CommonUtils.preserveHorizontalScroll({
            targets: ['rush-scroll'],
            update: () => ensureRushSizing()
        });
    });

    function showInfoDialog(title, message) {
        if (typeof SolitaireUiFeedback !== 'undefined' && typeof SolitaireUiFeedback.showInfo === 'function') {
            SolitaireUiFeedback.showInfo({ title, message });
            return;
        }
        alert(`${title}\n\n${message}`);
    }

    function showHintToast(message) {
        if (typeof SolitaireUiFeedback !== 'undefined' && typeof SolitaireUiFeedback.showToast === 'function') {
            SolitaireUiFeedback.showToast(message, { variant: 'warn', duration: 2200, containerId: 'table' });
            return;
        }
        alert(message);
    }

    function getValueOrder() {
        return state.settings.knightsEnabled ? KNIGHT_VALUES : BASE_VALUES;
    }

    function getOrderIndex(value) {
        return getValueOrder().indexOf(value);
    }

    function getExpectedDeckSize(settings = state.settings) {
        const base = 52;
        const knights = settings.knightsEnabled ? 4 : 0;
        const jokers = settings.jokersEnabled ? Math.max(1, Math.min(8, settings.jokerCount || 2)) : 0;
        return base + knights + jokers;
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

    function isJoker(card) {
        return !!(card && (card.isJoker === true || card.val === 'JK'));
    }

    function cloneCard(card) {
        if (!card) return null;
        const cloned = new Card(card.suit, card.val);
        cloned.hidden = !!card.hidden;
        if (Number.isFinite(card.rotation)) cloned.rotation = card.rotation;
        if (card.isJoker) cloned.isJoker = true;
        return cloned;
    }

    function cloneColumns(columns) {
        return columns.map((column) => column.map((card) => cloneCard(card)));
    }

    function cloneContracts(contracts) {
        return contracts.map((contract) => ({
            suit: contract.suit,
            type: contract.type,
            cards: contract.cards.map((card) => cloneCard(card))
        }));
    }

    function cloneStands(stands) {
        return stands.map((card) => (card ? cloneCard(card) : null));
    }

    function cloneStateSnapshot() {
        return {
            settings: { ...state.settings },
            tableau: cloneColumns(state.tableau),
            stock: state.stock.map((card) => cloneCard(card)),
            waste: state.waste.map((card) => cloneCard(card)),
            stands: cloneStands(state.stands),
            backseatQueue: state.backseatQueue.map((card) => cloneCard(card)),
            contracts: cloneContracts(state.contracts),
            removedPassengers: state.removedPassengers,
            stockPass: state.stockPass,
            stockEmptyCount: state.stockEmptyCount,
            mustPlaceWaste: state.mustPlaceWaste,
            rushHourActive: state.rushHourActive,
            moves: state.moves,
            score: state.score,
            isGameWon: state.isGameWon,
            isGameLost: state.isGameLost,
            resultMessage: state.resultMessage
        };
    }

    function pushHistoryEntry() {
        state.moveHistory.push(cloneStateSnapshot());
        if (state.moveHistory.length > MAX_HISTORY) {
            state.moveHistory.shift();
        }
    }

    function restoreHistoryEntry(entry) {
        if (!entry) return;
        state.settings = {
            knightsEnabled: entry.settings.knightsEnabled !== false,
            standCount: entry.settings.standCount === 1 ? 1 : 2,
            jokersEnabled: entry.settings.jokersEnabled === true,
            jokerCount: Number.isFinite(entry.settings.jokerCount) ? Math.max(1, Math.min(8, entry.settings.jokerCount)) : 2,
            jokerPassMode: entry.settings.jokerPassMode === 'parked-unlimited' ? 'parked-unlimited' : 'consume'
        };
        state.tableau = cloneColumns(entry.tableau || Array.from({ length: TABLEAU_COLUMNS }, () => []));
        state.stock = Array.isArray(entry.stock) ? entry.stock.map((card) => cloneCard(card)) : [];
        state.waste = Array.isArray(entry.waste) ? entry.waste.map((card) => cloneCard(card)) : [];
        state.stands = cloneStands(Array.isArray(entry.stands) ? entry.stands.slice(0, 2) : [null, null]);
        while (state.stands.length < 2) state.stands.push(null);
        state.backseatQueue = Array.isArray(entry.backseatQueue) ? entry.backseatQueue.map((card) => cloneCard(card)) : [];
        state.contracts = cloneContracts(Array.isArray(entry.contracts) ? entry.contracts : createContractsMeta());
        state.removedPassengers = Number.isFinite(entry.removedPassengers) ? Math.max(0, entry.removedPassengers) : 0;
        state.stockPass = Number.isFinite(entry.stockPass) ? Math.max(1, entry.stockPass) : 1;
        state.stockEmptyCount = Number.isFinite(entry.stockEmptyCount) ? Math.max(0, entry.stockEmptyCount) : 0;
        state.mustPlaceWaste = entry.mustPlaceWaste === true;
        state.rushHourActive = entry.rushHourActive === true;
        state.moves = Number.isFinite(entry.moves) ? Math.max(0, entry.moves) : 0;
        state.score = Number.isFinite(entry.score) ? Math.max(0, entry.score) : 0;
        state.isGameWon = entry.isGameWon === true;
        state.isGameLost = entry.isGameLost === true;
        state.resultMessage = typeof entry.resultMessage === 'string' ? entry.resultMessage : '';
        state.selected = null;
    }

    function createContractsMeta() {
        const shortContracts = [];
        const longContracts = [];
        SUIT_ORDER.forEach((suit) => {
            shortContracts.push({ suit, type: 'short', cards: [] });
            longContracts.push({ suit, type: 'long', cards: [] });
        });
        return shortContracts.concat(longContracts);
    }

    function getSaveState() {
        return {
            settings: { ...state.settings },
            tableau: state.tableau,
            stock: state.stock,
            waste: state.waste,
            stands: state.stands,
            backseatQueue: state.backseatQueue,
            contracts: state.contracts,
            removedPassengers: state.removedPassengers,
            stockPass: state.stockPass,
            stockEmptyCount: state.stockEmptyCount,
            mustPlaceWaste: state.mustPlaceWaste,
            rushHourActive: state.rushHourActive,
            moves: state.moves,
            score: state.score,
            elapsedSeconds: getElapsedSeconds(),
            isGameWon: state.isGameWon,
            isGameLost: state.isGameLost,
            resultMessage: state.resultMessage
        };
    }

    function getCurrentRuleKey() {
        const cfg = state.settings;
        const passMode = cfg.jokersEnabled ? cfg.jokerPassMode : 'none';
        const jokerCount = cfg.jokersEnabled ? cfg.jokerCount : 0;
        return `k-${cfg.knightsEnabled ? 1 : 0}_s-${cfg.standCount}_j-${cfg.jokersEnabled ? 1 : 0}-${jokerCount}_${passMode}`;
    }

    function isRestoreStateValid() {
        if (!Array.isArray(state.tableau) || state.tableau.length !== TABLEAU_COLUMNS) return false;
        if (!Array.isArray(state.contracts) || state.contracts.length !== 8) return false;
        if (!Array.isArray(state.stands) || state.stands.length !== 2) return false;
        if (!Array.isArray(state.stock) || !Array.isArray(state.waste)) return false;
        const tableauCount = state.tableau.reduce((sum, col) => sum + col.length, 0);
        const contractsCount = state.contracts.reduce((sum, contract) => sum + contract.cards.length, 0);
        const standCount = state.stands.filter(Boolean).length;
        const expected = getExpectedDeckSize(state.settings);
        const total = tableauCount + contractsCount + standCount + state.stock.length + state.waste.length + state.backseatQueue.length + state.removedPassengers;
        return total === expected;
    }

    function restoreState(saved) {
        if (!saved || typeof saved !== 'object') return;
        const hydrate = (value) => (
            typeof CommonUtils.hydrateSavedValue === 'function'
                ? CommonUtils.hydrateSavedValue(value)
                : value
        );

        const nextSettings = saved.settings && typeof saved.settings === 'object' ? saved.settings : {};
        state.settings = {
            knightsEnabled: nextSettings.knightsEnabled !== false,
            standCount: nextSettings.standCount === 1 ? 1 : 2,
            jokersEnabled: nextSettings.jokersEnabled === true,
            jokerCount: Number.isFinite(nextSettings.jokerCount) ? Math.max(1, Math.min(8, nextSettings.jokerCount)) : 2,
            jokerPassMode: nextSettings.jokerPassMode === 'parked-unlimited' ? 'parked-unlimited' : 'consume'
        };

        state.tableau = Array.isArray(saved.tableau)
            ? saved.tableau.slice(0, TABLEAU_COLUMNS).map((col) => (Array.isArray(col) ? hydrate(col) : []))
            : [];
        while (state.tableau.length < TABLEAU_COLUMNS) state.tableau.push([]);

        const restoredContracts = Array.isArray(saved.contracts) ? saved.contracts.slice(0, 8) : [];
        state.contracts = createContractsMeta().map((contract, index) => {
            const incoming = restoredContracts.find((candidate) => (
                candidate
                && candidate.suit === contract.suit
                && candidate.type === contract.type
            )) || restoredContracts[index] || {};
            const cards = Array.isArray(incoming.cards) ? hydrate(incoming.cards) : [];
            return {
                suit: contract.suit,
                type: contract.type,
                cards
            };
        });

        state.stock = Array.isArray(saved.stock) ? hydrate(saved.stock) : [];
        state.waste = Array.isArray(saved.waste) ? hydrate(saved.waste) : [];
        const restoredStands = Array.isArray(saved.stands) ? saved.stands.slice(0, 2).map((card) => (card ? hydrate(card) : null)) : [null, null];
        while (restoredStands.length < 2) restoredStands.push(null);
        state.stands = restoredStands;
        state.backseatQueue = Array.isArray(saved.backseatQueue) ? hydrate(saved.backseatQueue) : [];
        state.removedPassengers = Number.isFinite(saved.removedPassengers) ? Math.max(0, saved.removedPassengers) : 0;
        state.stockPass = Number.isFinite(saved.stockPass) ? Math.max(1, saved.stockPass) : 1;
        state.stockEmptyCount = Number.isFinite(saved.stockEmptyCount) ? Math.max(0, saved.stockEmptyCount) : 0;
        state.mustPlaceWaste = saved.mustPlaceWaste === true;
        state.rushHourActive = saved.rushHourActive === true;
        state.moves = Number.isFinite(saved.moves) ? Math.max(0, saved.moves) : 0;
        state.score = Number.isFinite(saved.score) ? Math.max(0, saved.score) : 0;
        state.isGameWon = saved.isGameWon === true;
        state.isGameLost = saved.isGameLost === true;
        state.resultMessage = typeof saved.resultMessage === 'string' ? saved.resultMessage : '';
        state.moveHistory = [];
        state.selected = null;

        const elapsed = Number.isFinite(saved.elapsedSeconds) ? Math.max(0, saved.elapsedSeconds) : 0;
        state.startTime = Date.now() - elapsed * 1000;

        if (!isRestoreStateValid()) {
            if (stateManager) stateManager.clear();
            initGame();
            return;
        }

        syncSettingsUI();
        startTimer();
        updateUI();
    }

    function clearRuntimeState() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        state.tableau = Array.from({ length: TABLEAU_COLUMNS }, () => []);
        state.stock = [];
        state.waste = [];
        state.stands = [null, null];
        state.backseatQueue = [];
        state.contracts = createContractsMeta();
        state.removedPassengers = 0;
        state.stockPass = 1;
        state.stockEmptyCount = 0;
        state.mustPlaceWaste = false;
        state.rushHourActive = false;
        state.moves = 0;
        state.score = 0;
        state.startTime = Date.now();
        state.moveHistory = [];
        state.selected = null;
        state.isGameWon = false;
        state.isGameLost = false;
        state.resultMessage = '';
    }

    function shuffleDeckInPlace(deck) {
        for (let i = deck.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }

    function createJoker() {
        const card = new Card('🃏', 'JK');
        card.isJoker = true;
        card.hidden = false;
        return card;
    }

    function getConfiguredDeckValues() {
        return state.settings.knightsEnabled ? ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'C', 'Q', 'K', 'A'] : VALUES;
    }

    function dealNewGame() {
        const deck = CommonUtils.createShoe(1, SUITS, getConfiguredDeckValues());
        if (state.settings.jokersEnabled) {
            const count = Math.max(1, Math.min(8, state.settings.jokerCount));
            for (let i = 0; i < count; i += 1) {
                deck.push(createJoker());
            }
            shuffleDeckInPlace(deck);
        }

        for (let columnIndex = 0; columnIndex < TABLEAU_COLUMNS; columnIndex += 1) {
            const dealCount = columnIndex + 1;
            for (let i = 0; i < dealCount; i += 1) {
                const card = deck.pop();
                if (!card) break;
                card.hidden = i < dealCount - 1;
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
        syncSettingsUI();
        dealNewGame();
        startTimer();
        updateScore();
        updateUI();
        CommonUtils.playSound('shuffle');
        if (stateManager) stateManager.markDirty();
    }

    function startTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
        }
        state.timerInterval = setInterval(() => {
            const timeEl = document.getElementById('rush-time');
            if (timeEl) timeEl.textContent = formatTime(getElapsedSeconds());
        }, 1000);
    }

    function getUpwardNextValue(currentValue) {
        const order = getValueOrder();
        const idx = order.indexOf(currentValue);
        if (idx < 0) return null;
        return order[(idx + 1) % order.length];
    }

    function getDownwardNextValue(currentValue) {
        const idx = getOrderIndex(currentValue);
        if (idx <= 0) return null;
        return getValueOrder()[idx - 1];
    }

    function isAlternating(cardA, cardB) {
        return cardA && cardB && cardA.color !== cardB.color;
    }

    function canMoveToStand(card, standIndex) {
        if (!card) return false;
        if (standIndex >= state.settings.standCount) return false;
        return !state.stands[standIndex];
    }

    function canMoveToTableau(card, targetIndex) {
        const targetColumn = state.tableau[targetIndex];
        if (!card || !Array.isArray(targetColumn)) return false;
        const top = targetColumn[targetColumn.length - 1];
        if (!top) return true;
        if (top.hidden) return false;
        if (isJoker(card) || isJoker(top)) return true;
        if (!isAlternating(card, top)) return false;
        const needed = getDownwardNextValue(top.val);
        return needed === card.val;
    }

    function getContractStartValues(type) {
        return type === 'short' ? ['A', '2'] : ['8'];
    }

    function getContractEndValue(type) {
        return type === 'short' ? '7' : 'A';
    }

    function canMoveToContract(card, contractIndex) {
        const contract = state.contracts[contractIndex];
        if (!card || !contract) return false;

        const pile = contract.cards;
        const top = pile[pile.length - 1];

        if (!top) {
            if (isJoker(card)) return true;
            if (card.suit !== contract.suit) return false;
            return getContractStartValues(contract.type).includes(card.val);
        }

        if (isJoker(card) || isJoker(top)) {
            return true;
        }

        if (card.suit !== contract.suit) return false;
        const needed = getUpwardNextValue(top.val);
        return needed === card.val;
    }

    function isContractComplete(contract) {
        if (!contract || !Array.isArray(contract.cards) || !contract.cards.length) return false;
        const endValue = getContractEndValue(contract.type);
        const expectedSuit = contract.suit;
        const expectedSequence = [];
        const starts = getContractStartValues(contract.type);

        const actualStartCard = contract.cards[0];
        if (!actualStartCard || isJoker(actualStartCard)) return false;
        if (actualStartCard.suit !== expectedSuit) return false;
        if (!starts.includes(actualStartCard.val)) return false;

        let value = actualStartCard.val;
        expectedSequence.push(value);
        while (value !== endValue) {
            value = getUpwardNextValue(value);
            if (!value) return false;
            expectedSequence.push(value);
            if (expectedSequence.length > 30) return false;
        }

        if (contract.cards.length < expectedSequence.length) return false;
        for (let i = 0; i < expectedSequence.length; i += 1) {
            const card = contract.cards[i];
            if (!card || isJoker(card)) return false;
            if (card.suit !== expectedSuit) return false;
            if (card.val !== expectedSequence[i]) return false;
        }

        return true;
    }

    function updateRushHourActivation() {
        if (state.rushHourActive) return;
        state.rushHourActive = state.contracts.some((contract) => contract.cards.some((card) => !isJoker(card) && card.val === '7'));
    }

    function clearBackseatOnContractComplete() {
        if (!state.backseatQueue.length) return;
        state.removedPassengers += state.backseatQueue.length;
        state.backseatQueue = [];
        CommonUtils.showTableToast('Backseat cleared by completed contract.', { variant: 'warn', duration: 1800 });
    }

    function getDrawPassLimit() {
        const baseline = 3;
        if (!state.settings.jokersEnabled) return baseline;
        if (state.settings.jokerPassMode === 'parked-unlimited' && state.stands.some((card) => card && isJoker(card))) {
            return Number.POSITIVE_INFINITY;
        }
        return baseline;
    }

    function consumeJokerPassBonusIfNeeded() {
        if (!state.settings.jokersEnabled) return false;
        if (state.settings.jokerPassMode !== 'consume') return false;
        for (let i = 0; i < state.settings.standCount; i += 1) {
            const card = state.stands[i];
            if (card && isJoker(card)) {
                state.stands[i] = null;
                state.removedPassengers += 1;
                CommonUtils.showTableToast('Parked Joker consumed for +1 pass.', { variant: 'warn', duration: 1800 });
                return true;
            }
        }
        return false;
    }

    function hasConsumableJokerPassBonus() {
        if (!state.settings.jokersEnabled) return false;
        if (state.settings.jokerPassMode !== 'consume') return false;
        for (let i = 0; i < state.settings.standCount; i += 1) {
            const card = state.stands[i];
            if (card && isJoker(card)) return true;
        }
        return false;
    }

    function canDrawNow() {
        if (state.isGameWon || state.isGameLost) return false;
        if (state.mustPlaceWaste && state.waste.length > 0) return false;
        if (state.backseatQueue.length > 0) return false;
        if (state.stock.length > 0) return true;

        const passLimit = getDrawPassLimit();
        if (state.stockPass < passLimit) return state.waste.length > 0;
        if (passLimit === Number.POSITIVE_INFINITY) return state.waste.length > 0;
        return state.waste.length > 0 && hasConsumableJokerPassBonus();
    }

    function recycleWasteIntoStock() {
        const recycled = state.waste.reverse();
        recycled.forEach((card) => {
            card.hidden = true;
        });
        state.stock = recycled;
        state.waste = [];
        state.mustPlaceWaste = false;
        state.stockPass += 1;
    }

    function checkForLoss() {
        if (state.isGameWon || state.isGameLost) return;
        if (state.stockEmptyCount >= 2) {
            state.isGameLost = true;
            state.resultMessage = 'You lost: the stock emptied twice.';
        }

        if (!state.isGameLost && !hasAnyLegalMove() && getPassengersWaitingCount() > 0) {
            state.isGameLost = true;
            state.resultMessage = 'You lost: no legal moves remain with passengers waiting.';
        }

        if (!state.isGameLost) return;
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        if (stateManager) stateManager.markDirty();
        window.setTimeout(() => {
            showInfoDialog('Game Over', state.resultMessage);
        }, 30);
    }

    function getPassengersWaitingCount() {
        const tableauCount = state.tableau.reduce((sum, col) => sum + col.length, 0);
        const standsCount = state.stands.filter(Boolean).length;
        return tableauCount + state.stock.length + state.waste.length + standsCount + state.backseatQueue.length;
    }

    function checkForWin() {
        if (state.isGameWon || state.isGameLost) return;
        const completeCount = state.contracts.reduce((sum, contract) => sum + (isContractComplete(contract) ? 1 : 0), 0);
        if (completeCount !== state.contracts.length) return;
        state.isGameWon = true;
        state.resultMessage = 'You solved Rush Hour Patience!';
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
        CommonUtils.playSound('win');
        CommonUtils.updateHighScore('rush-hour-patience', getCurrentRuleKey(), state.score);
        if (stateManager) stateManager.clear();
        window.setTimeout(() => {
            showInfoDialog('Victory', state.resultMessage);
        }, 30);
    }

    function updateScore() {
        let completedContracts = 0;
        let contractCards = 0;
        state.contracts.forEach((contract) => {
            contractCards += contract.cards.length;
            if (isContractComplete(contract)) completedContracts += 1;
        });
        state.score = (contractCards * 8) + (completedContracts * 50) + Math.max(0, 400 - state.moves * 2);
    }

    function clearSelection() {
        state.selected = null;
    }

    function getSelectedCard() {
        if (!state.selected) return null;
        if (state.selected.source === 'waste') {
            return state.waste[state.waste.length - 1] || null;
        }
        if (state.selected.source === 'stand') {
            return state.stands[state.selected.index] || null;
        }
        if (state.selected.source === 'tableau') {
            const column = state.tableau[state.selected.index];
            return column && column.length ? column[column.length - 1] : null;
        }
        return null;
    }

    function removeSelectedSourceCard() {
        if (!state.selected) return null;
        if (state.selected.source === 'waste') {
            return state.waste.pop() || null;
        }
        if (state.selected.source === 'stand') {
            const index = state.selected.index;
            const card = state.stands[index];
            state.stands[index] = null;
            return card || null;
        }
        if (state.selected.source === 'tableau') {
            const index = state.selected.index;
            const column = state.tableau[index];
            if (!column || !column.length) return null;
            const removed = column.pop();
            const nextTop = column[column.length - 1];
            if (nextTop && nextTop.hidden) {
                nextTop.hidden = false;
            }
            return removed;
        }
        return null;
    }

    function commitMove(options = {}) {
        state.moves += 1;

        if (options.placedWasteCard === true) {
            state.mustPlaceWaste = false;
        }

        if (options.contractIndex >= 0) {
            const contract = state.contracts[options.contractIndex];
            if (contract) {
                updateRushHourActivation();
                if (isContractComplete(contract)) {
                    clearBackseatOnContractComplete();
                }
            }
        }

        updateScore();
        clearSelection();
        checkForWin();
        checkForLoss();
        updateUI();
        CommonUtils.playSound('card');
        if (stateManager) stateManager.markDirty();
    }

    function drawFromStock() {
        if (state.isGameWon || state.isGameLost) return;
        if (!canDrawNow()) {
            if (state.mustPlaceWaste && state.waste.length > 0) {
                CommonUtils.showTableToast('Place the top passenger before drawing again.', { variant: 'warn', duration: 1800 });
            } else if (state.backseatQueue.length > 0) {
                CommonUtils.showTableToast('Backseat is full. Complete a contract to clear it.', { variant: 'warn', duration: 1800 });
            }
            return;
        }

        pushHistoryEntry();

        if (!state.stock.length) {
            const passLimit = getDrawPassLimit();
            if (state.stockPass >= passLimit && passLimit !== Number.POSITIVE_INFINITY) {
                if (!consumeJokerPassBonusIfNeeded()) {
                    updateUI();
                    return;
                }
            }
            state.stockEmptyCount += 1;
            if (state.stockEmptyCount >= 2) {
                checkForLoss();
                updateUI();
                if (stateManager) stateManager.markDirty();
                return;
            }
            recycleWasteIntoStock();
            updateUI();
            if (stateManager) stateManager.markDirty();
            return;
        }

        const drawCount = state.rushHourActive ? 3 : 1;
        const drawn = [];
        for (let i = 0; i < drawCount; i += 1) {
            const card = state.stock.pop();
            if (!card) break;
            card.hidden = false;
            drawn.push(card);
        }

        if (!drawn.length) {
            updateUI();
            return;
        }

        if (state.rushHourActive) {
            const primary = drawn[drawn.length - 1];
            state.waste.push(primary);
            state.mustPlaceWaste = true;
            state.backseatQueue = drawn.slice(0, -1);
        } else {
            const card = drawn[0];
            state.waste.push(card);
            if (state.stockPass >= 3) {
                state.mustPlaceWaste = true;
            }
        }

        state.moves += 1;
        updateScore();
        clearSelection();
        checkForLoss();
        updateUI();
        CommonUtils.playSound('card');
        if (stateManager) stateManager.markDirty();
    }

    function selectWasteTop() {
        if (!state.waste.length) {
            clearSelection();
            updateUI();
            return;
        }
        state.selected = { source: 'waste', index: state.waste.length - 1 };
        updateUI();
    }

    function selectStand(index) {
        if (index >= state.settings.standCount) return;
        if (!state.stands[index]) {
            clearSelection();
            updateUI();
            return;
        }
        state.selected = { source: 'stand', index };
        updateUI();
    }

    function selectTableauTop(columnIndex) {
        const column = state.tableau[columnIndex];
        if (!column || !column.length) {
            clearSelection();
            updateUI();
            return;
        }
        const top = column[column.length - 1];
        if (!top || top.hidden) {
            clearSelection();
            updateUI();
            return;
        }
        state.selected = { source: 'tableau', index: columnIndex };
        updateUI();
    }

    function tryAutoMoveSelectedToContract() {
        const card = getSelectedCard();
        if (!card) return false;
        for (let i = 0; i < state.contracts.length; i += 1) {
            if (!canMoveToContract(card, i)) continue;
            pushHistoryEntry();
            const moved = removeSelectedSourceCard();
            if (!moved) return false;
            state.contracts[i].cards.push(moved);
            commitMove({ placedWasteCard: state.selected && state.selected.source === 'waste', contractIndex: i });
            return true;
        }
        return false;
    }

    function handleWasteClick(event) {
        event.preventDefault();
        if (state.isGameWon || state.isGameLost) return;
        if (!state.waste.length) {
            if (state.selected && state.selected.source === 'tableau') {
                if (state.mustPlaceWaste && state.waste.length > 0) {
                    CommonUtils.showTableToast('Place the locked queue passenger first.', { variant: 'warn', duration: 1800 });
                    return;
                }
                pushHistoryEntry();
                const moved = removeSelectedSourceCard();
                if (!moved) return;
                moved.hidden = false;
                state.waste.push(moved);
                commitMove({ placedWasteCard: false });
                return;
            }
            clearSelection();
            updateUI();
            return;
        }

        if (state.selected && state.selected.source === 'waste') {
            if (!tryAutoMoveSelectedToContract()) {
                clearSelection();
                updateUI();
            }
            return;
        }

        if (state.selected && state.selected.source === 'tableau') {
            if (state.mustPlaceWaste && state.waste.length > 0) {
                CommonUtils.showTableToast('Place the locked queue passenger first.', { variant: 'warn', duration: 1800 });
                return;
            }
            pushHistoryEntry();
            const moved = removeSelectedSourceCard();
            if (!moved) return;
            moved.hidden = false;
            state.waste.push(moved);
            commitMove({ placedWasteCard: false });
            return;
        }

        selectWasteTop();
    }

    function handleStandClick(index) {
        if (state.isGameWon || state.isGameLost) return;

        if (!state.selected) {
            if (state.stands[index]) {
                selectStand(index);
            }
            return;
        }

        if (state.selected.source === 'stand' && state.selected.index === index) {
            if (!tryAutoMoveSelectedToContract()) {
                clearSelection();
                updateUI();
            }
            return;
        }

        const selectedCard = getSelectedCard();
        if (!selectedCard) return;
        if (!canMoveToStand(selectedCard, index)) return;

        pushHistoryEntry();
        const placedWasteCard = state.selected.source === 'waste';
        const moved = removeSelectedSourceCard();
        if (!moved) return;
        state.stands[index] = moved;
        commitMove({ placedWasteCard });
    }

    function handleTableauCardClick(columnIndex, cardIndex) {
        if (state.isGameWon || state.isGameLost) return;
        const column = state.tableau[columnIndex];
        if (!column || !column.length) return;
        if (cardIndex !== column.length - 1) return;
        if (column[cardIndex].hidden) return;

        if (!state.selected) {
            selectTableauTop(columnIndex);
            return;
        }

        if (state.selected.source === 'tableau' && state.selected.index === columnIndex) {
            if (!tryAutoMoveSelectedToContract()) {
                clearSelection();
                updateUI();
            }
            return;
        }

        const selectedCard = getSelectedCard();
        if (!selectedCard) return;

        if (!canMoveToTableau(selectedCard, columnIndex)) {
            selectTableauTop(columnIndex);
            return;
        }

        pushHistoryEntry();
        const placedWasteCard = state.selected.source === 'waste';
        const moved = removeSelectedSourceCard();
        if (!moved) return;
        state.tableau[columnIndex].push(moved);
        commitMove({ placedWasteCard });
    }

    function handleTableauColumnClick(columnIndex) {
        if (!state.selected || state.isGameWon || state.isGameLost) return;
        const selectedCard = getSelectedCard();
        if (!selectedCard) return;
        if (!canMoveToTableau(selectedCard, columnIndex)) return;

        pushHistoryEntry();
        const placedWasteCard = state.selected.source === 'waste';
        const moved = removeSelectedSourceCard();
        if (!moved) return;
        state.tableau[columnIndex].push(moved);
        commitMove({ placedWasteCard });
    }

    function handleContractClick(contractIndex) {
        if (state.isGameWon || state.isGameLost || !state.selected) return;
        const selectedCard = getSelectedCard();
        if (!selectedCard) return;
        if (!canMoveToContract(selectedCard, contractIndex)) return;

        pushHistoryEntry();
        const placedWasteCard = state.selected.source === 'waste';
        const moved = removeSelectedSourceCard();
        if (!moved) return;
        state.contracts[contractIndex].cards.push(moved);
        commitMove({ placedWasteCard, contractIndex });
    }

    function clearDropIndicators() {
        document.querySelectorAll('.rush-column, .rush-contract, .rush-stand').forEach((el) => {
            el.classList.remove('drag-over-valid', 'drag-over-invalid');
        });
    }

    function clearDragState() {
        dragState.active = null;
        clearDropIndicators();
        if (!CommonUtils.isMobile()) {
            clearSelection();
        }
    }

    function markDropIndicator(targetEl, valid) {
        if (!targetEl) return;
        targetEl.classList.remove('drag-over-valid', 'drag-over-invalid');
        targetEl.classList.add(valid ? 'drag-over-valid' : 'drag-over-invalid');
    }

    function startDragFromWaste(event) {
        if (CommonUtils.isMobile() || state.isGameWon || state.isGameLost || !state.waste.length) {
            event.preventDefault();
            return;
        }
        dragState.active = { source: 'waste' };
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', 'rush-waste');
        }
    }

    function startDragFromStand(event, standIndex) {
        if (CommonUtils.isMobile() || state.isGameWon || state.isGameLost || !state.stands[standIndex]) {
            event.preventDefault();
            return;
        }
        dragState.active = { source: 'stand', index: standIndex };
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', `rush-stand:${standIndex}`);
        }
    }

    function startDragFromTableau(event, columnIndex) {
        const column = state.tableau[columnIndex];
        if (CommonUtils.isMobile() || state.isGameWon || state.isGameLost || !column || !column.length) {
            event.preventDefault();
            return;
        }
        dragState.active = { source: 'tableau', index: columnIndex };
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', `rush-tableau:${columnIndex}`);
        }
    }

    function selectFromDragSource() {
        if (!dragState.active) return false;
        if (dragState.active.source === 'waste') {
            state.selected = { source: 'waste', index: state.waste.length - 1 };
            return true;
        }
        if (dragState.active.source === 'stand') {
            state.selected = { source: 'stand', index: dragState.active.index };
            return true;
        }
        if (dragState.active.source === 'tableau') {
            state.selected = { source: 'tableau', index: dragState.active.index };
            return true;
        }
        return false;
    }

    function canDragDropToTableau(targetColumn) {
        if (!selectFromDragSource()) return false;
        const card = getSelectedCard();
        if (!card) return false;
        if (state.selected.source === 'tableau' && state.selected.index === targetColumn) return false;
        return canMoveToTableau(card, targetColumn);
    }

    function canDragDropToContract(targetContract) {
        if (!selectFromDragSource()) return false;
        const card = getSelectedCard();
        if (!card) return false;
        return canMoveToContract(card, targetContract);
    }

    function canDragDropToStand(targetStand) {
        if (!selectFromDragSource()) return false;
        const card = getSelectedCard();
        if (!card) return false;
        if (state.selected.source === 'stand' && state.selected.index === targetStand) return false;
        return canMoveToStand(card, targetStand);
    }

    function canDragDropToWaste() {
        if (!selectFromDragSource()) return false;
        if (!(state.selected && state.selected.source === 'tableau')) return false;
        if (state.mustPlaceWaste && state.waste.length > 0) return false;
        return true;
    }

    function undoMove() {
        if (!state.moveHistory.length || state.isGameWon || state.isGameLost) return;
        const entry = state.moveHistory.pop();
        restoreHistoryEntry(entry);
        syncSettingsUI();
        clearSelection();
        checkForLoss();
        updateUI();
        if (stateManager) stateManager.markDirty();
    }

    function getContractLabel(contract) {
        return `${contract.suit}`;
    }

    function renderStock() {
        const stockEl = document.getElementById('rush-stock');
        if (!stockEl) return;
        stockEl.innerHTML = '';

        stockEl.classList.toggle('is-disabled', !canDrawNow());

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
            placeholder.className = 'rush-pile-placeholder';
            placeholder.textContent = 'Stock';
            stockEl.appendChild(placeholder);
        }
    }

    function renderWaste() {
        const wasteEl = document.getElementById('rush-waste');
        if (!wasteEl) return;
        wasteEl.innerHTML = '';

        if (!state.waste.length) {
            const placeholder = document.createElement('div');
            placeholder.className = 'rush-pile-placeholder';
            placeholder.textContent = 'Queue';
            wasteEl.appendChild(placeholder);
            return;
        }

        const top = state.waste[state.waste.length - 1];
        const cardEl = CommonUtils.createCardEl(top);
        cardEl.classList.toggle('rush-selected', !!state.selected && state.selected.source === 'waste');
        cardEl.classList.toggle('picked-up', !!state.selected && state.selected.source === 'waste' && CommonUtils.isMobile());
        if (!CommonUtils.isMobile()) {
            cardEl.draggable = true;
            cardEl.addEventListener('dragstart', startDragFromWaste);
            cardEl.addEventListener('dragend', clearDragState);
        }
        cardEl.addEventListener('click', (event) => {
            event.stopPropagation();
            handleWasteClick(event);
        });
        cardEl.addEventListener('dblclick', (event) => {
            event.stopPropagation();
            if (!state.selected || state.selected.source !== 'waste') selectWasteTop();
            tryAutoMoveSelectedToContract();
        });
        wasteEl.appendChild(cardEl);
    }

    function renderStands() {
        const root = document.getElementById('rush-stands');
        if (!root) return;
        root.innerHTML = '';

        for (let i = 0; i < 2; i += 1) {
            const standEl = document.createElement('div');
            standEl.className = 'rush-stand';
            standEl.dataset.index = String(i);
            if (i >= state.settings.standCount) {
                standEl.style.opacity = '0.35';
                const placeholder = document.createElement('div');
                placeholder.className = 'rush-pile-placeholder';
                placeholder.textContent = 'Locked';
                standEl.appendChild(placeholder);
                root.appendChild(standEl);
                continue;
            }

            standEl.addEventListener('dragover', (event) => {
                if (!dragState.active) return;
                const valid = canDragDropToStand(i);
                if (valid) event.preventDefault();
                markDropIndicator(standEl, valid);
            });
            standEl.addEventListener('dragleave', () => {
                standEl.classList.remove('drag-over-valid', 'drag-over-invalid');
            });
            standEl.addEventListener('drop', (event) => {
                if (!dragState.active) return;
                event.preventDefault();
                if (selectFromDragSource()) {
                    handleStandClick(i);
                }
                clearDragState();
            });
            standEl.addEventListener('click', () => handleStandClick(i));
            const card = state.stands[i];
            if (!card) {
                const placeholder = document.createElement('div');
                placeholder.className = 'rush-pile-placeholder';
                placeholder.textContent = 'Stand';
                standEl.appendChild(placeholder);
            } else {
                const cardEl = CommonUtils.createCardEl(card);
                cardEl.classList.toggle('rush-selected', !!state.selected && state.selected.source === 'stand' && state.selected.index === i);
                cardEl.classList.toggle('picked-up', !!state.selected && state.selected.source === 'stand' && state.selected.index === i && CommonUtils.isMobile());
                if (!CommonUtils.isMobile()) {
                    cardEl.draggable = true;
                    cardEl.addEventListener('dragstart', (event) => startDragFromStand(event, i));
                    cardEl.addEventListener('dragend', clearDragState);
                }
                cardEl.addEventListener('click', (event) => {
                    event.stopPropagation();
                    handleStandClick(i);
                });
                cardEl.addEventListener('dblclick', (event) => {
                    event.stopPropagation();
                    if (!state.selected || state.selected.source !== 'stand' || state.selected.index !== i) {
                        selectStand(i);
                    }
                    tryAutoMoveSelectedToContract();
                });
                standEl.appendChild(cardEl);
            }
            root.appendChild(standEl);
        }
    }

    function renderBackseat() {
        const root = document.getElementById('rush-backseat');
        if (!root) return;
        root.innerHTML = '';
        root.classList.toggle('has-waiting', state.backseatQueue.length > 0);

        for (let i = 0; i < 2; i += 1) {
            const slotEl = document.createElement('div');
            slotEl.className = 'rush-backseat-slot';
            const card = state.backseatQueue[i];
            if (!card) {
                const placeholder = document.createElement('div');
                placeholder.className = 'rush-pile-placeholder';
                placeholder.textContent = 'Backseat';
                slotEl.appendChild(placeholder);
            } else {
                const cardEl = CommonUtils.createCardEl(card);
                slotEl.appendChild(cardEl);
            }
            root.appendChild(slotEl);
        }
    }

    function renderContracts() {
        const root = document.getElementById('rush-contracts');
        if (!root) return;
        root.innerHTML = '';

        for (let i = 0; i < state.contracts.length; i += 1) {
            const contract = state.contracts[i];
            const pileEl = document.createElement('div');
            pileEl.className = 'rush-contract';
            pileEl.dataset.index = String(i);
            pileEl.classList.toggle('complete', isContractComplete(contract));
            pileEl.addEventListener('dragover', (event) => {
                if (!dragState.active) return;
                const valid = canDragDropToContract(i);
                if (valid) event.preventDefault();
                markDropIndicator(pileEl, valid);
            });
            pileEl.addEventListener('dragleave', () => {
                pileEl.classList.remove('drag-over-valid', 'drag-over-invalid');
            });
            pileEl.addEventListener('drop', (event) => {
                if (!dragState.active) return;
                event.preventDefault();
                if (selectFromDragSource()) {
                    handleContractClick(i);
                }
                clearDragState();
            });
            pileEl.addEventListener('click', () => handleContractClick(i));

            if (!contract.cards.length) {
                const placeholder = document.createElement('div');
                placeholder.className = 'rush-pile-placeholder';
                placeholder.textContent = getContractLabel(contract);
                pileEl.appendChild(placeholder);
            } else {
                const top = contract.cards[contract.cards.length - 1];
                const cardEl = CommonUtils.createCardEl(top);
                pileEl.appendChild(cardEl);
            }

            root.appendChild(pileEl);
        }
    }

    function renderTableau() {
        const root = document.getElementById('rush-tableau');
        if (!root) return;
        root.innerHTML = '';

        const stackY = CommonUtils.getSolitaireStackOffset(TABLEAU_STACK_Y, { minFactor: TABLEAU_STACK_Y_MIN_FACTOR });

        for (let colIndex = 0; colIndex < state.tableau.length; colIndex += 1) {
            const columnEl = document.createElement('div');
            columnEl.className = 'rush-column';
            columnEl.id = `rush-column-${colIndex}`;
            columnEl.dataset.index = String(colIndex);
            columnEl.addEventListener('dragover', (event) => {
                if (!dragState.active) return;
                const valid = canDragDropToTableau(colIndex);
                if (valid) event.preventDefault();
                markDropIndicator(columnEl, valid);
            });
            columnEl.addEventListener('dragleave', () => {
                columnEl.classList.remove('drag-over-valid', 'drag-over-invalid');
            });
            columnEl.addEventListener('drop', (event) => {
                if (!dragState.active) return;
                event.preventDefault();
                if (selectFromDragSource()) {
                    handleTableauColumnClick(colIndex);
                }
                clearDragState();
            });
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
                    && state.selected.index === colIndex
                    && cardIndex === column.length - 1;
                if (isSelected) {
                    cardEl.classList.add('rush-selected');
                    if (CommonUtils.isMobile()) {
                        cardEl.classList.add('picked-up');
                    }
                }

                const isTopCard = cardIndex === column.length - 1;
                if (!CommonUtils.isMobile() && isTopCard) {
                    if (!card.hidden) {
                        cardEl.draggable = true;
                        cardEl.addEventListener('dragstart', (event) => startDragFromTableau(event, colIndex));
                        cardEl.addEventListener('dragend', clearDragState);
                    }
                }
                cardEl.addEventListener('click', (event) => {
                    event.stopPropagation();
                    handleTableauCardClick(colIndex, cardIndex);
                });
                cardEl.addEventListener('dblclick', (event) => {
                    event.stopPropagation();
                    if (cardIndex !== column.length - 1) return;
                    selectTableauTop(colIndex);
                    tryAutoMoveSelectedToContract();
                });

                columnEl.appendChild(cardEl);
            }

            const minHeight = CommonUtils.getStackHeight(Math.max(1, column.length), stackY);
            columnEl.style.minHeight = `${Math.max(210, minHeight)}px`;
            root.appendChild(columnEl);
        }
    }

    function syncHighScore() {
        const highScoreEl = document.getElementById('rush-high-score');
        if (!highScoreEl) return;
        const value = CommonUtils.getHighScore('rush-hour-patience', getCurrentRuleKey());
        highScoreEl.textContent = String(value);
    }

    function updateStats() {
        const movesEl = document.getElementById('rush-moves');
        const scoreEl = document.getElementById('rush-score');
        const timeEl = document.getElementById('rush-time');
        const passEl = document.getElementById('rush-stock-pass');
        const rushEl = document.getElementById('rush-hour-state');
        const rushHeadingEl = document.getElementById('rush-hour-heading');
        if (movesEl) movesEl.textContent = String(state.moves);
        if (scoreEl) scoreEl.textContent = String(state.score);
        if (timeEl) timeEl.textContent = formatTime(getElapsedSeconds());

        const maxPass = getDrawPassLimit();
        const maxPassText = maxPass === Number.POSITIVE_INFINITY ? '∞' : String(maxPass);
        if (passEl) passEl.textContent = `${state.stockPass}/${maxPassText}`;
        if (rushEl) rushEl.textContent = state.rushHourActive ? 'Yes' : 'No';
        if (rushHeadingEl) {
            rushHeadingEl.textContent = state.rushHourActive ? 'Rush hour!' : 'rush hour';
            rushHeadingEl.classList.toggle('rush-active', state.rushHourActive);
            rushHeadingEl.classList.toggle('rush-subtle', !state.rushHourActive);
        }

        syncHighScore();
    }

    function updateUndoButton() {
        const undoBtn = document.getElementById('rush-undo');
        if (!undoBtn) return;
        undoBtn.disabled = !state.moveHistory.length || state.isGameWon || state.isGameLost;
    }

    function updateDrawButton() {
        const drawBtn = document.getElementById('rush-draw');
        if (!drawBtn) return;
        drawBtn.disabled = !canDrawNow() || state.isGameWon || state.isGameLost;
    }

    function ensureRushSizing() {
        const tableEl = document.getElementById('table');
        if (!tableEl) return;

        const cardMetrics = CommonUtils.getCardMetrics();
        const baseGap = Math.max(4, Math.round(10 * Math.min(cardMetrics.scale, 1)));
        const fan = Math.max(4, Math.round(14 * Math.min(cardMetrics.scale, 1)));

        tableEl.style.setProperty('--rush-tableau-gap', `${baseGap}px`);
        tableEl.style.setProperty('--rush-fan-x', `${fan}px`);

        CommonUtils.ensureScrollableWidth({
            table: 'table',
            wrapper: 'rush-scroll',
            contentSelectors: ['#rush-top-row', '#rush-lane-row', '#rush-tableau'],
            enterTolerance: 6,
            exitTolerance: 3
        });
    }

    function updateUI() {
        CommonUtils.preserveHorizontalScroll({
            targets: ['rush-scroll'],
            update: () => {
                clearDropIndicators();
                renderStock();
                renderWaste();
                renderStands();
                renderBackseat();
                renderContracts();
                renderTableau();
                updateStats();
                updateUndoButton();
                updateDrawButton();
                ensureRushSizing();
            }
        });
    }

    function gatherHintMoves() {
        const moves = [];

        const wasteTop = state.waste[state.waste.length - 1];
        if (wasteTop) {
            for (let i = 0; i < state.contracts.length; i += 1) {
                if (canMoveToContract(wasteTop, i)) {
                    moves.push('Move queue card to a contract');
                    return moves;
                }
            }
            for (let col = 0; col < TABLEAU_COLUMNS; col += 1) {
                if (canMoveToTableau(wasteTop, col)) {
                    moves.push(`Move queue card to street ${col + 1}`);
                    return moves;
                }
            }
        }

        for (let standIndex = 0; standIndex < state.settings.standCount; standIndex += 1) {
            const standCard = state.stands[standIndex];
            if (!standCard) continue;
            for (let i = 0; i < state.contracts.length; i += 1) {
                if (canMoveToContract(standCard, i)) {
                    moves.push(`Move stand ${standIndex + 1} card to a contract`);
                    return moves;
                }
            }
            for (let col = 0; col < TABLEAU_COLUMNS; col += 1) {
                if (canMoveToTableau(standCard, col)) {
                    moves.push(`Move stand ${standIndex + 1} card to street ${col + 1}`);
                    return moves;
                }
            }
        }

        for (let sourceCol = 0; sourceCol < TABLEAU_COLUMNS; sourceCol += 1) {
            const column = state.tableau[sourceCol];
            if (!column.length) continue;
            const card = column[column.length - 1];
            for (let i = 0; i < state.contracts.length; i += 1) {
                if (canMoveToContract(card, i)) {
                    moves.push(`Move street ${sourceCol + 1} top card to a contract`);
                    return moves;
                }
            }
            for (let target = 0; target < TABLEAU_COLUMNS; target += 1) {
                if (target === sourceCol) continue;
                if (canMoveToTableau(card, target)) {
                    moves.push(`Move street ${sourceCol + 1} top card to street ${target + 1}`);
                    return moves;
                }
            }
            for (let standIndex = 0; standIndex < state.settings.standCount; standIndex += 1) {
                if (canMoveToStand(card, standIndex)) {
                    moves.push(`Park street ${sourceCol + 1} top card in stand ${standIndex + 1}`);
                    return moves;
                }
            }
        }

        if (canDrawNow()) {
            moves.push('Draw from stock');
        }

        return moves;
    }

    function showHint() {
        if (state.isGameWon || state.isGameLost) return;
        const hints = gatherHintMoves();
        if (!hints.length) {
            showHintToast('Hint: No obvious moves found.');
            return;
        }
        showHintToast(`Hint: ${hints[0]}`);
    }

    function showHelp() {
        showInfoDialog('Rush Hour Patience Rules', HELP_TEXT);
    }

    function hasAnyLegalMove() {
        const wasteTop = state.waste[state.waste.length - 1];
        if (wasteTop) {
            for (let i = 0; i < state.contracts.length; i += 1) {
                if (canMoveToContract(wasteTop, i)) return true;
            }
            for (let col = 0; col < TABLEAU_COLUMNS; col += 1) {
                if (canMoveToTableau(wasteTop, col)) return true;
            }
            for (let standIndex = 0; standIndex < state.settings.standCount; standIndex += 1) {
                if (canMoveToStand(wasteTop, standIndex)) return true;
            }
        }

        for (let standIndex = 0; standIndex < state.settings.standCount; standIndex += 1) {
            const standCard = state.stands[standIndex];
            if (!standCard) continue;
            for (let i = 0; i < state.contracts.length; i += 1) {
                if (canMoveToContract(standCard, i)) return true;
            }
            for (let col = 0; col < TABLEAU_COLUMNS; col += 1) {
                if (canMoveToTableau(standCard, col)) return true;
            }
        }

        for (let sourceCol = 0; sourceCol < TABLEAU_COLUMNS; sourceCol += 1) {
            const column = state.tableau[sourceCol];
            if (!column.length) continue;
            const top = column[column.length - 1];
            for (let i = 0; i < state.contracts.length; i += 1) {
                if (canMoveToContract(top, i)) return true;
            }
            for (let targetCol = 0; targetCol < TABLEAU_COLUMNS; targetCol += 1) {
                if (targetCol === sourceCol) continue;
                if (canMoveToTableau(top, targetCol)) return true;
            }
            for (let standIndex = 0; standIndex < state.settings.standCount; standIndex += 1) {
                if (canMoveToStand(top, standIndex)) return true;
            }
        }

        return canDrawNow();
    }

    function applySettingChange() {
        const standSelect = document.getElementById('rush-stand-count');
        const knightsInput = document.getElementById('rush-knights-enabled');
        const jokersInput = document.getElementById('rush-jokers-enabled');
        const jokerCountSelect = document.getElementById('rush-joker-count');
        const jokerModeSelect = document.getElementById('rush-joker-pass-mode');

        const next = {
            standCount: standSelect && standSelect.value === '1' ? 1 : 2,
            knightsEnabled: !knightsInput || knightsInput.checked,
            jokersEnabled: !!(jokersInput && jokersInput.checked),
            jokerCount: jokerCountSelect ? Math.max(1, Math.min(8, parseInt(jokerCountSelect.value, 10) || 2)) : 2,
            jokerPassMode: jokerModeSelect && jokerModeSelect.value === 'parked-unlimited' ? 'parked-unlimited' : 'consume'
        };

        const changed = next.standCount !== state.settings.standCount
            || next.knightsEnabled !== state.settings.knightsEnabled
            || next.jokersEnabled !== state.settings.jokersEnabled
            || next.jokerCount !== state.settings.jokerCount
            || next.jokerPassMode !== state.settings.jokerPassMode;

        state.settings = next;
        syncSettingsUI();

        if (changed) {
            initGame();
        }
    }

    function syncSettingsUI() {
        const standSelect = document.getElementById('rush-stand-count');
        const knightsInput = document.getElementById('rush-knights-enabled');
        const jokersInput = document.getElementById('rush-jokers-enabled');
        const jokerCountSelect = document.getElementById('rush-joker-count');
        const jokerModeSelect = document.getElementById('rush-joker-pass-mode');

        if (standSelect) standSelect.value = String(state.settings.standCount);
        if (knightsInput) knightsInput.checked = !!state.settings.knightsEnabled;
        if (jokersInput) jokersInput.checked = !!state.settings.jokersEnabled;
        if (jokerCountSelect) {
            jokerCountSelect.value = String(state.settings.jokerCount);
            jokerCountSelect.disabled = !state.settings.jokersEnabled;
        }
        if (jokerModeSelect) {
            jokerModeSelect.value = state.settings.jokerPassMode;
            jokerModeSelect.disabled = !state.settings.jokersEnabled;
        }
    }

    function setupEventListeners() {
        const newGameBtn = document.getElementById('rush-new-game');
        const drawBtn = document.getElementById('rush-draw');
        const undoBtn = document.getElementById('rush-undo');
        const hintBtn = document.getElementById('rush-hint');
        const helpBtn = document.getElementById('rush-help');
        const stockEl = document.getElementById('rush-stock');
        const wasteEl = document.getElementById('rush-waste');

        if (newGameBtn) newGameBtn.addEventListener('click', initGame);
        if (drawBtn) drawBtn.addEventListener('click', drawFromStock);
        if (undoBtn) undoBtn.addEventListener('click', undoMove);
        if (hintBtn) hintBtn.addEventListener('click', showHint);
        if (helpBtn) helpBtn.addEventListener('click', showHelp);
        if (stockEl) stockEl.addEventListener('click', drawFromStock);
        if (wasteEl) wasteEl.addEventListener('click', handleWasteClick);
        if (wasteEl) {
            wasteEl.addEventListener('dragover', (event) => {
                if (!dragState.active) return;
                const valid = canDragDropToWaste();
                if (valid) event.preventDefault();
                markDropIndicator(wasteEl, valid);
            });
            wasteEl.addEventListener('dragleave', () => {
                wasteEl.classList.remove('drag-over-valid', 'drag-over-invalid');
            });
            wasteEl.addEventListener('drop', (event) => {
                if (!dragState.active) return;
                event.preventDefault();
                if (selectFromDragSource()) {
                    handleWasteClick(event);
                }
                clearDragState();
            });
        }

        ['rush-stand-count', 'rush-knights-enabled', 'rush-jokers-enabled', 'rush-joker-count', 'rush-joker-pass-mode'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', applySettingChange);
        });

        window.addEventListener('card-scale:changed', scheduleSizing);
        window.addEventListener('resize', scheduleSizing);
        document.addEventListener('dragover', (event) => {
            if (!dragState.active) return;
            event.preventDefault();
        });
        document.addEventListener('drop', (event) => {
            if (!dragState.active) return;
            event.preventDefault();
            clearDragState();
        });

        document.addEventListener('click', (event) => {
            if (!state.selected) return;
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.closest('#rush-tableau') || target.closest('#rush-waste') || target.closest('#rush-contracts-panel') || target.closest('#rush-stands') || target.closest('#rush-backseat')) return;
            clearSelection();
            updateUI();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                clearSelection();
                updateUI();
            }
        });
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
        CommonUtils.initCardScaleControls('rush-card-scale', 'rush-card-scale-value');

        stateManager = new CommonUtils.StateManager({
            gameId: 'rush-hour-patience',
            getState: getSaveState,
            setState: restoreState,
            isWon: () => state.isGameWon
        });

        syncSettingsUI();
        const restored = stateManager.load();
        if (!restored) {
            initGame();
        }
    });
})();
