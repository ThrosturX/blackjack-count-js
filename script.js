/* --- CONSTANTS --- */
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const BET_TIME = 10;
const MIN_TIMER = 3;
const PENETRATION = 0.75;

/* --- STATE --- */
const state = {
    seatCount: 5,
    deckCount: 6,
    shoe: [],
    totalInitialCards: 0,
    cutCardReached: false,
    runningCount: 0,
    dealer: { hand: [] },
    players: [],
    phase: 'BETTING', // BETTING, SHUFFLING, DEALING, PLAYING, RESOLVING
    turnIndex: -1,
    splitIndex: -1,
    timer: null,
    timerVal: 0,
    isShuffling: false
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
    deckSelect: document.getElementById('deck-select'),
    seatSelect: document.getElementById('seat-select'),
    strategyText: document.getElementById('strategy-text'),
    countHint: document.getElementById('count-hint'),
};

/* --- AUDIO HANDLING --- */
// Preload audio assets
const audioAssets = {};

function preloadAudio() {
    const soundFiles = {
        'card': ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav', 'card5.wav'],
        'shuffle': ['shuffle.wav'],
        'chip': ['chip.wav', 'chips.wav'],
        'win': ['win.wav', 'nice.wav', 'youwin.wav', 'winner.wav'],
        'lose': ['lose.wav', 'noluck.wav', 'itiswhatis.wav', 'nextluck.wav', 'lucknext.wav'],
        'bust': ['bust.wav', 'lose.wav'],
        'blackjack': ['blackjack.wav', 'nice.wav'],
        'error': ['error.wav']
    };

    for (const [type, filepaths] of Object.entries(soundFiles)) {
        // audioAssets[type] will now hold an array of Audio objects
        audioAssets[type] = filepaths.map(path => {
            const audio = new Audio();
            audio.preload = 'auto';
            audio.src = 'audio/' + path;
            audio.load();

            audio.addEventListener('error', () => {
                console.warn(`Could not load audio file: ${path}`);
            });

            return audio;
        });
    }
}

// Initialize audio at startup
preloadAudio();

function playSound(type) {
    if (audioAssets[type]) {
        const sounds = audioAssets[type]

        const audioChoice = sounds[Math.floor(Math.random() * sounds.length)];
        // Create a new instance to allow overlapping sounds
        const audio = new Audio(audioChoice.src);
        audio.volume = 0.05; // Set volume low
        if (type === 'card' || type === 'chip') {
            audio.volume = 0.3; // Set volume to 30%
        }
        audio.play().catch(e => {
            console.warn(`Could not play ${type} sound:`, e.message);
        });
    } else {
        // For all other sound types, print warning without erroring
        console.warn("Audio not implemented for: " + type);
    }
}

/* --- CARD CLASS --- */
class Card {
    constructor(suit, val) {
        this.suit = suit;
        this.val = val;
        this.hidden = false;
        this.isSplitCard = false;
    }
    get num() {
        if (['J', 'Q', 'K'].includes(this.val)) return 10;
        if (this.val === 'A') return 11;
        return parseInt(this.val);
    }
    get count() {
        if (['10', 'J', 'Q', 'K', 'A'].includes(this.val)) return -1;
        if (['2', '3', '4', '5', '6'].includes(this.val)) return 1;
        return 0;
    }
    get color() { return (this.suit === '♥' || this.suit === '♦') ? 'red' : 'black'; }
}

/* --- INITIALIZATION --- */
function init() {
    state.players = Array(state.seatCount).fill(null);
    createShoe();
    setTimeout(updateShoeVisual, 100);
}

