/**
 * Poker (Texas Hold'em) game logic and UI management.
 */

const state = {
    seatCount: 5,
    deckCount: 1, // Poker usually uses 1 deck
    shoe: [],
    communityCards: [],
    players: [],
    pot: 0,
    currentBet: 0, // Highest bet in current round
    dealerIdx: 0,
    turnIndex: -1,
    phase: 'WAITING', // WAITING, PRE-FLOP, FLOP, TURN, RIVER, SHOWDOWN
    isShuffling: false,
    smallBlind: 10,
    bigBlind: 20
};

const ui = {
    seats: document.getElementById('seats'),
    communityCards: document.getElementById('community-cards'),
    potDisplay: document.getElementById('pot-display'),
    potTotal: document.getElementById('pot-total'),
    overlay: document.getElementById('center-overlay'),
    overlayMain: document.getElementById('overlay-main'),
    overlaySub: document.getElementById('overlay-sub'),
    gamePhaseText: document.getElementById('game-phase-text'),
    deckStyleSelect: document.getElementById('deck-style-select'),
    tableStyleSelect: document.getElementById('table-style-select'),
    seatSelect: document.getElementById('seat-select'),
    toggleSettings: document.getElementById('toggle-settings'),
    toggleThemes: document.getElementById('toggle-themes'),
    toggleAddons: document.getElementById('toggle-addons'),
    toggleStats: document.getElementById('toggle-stats'),
    settingsArea: document.getElementById('settings-area'),
    themeArea: document.getElementById('theme-area'),
    addonsArea: document.getElementById('addons-area'),
    statsArea: document.getElementById('stats-area'),
    cardStack: document.getElementById('card-stack')
};

function init() {
    state.players = Array(state.seatCount).fill(null);
    CommonUtils.preloadAudio({
        'card': ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav', 'card5.wav'],
        'shuffle': ['shuffle.wav'],
        'chip': ['chip.wav', 'chips.wav'],
        'win': ['win.wav', 'winner.wav'],
        'error': ['error.wav']
    });

    if (ui.deckStyleSelect) {
        updateDeckStyle();
        ui.deckStyleSelect.addEventListener('change', updateDeckStyle);
    }

    if (ui.tableStyleSelect) {
        updateTableStyle();
        ui.tableStyleSelect.addEventListener('change', updateTableStyle);
    }

    if (ui.seatSelect) {
        ui.seatSelect.addEventListener('change', e => {
            state.seatCount = parseInt(e.target.value);
            state.players = state.players.slice(0, state.seatCount);
            while (state.players.length < state.seatCount) state.players.push(null);
            renderSeats();
        });
    }

    if (ui.toggleSettings) {
        ui.toggleSettings.addEventListener('click', () => toggleControlsArea('settings'));
    }
    if (ui.toggleThemes) {
        ui.toggleThemes.addEventListener('click', () => toggleControlsArea('themes'));
    }
    if (ui.toggleAddons) {
        ui.toggleAddons.addEventListener('click', () => toggleControlsArea('addons'));
        ui.toggleAddons.classList.toggle('active', !ui.addonsArea.classList.contains('collapsed'));
    }
    if (ui.toggleStats) {
        ui.toggleStats.addEventListener('click', () => toggleControlsArea('stats'));
    }

    renderSeats();
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
    Array.from(document.body.classList).forEach(cls => {
        if (cls.startsWith('deck-')) document.body.classList.remove(cls);
    });
    document.body.classList.add(`deck-${style}`);
    updateShoeVisual();
    render();
}

function updateTableStyle() {
    const style = ui.tableStyleSelect.value;
    Array.from(document.body.classList).forEach(cls => {
        if (cls.startsWith('table-')) document.body.classList.remove(cls);
    });
    document.body.classList.add(`table-${style}`);
}

function updateShoeVisual() {
    CommonUtils.updateShoeVisual(ui.cardStack, state.shoe, state.isShuffling, state.deckCount, state.shoe.length);
}

function createShoe() {
    state.phase = 'STARTING'; // Lock state to prevent multiple starts
    state.isShuffling = true;
    CommonUtils.playSound('shuffle');
    state.shoe = CommonUtils.createShoe(state.deckCount, SUITS, VALUES);

    showOverlay("Shuffling", "Dealing new hand...", "", "msg-shuffle");

    setTimeout(() => {
        state.isShuffling = false;
        ui.overlay.classList.remove('show');
        updateShoeVisual();
        startHand();
    }, 1000);
}

