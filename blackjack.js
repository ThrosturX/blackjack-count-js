const BET_TIME = 10;
const MIN_TIMER = 3;
const PENETRATION = 0.75;
const SETTINGS_STORAGE_KEY = 'bj_table.settings';

/* --- STATE --- */
const state = {
    seatCount: 5,
    deckCount: 6,
    shoe: [],
    totalInitialCards: 0,
    cutCardReached: false,
    tableSettingsChanged: false,
    runningCount: 0,
    countingSystem: 'hi-lo',
    dealer: { hand: [] },
    players: [],
    phase: 'BETTING', // BETTING, SHUFFLING, DEALING, PLAYING, RESOLVING
    turnIndex: -1,
    splitIndex: -1,
    timer: null,
    timerVal: 0,
    isShuffling: false,
    minBet: 10,
    maxBet: 1000,
    casinoProfit: 0,
    playedRounds: 0,
    fastMode: false
};

const ui = {
    seats: document.getElementById('seats'),
    dealerCards: document.getElementById('dealer-cards'),
    dealerScore: document.getElementById('dealer-score'),
    overlay: document.getElementById('center-overlay'),
    overlayMain: document.getElementById('overlay-main'),
    overlaySub: document.getElementById('overlay-sub'),
    cardsLeft: document.getElementById('cards-left'),
    runCount: document.getElementById('run-count'),
    casinoProfit: document.getElementById('casino-profit'),
    playedRounds: document.getElementById('played-rounds'),
    deckSelect: document.getElementById('deck-select'),
    deckStyleSelect: document.getElementById('deck-style-select'),
    tableStyleSelect: document.getElementById('table-style-select'),
    seatSelect: document.getElementById('seat-select'),
    strategyText: document.getElementById('strategy-text'),
    countHint: document.getElementById('count-hint'),
    settingsArea: document.getElementById('settings-area'),
    themeArea: document.getElementById('theme-area'),
    addonsArea: document.getElementById('addons-area'),
    statsArea: document.getElementById('stats-area'),
    toggleSettings: document.getElementById('toggle-settings'),
    toggleThemes: document.getElementById('toggle-themes'),
    toggleAddons: document.getElementById('toggle-addons'),
    toggleStats: document.getElementById('toggle-stats'),
    fastModeCheckbox: document.getElementById('fast-mode-checkbox'),
    minBet: document.getElementById('table-minimum-bet'),
    countSystemSelect: document.getElementById('count-system-select'),
    topCardPreview: document.getElementById('top-card-preview'),
};

/* --- AUDIO HANDLING --- */
function preloadAudio() {
    const soundFiles = {
        'card': ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav', 'card5.wav'],
        'shuffle': ['shuffle.wav'],
        'chip': ['chip.wav', 'chips.wav'],
        'win': ['win.wav', 'nice.wav', 'youwin.wav', 'winner.wav'],
        'lose': ['lose.wav', 'noluck.wav', 'itiswhatis.wav', 'nextluck.wav', 'lucknext.wav'],
        'bust': ['bust.wav'],
        'blackjack': ['blackjack.wav'],
        'dealer-bj': ['dealer-bj.wav', 'dealer-bj2.wav', 'dealer-bj3.wav'],
        'dealer-bust': ['dealer-bust.wav', 'dealer-bust2.wav', 'dealer-bust3.wav'],
        'error': ['error.wav']
    };
    CommonUtils.preloadAudio(soundFiles);
}

// Initialize audio at startup
preloadAudio();

function playSound(type) {
    CommonUtils.playSound(type);
}

/* --- INITIALIZATION --- */
function init() {
    state.players = Array(state.seatCount).fill(null);
    createShoe();

    // Initialize deck style
    if (ui.deckStyleSelect) {
        updateDeckStyle();
        ui.deckStyleSelect.addEventListener('change', updateDeckStyle);
    }

    // Initialize table style
    if (ui.tableStyleSelect) {
        updateTableStyle();
        ui.tableStyleSelect.addEventListener('change', updateTableStyle);
    }

    if (ui.countSystemSelect) {
        const loadSettings = () => {
            try {
                const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
                if (!raw) return null;
                const data = JSON.parse(raw);
                if (!data || typeof data !== 'object') return null;
                return data;
            } catch (err) {
                return null;
            }
        };
        const persistSettings = (updates = {}) => {
            if (window.__settingsResetInProgress) return;
            try {
                const current = loadSettings() || { addons: {} };
                const next = {
                    ...current,
                    ...updates,
                    addons: { ...(current.addons || {}) }
                };
                localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
            } catch (err) {
                // Ignore storage failures.
            }
        };
        const stored = loadSettings();
        if (stored && stored.countingSystem) {
            state.countingSystem = stored.countingSystem;
        }
        const initCounting = () => {
            populateCountingSystems();
            ui.countSystemSelect.addEventListener('change', (e) => {
                state.countingSystem = e.target.value;
                state.runningCount = 0;
                updateStats();
                updateCountHint();
                persistSettings({ countingSystem: state.countingSystem });
            });
        };
        if (window.AddonLoader && window.AddonLoader.ready) {
            window.AddonLoader.ready.then(initCounting);
        } else {
            initCounting();
        }
        window.CountingUI = { refresh: populateCountingSystems };
    }

    // Initialize independent toggles
    if (ui.toggleSettings) {
        ui.toggleSettings.addEventListener('click', () => toggleControlsArea('settings'));
        ui.toggleSettings.classList.add('active'); // Default open
    }
    if (ui.toggleThemes) {
        ui.toggleThemes.addEventListener('click', () => toggleControlsArea('themes'));
        ui.toggleThemes.classList.add('active'); // Default open
    }
    if (ui.toggleAddons) {
        ui.toggleAddons.addEventListener('click', () => toggleControlsArea('addons'));
        ui.toggleAddons.classList.toggle('active', !ui.addonsArea.classList.contains('collapsed'));
    }
    if (ui.toggleStats) {
        ui.toggleStats.addEventListener('click', () => toggleControlsArea('stats'));
        ui.toggleStats.classList.add('active'); // Default open
    }

    if (ui.topCardPreview) {
        ui.topCardPreview.onmouseup = () => {
            const peekCard = ui.topCardPreview.children[0];
            if (peekCard) peekCard.classList.add('hidden');
        }
        ui.topCardPreview.onmousedown = () => {
            const peekCard = ui.topCardPreview.children[0];
            if (peekCard) peekCard.classList.remove('hidden');
        }
    }

    setTimeout(updateShoeVisual, 100);
}

function toggleControlsArea(type) {
    if (type === 'settings') {
        const isCollapsed = ui.settingsArea.classList.toggle('collapsed');
        ui.toggleSettings.classList.toggle('active', !isCollapsed);
    } else if (type === 'themes') {
        const isCollapsed = ui.themeArea.classList.toggle('collapsed');
        ui.toggleThemes.classList.toggle('active', !isCollapsed);
    } else if (type === 'addons') {
        const isCollapsed = ui.addonsArea.classList.toggle('collapsed');
        ui.toggleAddons.classList.toggle('active', !isCollapsed);
    } else if (type === 'stats') {
        const isCollapsed = ui.statsArea.classList.toggle('collapsed');
        ui.toggleStats.classList.toggle('active', !isCollapsed);
    }
}