function createShoe() {
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
    for (let i = 0; i < state.deckCount; i++) {
        for (let s of SUITS) {
            for (let v of VALUES) {
                state.shoe.push(new Card(s, v));
                state.totalInitialCards++;
            }
        }
    }
    // Fisher-Yates Shuffle
    for (let i = state.shoe.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.shoe[i], state.shoe[j]] = [state.shoe[j], state.shoe[i]];
    }

    // Determine Cut Card Position
    const cutIndex = Math.floor(state.totalInitialCards * (1 - PENETRATION));
    state.shoe[cutIndex].isSplitCard = true;

    // UI Updates
    ui.overlayMain.className = 'overlay-text msg-shuffle';
    ui.overlayMain.textContent = "Shuffling";
    ui.overlaySub.textContent = "Preparing Shoe...";
    ui.overlay.classList.add('show');

    // Clear seats visually if not already done (usually cleared before calling this)
    if (ui.seats.innerHTML === '') renderSeats();

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
    }, 800);

    // Update shoe visual after shuffle
    setTimeout(() => {
        state.isShuffling = false;
        state.phase = 'BETTING';
        ui.overlay.classList.remove('show');
        updateShoeVisual(); // Show full stack
        updateGameFlow();
    }, 800);
}

function finishShuffle() {
    state.isShuffling = false;
    state.phase = 'BETTING';
    ui.overlay.classList.remove('show');
    updateShoeVisual();
    updateGameFlow(); // Check for auto-bets immediately
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
    const shoeContainer = document.querySelector('.shoe-container');
    if (!cardStack || !shoeContainer) return;

    requestAnimationFrame(() => {
        cardStack.innerHTML = '';

        if (state.shoe.length === 0 || state.isShuffling) {
            return;
        }

        const totalCards = state.shoe.length;

        // Find separator position
        const separatorIndex = state.shoe.findIndex(card => card.isSplitCard);

        // Scale the number of rendered cards based on the number of decks
        // To make 8 decks look like 4 decks currently does, we use a square root scale
        // This creates a gradual compression as deck count increases
        // Formula: renderedCards = baseCards * sqrt(deckCount)
        // For 1 deck (52 cards): render 52 cards (~1:1 ratio)
        // For 2 decks (104 cards): render ~73 cards (~1.4:1 ratio)
        // For 4 decks (208 cards): render ~104 cards (~2:1 ratio)
        // For 6 decks (312 cards): render ~127 cards (~2.5:1 ratio)
        // For 8 decks (416 cards): render ~147 cards (~2.8:1 ratio) - closer to 4 decks appearance
        const baseRenderedCards = 52; // Base number of rendered cards for 1 deck
        const deckScalingFactor = Math.sqrt(state.deckCount); // Square root scaling
        let maxRenderedCards = Math.floor(baseRenderedCards * deckScalingFactor);

        // Also consider available width constraint (max 188 cards for 380px width)
        const maxWidthCards = 188; // 380px / 2px per card
        maxRenderedCards = Math.min(maxRenderedCards, maxWidthCards);

        let cardsToShow, reductionFactor = 1;
        if (totalCards > maxRenderedCards) {
            reductionFactor = totalCards / maxRenderedCards;
            cardsToShow = maxRenderedCards;
        } else {
            cardsToShow = totalCards;
        }

        // Flip the shoe horizontally: draw from right to left (dealer draws from right/end of shoe)
        const totalWidth = cardsToShow * 2; // Each card takes 2px (back line + edge line)

        // Create thin lines representing card backs and edges
        for (let i = 0; i < cardsToShow; i++) {
            // Calculate which card in the actual shoe this represents
            // Since we're flipping horizontally, we want the top card (last drawn) to be on the right
            const realIndex = Math.floor(i * reductionFactor); // Start from beginning of shoe (top cards)

            // Card back line (representing the visible part of the card back)
            const cardBackLine = document.createElement('div');
            cardBackLine.className = 'card-back-line';

            // Horizontal orientation - flip by calculating position from the right
            const positionFromRight = totalWidth - (i * 2);

            cardBackLine.style.cssText = `
                position: absolute;
                width: 2px;
                height: 70px;
                background: linear-gradient(0deg, #b71c1c 0%, #c62828 50%, #b71c1c 100%);
                left: ${positionFromRight}px;
                z-index: ${i * 2};
            `;

            // Check if this position corresponds to the separator card
            if (Math.abs(realIndex - separatorIndex) < reductionFactor) {
                // This visual card represents the separator card
                cardBackLine.style.width = '1px';
                cardBackLine.style.background = 'linear-gradient(0deg, #FFEED7 0%, #FFEEA5 50%, #FFEED7 100%)';
                cardBackLine.style.zIndex = 100; // Ensure separator is visible
            }

            cardStack.appendChild(cardBackLine);

            // Card edge line (representing the physical edge of the card)
            const cardEdgeLine = document.createElement('div');
            cardEdgeLine.className = 'card-edge-line';

            // Horizontal orientation - flip by calculating position from the right
            const edgePositionFromRight = totalWidth - (i * 2 + 1);

            cardEdgeLine.style.cssText = `
                position: absolute;
                width: 2px;
                height: 70px;
                background-color: pink;
                left: ${edgePositionFromRight}px;
                z-index: ${i * 2 + 1};
            `;

            // Make separator card edge line more prominent
            if (Math.abs(realIndex - separatorIndex) < reductionFactor) {
                cardEdgeLine.style.width = '2px';
                cardEdgeLine.style.backgroundColor = '#FFF7A2';
                cardEdgeLine.style.zIndex = 99; // Ensure separator edge is very visible
            }

            cardStack.appendChild(cardEdgeLine);
        }

        // Ensure the separator card is always visible by adding it explicitly if needed
        if (separatorIndex !== -1 && totalCards > 0) {
            // Calculate where the separator should appear in the visual representation
            // Since we're showing the shoe flipped horizontally (dealer draws from right), 
            // the separator card (which is at 25% from start of full shoe) should appear 
            // at the corresponding position from the LEFT side of the visual representation
            const separatorVisualPos = Math.floor((separatorIndex / state.totalInitialCards) * cardsToShow);
            const positionFromRight = totalWidth - (separatorVisualPos * 2);
        }
    });
}