function startHand() {
    state.communityCards = [];
    renderCommunityCards();
    state.pot = 0;
    state.currentBet = 0;
    state.phase = 'PRE-FLOP';

    // Clear previous hand state
    state.players.forEach(p => {
        if (p) {
            p.hand = [];
            p.currentBet = 0;
            p.folded = false;
            p.allIn = false;
            p.isActing = false;
            p.lastAction = '';
            p.sittingOut = false; // Reset for the new hand
        }
    });

    // Move dealer button
    const occupiedSeats = state.players.map((p, i) => p ? i : -1).filter(i => i !== -1);
    if (occupiedSeats.length > 0) {
        const currentDealerIdxInOccupied = occupiedSeats.indexOf(state.dealerIdx);
        state.dealerIdx = occupiedSeats[(currentDealerIdxInOccupied + 1) % occupiedSeats.length];
    }

    // Deal 2 cards to each player
    dealHoleCards();
}

async function dealHoleCards() {
    const activePlayers = state.players.filter(p => p && !p.sittingOut);
    for (let j = 0; j < 2; j++) {
        for (let i = 0; i < activePlayers.length; i++) {
            const p = activePlayers[i];
            const card = drawCard();
            p.hand.push(card);
            animateCardDraw(p.id);
            CommonUtils.playSound('card');
            renderSeat(p.id);
            await new Promise(r => setTimeout(r, 200));
        }
    }

    postBlinds();
}

function postBlinds() {
    const activePlayers = state.players.filter(p => p);
    if (activePlayers.length < 2) return;

    const occupiedSeats = state.players.map((p, i) => p ? i : -1).filter(i => i !== -1);
    const dealerPos = occupiedSeats.indexOf(state.dealerIdx);

    const sbIdx = occupiedSeats[(dealerPos + 1) % occupiedSeats.length];
    const bbIdx = occupiedSeats[(dealerPos + 2) % occupiedSeats.length];

    const sbPlayer = state.players[sbIdx];
    const bbPlayer = state.players[bbIdx];

    betInternal(sbPlayer, state.smallBlind);
    sbPlayer.lastAction = 'SB';

    betInternal(bbPlayer, state.bigBlind);
    bbPlayer.lastAction = 'BB';

    state.currentBet = state.bigBlind;
    state.turnIndex = occupiedSeats[(dealerPos + 3) % occupiedSeats.length];

    state.phase = 'PRE-FLOP';
    renderSeats(); // Ensure SB/BB markers show up
    startBettingRound();
}

function betInternal(player, amount) {
    if (amount > player.chips) {
        amount = player.chips;
        player.allIn = true;
    }
    player.chips -= amount;
    player.currentBet += amount;
    state.pot += amount;
    CommonUtils.playSound('chip');
    updateStats();
}

function startBettingRound() {
    ui.gamePhaseText.textContent = state.phase;
    nextAction();
}

function nextAction() {
    const activePlayers = state.players.filter(p => p && !p.folded);

    // Check if round is over (everyone called highest bet or all-in)
    const playersStillActing = activePlayers.filter(p => !p.allIn && (p.currentBet < state.currentBet || p.lastAction === '' || (p.lastAction === 'CHECK' && state.currentBet > 0)));

    if (playersStillActing.length === 0 || (activePlayers.length === 1)) {
        // If everyone checked or everyone called, advance
        advancePhase();
        return;
    }

    // Find next player to act starting from turnIndex
    let nextIdx = state.turnIndex;
    let found = false;
    for (let i = 0; i < state.seatCount; i++) {
        const checkIdx = (nextIdx + i) % state.seatCount;
        const p = state.players[checkIdx];
        if (p && !p.folded && !p.allIn) {
            // This player needs to act if they haven't matched the bet or haven't acted at all this round
            if (p.currentBet < state.currentBet || p.lastAction === '' || (p.lastAction === 'BB' && state.currentBet === state.bigBlind && state.phase === 'PRE-FLOP')) {
                state.turnIndex = checkIdx;
                found = true;
                break;
            }
        }
    }

    if (!found) {
        advancePhase();
        return;
    }

    const currentPlayer = state.players[state.turnIndex];

    currentPlayer.isActing = true;
    renderSeat(currentPlayer.id);

    if (currentPlayer.autoPlay) {
        setTimeout(() => botAction(currentPlayer), 800);
    }
}