function updateDeckStyle() {
    const style = ui.deckStyleSelect.value;
    // Remove any existing deck classes
    Array.from(document.body.classList).forEach(cls => {
        if (cls.startsWith('deck-')) document.body.classList.remove(cls);
    });
    // Add selected deck class
    document.body.classList.add(`deck-${style}`);

    // Refresh visuals that might need it
    updateShoeVisual();
    render();
}

function updateTableStyle() {
    const style = ui.tableStyleSelect.value;
    // Remove any existing table classes
    Array.from(document.body.classList).forEach(cls => {
        if (cls.startsWith('table-')) document.body.classList.remove(cls);
    });
    // Add selected table class
    document.body.classList.add(`table-${style}`);
}

function getCountingCatalog() {
    if (window.AssetRegistry && typeof window.AssetRegistry.getCountingSystems === 'function') {
        return window.AssetRegistry.getCountingSystems();
    }
    return {
        core: [{ id: 'hi-lo', name: 'Hi-Lo' }],
        extras: [{ id: 'ko', name: 'KO (U)' }]
    };
}

function populateCountingSystems() {
    const catalog = getCountingCatalog();
    const select = ui.countSystemSelect;
    if (!select) return;

    const currentValue = select.value || state.countingSystem;
    select.innerHTML = '';
    catalog.core.forEach(system => {
        const option = document.createElement('option');
        option.value = system.id;
        option.textContent = system.name;
        option.dataset.themeGroup = 'core';
        select.appendChild(option);
    });
    catalog.extras.forEach(system => {
        const option = document.createElement('option');
        option.value = system.id;
        option.textContent = system.name;
        option.dataset.themeGroup = 'extras';
        select.appendChild(option);
    });
    if (currentValue && !select.querySelector(`option[value="${currentValue}"]`)) {
        const option = document.createElement('option');
        option.value = currentValue;
        option.textContent = `${currentValue} (Active)`;
        option.dataset.themeGroup = 'active';
        select.appendChild(option);
    }
    select.value = currentValue || state.countingSystem;
    if (select.value && select.value !== state.countingSystem) {
        state.countingSystem = select.value;
    }
}

function getCardCountValue(card) {
    switch (state.countingSystem) {
        case 'zen':
            if (['10', 'J', 'Q', 'K'].includes(card.val)) return -2;
            if (['A'].includes(card.val)) return -1;
            if (['4', '5', '6'].includes(card.val)) return 2;
            if (['2', '3', '7'].includes(card.val)) return 1;
            return 0;
        case 'wong-halves':
            if (['10', 'J', 'Q', 'K', 'A'].includes(card.val)) return -1;
            if (['9'].includes(card.val)) return -0.5;
            if (['2', '7'].includes(card.val)) return 0.5;
            if (['3', '4', '6'].includes(card.val)) return 1;
            if (['5'].includes(card.val)) return 1.5;
            return 0;
        case 'ko':
            if (['10', 'J', 'Q', 'K', 'A'].includes(card.val)) return -1;
            if (['2', '3', '4', '5', '6', '7'].includes(card.val)) return 1;
            return 0;
        case 'hi-lo':
        default:
            return BlackjackLogic.getCardCount(card);
    }
}

ui.fastModeCheckbox.addEventListener('change', (event) => {
    state.fastMode = event.target.checked;
});

function createShoe(msg) {
    // Allow shuffling from RESOLVING or BETTING phases, but prevent double trigger
    if (state.isShuffling) return;
    playSound('shuffle');

    state.shoe = [];
    state.runningCount = 0;
    state.cutCardReached = false;
    state.totalInitialCards = 0;
    state.isShuffling = true;
    state.phase = 'SHUFFLING';

    // Create cards
    state.shoe = CommonUtils.createShoe(state.deckCount, SUITS, VALUES);
    state.totalInitialCards = state.shoe.length;

    // Determine Cut Card Position
    const cutIndex = Math.floor(state.totalInitialCards * (1 - PENETRATION));
    state.shoe[cutIndex].isSplitCard = true;

    // UI Updates
    ui.overlayMain.className = 'overlay-text msg-shuffle';
    ui.overlayMain.textContent = "Shuffling";
    ui.overlaySub.textContent = msg ? msg :"Preparing Shoe...";
    ui.overlay.classList.add('show');

    // Clear seats visually if not already done (usually cleared before calling this)
    if (ui.seats.innerHTML === '') renderSeats();

    // hide the top card from the shoe if it was visible
    if (ui.topCardPreview) {
        ui.topCardPreview.style.opacity = 0;
    }

    // reset the count hint since we just shuffled
    updateCountHint();

    // Remove the old fill animation code and replace with:
    updateShoeVisual();

    // Show shuffling message for a moment
    setTimeout(() => {
        state.isShuffling = false;
        state.phase = 'BETTING';
        ui.overlay.classList.remove('show');
        updateGameFlow();
    }, getDelay(800));

    // Update shoe visual after shuffle
    setTimeout(() => {
        state.isShuffling = false;
        state.phase = 'BETTING';
        ui.overlay.classList.remove('show');
        updateShoeVisual(); // Show full stack
        updateGameFlow();
    }, getDelay(800));
}

function finishShuffle() {
    state.isShuffling = false;
    state.phase = 'BETTING';
    ui.overlay.classList.remove('show');
    updateShoeVisual();
    updateGameFlow(); // Check for auto-bets immediately
}

function updateCasinoProfit() {
    ui.casinoProfit.classList.remove('casino-profit-positive', 'casino-profit-negative', 'casino-profit-neutral');
    if (state.casinoProfit > 0) {
        ui.casinoProfit.textContent = `$${state.casinoProfit}`;
        ui.casinoProfit.classList.add('casino-profit-positive');
    } else if (state.casinoProfit < 0) {
        ui.casinoProfit.textContent = `-$${Math.abs(state.casinoProfit)}`;
        ui.casinoProfit.classList.add('casino-profit-negative');
    } else {
        ui.casinoProfit.textContent = `$${state.casinoProfit}`;
        ui.casinoProfit.classList.add('casino-profit-neutral');
    }
}

function updatePlayedRounds() {
    state.playedRounds += 1;
    ui.playedRounds.textContent = `${state.playedRounds}`;
}

function updateStats() {
    ui.cardsLeft.textContent = state.shoe.length;
    const decksRem = Math.max(1, state.shoe.length / 52);
    const trueCount = (state.runningCount / decksRem).toFixed(1);
    ui.runCount.textContent = `${state.runningCount} (TC:${trueCount})`;

    // Update shoe visualization
    updateShoeVisual();
}

function updateShoeVisual() {
    const cardStack = document.getElementById('card-stack');
    CommonUtils.updateShoeVisual(cardStack, state.shoe, state.isShuffling, state.deckCount, state.totalInitialCards);
}