function animateCardDraw(toDealer = true, seatIndex = null) {
    const cardStack = document.getElementById('card-stack');
    if (!cardStack) return;

    // Create flying card animation using the same style as the hole card
    const flyingCard = document.createElement('div');
    flyingCard.className = 'card hidden'; // Use the same styling as hidden cards
    flyingCard.style.position = 'fixed';
    flyingCard.style.width = '70px';
    flyingCard.style.height = '95px';
    flyingCard.style.zIndex = '1000';
    flyingCard.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    flyingCard.style.pointerEvents = 'none';
    flyingCard.style.opacity = '0.95';
    flyingCard.style.borderRadius = '6px';
    flyingCard.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4), inset 0 0 10px rgba(255,255,255,0.1)';
    flyingCard.style.border = '2px solid #ffd700';

    // Position at shoe
    const shoeRect = document.querySelector('.shoe-body').getBoundingClientRect();
    flyingCard.style.left = `${shoeRect.left + 5}px`;
    flyingCard.style.top = `${shoeRect.top + 15}px`;

    document.body.appendChild(flyingCard);

    // Determine destination based on parameters
    setTimeout(() => {
        let destX, destY;
        
        if (!toDealer && seatIndex !== null) {
            // Animate to specific player seat
            const seatElement = document.getElementById(`seat-${seatIndex}`);
            if (seatElement) {
                const seatRect = seatElement.getBoundingClientRect();
                destX = seatRect.left + seatRect.width / 2;
                destY = seatRect.top + seatRect.height / 2;
            } else {
                // Fallback to dealer if seat element not found
                const tableRect = document.getElementById('table').getBoundingClientRect();
                destX = tableRect.left + tableRect.width / 2 + 36;
                destY = tableRect.top + 60;
            }
        } else {
            // Animate to dealer
            const tableRect = document.getElementById('table').getBoundingClientRect();
            destX = tableRect.left + tableRect.width / 2 + 36;
            destY = tableRect.top + 60;
        }

        flyingCard.style.left = `${destX}px`;
        flyingCard.style.top = `${destY}px`;
        flyingCard.style.transform = 'scale(0.8) rotate(5deg)';
        flyingCard.style.opacity = '0.7';

        setTimeout(() => {
            if (flyingCard.parentNode) {
                flyingCard.parentNode.removeChild(flyingCard);
            }
            updateShoeVisual();
        }, 400);
    }, 10);
}