function botAction(player) {
    const callAmount = state.currentBet - player.currentBet;
    if (callAmount > 0) {
        // Simple bot: call if it has chips, else fold (randomly for variety)
        if (player.chips > callAmount && Math.random() > 0.2) {
            playerAction('call');
        } else {
            playerAction('fold');
        }
    } else {
        playerAction('check');
    }
}

function playerAction(type) {
    const p = state.players[state.turnIndex];
    if (!p || !p.isActing) return;

    p.isActing = false;

    switch (type) {
        case 'fold':
            p.folded = true;
            p.lastAction = 'FOLD';
            break;
        case 'check':
            p.lastAction = 'CHECK';
            break;
        case 'call':
            const callAmount = state.currentBet - p.currentBet;
            betInternal(p, callAmount);
            p.lastAction = 'CALL';
            break;
        case 'raise':
            const raiseAmount = state.bigBlind; // Fixed raise for prototype
            const totalToBet = (state.currentBet - p.currentBet) + raiseAmount;
            betInternal(p, totalToBet);
            state.currentBet = p.currentBet;
            p.lastAction = 'RAISE';
            break;
    }

    renderSeat(p.id);
    state.turnIndex = (state.turnIndex + 1) % state.seatCount;
    setTimeout(nextAction, 100); // Small delay for better UX
}

async function advancePhase() {
    // Reset individual bets for next round
    state.players.forEach(p => {
        if (p) {
            p.currentBet = 0;
            p.lastAction = '';
        }
    });
    state.currentBet = 0;

    // Reset turn to first player after dealer
    const occupiedSeats = state.players.map((p, i) => p ? i : -1).filter(i => i !== -1);
    const dealerPos = occupiedSeats.indexOf(state.dealerIdx);
    state.turnIndex = occupiedSeats[(dealerPos + 1) % occupiedSeats.length];

    switch (state.phase) {
        case 'PRE-FLOP':
            state.phase = 'FLOP';
            await dealCommunity(3);
            startBettingRound();
            break;
        case 'FLOP':
            state.phase = 'TURN';
            await dealCommunity(1);
            startBettingRound();
            break;
        case 'TURN':
            state.phase = 'RIVER';
            await dealCommunity(1);
            startBettingRound();
            break;
        case 'RIVER':
            state.phase = 'SHOWDOWN';
            showdown();
            break;
    }
}

async function dealCommunity(count) {
    for (let i = 0; i < count; i++) {
        const card = drawCard();
        state.communityCards.push(card);
        animateCardDrawCommunity();
        CommonUtils.playSound('card');
        renderCommunityCards();
        await new Promise(r => setTimeout(r, 400));
    }
}

function drawCard() {
    if (state.shoe.length === 0) {
        state.shoe = CommonUtils.createShoe(1, SUITS, VALUES);
    }
    const card = state.shoe.pop();
    updateShoeVisual();
    return card;
}

function animateCardDraw(seatIdx) {
    const tableRect = ui.cardStack.getBoundingClientRect();
    const seatEl = document.getElementById(`seat-${seatIdx}`);
    if (!seatEl) return;
    const seatRect = seatEl.getBoundingClientRect();
    CommonUtils.animateCardDraw(ui.cardStack.parentElement, seatRect.left + 50, seatRect.top + 50);
}

function animateCardDrawCommunity() {
    const tableRect = ui.communityCards.getBoundingClientRect();
    CommonUtils.animateCardDraw(ui.cardStack.parentElement, tableRect.left + (state.communityCards.length * 40), tableRect.top + 20);
}

function showdown() {
    const activePlayers = state.players.filter(p => p && !p.folded);
    let winners = [];
    let bestRank = -1;

    activePlayers.forEach(p => {
        const fullSeven = [...p.hand, ...state.communityCards];
        p.bestHand = PokerLogic.evaluateHand(fullSeven);
        if (!winners.length || p.bestHand.rank > bestRank) {
            winners = [p];
            bestRank = p.bestHand.rank;
        } else if (p.bestHand.rank === bestRank) {
            // Check value tie-breaker
            if (p.bestHand.value > winners[0].bestHand.value) {
                winners = [p];
            } else if (p.bestHand.value === winners[0].bestHand.value) {
                winners.push(p);
            }
        }
    });

    const winAmount = Math.floor(state.pot / winners.length);
    winners.forEach(p => {
        p.chips += winAmount;
        p.lastAction = 'WINNER!';
    });

    showOverlay(winners.length > 1 ? "Split Pot!" : "Winner!",
        winners.map(p => `Player ${p.id + 1}: ${p.bestHand.name}`).join('<br>'),
        `$${winAmount}`, "msg-win");
    CommonUtils.playSound('win');

    render();
    setTimeout(createShoe, 5000); // 5 second pause for player to see the results
}