function animateCardDraw(toDealer = true, seatIndex = null) {
    const shoeBody = document.querySelector('.shoe-body');
    let destX, destY;

    if (!toDealer && seatIndex !== null) {
        const seatElement = document.getElementById(`seat-${seatIndex}`);
        if (seatElement) {
            const seatRect = seatElement.getBoundingClientRect();
            destX = seatRect.left + seatRect.width / 2;
            destY = seatRect.top + seatRect.height / 2;
        } else {
            const tableRect = document.getElementById('table').getBoundingClientRect();
            destX = tableRect.left + tableRect.width / 2 + 36;
            destY = tableRect.top + 60;
        }
    } else {
        const tableRect = document.getElementById('table').getBoundingClientRect();
        destX = tableRect.left + tableRect.width / 2 + 36;
        destY = tableRect.top + 60;
    }

    CommonUtils.animateCardDraw(shoeBody, destX, destY, () => {
        updateShoeVisual();
    });

    // if we took the last card, hide it
    if (state.shoe.length === 0) {
        if (ui.topCardPreview ) {
            ui.topCardPreview.style.opacity = 0;
        }
    }
}

/* --- GAME FLOW CONTROL --- */

function updateGameFlow() {
    if (state.phase === 'BETTING') {
        processAutoBets();

        // --- NEW LOGIC: Check for immediate start condition ---
        const seatedPlayers = state.players.filter(p => p); // Get all players who are seated (not null)
        const allSeatedPlayersAreReady = seatedPlayers.length > 0 && seatedPlayers.every(p => p.isReady); // Check if there are seated players AND all of them are ready
        const isThereAtLeastOneHuman = seatedPlayers.some(p => !p.autoPlay); // Check if at least one of the seated players is a human

        if (allSeatedPlayersAreReady && isThereAtLeastOneHuman) {
            // All seated players have placed their bets and at least one is a human.
            // Expire the timer immediately.
            if (state.timer) {
                clearInterval(state.timer);
                state.timer = null;
            }
            ui.overlay.classList.remove('show'); // Remove the timer display
            dealHands(); // Start the round immediately
            return; // Exit the function early since the round has started
        } else if (seatedPlayers.length > 0 && seatedPlayers.every(p => (!p.isReady) && p.autoBet)) {
            // nobody is playing and nobody wants to bet, so shuffle the deck to attract customers
            createShoe();
            return;
        }
        // --- END OF NEW LOGIC ---

        // Original logic continues only if the immediate start condition wasn't met
        const waitingPlayers = state.players.filter(p => p && p.isReady);

        if (waitingPlayers.length > 0) {
            if (!state.timer) {
                startTimer(); // Start the timer if it wasn't already running and bets have been placed
            }
        } else {
            // No one has placed a bet yet
            if (state.timer) {
                clearInterval(state.timer);
                state.timer = null;
                ui.overlay.classList.remove('show');
            }
        }
    }

    renderSeats();
}

function processAutoBets() {
    if (state.phase !== 'BETTING') return;
    let madeChanges = false;

    state.players.forEach((p, idx) => {
        if (p && p.autoBet && !p.isReady) {
            const decksRem = Math.max(1, state.shoe.length / 52);
            const tc = state.runningCount / decksRem;
            // counters aren't perfect, give him a "mental count"
            const mc = tc + (2 + Math.random()) * (p.countingBias * (Math.random() - 0.4))
            let betAmt = p.lastBet || state.minBet;
            // determine the size of a "unit"
            let unit = Math.round(p.chips / 200) * (2 - (p.conservative ? 1 : -p.countingBias)); // ~ 0.25 -> 0.5%
            // make sure the unit isn't too big
            if (unit * 12 > state.maxBet) unit = state.maxBet / 8;
            // make sure it isn't too small
            if (unit < state.minBet) unit = state.minBet;

            // Bet 1 unit for every true count (use mc to fudge)
            betAmt = unit * Math.max(1, (Math.ceil(mc - 1)));

            // if we are 'conservative' keep the spread lower
            if (p.conservative) {
                if (betAmt > 5 * unit) {
                    betAmt = 5 * unit;
                } else if (mc > 0) {
                    betAmt = Math.max(unit, betAmt * 0.66);
                }
            }

            if (betAmt > p.chips) betAmt = p.chips;

            /*  simulate some player stress, like the feeling of
             *  being poor or fear of an upcoming losing streak
             *  maybe we think we are using too much of our bankroll
             */
            if (betAmt > p.chips * 0.06 && p.chips < state.minBet * 20) {
                // only bet if the count is positive
                if (tc > 0) betAmt = Math.floor(p.chips * 0.021 * tc);
                // otherwise sit out most of the time
                else if (Math.random() > 0.33) betAmt = 0;
                else betAmt = state.minBet; // if won't sit out, bet the minimum
            } else if (3 * p.chips < state.maxBet * Math.random() - state.minBet * 2) {
                // check if this AI player "feels" poor
                // sit out if this AI might believe the deck is cold
                if (mc < Math.random()) betAmt = 0
                // place a smaller bet
                else betAmt = Math.floor(Math.max(state.minBet, Math.floor(betAmt / 2)))
            }

            // "never" bet more than 1/4 of bankroll on one round (unless we have to)
            if (betAmt * 4 > p.chips) {
                betAmt = state.minBet; // bet as little as possible to keep our seat
            }

            // round it off to the nearest "minimum unit" ($5 or higher)
            let magnitude = Math.pow(10, Math.floor(Math.log10(betAmt)));
            let rawIncrement = (betAmt < 2 * magnitude) ? (magnitude / 10) : (magnitude / 2);

            // We round the increment to the nearest 5 before using it to round the bet
            let chipStep = Math.max(5, Math.round(rawIncrement / 5) * 5);

            // Round the actual bet/payout using our "chip-safe" increment
            betAmt = Math.round(betAmt / chipStep) * chipStep;

            if (betAmt >= state.minBet && betAmt <= p.chips) {
                placeBetInternal(idx, betAmt);
                madeChanges = true;
            }
        }
    });
}

/* --- BETTING LOGIC --- */

function placeBet(idx, amt) {
    if (state.phase !== 'BETTING') return;
    const p = state.players[idx];
    if (!p) return;

    if (isNaN(amt) || amt < state.minBet || amt > p.chips) {
        showOverlay("Invalid bet", 'Check the minimum and maximum bet amounts.', 0, "msg-lose");
        playSound('error'); return;
    }
    amt = Math.floor(amt);
    if (amt === 0) { return; }
    if (amt > state.maxBet) { amt = state.maxBet; }


    placeBetInternal(idx, amt);
    updateGameFlow();
}

function placeBetInternal(idx, amt) {
    const p = state.players[idx];
    if (!p) return;

    playSound('chip');
    p.currentBet += amt;
    p.lastBet = amt;
    p.chips -= amt;
    p.isReady = true;
    renderSeat(idx);
}

function clearBet(idx) {
    if (state.phase !== 'BETTING') return;
    const p = state.players[idx];
    if (!p || !p.isReady) return;

    playSound('chip');
    p.chips += p.currentBet;
    p.currentBet = 0;
    p.isReady = false;

    updateGameFlow();
}