/* --- GAME FLOW CONTROL --- */

function updateGameFlow() {
    if (state.phase !== 'BETTING') return;

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
    }
    // --- END OF NEW LOGIC ---

    // Original logic continues only if the immediate start condition wasn't met
    const waitingPlayers = state.players.filter(p => p && p.isReady);

    if (waitingPlayers.length > 0) {
        if (!state.timer) {
            startTimer(); // Start the timer if it wasn't already running and bets have been placed
        }
        // If timer is already running, this function might update the UI or perform other tasks
        // related to the ongoing betting phase, though in the original code it doesn't do much more here.
    } else {
        // No one has placed a bet yet
        if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
            ui.overlay.classList.remove('show');
        }
    }

    renderSeats();
}

function processAutoBets() {
    if (state.phase !== 'BETTING') return;
    let madeChanges = false;

    state.players.forEach((p, idx) => {
        if (p && p.autoPlay && p.autoBet && !p.isReady) {
            const decksRem = Math.max(1, state.shoe.length / 52);
            const tc = state.runningCount / decksRem;
            let betAmt = p.lastBet || 10;
            if (tc >= 3) betAmt = 100;
            else if (tc >= 2) betAmt = 50;
            else if (tc <= -2) betAmt = 10;
            else betAmt = 20;
            if (betAmt > p.chips) betAmt = p.chips;


            placeBetInternal(idx, betAmt);
            madeChanges = true;
        }
    });
}

/* --- BETTING LOGIC --- */

function placeBet(idx, amt) {
    if (state.phase !== 'BETTING') return;
    const p = state.players[idx];
    if (!p) return;

    if (isNaN(amt) || amt < 1) { playSound('error'); return; }
    if (amt > p.chips) { amt = p.chips; }
    if (amt === 0) { return; }

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
    if (state.phase !== 'BETTING') return;
    const p = state.players[idx];
    if (!p) return;

    if (type === 'play') {
        p.autoPlay = !p.autoPlay;
        if (!p.autoPlay) {
            p.autoBet = false;
        }
    } else if (type === 'bet' && p.autoPlay) {
        p.autoBet = !p.autoBet;
        if (p.autoBet) {
            updateGameFlow();
        } else {
            if (p.isReady) {
                clearBet(idx);
            }
        }
    }
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
    }, 1000);
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
                state.runningCount += c.count;
                updateStats();
                playSound('card');
            }
            renderDealer();
        } else {
            const p = state.players[action.idx];
            const c = drawCard(false, action.idx);
            if (c.isSplitCard) state.cutCardReached = true;

            state.runningCount += c.count;
            updateStats();
            playSound('card');
            p.hands[0].cards.push(c);
            renderSeat(action.idx);
        }
        i++;
        setTimeout(nextDeal, 200);
    }
    nextDeal();
}