function showOverlay(main, sub, amount, colorClass) {
    ui.overlayMain.className = 'overlay-text ' + (colorClass || '');
    ui.overlayMain.textContent = main;
    ui.overlaySub.innerHTML = sub + (amount ? `<br><span class="profit-indicator">${amount}</span>` : "");
    ui.overlay.classList.add('show');
}

function renderCommunityCards() {
    ui.communityCards.innerHTML = '';
    state.communityCards.forEach(c => {
        ui.communityCards.appendChild(CommonUtils.createCardEl(c));
    });
}

function renderSeats() {
    ui.seats.innerHTML = '';
    for (let i = 0; i < state.seatCount; i++) {
        ui.seats.innerHTML += getSeatHTML(i);
    }
}

function renderSeat(idx) {
    const el = document.getElementById(`seat-${idx}`);
    if (el) el.outerHTML = getSeatHTML(idx);
}

function render() {
    renderSeats();
    renderCommunityCards();
    updateStats();
}

function updateStats() {
    ui.potDisplay.textContent = `Pot: $${state.pot}`;
    ui.potTotal.textContent = `$${state.pot}`;
}

function getSeatHTML(idx) {
    const p = state.players[idx];
    if (!p) {
        return `<div class="seat" id="seat-${idx}"><button class="btn-sit" onclick="sit(${idx})">Sit</button></div>`;
    }

    const classList = `seat ${p.isActing ? 'turn' : ''} ${p.folded ? 'folded' : ''} ${p.allIn ? 'all-in' : ''}`;

    let buttons = '';
    if (p.isActing && !p.autoPlay) {
        const callAmt = state.currentBet - p.currentBet;
        buttons = `
            <div class="controls">
                <button onclick="playerAction('fold')">Fold</button>
                <button onclick="playerAction('check')" ${callAmt > 0 ? 'disabled' : ''}>Check</button>
                <button onclick="playerAction('call')" ${callAmt === 0 ? 'disabled' : ''}>Call ${callAmt > 0 ? '$' + callAmt : ''}</button>
                <button onclick="playerAction('raise')">Raise</button>
            </div>
        `;
    }

    const isHuman = idx === 0;
    const showCards = isHuman || state.phase === 'SHOWDOWN' || p.folded;
    const handHTML = p.hand.map(c => {
        const cardToRender = showCards ? c : { ...c, hidden: true };
        return CommonUtils.createCardEl(cardToRender).outerHTML;
    }).join('');

    return `
        <div class="${classList}" id="seat-${idx}">
            <div class="seat-info">
                <span>P${idx + 1} ${p.autoPlay ? '(Bot)' : ''}</span>
                <span class="chip-stack">$${p.chips}</span>
            </div>
            <div class="player-hand-area">
                <div class="cards" style="transform: scale(0.8);">${handHTML}</div>
                ${p.lastAction ? `<div class="bet-bubble">${p.lastAction}</div>` : ''}
                ${p.currentBet > 0 ? `<div class="bet-bubble" style="top: 25px;">$${p.currentBet}</div>` : ''}
            </div>
            ${buttons}
            <button class="btn-standup" onclick="standUp(${idx})">Exit</button>
        </div>
    `;
}

function sit(idx) {
    state.players[idx] = {
        id: idx,
        chips: 1000,
        hand: [],
        currentBet: 0,
        folded: false,
        allIn: false,
        autoPlay: idx !== 0, // All but first are bots by default
        isActing: false,
        lastAction: '',
        sittingOut: state.phase !== 'WAITING'
    };
    if (state.phase === 'WAITING' && state.players.filter(p => p).length >= 2) {
        createShoe();
    } else {
        renderSeat(idx);
    }
}

function standUp(idx) {
    state.players[idx] = null;
    renderSeats();
}

init();