function toggleAuto(idx, type) {
    const p = state.players[idx];
    if (!p) return;

    if (type === 'play') {
        p.autoPlay = !p.autoPlay;
        if (p.autoPlay && state.phase === 'PLAYING' && state.turnIndex === idx) {
            // If it's this player's turn and they just enabled auto-play, trigger it
            runAutoPlay();
        }
    } else if (type === 'bet') {
        p.autoBet = !p.autoBet;
        if (p.autoBet) {
            updateGameFlow();
        } else {
            if (p.isReady) {
                clearBet(idx);
            }
        }
    }
    renderSeat(idx);
    updateGameFlow();
}

function startTimer() {
    const hasHumanSittingUnbet = state.players.some(p => p && !p.autoPlay);
    state.timerVal = hasHumanSittingUnbet ? BET_TIME : MIN_TIMER;

    ui.overlayMain.className = 'overlay-text msg-timer';
    ui.overlayMain.textContent = state.timerVal;
    ui.overlaySub.textContent = "Starting...";
    ui.overlay.classList.add('show');

    state.timer = setInterval(() => {
        state.timerVal--;
        ui.overlayMain.textContent = state.timerVal;
        if (state.timerVal <= 0) {
            clearInterval(state.timer);
            state.timer = null;
            ui.overlay.classList.remove('show');
            dealHands();
        }
    }, state.fastMode ? 300 : 1000);
}

/* --- GAME LOGIC --- */

function drawCard(toDealer = true, seatIndex = null) {
    if (state.shoe.length === 0) {
        // Emergency shuffle mid-hand
        console.warn("Shoe empty! Emergency shuffle.");

        // Save current game state
        const currentPhase = state.phase;
        const currentTurnIndex = state.turnIndex;
        const currentSplitIndex = state.splitIndex;

        // Create new shoe without changing phase to SHUFFLING
        const tempShoe = [];
        state.runningCount = 0;

        // Create cards
        for (let i = 0; i < state.deckCount; i++) {
            for (let s of SUITS) {
                for (let v of VALUES) {
                    tempShoe.push(new Card(s, v));
                }
            }
        }

        // Fisher-Yates Shuffle
        for (let i = tempShoe.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tempShoe[i], tempShoe[j]] = [tempShoe[j], tempShoe[i]];
        }

        // Add to existing shoe (for continuous play)
        state.shoe = state.shoe.concat(tempShoe);
        state.totalInitialCards = state.shoe.length;

        // Reset cut card
        const cutIndex = Math.floor(state.totalInitialCards * (1 - PENETRATION));
        state.shoe[cutIndex].isSplitCard = true;
        state.cutCardReached = false;

        // Restore phase
        state.phase = currentPhase;
        state.turnIndex = currentTurnIndex;
        state.splitIndex = currentSplitIndex;

        // Show brief notification
        showOverlay("Reshuffling", "Mid-hand", "", "msg-shuffle");
        playSound('shuffle');
    }

    const card = state.shoe.pop();
    if (card.isSplitCard) {
        state.cutCardReached = true;
    }

    // Update count
    updateStats();

    // Animate or just update
    if (state.phase === 'PLAYING' || (state.phase === 'DEALING' && state.dealer.hand.length + state.dealer.hand.length < 4)) {
        animateCardDraw(toDealer, seatIndex);
    } else {
        // Batch update during dealing
        setTimeout(updateShoeVisual, 50);
    }

    return card;
}

function dealHands() {
    if (state.shoe.length === 0) {
        createShoe();
        return;
    }

    state.phase = 'DEALING';

    state.players.forEach(p => {
        if (p && p.isReady) {
            p.hands = [{ cards: [], bet: p.currentBet, result: null, status: 'playing' }];
            p.currentBet = 0;
            p.isReady = false;
        } else if (p) {
            p.hands = [];
        }
    });
    state.dealer.hand = [];

    render();

    let deals = [];
    state.players.forEach((p, i) => { if (p && p.hands.length) deals.push({ who: 'p', idx: i, hand: 0 }); });
    deals.push({ who: 'd' });
    state.players.forEach((p, i) => { if (p && p.hands.length) deals.push({ who: 'p', idx: i, hand: 0 }); });
    deals.push({ who: 'd', hidden: true });

    let i = 0;
    function nextDeal() {
        if (i >= deals.length) {
            checkBlackjack();
            return;
        }
        const action = deals[i];
        if (action.who === 'd') {
            const c = drawCard(true, null);
            c.hidden = !!action.hidden;
            state.dealer.hand.push(c);
            if (c.isSplitCard) state.cutCardReached = true;

            if (!c.hidden) {
                state.runningCount += getCardCountValue(c);
                updateStats();
                playSound('card');
            }
            renderDealer();
        } else {
            const p = state.players[action.idx];
            const c = drawCard(false, action.idx);
            if (c.isSplitCard) state.cutCardReached = true;

            state.runningCount += getCardCountValue(c);
            updateStats();
            playSound('card');
            p.hands[0].cards.push(c);
            renderSeat(action.idx);
        }
        i++;
        setTimeout(nextDeal, getDelay(200));
    }
    nextDeal();
}

function checkBlackjack() {
    const upCard = state.dealer.hand[0];
    const isTenVal = ['10', 'J', 'Q', 'K'].includes(upCard.val);
    const dScore = (isTenVal || upCard.val === 'A')
        ? calcScore(state.dealer.hand, true) // Peek for BJ
        : calcScore(state.dealer.hand);     // Regular score
    let activePlayers = state.players.filter(p => p && p.hands.length);
    let playing = false;

    // Set blackjack status for any player who has 21
    activePlayers.forEach(p => {
        p.hands.forEach(h => {
            if (BlackjackLogic.isBlackjack(h.cards)) {
                h.status = 'blackjack';
                playSound('blackjack');
            }
        });
    });

    render(); // Update UI to show player blackjacks

    if (dScore === 21) {
        // Dealer has blackjack, the round is over for everyone.
        state.dealer.hand[1].hidden = false;
        renderDealer();
        state.runningCount += getCardCountValue(state.dealer.hand[1]);
        updateStats();
        showOverlay("Dealer", "Blackjack!", "", "msg-bj");
        playSound('dealer-bj');

        // Determine outcomes: push for player blackjacks, lose for everyone else.
        activePlayers.forEach(p => {
            p.hands.forEach(h => {
                if (h.status === 'blackjack') {
                    h.result = 'push';
                } else {
                    h.result = 'lose';
                }
            });
        });

        // Move to the resolution phase to settle bets.
        state.phase = 'RESOLVING';
        setTimeout(resolveRound, getDelay(2000));

    } else {
        // Dealer does not have blackjack. Check if any players are still in the game.
        playing = activePlayers.some(p => p.hands.some(h => h.status !== 'blackjack'));

        if (playing) {
            // At least one player needs to act, so proceed to their turn.
            state.phase = 'PLAYING';
            nextTurn();
        } else {
            // All active players had blackjack, so they all win. The round is over.
            activePlayers.forEach(p => p.hands.forEach(h => {
                if (h.status === 'blackjack') {
                    h.result = 'win';
                }
            }));
            state.phase = 'RESOLVING';
            setTimeout(resolveRound, getDelay(1500));
        }
    }
}