function checkBlackjack() {
    const dScore = calcScore(state.dealer.hand);
    let activePlayers = state.players.filter(p => p && p.hands.length);
    let playing = false;

    activePlayers.forEach(p => {
        p.hands.forEach(h => {
            const s = calcScore(h.cards);
            if (s === 21) {
                h.status = 'blackjack';
                h.result = 'win';
                playSound('blackjack')
                if (dScore === 21) h.result = 'push';
            } else {
                playing = true;
            }
        });
    });

    render();

    if (dScore === 21) {
        state.dealer.hand[1].hidden = false;
        renderDealer();
        state.runningCount += state.dealer.hand[1].count;
        updateStats();
        showOverlay("Dealer", "Blackjack!", "", "msg-bj");
        playSound('lose');
        setTimeout(endRound, 2000);
    } else if (!playing) {
        setTimeout(endRound, 1500);
    } else {
        state.phase = 'PLAYING';
        nextTurn();
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
                    setTimeout(playerStand, 500);
                } else {
                    render();
                    updateStrategyHint();

                    if (p.autoPlay) {
                        setTimeout(runAutoPlay, 800);
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
    playSound('card');

    setTimeout(() => {
        if (action === 'Hit') playerHit();
        else if (action === 'Stand') playerStand();
        else if (action === 'Double') {
            // Logic: Can only double on first 2 cards
            if (p.chips >= h.bet && h.cards.length === 2) playerDouble();
            else playerHit();
        }
        else if (action === 'Split') playerSplit();
    }, 1000);
}

function playerHit() {
    const p = state.players[state.turnIndex];
    const h = p.hands[state.splitIndex];

    const c = drawCard(false, state.turnIndex);
    state.runningCount += c.count;
    updateStats();
    playSound('card');
    h.cards.push(c);

    ui.overlay.classList.remove('show');
    renderSeat(state.turnIndex);

    setTimeout(() => {
        if (calcScore(h.cards) > 21) {
            h.status = 'bust';
            h.result = 'lose';
            playSound('bust');
            ui.strategyText.textContent = "";
            setTimeout(nextTurn, 800);
        } else if (calcScore(h.cards) === 21) {
            ui.strategyText.textContent = "";
            setTimeout(playerStand, 500);
        } else {
            updateStrategyHint();
            if (state.players[state.turnIndex].autoPlay) {
                setTimeout(runAutoPlay, 500);
            }
        }
    }, 500);
}

function playerStand() {
    ui.overlay.classList.remove('show');
    ui.strategyText.textContent = "";
    const p = state.players[state.turnIndex];
    const h = p.hands[state.splitIndex];
    h.status = 'stand';

    const nextSplit = p.hands.findIndex((hand, idx) => idx > state.splitIndex && hand.status === 'playing');
    if (nextSplit !== -1) {
        state.splitIndex = nextSplit;
        render();
        updateStrategyHint();
        setTimeout(() => {
            if (calcScore(p.hands[nextSplit].cards) === 21) playerStand();
            else if (p.autoPlay) setTimeout(runAutoPlay, 500);
        }, 500);
    } else {
        nextTurn();
    }
}

function playerDouble() {
    const p = state.players[state.turnIndex];
    const h = p.hands[state.splitIndex];

    // Protection: Cannot double if not initial 2 cards
    if (h.cards.length !== 2) { playSound('error'); return; }
    if (p.chips < h.bet) { playSound('error'); return; }

    playSound('chip');
    p.chips -= h.bet;
    h.bet *= 2;

    const c = drawCard(false, state.turnIndex);
    state.runningCount += c.count;
    updateStats();
    playSound('card');
    h.cards.push(c);
    h.status = 'stand';

    ui.overlay.classList.remove('show');
    ui.strategyText.textContent = "";
    renderSeat(state.turnIndex);
    setTimeout(nextTurn, 800);
}

function playerSplit() {
    const p = state.players[state.turnIndex];
    const h = p.hands[state.splitIndex];

    if (p.chips < h.bet) { playSound('error'); return; }
    const c1 = h.cards[0];
    const c2 = h.cards[1];
    if (c1.val !== c2.val) { playSound('error'); return; }

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
    state.runningCount += cFirst.count;
    updateStats();
    playSound('card');
    h.cards.push(cFirst);

    const cSecond = drawCard(false, state.turnIndex);
    state.runningCount += cSecond.count;
    updateStats();
    playSound('card');
    newHand.cards.push(cSecond);

    renderSeat(state.turnIndex);
    updateStrategyHint();
    if (p.autoPlay) setTimeout(runAutoPlay, 500);
}

function dealerTurn() {
    state.phase = 'RESOLVING';
    state.turnIndex = -1;

    const hole = state.dealer.hand[1];
    hole.hidden = false;
    state.runningCount += hole.count;
    updateStats();
    playSound('card');
    renderDealer();

    let score = calcScore(state.dealer.hand);

    function loop() {
        if (score < 17) {
            const c = drawCard(true, null);
            state.runningCount += c.count;
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

    if (dScore > 21 && false) {
        showOverlay("Dealer Busts!", "All Active Hands Win", "", "msg-win");
    }
    ui.overlay.classList.remove('show');
    let pIndex = 0;

    function processNextPlayer() {
        if (pIndex >= state.players.length) {
            finishRound();
            return;
        }

        const p = state.players[pIndex];
        pIndex++;

        if (!p || !p.hands.length) {
            processNextPlayer();
            return;
        }

        // Process hands one by one with delays to avoid overlapping sounds
        let handIndex = 0;
        
        function processNextHand() {
            if (handIndex >= p.hands.length) {
                // All hands for this player processed, move to next player
                renderSeat(pIndex - 1);
                setTimeout(processNextPlayer, 1200); // Delay before moving to next player
                return;
            }
            
            const h = p.hands[handIndex];
            handIndex++;
            
            if (h.result !== null) {
                if (h.status === 'blackjack') {
                    const profit = h.bet * 1.5;
                    p.chips += h.bet + profit;
                    showOverlay(`Player ${p.id + 1}`, "Blackjack", `+$${Math.floor(profit)}`, "msg-bj");
                } else if (h.status === 'bust') {
                    showOverlay(`Player ${p.id + 1}`, "Bust", `-$${h.bet}`, "msg-lose");
                    //                              playSound('bust');
                }
                
                // Process next hand after delay
                setTimeout(processNextHand, 1200);
                return;
            }

            const pScore = calcScore(h.cards);

            if (pScore > dScore || dScore > 21) {
                h.status = 'win';
                h.result = 'win';
                p.chips += h.bet * 2;
                showOverlay(`Player ${p.id + 1}`, `Won`, `+$${h.bet}`, "msg-win");
                playSound('win');
            } else if (pScore < dScore) {
                h.status = 'lose';
                h.result = 'lose';
                showOverlay(`Player ${p.id + 1}`, `Lost`, `-$${h.bet}`, "msg-lose");
                playSound('lose');
            } else {
                h.status = 'push';
                h.result = 'push';
                p.chips += h.bet;
                showOverlay(`Player ${p.id + 1}`, `Push`, "", "msg-push");
            }
            
            // Process next hand after delay
            setTimeout(processNextHand, 1200);
        }
        
        // Start processing hands for this player
        processNextHand();
    }

    processNextPlayer();
}

function finishRound() {
    if (state.cutCardReached) {
        // Requirement 4: Clear table immediately when shuffling starts
        state.phase = 'SHUFFLING';

        // Clear hands visually
        state.players.forEach(p => { if (p) p.hands = []; });
        state.dealer.hand = [];

        // Force a render to show the empty table immediately
        render();

        showOverlay("Cut Card Reached", "Shuffling...", "", "msg-shuffle");
        setTimeout(createShoe, 1500);
    } else {
        endRound();
    }
}

function endRound() {
    state.phase = 'BETTING';
    updateCountHint();
    updateGameFlow();
    render();
}

/* --- HELPERS --- */

function calcScore(cards) {
    let s = 0;
    let a = 0;
    cards.forEach(c => {
        if (c.hidden) return;
        s += c.num;
        if (c.val === 'A') a++;
    });
    while (s > 21 && a > 0) { s -= 10; a--; }
    return s;
}

function getScoreDisplay(cards) {
    const score = calcScore(cards);
    if (isSoftHand(cards) && score < 21) {
        return `${score - 10} / ${score}`;
    }
    return score;
}

function isSoftHand(cards) {
    let minScore = 0;
    let hasAce = false;

    for (let c of cards) {
        if (c.hidden) continue;

        // Calculate the absolute minimum value (Aces = 1)
        if (c.val === 'A') {
            minScore += 1;
            hasAce = true;
        } else {
            // Ensure we use the card's blackjack value (10 for J, Q, K)
            minScore += Math.min(10, c.num); 
        }
    }

    // A hand is "Soft" ONLY if:
    // 1. It has at least one Ace
    // 2. Changing ONE Ace from 1 to 11 (adding 10) stays at or under 21
    return hasAce && (minScore + 10 <= 21);
}

function getStrategyHint(dCard, pCards) {
    const dVal = dCard.num;
    const pScore = calcScore(pCards);
    const soft = isSoftHand(pCards);

    if (pCards.length === 2 && pCards[0].val === pCards[1].val) {
        const c = pCards[0].val;
        if (c === 'A' || c === '8') return "Split";
        if (c === '10' || c === '5') return soft ? "Stand" : (pScore >= 12 ? "Stand" : "Hit");
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
        if (pScore === 17) return "Double";
        if (pScore === 16 || pScore === 15) return (dVal <= 6) ? "Double" : "Hit";
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

/* --- RENDERING --- */
function createCardEl(card) {
    const div = document.createElement('div');
    div.className = `card ${card.color} ${card.hidden ? 'hidden' : ''} ${card.isSplitCard ? 'split-card' : ''}`;
    if (!card.hidden) {
        div.innerHTML = `<div class="val-top">${card.val}<small>${card.suit}</small></div>`;
        div.innerHTML += `<div class="suit-center">${card.suit}</div>`;
        div.innerHTML += `<div class="val-bot">${card.val}<small>${card.suit}</small></div>`;
    }
    return div;
}

function renderDealer() {
    ui.dealerCards.innerHTML = '';
    state.dealer.hand.forEach(c => ui.dealerCards.appendChild(createCardEl(c)));

    const hasHidden = state.dealer.hand.some(c => c.hidden);
    if (hasHidden && state.phase !== 'RESOLVING') {
        ui.dealerScore.textContent = state.dealer.hand[0].num;
    } else {
        ui.dealerScore.textContent = calcScore(state.dealer.hand);
    }
}

function sit(idx) {
    state.players[idx] = {
        id: idx,
        chips: 1000,
        currentBet: 0,
        lastBet: 10,
        hands: [],
        isReady: false,
        autoPlay: false,
        autoBet: false
    };
    updateGameFlow();
}

function standUp(idx) {
    state.players[idx] = null;
    updateGameFlow();
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
                        <button class="btn-sit" onclick="sit(${idx})" ${isGameActive ? 'disabled' : ''}>Sit Down</button>
                    </div>
                `;
    }

    let classList = `seat ${state.turnIndex === idx && state.phase === 'PLAYING' ? 'turn' : ''}`;
    if (p.autoPlay) classList += ` auto`;

    const isMyTurn = (state.turnIndex === idx && state.phase === 'PLAYING');
    if (isGameActive && !isMyTurn) classList += ` disabled`;

    let statusClass = '';
    let statusText = '';

    if (state.phase === 'BETTING' || state.phase === 'RESOLVING') {
        const wins = p.hands.filter(h => h.result === 'win').length;
        const loses = p.hands.filter(h => h.result === 'lose').length;
        const pushes = p.hands.filter(h => h.result === 'push').length;

        if (wins > 0 && loses === 0 && pushes === 0) { statusClass = 'winner'; statusText = 'WINNER'; }
        else if (loses > 0 && wins === 0 && pushes === 0) { statusClass = 'loser'; statusText = 'LOSER'; }
        else if (pushes > 0 && wins === 0 && loses === 0) { statusClass = 'push'; statusText = 'PUSH'; }
    }

    if (statusClass) classList += ` ${statusClass}`;

    let controlsHTML = '';

    // Betting Phase Controls
    if (state.phase === 'BETTING') {
        controlsHTML = `
                    <button class="btn-standup" onclick="standUp(${idx})">Stand Up</button>
                    <div class="toggle-container" onclick="toggleAuto(${idx}, 'play')">
                        <span class="toggle-label">Auto Play</span>
                        <label class="toggle-switch">
                            <input type="checkbox" ${p.autoPlay ? 'checked' : ''} disabled>
                            <span class="slider"></span>
                        </label>
                    </div>
                    ${p.autoPlay ? `
                    <div class="toggle-container" onclick="toggleAuto(${idx}, 'bet')">
                        <span class="toggle-label">Auto Bet</span>
                        <label class="toggle-switch auto-bet">
                            <input type="checkbox" ${p.autoBet ? 'checked' : ''} disabled>
                            <span class="slider"></span>
                        </label>
                    </div>` : ''}

                    <div class="bet-controls">
                        <input type="number" class="bet-input" id="bet-in-${idx}" value="${p.lastBet || 10}" min="10" step="10">
                        <button class="btn-bet" onclick="placeBet(${idx}, parseInt(document.getElementById('bet-in-${idx}').value))">Bet</button>
                        <button class="btn-clear" onclick="clearBet(${idx})">Clear</button>
                    </div>
                `;
    }
    // Playing Phase Controls
    else if (state.phase === 'PLAYING' && isMyTurn) {
        const h = p.hands[state.splitIndex];
        // Bot/Human double check
        const canDouble = (h.cards.length === 2 && h.cards[0].val === h.cards[1].val && p.chips >= h.bet);

        controlsHTML = `
                    <div class="controls">
                        <button class="action-btn btn-hit" onclick="playerHit()">H</button>
                        <button class="action-btn btn-stand" onclick="playerStand()">S</button>
                        <button class="action-btn btn-double" onclick="playerDouble()" ${p.chips < h.bet || h.cards.length !== 2 ? 'disabled' : ''}>D</button>
                        <button class="action-btn btn-split" onclick="playerSplit()" ${!canDouble ? 'disabled' : ''}>SP</button>
                    </div>
                `;
    }

    // Hand Rendering
    let handsHTML = '';
    if (p.hands.length > 0) {
        if (p.hands.length > 1) {
            // Split view
            handsHTML = `<div class="split-container">`;
            p.hands.forEach((h, hIdx) => {
                const isActive = (state.splitIndex === hIdx) ? 'active-split' : '';
                handsHTML += `
                            <div class="mini-hand ${isActive}">
                                <div class="score-pill" style="font-size:0.7rem; padding:2px 6px;">${getScoreDisplay(h.cards)}</div>
                                <div class="cards">
                                    ${h.cards.map(c => createCardEl(c).outerHTML).join('')}
                                </div>
                            </div>
                        `;
            });
            handsHTML += `</div>`;
        } else {
            // Single hand view
            const h = p.hands[0];
            handsHTML = `
                        <div class="cards" style="transform: scale(0.8);">
                            ${h.cards.map(c => createCardEl(c).outerHTML).join('')}
                        </div>
                    `;
        }
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
                        <span>Player ${idx + 1} ${p.autoPlay ? '(Bot)' : ''}</span>
                        <span class="chip-stack">$${p.chips}</span>
                    </div>

                    <div class="player-hand-area">
                        ${statusText ? `<div style="position:absolute; color:var(--gold); font-weight:bold; font-size:1.2rem; text-shadow:0 2px 4px black; z-index:10;">${statusText}</div>` : ''}

                        ${p.hands.length > 0 && state.phase !== 'BETTING'
                                ? `<div class="score-pill" style="margin-bottom:5px;">${p.hands.length > 1 ? '' : getScoreDisplay(p.hands[0].cards)}</div>`
                                : ''}

                        ${handsHTML}

                        ${betAmount > 0 ? `<div class="bet-bubble">Bet: $${betAmount}</div>` : ''}
                    </div>

                    ${controlsHTML}
                </div>
            `;
}

// Event Listeners for Settings
ui.seatSelect.addEventListener('change', (e) => {
    state.seatCount = parseInt(e.target.value);
    state.players = Array(state.seatCount).fill(null);
    renderSeats();
});

ui.deckSelect.addEventListener('change', (e) => {
    state.deckCount = parseInt(e.target.value);
    createShoe();
});

// Start
init();