function nextTurn() {
    let found = false;
    for (let i = 0; i < state.players.length; i++) {
        const p = state.players[i];
        if (p && p.hands.length) {
            const hIdx = p.hands.findIndex(h => h.status === 'playing');
            if (hIdx !== -1) {
                state.turnIndex = i;
                state.splitIndex = hIdx;
                found = true;

                const score = calcScore(p.hands[hIdx].cards);
                if (score === 21) {
                    setTimeout(playerStand, getDelay(500));
                } else {
                    render();
                    updateStrategyHint();

                    if (p.autoPlay) {
                        setTimeout(runAutoPlay, getDelay(800));
                    }
                }
                return;
            }
        }
    }
    if (!found) {
        dealerTurn();
    }
}

function runAutoPlay() {
    const p = state.players[state.turnIndex];
    if (!p || !p.autoPlay) return;

    const h = p.hands[state.splitIndex];
    if (h.status !== 'playing') return;

    const d = state.dealer.hand[0];
    const action = getStrategyHint(d, h.cards);

    showOverlay(`Player ${p.id + 1}`, `Auto: ${action.toUpperCase()}`, "", "msg-auto");

    setTimeout(() => {
        if (action === 'Hit') playerHit();
        else if (action === 'Stand') playerStand();
        else if (action === 'Double') {
            // Logic: Can only double on first 2 cards
            if (p.chips >= h.bet && h.cards.length === 2) playerDouble();
            else playerHit();
        }
        else if (action === 'Split') playerSplit();
    }, getDelay(1000));
}

function playerHit() {
    const p = state.players[state.turnIndex];
    const h = p.hands[state.splitIndex];

    // Prevent hitting if hand is not in playing status (already busted, stood, etc.)
    if (h.status !== 'playing') {
        playSound('error');
        return;
    }

    const c = drawCard(false, state.turnIndex);
    state.runningCount += getCardCountValue(c);
    updateStats();
    playSound('card');
    h.cards.push(c);

    ui.overlay.classList.remove('show');
    renderSeat(state.turnIndex);

    // Immediately check for bust and update status to prevent multiple hits after bust
    if (calcScore(h.cards) > 21) {
        h.status = 'bust';
        h.result = 'lose';
        if (!p.autoPlay) setTimeout(playSound, getDelay(200), 'bust');
        ui.strategyText.textContent = "";
        setTimeout(nextTurn, getDelay(800));
    } else if (calcScore(h.cards) === 21) {
        ui.strategyText.textContent = "";
        setTimeout(playerStand, getDelay(500));
    } else {
        updateStrategyHint();
        if (state.players[state.turnIndex].autoPlay) {
            setTimeout(runAutoPlay, getDelay(500));
        }
    }
}

function playerStand() {
    ui.overlay.classList.remove('show');
    ui.strategyText.textContent = "";
    const p = state.players[state.turnIndex];
    const h = p.hands[state.splitIndex];

    // Prevent standing if hand is not in playing status
    if (h.status !== 'playing') {
        playSound('error');
        return;
    }
    h.status = 'stand';

    const nextSplit = p.hands.findIndex((hand, idx) => idx > state.splitIndex && hand.status === 'playing');
    if (nextSplit !== -1) {
        state.splitIndex = nextSplit;
        render();
        updateStrategyHint();
        setTimeout(() => {
            if (calcScore(p.hands[nextSplit].cards) === 21) playerStand();
            else if (p.autoPlay) setTimeout(runAutoPlay, getDelay(500));
        }, getDelay(500));
    } else {
        nextTurn();
    }
}

function playerDouble() {
    const p = state.players[state.turnIndex];
    const h = p.hands[state.splitIndex];

    // Prevent doubling if hand is not in playing status
    if (h.status !== 'playing') {
        playSound('error');
        return;
    }

    // Protection: Cannot double if not initial 2 cards
    if (h.cards.length !== 2) { playSound('error'); return; }
    if (p.chips < h.bet) { playSound('error'); return; }

    playSound('chip');
    p.chips -= h.bet;
    h.bet *= 2;

    const c = drawCard(false, state.turnIndex);
    state.runningCount += getCardCountValue(c);
    updateStats();
    playSound('card');
    h.cards.push(c);
    h.status = 'stand';

    ui.overlay.classList.remove('show');
    ui.strategyText.textContent = "";
    renderSeat(state.turnIndex);
    setTimeout(nextTurn, getDelay(800));
}

function playerSplit() {
    const p = state.players[state.turnIndex];
    const h = p.hands[state.splitIndex];

    // Prevent splitting if hand is not in playing status
    if (h.status !== 'playing') {
        playSound('error');
        return;
    }

    if (p.chips < h.bet) { playSound('error'); return; }
    const c1 = h.cards[0];
    const c2 = h.cards[1];
    if (BlackjackLogic.getCardValue(c1) !== BlackjackLogic.getCardValue(c2)) { playSound('error'); return; }

    playSound('chip');
    p.chips -= h.bet;

    const newHand = {
        cards: [c2],
        bet: h.bet,
        status: 'playing',
        result: null
    };

    h.cards = [c1];
    p.hands.splice(state.splitIndex + 1, 0, newHand);

    const cFirst = drawCard(false, state.turnIndex);
    state.runningCount += getCardCountValue(cFirst);
    updateStats();
    playSound('card');
    h.cards.push(cFirst);

    // The two `drawCard` animations for the split hand often merge visually.
    // This explicit `animateCardDraw` with a timeout creates a distinct
    // second animation, simulating two separate card throws.
    setTimeout( function() {
        animateCardDraw(false, state.turnIndex);
    }, 100);


    const cSecond = drawCard(false, state.turnIndex);
    state.runningCount += getCardCountValue(cSecond);
    updateStats();
    playSound('card');
    newHand.cards.push(cSecond);

    renderSeat(state.turnIndex);
    updateStrategyHint();
    if (p.autoPlay) setTimeout(runAutoPlay, getDelay(500));
}

function dealerTurn() {
    state.phase = 'RESOLVING';
    state.turnIndex = -1;
    state.splitIndex = -1;

    const hole = state.dealer.hand[1];
    hole.hidden = false;
    state.runningCount += getCardCountValue(hole);
    render();
    playSound('card');

    // if nobody is playing, don't draw the rest of the dealer hand
    let activePlayers = state.players.filter(p =>
        p && p.hands.some(h => h.status === 'stand' || h.status === 'playing')
    );

    if (activePlayers.length === 0) {
        resolveRound();
        return;
    }

    let score = calcScore(state.dealer.hand);

    function loop() {
        if (score < 17) {
            const c = drawCard(true, null);
            state.runningCount += getCardCountValue(c);
            updateStats();
            playSound('card');
            state.dealer.hand.push(c);
            score = calcScore(state.dealer.hand);
            renderDealer();
            setTimeout(loop, 800);
        } else {
            resolveRound();
        }
    }
    setTimeout(loop, 800);
}

function resolveRound() {
    const dScore = calcScore(state.dealer.hand);

    if (dScore > 21) {
        showOverlay("Dealer Busts!", "All Active Hands Win", "", "msg-win");
        playSound('dealer-bust')
    }
    ui.overlay.classList.remove('show');

    // Resolve all hands simultaneously
    state.players.forEach((p, pIndex) => {
        if (!p || !p.hands.length) return;

        p.hands.forEach(h => {
            // Determine result if not already determined (e.g. by blackjack or bust)
            if (h.status === 'bust') {
                h.result = 'lose';
            } else if (!h.result) {
                const result = BlackjackLogic.determineResult(h.cards, state.dealer.hand);
                h.result = (result === 'blackjack') ? 'win' : result;
            }
            h.status = h.result;

            // Calculate Payouts
            h.profit = 0;
            if (h.result === 'win') {
                if (BlackjackLogic.isBlackjack(h.cards)) {
                    h.profit = h.bet * 1.5;
                } else {
                    h.profit = h.bet;
                }
                // Return original bet + profit
                p.chips += h.bet + h.profit;
                state.casinoProfit -= h.profit;
                p.profit += h.profit;
            } else if (h.result === 'push') {
                // get the bet back
                p.chips += h.bet;
                // No profit change
            } else {
                // Loss
                state.casinoProfit += h.bet;
                h.profit = -h.bet;
                // log the loss
                p.profit -= h.bet;
            }
        });
    });

    // Update UI
    render();

    // Move directly to finish (wait for user to see results)
    setTimeout(finishRound, 1000 + getDelay(3000));
}

function finishRound() {
    if (state.cutCardReached || state.tableSettingsChanged) {
        // Requirement 4: Clear table immediately when shuffling starts
        state.phase = 'SHUFFLING';

        // Clear hands visually
        state.players.forEach(p => { if (p) p.hands = []; });
        state.dealer.hand = [];

        // Force a render to show the empty table immediately
        render();

        let msg = "Cut Card Reached";
        if (state.tableSettingsChanged) {
            msg = "Changing table";
            let dc = state.tableSettingsChanged['deckCount']
            if (dc !== undefined) {
                state.deckCount = parseInt(dc);
            }
            let min = state.tableSettingsChanged['minBet']
            if (min !== undefined) {
                state.minBet = parseInt(min);
                state.maxBet = calcMaxBet(state.minBet)
            }
            state.tableSettingsChanged = false;
        }

        showOverlay(msg, "Shuffling...", "", "msg-shuffle");
        setTimeout(createShoe, 1500);
    } else {
        endRound();
    }
    updateCasinoProfit();
    updatePlayedRounds();
}

function endRound() {
    // 1. Finalize any pending removals
    state.players = state.players.map(p => (p && p.pendingStandUp) ? null : p);

    // 2. Trim players array if seatCount was decreased during the round
    if (state.players.length > state.seatCount) {
        state.players = state.players.slice(0, state.seatCount);
    }

    state.phase = 'BETTING';
    updateCountHint();
    updateGameFlow();
    render();
}

/* --- HELPERS --- */

function getDelay(base) {
    return state.fastMode ? 180 : base;
}

function calcScore(cards, peek = false) {
    return BlackjackLogic.calcScore(cards, peek);
}

function getScoreDisplay(cards) {
    const score = calcScore(cards);
    if (isSoftHand(cards) && score < 21) {
        return `${score - 10} / ${score}`;
    }
    return CommonUtils.getScoreDisplay(score);
}

function isSoftHand(cards) {
    return BlackjackLogic.isSoftHand(cards);
}

function getStrategyHint(dCard, pCards) {
    const dVal = BlackjackLogic.getCardValue(dCard);
    const pScore = calcScore(pCards);
    const soft = isSoftHand(pCards);

    if (pCards.length === 2 && BlackjackLogic.getCardValue(pCards[0]) === BlackjackLogic.getCardValue(pCards[1])) {
        const c = pCards[0].val;
        if (c === 'A' || c === '8') return "Split";
        if (c === '10') return soft ? "Stand" : (pScore >= 12 ? "Stand" : "Hit");
        if (c === '9') return (dVal !== 7 && dVal <= 9) ? "Split" : "Stand";
        if (c === '7') return (dVal <= 7) ? "Split" : "Hit";
        if (c === '6') return (dVal <= 6) ? "Split" : "Hit";
        if (c === '4') return (dVal === 5 || dVal === 6) ? "Split" : "Hit";
        if (c === '2' || c === '3') return (dVal <= 7) ? "Split" : "Hit";
    }

    if (soft) {
        if (pScore >= 20) return "Stand";
        if (pScore === 19) return (dVal === 6) ? "Double" : "Stand";
        if (pScore === 18) return (dVal <= 6) ? "Double" : (dVal === 7 || dVal === 8 ? "Stand" : "Hit");
        if (pScore === 17) return (dVal >= 3 && dVal <= 6) ? "Double" : "Hit";
        if (pScore === 16 || pScore === 15) return (dVal >= 4 && dVal <= 6) ? "Double" : "Hit";
        if (pScore === 14 || pScore === 13) return (dVal === 5 || dVal === 6) ? "Double" : "Hit";
    }

    if (pScore >= 17) return "Stand";
    if (pScore >= 13 && pScore <= 16) return (dVal <= 6) ? "Stand" : "Hit";
    if (pScore === 12) return (dVal >= 4 && dVal <= 6) ? "Stand" : "Hit";
    if (pScore === 11) return "Double";
    if (pScore === 10) return (dVal <= 9) ? "Double" : "Hit";
    if (pScore === 9) return (dVal >= 3 && dVal <= 6) ? "Double" : "Hit";
    return "Hit";
}

function updateStrategyHint() {
    if (state.phase !== 'PLAYING') {
        ui.strategyText.textContent = "Place bets to start";
        ui.countHint.className = "count-hint ch-neutral";
        ui.countHint.textContent = "";
        return;
    }
    const p = state.players[state.turnIndex];
    const h = p.hands[state.splitIndex];
    const d = state.dealer.hand[0];

    const hint = getStrategyHint(d, h.cards);
    ui.strategyText.textContent = hint;
}

function updateCountHint() {
    const decksRem = Math.max(1, state.shoe.length / 52);
    const tc = (state.runningCount / decksRem);

    let countHintText = "";
    let countClass = "ch-neutral";

    if (tc >= 2) {
        countHintText = `Count High (+${tc.toFixed(1)}) - Bet Big`;
        countClass = "ch-high";
    } else if (tc <= -2) {
        countHintText = `Count Low (${tc.toFixed(1)}) - Bet Small`;
        countClass = "ch-low";
    } else {
        countHintText = `Count Average (${tc.toFixed(1)})`;
    }

    ui.countHint.textContent = countHintText;
    ui.countHint.className = `count-hint ${countClass}`;
}

function showOverlay(main, sub, amount, colorClass) {
    ui.overlayMain.className = `overlay-text ${colorClass}`;
    ui.overlayMain.textContent = main;

    let subHtml = sub;
    if (amount) {
        const color = amount.startsWith('+') ? 'profit-green' : 'profit-red';
        subHtml += `<span class="profit-indicator ${color}">${amount}</span>`;
    }
    ui.overlaySub.innerHTML = subHtml;

    ui.overlay.classList.add('show');

    if (colorClass === 'msg-win' || colorClass === 'msg-lose' || colorClass === 'msg-push' || colorClass === 'msg-auto' || colorClass === 'msg-bj') {
        setTimeout(() => { ui.overlay.classList.remove('show'); }, 1200);
    }
}

function calcMaxBet(minBet) {
    const raw = minBet * (minBet >= 25 ? 200 : 100);

    let div;
    if (raw <= 1000) {
        div = 100;
    } else if (raw <= 5000) {
        div = 500;
    } else {
        div = 1000;
    }

    return Math.round(raw / div) * div;
}


/* --- RENDERING --- */
function createCardEl(card) {
    return CommonUtils.createCardEl(card);
}

function renderDealer() {
    ui.dealerCards.innerHTML = '';
    state.dealer.hand.forEach(c => ui.dealerCards.appendChild(createCardEl(c)));

    const hasHidden = state.dealer.hand.some(c => c.hidden);
    if (hasHidden && state.phase !== 'RESOLVING') {
        ui.dealerScore.textContent = BlackjackLogic.getCardValue(state.dealer.hand[0]);
        /* let the user click on the card to peek it */
        let holeCard = ui.dealerCards.children[1];
        if (holeCard) {
            holeCard.onmouseup = () => {
                holeCard.classList.add('hidden');
            }
            holeCard.onmousedown = () => {
                holeCard.classList.remove('hidden');
            }
        }
    } else {
        ui.dealerScore.textContent = calcScore(state.dealer.hand);
    }
}

function sit(idx) {
    if (state.players[idx]) return;

    // determine what kind of clientele just sat down
    let luck = Math.random()
    let chips = 1000;

    if (luck < 0.02) chips = 10000;
    else if (luck < 0.12) chips = 5000;
    else if (luck > 0.9) chips = 3000;
    else if (luck > 0.49 && luck < 0.51) chips = 20000;

    // add petty cash
    for (let i=0; i<3; ++i) {
        if (Math.random() < 0.13) chips += 250;
        if (Math.random() < 0.12) chips += 500;
        if (Math.random() < 0.14) chips += 300;
    }
    let pocket = Math.random()
    for (let i=0; i<5; ++i) {
        if (pocket + Math.random() < 0.1 * (i+1)) chips += 50;
    }

    // VIP
    if (luck > 0.998) chips = 100000;

    state.players[idx] = {
        id: idx,
        chips: chips,
        currentBet: 0,
        profit: 0,
        lastBet: state.minBet,
        hands: [],
        isReady: false,
        autoPlay: false,
        autoBet: false,
        pendingStandUp: false,
        countingBias: Math.random(),
        conservative: (Math.random() > 0.5 ? true : false),
    };

    if (state.phase === 'BETTING') {
        updateGameFlow();
    } else {
        renderSeat(idx);
    }
}

function standUp(idx) {
    const p = state.players[idx];
    if (!p) return;

    if (state.phase !== 'BETTING' && p.hands.length > 0) {
        // Round in progress and player has a hand, mark for removal
        p.pendingStandUp = true;
        p.autoPlay = true; // Bot takes over to finish the hand
        renderSeat(idx);

        // If it's their turn, the bot should start immediately
        if (state.phase === 'PLAYING' && state.turnIndex === idx) {
            runAutoPlay();
        }
    } else {
        // Safe to remove immediately
        state.players[idx] = null;
        if (state.phase === 'BETTING') {
            updateGameFlow();
        } else {
            renderSeats();
        }
    }
}

function renderSeat(idx) {
    const el = document.getElementById(`seat-${idx}`);
    if (!el) return;
    el.outerHTML = getSeatHTML(idx);
}

function renderSeats() {
    ui.seats.innerHTML = '';
    for (let i = 0; i < state.seatCount; i++) {
        ui.seats.innerHTML += getSeatHTML(i);
    }
}

function render() {
    renderDealer();
    renderSeats();
    updateStats();
}

function getSeatHTML(idx) {
    const p = state.players[idx];
    const isGameActive = (state.phase === 'DEALING' || state.phase === 'PLAYING' || state.phase === 'RESOLVING');

    if (!p) {
        return `
                    <div class="seat" id="seat-${idx}" style="justify-content: flex-end;">
                        <div style="color:#aaa; margin-bottom:auto;">Empty</div>
                        <button class="btn-sit" onclick="sit(${idx})">Sit Down</button>
                    </div>
                `;
    }

    let classList = `seat ${state.turnIndex === idx && state.phase === 'PLAYING' ? 'turn' : ''}`;
    if (p.autoPlay) classList += ` auto`;

    const isMyTurn = (state.turnIndex === idx && state.phase === 'PLAYING');

    let statusClass = '';
    let statusText = '';

    if (p.pendingStandUp) {
        statusClass = 'pending-standup';
        statusText = 'STANDING UP...';
    } else if (state.phase === 'BETTING' || state.phase === 'RESOLVING') {
        const wins = p.hands.filter(h => h.result === 'win').length;
        const loses = p.hands.filter(h => h.result === 'lose').length;
        const pushes = p.hands.filter(h => h.result === 'push').length;

        if (wins > 0 && loses === 0 && pushes === 0) { statusClass = 'winner'; statusText = 'WINNER'; }
        else if (loses > 0 && wins === 0 && pushes === 0) { statusClass = 'loser'; statusText = 'LOSER'; }
        else if (pushes > 0 && wins === 0 && loses === 0) { statusClass = 'push'; statusText = 'PUSH'; }
    }

    if (statusClass) classList += ` ${statusClass}`;

    let controlsHTML = '';

    // General Controls (Stand Up and Toggles) - Always available if seated
    const togglesHTML = `
                <button class="btn-standup" onclick="standUp(${idx})">${p.pendingStandUp ? 'Cancel' : 'Stand Up'}</button>
                <div class="toggle-container" onclick="toggleAuto(${idx}, 'play')">
                    <span class="toggle-label">Auto Play</span>
                    <label class="toggle-switch">
                        <input type="checkbox" ${p.autoPlay ? 'checked' : ''} name="autoplay-${idx}" disabled>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="toggle-container" onclick="toggleAuto(${idx}, 'bet')">
                    <span class="toggle-label">Auto Bet</span>
                    <label class="toggle-switch auto-bet">
                        <input type="checkbox" ${p.autoBet ? 'checked' : ''} name="autobet-${idx}" disabled>
                        <span class="slider"></span>
                    </label>
                </div>
    `;

    // Betting Phase Controls
    if (state.phase === 'BETTING') {
        controlsHTML = `
                    ${togglesHTML}
                    <div class="bet-controls">
                        <input type="number" class="bet-input" id="bet-in-${idx}" value="${p.lastBet || state.minBet}" min="${state.minBet}" step="5">
                        <button class="btn-bet" onclick="placeBet(${idx}, parseInt(document.getElementById('bet-in-${idx}').value))">Bet</button>
                        <button class="btn-clear" onclick="clearBet(${idx})">Clear</button>
                    </div>
                `;
    }
    // Playing Phase Controls
    else if (state.phase === 'PLAYING') {
        if (isMyTurn && !p.autoPlay) {
            const h = p.hands[state.splitIndex];
            const canSplit = (h.cards.length === 2 && BlackjackLogic.getCardValue(h.cards[0]) === BlackjackLogic.getCardValue(h.cards[1]) && p.chips >= h.bet);

            controlsHTML = `
                        ${togglesHTML}
                        <div class="controls">
                            <button class="action-btn btn-hit" onclick="playerHit()">H</button>
                            <button class="action-btn btn-stand" onclick="playerStand()">S</button>
                            <button class="action-btn btn-double" onclick="playerDouble()" ${p.chips < h.bet || h.cards.length !== 2 ? 'disabled' : ''}>D</button>
                            <button class="action-btn btn-split" onclick="playerSplit()" ${!canSplit ? 'disabled' : ''}>SP</button>
                        </div>
                    `;
        } else {
            controlsHTML = togglesHTML;
        }
    } else {
        controlsHTML = togglesHTML;
    }

    // Requirement: Persistent Bet Bubble
    // Logic: If Betting phase, use currentBet. If Playing/Resolving, sum hand bets.
    let betAmount = 0;
    if (state.phase === 'BETTING') {
        betAmount = p.currentBet;
    } else {
        // Sum of all active hand bets
        betAmount = p.hands.reduce((sum, h) => sum + (h ? h.bet : 0), 0);
    }

    return `
                <div class="seat ${classList}" id="seat-${idx}">
                    <div class="seat-info">
                        <span>Player ${idx + 1} ${p.autoPlay && !p.pendingStandUp ? '(Bot)' : ''}</span>
                        <div class='money-anchor'>
                            <span class="chip-stack">$${p.chips}</span>
                            <span class="${p.profit >= 0 ? 'player-profit' : 'player-loss'}">${Math.abs(p.profit)}</span>
                        </div>
                    </div>

                    <div class="player-hand-area">
                        ${statusText ? `<div style="position:absolute; color:var(--gold); font-weight:bold; font-size:1.2rem; text-shadow:0 2px 4px black; z-index:10; top:-10px;">${statusText}</div>` : ''}

                        ${p.hands.length === 1 && state.phase !== 'BETTING'
            ? `<div class="score-pill" style="margin-bottom:5px;">${getScoreDisplay(p.hands[0].cards)}</div>`
            : `<div class="score-pill" style="margin-bottom:5px; visibility: hidden;">0</div>`
        }

                        ${(() => {
            // Hand rendering logic inline
            if (!p.hands.length) return '';

            let html = '';
            if (p.hands.length > 1) {
                html += `<div class="split-container">`;
                p.hands.forEach((h, hIdx) => {
                    const isActive = (isMyTurn && state.splitIndex === hIdx) ? 'active-split' : '';

                    // Result Overlay
                    let resultHTML = '';
                    if (state.phase === 'RESOLVING' && h.result) {
                        let resClass = 'result-push';
                        let contentHTML = '<span class="res-text">PUSH</span>';

                        if (h.result === 'win') {
                            resClass = 'result-win';
                            contentHTML = `<span class="res-profit">+$${h.profit}</span>`;
                        } else if (h.result === 'lose') {
                            resClass = 'result-lose';
                            contentHTML = `<span class="res-profit">-$${h.bet}</span>`;
                        }

                        resultHTML = `
                                            <div class="hand-result ${resClass}">
                                                ${contentHTML}
                                            </div>
                                        `;
                    }

                    html += `
                                        <div class="mini-hand ${isActive}">
                                            ${resultHTML}
                                            <div class="score-pill" style="font-size:0.7rem; padding:2px 6px;">${getScoreDisplay(h.cards)}</div>
                                            <div class="cards">
                                                ${h.cards.map(c => createCardEl(c).outerHTML).join('')}
                                            </div>
                                        </div>
                                    `;
                });
                html += `</div>`;
            } else {
                const h = p.hands[0];

                // Result Overlay
                let resultHTML = '';
                if (state.phase === 'RESOLVING' && h.result) {
                    let resClass = 'result-push';
                    let contentHTML = '<span class="res-text">PUSH</span>';

                    if (h.result === 'win') {
                        resClass = 'result-win';
                        contentHTML = `<span class="res-profit">+$${h.profit}</span>`;
                    } else if (h.result === 'lose') {
                        resClass = 'result-lose';
                        contentHTML = `<span class="res-profit">-$${h.bet}</span>`;
                    }

                    resultHTML = `
                                        <div class="hand-result ${resClass}">
                                            ${contentHTML}
                                        </div>
                                    `;
                }

                html = `
                                    <div class="cards" style="transform: scale(0.8); position: relative;">
                                        ${h.cards.map(c => createCardEl(c).outerHTML).join('')}
                                        ${resultHTML}
                                    </div>
                                `;
            }
            return html;
        })()}

                        ${betAmount > 0 ? `<div class="bet-bubble">Bet: $${betAmount}</div>` : ''}
                    </div>

                    ${controlsHTML}
                </div>
            `;
}

// Event Listeners for Settings
ui.seatSelect.addEventListener('change', (e) => {
    const newCount = parseInt(e.target.value);
    const oldCount = state.seatCount;
    state.seatCount = newCount;

    if (newCount > oldCount) {
        // Just expand the array
        for (let i = oldCount; i < newCount; i++) {
            state.players.push(null);
        }
    } else if (newCount < oldCount) {
        // If some players are beyond the new count, they will be removed at the end of the round.
        // For now, we just update the visual seat Count so renderSeats() only shows the new count.
        // But we keep the players in state.players until endRound() trims it.
    }

    renderSeats();
});

ui.deckSelect.addEventListener('change', (e) => {
    if (state.phase === 'BETTING') {
        state.deckCount = parseInt(e.target.value);
        createShoe();
    } else {
        // wait until the round is finished before "changing tables"
        state.tableSettingsChanged = state.tableSettingsChanged || {};
        state.tableSettingsChanged["deckCount"] = parseInt(e.target.value);
    }
})

ui.minBet.addEventListener('change', (e) => {
    if (state.phase === 'BETTING') {
        state.minBet = parseInt(e.target.value);
        state.maxBet = calcMaxBet(state.minBet);
        createShoe("Changing table...");
    } else {
        state.tableSettingsChanged = state.tableSettingsChanged || {};
        state.tableSettingsChanged["minBet"] =  parseInt(e.target.value); // forces a re-shuffle due to having "changed tables"
    }
});


// Start
const handleFirstInteraction = (event) => {
    init();
    // Clean up all listeners so it doesn't fire again
    window.removeEventListener('click', handleFirstInteraction);
    window.removeEventListener('keydown', handleFirstInteraction);
    window.removeEventListener('touchstart', handleFirstInteraction);

    if (event && event.type === 'click') {
        const toggle = event.target && event.target.closest ? event.target.closest('.btn-toggle') : null;
        if (toggle) {
            if (toggle.id === 'toggle-settings') {
                toggleControlsArea('settings');
            } else if (toggle.id === 'toggle-themes') {
                toggleControlsArea('themes');
            } else if (toggle.id === 'toggle-addons') {
                toggleControlsArea('addons');
            } else if (toggle.id === 'toggle-stats') {
                toggleControlsArea('stats');
            }
        }
    }
};

window.addEventListener('click', handleFirstInteraction);
window.addEventListener('keydown', handleFirstInteraction);
window.addEventListener('touchstart', handleFirstInteraction);
