const BET_TIME = 10;
const MIN_TIMER = 3;
const PENETRATION = 0.75;
const SETTINGS_STORAGE_KEY = 'bj_table.settings';
const PACE_LEVELS = [
    {
        id: 'practice',
        label: 'Practice',
        description: 'Slowest pace with the most time to think through decisions.',
        timerTickMs: 1250,
        humanBetSeconds: BET_TIME + 4,
        autoBetSeconds: MIN_TIMER + 2,
        delayMultiplier: 1.2,
        minDelay: 240
    },
    {
        id: 'classic',
        label: 'Classic',
        description: 'Standard table tempo.',
        timerTickMs: 1000,
        humanBetSeconds: BET_TIME,
        autoBetSeconds: MIN_TIMER,
        delayMultiplier: 1,
        minDelay: 180
    },
    {
        id: 'quick',
        label: 'Quick',
        description: 'Less think time between actions.',
        timerTickMs: 720,
        humanBetSeconds: BET_TIME - 2,
        autoBetSeconds: Math.max(1, MIN_TIMER - 1),
        delayMultiplier: 0.74,
        minDelay: 140
    },
    {
        id: 'turbo',
        label: 'Turbo',
        description: 'High-pressure pace for advanced play.',
        timerTickMs: 500,
        humanBetSeconds: BET_TIME - 4,
        autoBetSeconds: 2,
        delayMultiplier: 0.6,
        minDelay: 110
    },
    {
        id: 'blitz',
        label: 'Blitz',
        description: 'Closest to the old fast mode, with minimal decision windows.',
        timerTickMs: 320,
        humanBetSeconds: BET_TIME - 5,
        autoBetSeconds: 1,
        delayMultiplier: 0.45,
        minDelay: 90
    }
];

/* --- STATE --- */
const state = {
    seatCount: 5,
    deckCount: 6,
    shoe: [],
    totalInitialCards: 0,
    cutCardReached: false,
    tableSettingsChanged: false,
    runningCount: 0,
    sideCounts: {},
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
    paceLevel: 1
};

const ui = {
    seats: document.getElementById('seats'),
    dealerArea: document.getElementById('dealer-area'),
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
    gameArea: document.getElementById('game-area'),
    toggleGame: document.getElementById('toggle-game'),
    toggleSettings: document.getElementById('toggle-settings'),
    toggleThemes: document.getElementById('toggle-themes'),
    toggleAddons: document.getElementById('toggle-addons'),
    toggleStats: document.getElementById('toggle-stats'),
    paceModeButtons: Array.from(document.querySelectorAll('.pace-mode-btn')),
    minBet: document.getElementById('table-minimum-bet'),
    countSystemSelect: document.getElementById('count-system-select'),
    topCardPreview: document.getElementById('top-card-preview'),
    resetStats: document.getElementById('reset-blackjack-stats'),
    personaSaveOverlay: document.getElementById('persona-save-overlay'),
    personaSaveName: document.getElementById('persona-save-name'),
    personaSaveConfirm: document.getElementById('persona-save-confirm'),
    personaSaveCancel: document.getElementById('persona-save-cancel'),
    personaLoadOverlay: document.getElementById('persona-load-overlay'),
    personaLoadSelect: document.getElementById('persona-load-select'),
    personaLoadDelete: document.getElementById('persona-load-delete'),
    personaLoadConfirm: document.getElementById('persona-load-confirm'),
    personaLoadCancel: document.getElementById('persona-load-cancel'),
};

const scheduleTableSizing = CommonUtils.createRafScheduler(ensureTableSizing);
const scheduleShoeFitCheck = CommonUtils.createRafScheduler(updateShoeVisibilityForFit);
const BASE_SEAT_MIN_WIDTH = 166;
const ABSOLUTE_SEAT_MIN_WIDTH = 166;
const BASE_SEAT_MIN_HEIGHT = 280;
const ABSOLUTE_SEAT_MIN_HEIGHT = 220;
const SPLIT_HAND_SEAT_WIDTH_STEP = 8;
const SPLIT_HAND_SEAT_WIDTH_CAP = 24;
const BLACKJACK_PERSONAS_STORAGE_KEY = 'bj_table.blackjack_personas';
const MAX_BLACKJACK_PERSONAS = 9;
let blackjackStateManager = null;
let pendingPersonaSaveSeat = null;
let pendingPersonaLoadSeat = null;

function markSessionDirty() {
    if (blackjackStateManager) {
        blackjackStateManager.markDirty();
    }
}

function getElapsedRoundsSafe(value) {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function clampNumber(value, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
}

function escapeHTML(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function normalizePersonaName(name) {
    if (typeof name !== 'string') return '';
    return name.trim().slice(0, 24);
}

function loadSavedPersonas() {
    try {
        const raw = localStorage.getItem(BLACKJACK_PERSONAS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((persona) => persona && typeof persona === 'object' && normalizePersonaName(persona.name));
    } catch (err) {
        return [];
    }
}

function saveSavedPersonas(personas) {
    try {
        localStorage.setItem(BLACKJACK_PERSONAS_STORAGE_KEY, JSON.stringify(personas));
    } catch (err) {
        // Ignore storage failures.
    }
}

function getPlayerDisplayName(player, idx) {
    const personaName = normalizePersonaName(player && player.displayName);
    return personaName || `Player ${idx + 1}`;
}

function buildPlayerFromPersona(idx, persona) {
    return {
        id: idx,
        chips: clampNumber(persona.chips, 1000, 0),
        currentBet: 0,
        profit: 0,
        lastBet: clampNumber(persona.lastBet, state.minBet, state.minBet),
        hands: [],
        isReady: false,
        autoPlay: !!persona.autoPlay,
        autoBet: !!persona.autoBet,
        pendingStandUp: false,
        countingBias: clampNumber(persona.countingBias, Math.random(), 0, 1),
        conservative: !!persona.conservative,
        displayName: normalizePersonaName(persona.name)
    };
}

function sanitizeSavedPlayer(savedPlayer, seatIndex) {
    if (!savedPlayer || typeof savedPlayer !== 'object') return null;
    const chips = clampNumber(savedPlayer.chips, 0, 0);
    return {
        id: seatIndex,
        chips,
        currentBet: 0,
        profit: clampNumber(savedPlayer.profit, 0),
        lastBet: clampNumber(savedPlayer.lastBet, state.minBet, state.minBet),
        hands: [],
        isReady: false,
        autoPlay: !!savedPlayer.autoPlay,
        autoBet: !!savedPlayer.autoBet,
        pendingStandUp: false,
        countingBias: clampNumber(savedPlayer.countingBias, Math.random(), 0, 1),
        conservative: !!savedPlayer.conservative,
        displayName: normalizePersonaName(savedPlayer.displayName),
    };
}

function getBlackjackSaveState() {
    return {
        version: 1,
        seatCount: state.seatCount,
        deckCount: state.deckCount,
        minBet: state.minBet,
        countingSystem: state.countingSystem,
        paceLevel: state.paceLevel,
        casinoProfit: state.casinoProfit,
        playedRounds: state.playedRounds,
        players: state.players.map((player, idx) => {
            if (!player) return null;
            return {
                id: idx,
                chips: player.chips,
                profit: player.profit,
                lastBet: player.lastBet,
                autoPlay: player.autoPlay,
                autoBet: player.autoBet,
                countingBias: player.countingBias,
                conservative: player.conservative,
                displayName: normalizePersonaName(player.displayName)
            };
        })
    };
}

function applyStateToControls() {
    if (ui.seatSelect) ui.seatSelect.value = String(state.seatCount);
    if (ui.deckSelect) ui.deckSelect.value = String(state.deckCount);
    if (ui.minBet) ui.minBet.value = String(state.minBet);
    if (ui.countSystemSelect) ui.countSystemSelect.value = state.countingSystem;
    applyPaceLevel(state.paceLevel, { persist: false });
}

function restoreBlackjackState(saved) {
    if (!saved || typeof saved !== 'object') return;

    state.seatCount = clampNumber(saved.seatCount, state.seatCount, 1, 9);
    state.deckCount = clampNumber(saved.deckCount, state.deckCount, 1, 8);
    state.minBet = clampNumber(saved.minBet, state.minBet, 1);
    state.maxBet = calcMaxBet(state.minBet);
    state.countingSystem = typeof saved.countingSystem === 'string' ? saved.countingSystem : state.countingSystem;
    state.paceLevel = normalizePaceLevel(saved.paceLevel);
    state.casinoProfit = clampNumber(saved.casinoProfit, 0);
    state.playedRounds = getElapsedRoundsSafe(saved.playedRounds);

    const rawPlayers = Array.isArray(saved.players) ? saved.players : [];
    state.players = Array.from({ length: state.seatCount }, (_, idx) => sanitizeSavedPlayer(rawPlayers[idx], idx));

    state.runningCount = 0;
    state.sideCounts = {};
    state.dealer.hand = [];
    state.phase = 'BETTING';
    state.turnIndex = -1;
    state.splitIndex = -1;
    state.cutCardReached = false;
    state.tableSettingsChanged = false;
    state.isShuffling = false;
    state.timerVal = 0;
    if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
    }
}

function rectsOverlap(a, b, padding = 0) {
    if (!a || !b) return false;
    return !(
        a.right <= b.left + padding ||
        a.left >= b.right - padding ||
        a.bottom <= b.top + padding ||
        a.top >= b.bottom - padding
    );
}

function setDealerCenterShift(shiftPx = 0) {
    if (!ui.dealerArea) return;
    const value = Number.isFinite(shiftPx) ? Math.round(shiftPx) : 0;
    ui.dealerArea.style.setProperty('--dealer-center-shift', `${value}px`);
}

function updateDealerCenterCompensation(tableRect, shoeRect, canFitNeatly) {
    if (!tableRect || !shoeRect || !canFitNeatly) {
        setDealerCenterShift(0);
        return;
    }
    const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1;
    const centerX = tableRect.left + (tableRect.width / 2);
    const desiredCenterClearance = 108 * scale;
    const encroachment = centerX + desiredCenterClearance - shoeRect.left;
    const maxShift = 124 * scale;
    const shift = Math.max(0, Math.min(maxShift, encroachment));
    // Shoe is on the right side, so shift dealer content to the left.
    setDealerCenterShift(-shift);
}

function updateShoeVisibilityForFit() {
    const tableEl = document.getElementById('table');
    const shoeEl = document.querySelector('.shoe-container');
    if (!tableEl || !shoeEl) {
        setDealerCenterShift(0);
        return;
    }

    const shoeStyle = getComputedStyle(shoeEl);
    if (shoeStyle.display === 'none') {
        document.body.classList.add('blackjack-hide-shoe-fit');
        setDealerCenterShift(0);
        if (ui.topCardPreview) {
            ui.topCardPreview.style.opacity = 0;
        }
        return;
    }

    const tableRect = tableEl.getBoundingClientRect();
    const shoeRect = shoeEl.getBoundingClientRect();
    const seatsRect = ui.seats ? ui.seats.getBoundingClientRect() : null;

    // Apply a provisional dealer shift before overlap checks so shoe/dealer
    // can share real estate when the shoe drifts toward center.
    updateDealerCenterCompensation(tableRect, shoeRect, true);
    const dealerCardsRect = ui.dealerCards ? ui.dealerCards.getBoundingClientRect() : null;
    const dealerScoreRect = ui.dealerScore ? ui.dealerScore.getBoundingClientRect() : null;

    const inset = 8;
    const clearGap = 12;
    const withinTableBounds = (
        shoeRect.left >= tableRect.left + inset &&
        shoeRect.right <= tableRect.right - inset &&
        shoeRect.top >= tableRect.top + inset &&
        shoeRect.bottom <= tableRect.bottom - inset
    );
    const clearsDealer = (
        !rectsOverlap(shoeRect, dealerCardsRect, clearGap) &&
        !rectsOverlap(shoeRect, dealerScoreRect, clearGap)
    );
    const clearsSeats = !seatsRect || shoeRect.bottom <= seatsRect.top - clearGap;

    const canFitNeatly = withinTableBounds && clearsDealer && clearsSeats;
    document.body.classList.toggle('blackjack-hide-shoe-fit', !canFitNeatly);
    if (!canFitNeatly) {
        setDealerCenterShift(0);
    }

    if (ui.topCardPreview) {
        const shouldShowPreview = canFitNeatly && state.shoe.length > 0 && !state.isShuffling;
        ui.topCardPreview.style.opacity = shouldShowPreview ? 0.92 : 0;
    }
}

function loadSettingsSnapshot() {
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return null;
        return data;
    } catch (err) {
        return null;
    }
}

function persistSettings(updates = {}) {
    if (window.__settingsResetInProgress) return;
    try {
        const current = loadSettingsSnapshot() || { addons: {} };
        const next = {
            ...current,
            ...updates,
            addons: { ...(current.addons || {}) }
        };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
        // Ignore storage failures.
    }
}

function normalizePaceLevel(level) {
    const parsed = parseInt(level, 10);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(0, Math.min(PACE_LEVELS.length - 1, parsed));
}

function getPaceProfile() {
    return PACE_LEVELS[normalizePaceLevel(state.paceLevel)] || PACE_LEVELS[1];
}

function applyPaceLevel(level, options = {}) {
    const persist = options.persist !== false;
    state.paceLevel = normalizePaceLevel(level);

    if (ui.paceModeButtons && ui.paceModeButtons.length) {
        ui.paceModeButtons.forEach(button => {
            const buttonLevel = normalizePaceLevel(button.dataset.paceLevel);
            button.classList.toggle('active', buttonLevel === state.paceLevel);
            button.setAttribute('aria-pressed', buttonLevel === state.paceLevel ? 'true' : 'false');
        });
    }
    if (persist) {
        persistSettings({ blackjackPaceLevel: state.paceLevel });
        markSessionDirty();
    }
}

function initPaceControls(storedSettings) {
    const settings = storedSettings || loadSettingsSnapshot();
    let nextLevel = 1;
    if (settings && settings.blackjackPaceLevel !== undefined) {
        nextLevel = parseInt(settings.blackjackPaceLevel, 10);
    } else if (settings && typeof settings.fastMode === 'boolean') {
        nextLevel = settings.fastMode ? 4 : 1;
    }
    applyPaceLevel(nextLevel, { persist: false });

    if (!ui.paceModeButtons || !ui.paceModeButtons.length) return;
    ui.paceModeButtons.forEach(button => {
        if (button.dataset.boundPace === 'true') return;
        button.dataset.boundPace = 'true';
        button.addEventListener('click', () => {
            applyPaceLevel(button.dataset.paceLevel);
        });
    });
}

function captureViewportState() {
    const docScroller = document.scrollingElement || document.documentElement;
    const wrapperEl = document.getElementById('blackjack-scroll');
    const tableEl = document.getElementById('table');
    return {
        pageX: window.scrollX,
        pageY: window.scrollY,
        docLeft: docScroller ? docScroller.scrollLeft : 0,
        docTop: docScroller ? docScroller.scrollTop : 0,
        wrapperLeft: wrapperEl ? wrapperEl.scrollLeft : 0,
        wrapperTop: wrapperEl ? wrapperEl.scrollTop : 0,
        tableLeft: tableEl ? tableEl.scrollLeft : 0,
        tableTop: tableEl ? tableEl.scrollTop : 0
    };
}

function restoreViewportState(snapshot) {
    if (!snapshot) return;
    const docScroller = document.scrollingElement || document.documentElement;
    const wrapperEl = document.getElementById('blackjack-scroll');
    const tableEl = document.getElementById('table');

    if (docScroller) {
        docScroller.scrollLeft = snapshot.docLeft;
        docScroller.scrollTop = snapshot.docTop;
    }
    if (wrapperEl) {
        wrapperEl.scrollLeft = snapshot.wrapperLeft;
        wrapperEl.scrollTop = snapshot.wrapperTop;
    }
    if (tableEl) {
        tableEl.scrollLeft = snapshot.tableLeft;
        tableEl.scrollTop = snapshot.tableTop;
    }

    if (window.scrollX !== snapshot.pageX || window.scrollY !== snapshot.pageY) {
        window.scrollTo(snapshot.pageX, snapshot.pageY);
    }
}

function restoreViewportStateForFrames(snapshot, frameCount = 2) {
    if (!snapshot) return;
    restoreViewportState(snapshot);
    let remaining = Math.max(0, frameCount);
    const tick = () => {
        restoreViewportState(snapshot);
        remaining -= 1;
        if (remaining > 0) {
            requestAnimationFrame(tick);
        }
    };
    requestAnimationFrame(tick);
}

function ensureTableSizing() {
    const tableEl = document.getElementById('table');
    if (!tableEl || !ui.seats) return;
    const viewportSnapshot = captureViewportState();
    const isCompactViewport = window.matchMedia('(max-width: 900px)').matches;

    tableEl.style.minWidth = '';
    tableEl.style.minHeight = '';
    tableEl.style.maxHeight = '';

    const seatsStyle = getComputedStyle(ui.seats);
    const gap = parseFloat(seatsStyle.columnGap || seatsStyle.gap) || 0;
    const paddingLeft = parseFloat(seatsStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(seatsStyle.paddingRight) || 0;

    const seatDimensions = getSeatDimensionsForLayout();
    const seatMinWidth = seatDimensions.minWidth;
    const seatMinHeight = seatDimensions.minHeight;
    ui.seats.style.setProperty('--blackjack-seat-min-width', `${Math.ceil(seatMinWidth)}px`);
    ui.seats.style.setProperty('--blackjack-seat-min-height', `${Math.ceil(seatMinHeight)}px`);

    const seatCount = Math.max(1, state.seatCount || 1);
    const minWidth = paddingLeft + paddingRight + seatMinWidth * seatCount + gap * Math.max(0, seatCount - 1);
    const requiredWidth = minWidth;

    const tableStyles = getComputedStyle(tableEl);
    const baseMinHeight = parseFloat(tableStyles.minHeight) || 0;
    const baseMaxHeight = parseFloat(tableStyles.maxHeight);
    const paddingBottom = parseFloat(tableStyles.paddingBottom) || 0;
    const borderBottom = parseFloat(tableStyles.borderBottomWidth) || 0;

    const tableRect = tableEl.getBoundingClientRect();
    const dealerRect = ui.dealerArea ? ui.dealerArea.getBoundingClientRect() : null;
    const seatsRect = ui.seats.getBoundingClientRect();
    let contentBottom = tableRect.top;
    if (dealerRect) contentBottom = Math.max(contentBottom, dealerRect.bottom);
    contentBottom = Math.max(contentBottom, seatsRect.bottom);
    const contentDrivenHeight = Math.ceil(contentBottom - tableRect.top + paddingBottom + borderBottom + 12);
    const requiredHeight = isCompactViewport
        ? Math.max(baseMinHeight, contentDrivenHeight)
        : baseMinHeight;

    CommonUtils.ensureScrollableWidth({
        table: tableEl,
        wrapper: 'blackjack-scroll',
        requiredWidth: Math.ceil(requiredWidth),
        enterTolerance: 10,
        exitTolerance: 4
    });

    tableEl.style.minHeight = `${requiredHeight}px`;
    const needsTallTable = Number.isFinite(baseMaxHeight) && requiredHeight > baseMaxHeight + 2;
    tableEl.style.maxHeight = needsTallTable ? 'none' : '';
    restoreViewportStateForFrames(viewportSnapshot, 2);
    scheduleShoeFitCheck();
}

function getSeatDimensionsForLayout() {
    const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1;
    const isCompactViewport = window.matchMedia('(max-width: 900px)').matches;
    const widthFloor = Math.max(ABSOLUTE_SEAT_MIN_WIDTH, BASE_SEAT_MIN_WIDTH * scale);
    const heightFloor = Math.max(ABSOLUTE_SEAT_MIN_HEIGHT, BASE_SEAT_MIN_HEIGHT * scale);
    let seatMinWidth = widthFloor;
    if (!isCompactViewport) {
        const maxHandsAtAnySeat = state.players.reduce((maxHands, player) => {
            if (!player || !Array.isArray(player.hands)) return maxHands;
            return Math.max(maxHands, player.hands.length || 0);
        }, 1);
        if (maxHandsAtAnySeat > 2) {
            const splitOverflowHands = maxHandsAtAnySeat - 2;
            const splitBoost = Math.min(
                SPLIT_HAND_SEAT_WIDTH_CAP * scale,
                splitOverflowHands * SPLIT_HAND_SEAT_WIDTH_STEP * scale
            );
            seatMinWidth += splitBoost;
        }
    }

    const seatMinHeight = heightFloor;
    return {
        minWidth: seatMinWidth,
        minHeight: seatMinHeight
    };
}

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


function playSound(type) {
    CommonUtils.playSound(type);
}

document.addEventListener('DOMContentLoaded', () => {
    preloadAudio();
    CommonUtils.initCardScaleControls('blackjack-card-scale', 'blackjack-card-scale-value', {
        min: 0.5,
        max: 2,
        legacyStorageKeys: ['bj_table.blackjack_ui_scale']
    });
    scheduleShoeFitCheck();
    initPaceControls();
    blackjackStateManager = new CommonUtils.StateManager({
        gameId: 'blackjack',
        getState: getBlackjackSaveState,
        setState: restoreBlackjackState
    });
});

/* --- INITIALIZATION --- */
function init() {
    const storedSettings = loadSettingsSnapshot();
    initPaceControls(storedSettings);
    const restoredSession = blackjackStateManager ? blackjackStateManager.load() : false;
    if (!restoredSession) {
        state.players = Array(state.seatCount).fill(null);
    }
    applyStateToControls();
    createShoe();
    updateCasinoProfit();
    ui.playedRounds.textContent = `${state.playedRounds}`;
    updateCountHint();
    if (restoredSession) {
        CommonUtils.showTableToast('Session restored', {
            containerId: 'table',
            duration: 1400
        });
    }

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
        if (storedSettings && storedSettings.countingSystem) {
            state.countingSystem = storedSettings.countingSystem === 'reko' ? 'ko' : storedSettings.countingSystem;
        }
        const initCounting = () => {
            populateCountingSystems();
            ui.countSystemSelect.addEventListener('change', (e) => {
                state.countingSystem = e.target.value;
                state.runningCount = 0;
                resetSideCounts();
                updateStats();
                updateCountHint();
                persistSettings({ countingSystem: state.countingSystem });
                markSessionDirty();
            });
        };
        if (window.AddonLoader && window.AddonLoader.ready) {
            window.AddonLoader.ready.then(initCounting);
        } else {
            initCounting();
        }
        window.CountingUI = { refresh: populateCountingSystems };
    }

    if (ui.topCardPreview) {
        let lockedOpen = false;
        const getPeekCard = () => ui.topCardPreview.querySelector('.top-card-preview-card');
        const setPeekVisible = (visible) => {
            const peekCard = getPeekCard();
            if (!peekCard) return;
            peekCard.classList.toggle('hidden', !visible);
        };

        ui.topCardPreview.addEventListener('pointerdown', () => {
            setPeekVisible(true);
        });
        ui.topCardPreview.addEventListener('pointerup', () => {
            if (!lockedOpen) setPeekVisible(false);
        });
        ui.topCardPreview.addEventListener('pointerleave', () => {
            if (!lockedOpen) setPeekVisible(false);
        });
        ui.topCardPreview.addEventListener('click', () => {
            lockedOpen = !lockedOpen;
            setPeekVisible(lockedOpen);
        });
    }

    window.addEventListener('resize', scheduleTableSizing);
    window.addEventListener('ui-scale:changed', () => {
        scheduleTableSizing();
        updateShoeVisual();
    });

    setTimeout(() => {
        updateShoeVisual();
        scheduleTableSizing();
    }, 100);
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

function getActiveCountingSystem() {
    const catalog = getCountingCatalog();
    return [...catalog.core, ...catalog.extras].find(system => system.id === state.countingSystem) || null;
}

function isBalancedSystem() {
    const system = getActiveCountingSystem();
    if (!system) return true;
    if (typeof system.balanced === 'boolean') return system.balanced;
    return true;
}

function resetSideCounts() {
    state.sideCounts = {};
}

function updateSideCounts(card) {
    const system = getActiveCountingSystem();
    if (!system || !Array.isArray(system.sideCounts)) return;
    if (!state.sideCounts) state.sideCounts = {};
    system.sideCounts.forEach(side => {
        const values = Array.isArray(side.values) ? side.values : [];
        if (values.includes(card.val)) {
            state.sideCounts[side.id] = (state.sideCounts[side.id] || 0) + 1;
        }
    });
}

function getSideCountText() {
    const system = getActiveCountingSystem();
    if (!system || !Array.isArray(system.sideCounts) || !system.sideCounts.length) return '';
    const parts = system.sideCounts.map(side => {
        const value = state.sideCounts && typeof state.sideCounts[side.id] === 'number'
            ? state.sideCounts[side.id]
            : 0;
        return `${side.name}: ${value}`;
    });
    return parts.length ? ` | ${parts.join(' • ')}` : '';
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
        case 'hi-opt-ii':
            if (['10', 'J', 'Q', 'K'].includes(card.val)) return -2;
            if (['4', '5'].includes(card.val)) return 2;
            if (['2', '3', '6', '7'].includes(card.val)) return 1;
            return 0;
        case 'ko':
            if (['10', 'J', 'Q', 'K', 'A'].includes(card.val)) return -1;
            if (['2', '3', '4', '5', '6', '7'].includes(card.val)) return 1;
            return 0;
        case 'red-7':
            if (['10', 'J', 'Q', 'K', 'A'].includes(card.val)) return -1;
            if (['2', '3', '4', '5', '6'].includes(card.val)) return 1;
            if (card.val === '7' && card.color === 'red') return 1;
            return 0;
        case 'hi-lo':
        default:
            return BlackjackLogic.getCardCount(card);
    }
}

function applyCount(card) {
    state.runningCount += getCardCountValue(card);
    updateSideCounts(card);
    updateStats();
}

function createShoe(msg) {
    // Allow shuffling from RESOLVING or BETTING phases, but prevent double trigger
    if (state.isShuffling) return;
    playSound('shuffle');

    state.shoe = [];
    state.runningCount = 0;
    resetSideCounts();
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

    // Show shuffling message for a moment, then finish
    setTimeout(() => {
        state.isShuffling = false;
        state.phase = 'BETTING';
        ui.overlay.classList.remove('show');
        updateShoeVisual(); // Show full stack
        updateGameFlow();
    }, getDelay(800));
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
    const sideText = getSideCountText();
    if (isBalancedSystem()) {
        ui.runCount.textContent = `${state.runningCount} (TC:${trueCount})${sideText}`;
    } else {
        ui.runCount.textContent = `RC:${state.runningCount}${sideText}`;
    }

    // Update shoe visualization
    updateShoeVisual();
}

function updateShoeVisual() {
    const cardStack = document.getElementById('card-stack');
    CommonUtils.updateShoeVisual(cardStack, state.shoe, state.isShuffling, state.deckCount, state.totalInitialCards);
    scheduleShoeFitCheck();
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
    markSessionDirty();
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
    markSessionDirty();
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
    markSessionDirty();
}

function startTimer() {
    const pace = getPaceProfile();
    const hasHumanSittingUnbet = state.players.some(p => p && !p.autoPlay);
    state.timerVal = hasHumanSittingUnbet ? pace.humanBetSeconds : pace.autoBetSeconds;

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
    }, pace.timerTickMs);
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
        resetSideCounts();

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
                applyCount(c);
                playSound('card');
            }
            renderDealer();
        } else {
            const p = state.players[action.idx];
            const c = drawCard(false, action.idx);
            if (c.isSplitCard) state.cutCardReached = true;

            applyCount(c);
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
        applyCount(state.dealer.hand[1]);
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
    applyCount(c);
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
    applyCount(c);
    playSound('card');
    h.cards.push(c);
    h.status = 'stand';

    ui.overlay.classList.remove('show');
    ui.strategyText.textContent = "";
    renderSeat(state.turnIndex);
    markSessionDirty();
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
    applyCount(cFirst);
    playSound('card');
    h.cards.push(cFirst);

    // The two `drawCard` animations for the split hand often merge visually.
    // This explicit `animateCardDraw` with a timeout creates a distinct
    // second animation, simulating two separate card throws.
    setTimeout( function() {
        animateCardDraw(false, state.turnIndex);
    }, 100);


    const cSecond = drawCard(false, state.turnIndex);
    applyCount(cSecond);
    playSound('card');
    newHand.cards.push(cSecond);

    renderSeat(state.turnIndex);
    updateStrategyHint();
    markSessionDirty();
    if (p.autoPlay) setTimeout(runAutoPlay, getDelay(500));
}

function dealerTurn() {
    state.phase = 'RESOLVING';
    state.turnIndex = -1;
    state.splitIndex = -1;

    const hole = state.dealer.hand[1];
    hole.hidden = false;
    applyCount(hole);
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
            applyCount(c);
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
    markSessionDirty();

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
    markSessionDirty();
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
    markSessionDirty();
}

/* --- HELPERS --- */

function getDelay(base) {
    const pace = getPaceProfile();
    const scaled = Math.round(base * pace.delayMultiplier);
    return Math.max(pace.minDelay, scaled);
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
    if (!isBalancedSystem()) {
        ui.countHint.textContent = `Unbalanced Count (RC:${state.runningCount})`;
        ui.countHint.className = "count-hint ch-neutral";
        return;
    }
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

function resetBlackjackStatistics() {
    state.casinoProfit = 0;
    state.playedRounds = 0;
    state.players.forEach((player) => {
        if (!player) return;
        player.profit = 0;
    });
    markSessionDirty();
    render();
    CommonUtils.showTableToast('Blackjack stats reset', {
        containerId: 'table',
        duration: 1500
    });
}

function closeSavePersonaOverlay() {
    pendingPersonaSaveSeat = null;
    if (!ui.personaSaveOverlay) return;
    ui.personaSaveOverlay.classList.remove('show');
    ui.personaSaveOverlay.setAttribute('aria-hidden', 'true');
}

function closeLoadPersonaOverlay() {
    pendingPersonaLoadSeat = null;
    if (!ui.personaLoadOverlay) return;
    ui.personaLoadOverlay.classList.remove('show');
    ui.personaLoadOverlay.setAttribute('aria-hidden', 'true');
}

function confirmSavePlayerPersona() {
    if (pendingPersonaSaveSeat === null) return;
    const player = state.players[pendingPersonaSaveSeat];
    if (!player) {
        closeSavePersonaOverlay();
        return;
    }
    const name = normalizePersonaName(ui.personaSaveName ? ui.personaSaveName.value : '');
    if (!name) {
        CommonUtils.showTableToast('Enter a player name first', {
            containerId: 'table',
            duration: 1300
        });
        if (ui.personaSaveName) ui.personaSaveName.focus();
        return;
    }

    const personas = loadSavedPersonas();
    const nextPersona = {
        name,
        chips: clampNumber(player.chips, 0, 0),
        lastBet: clampNumber(player.lastBet, state.minBet, state.minBet),
        autoPlay: !!player.autoPlay,
        autoBet: !!player.autoBet,
        countingBias: clampNumber(player.countingBias, 0.5, 0, 1),
        conservative: !!player.conservative,
        updatedAt: Date.now()
    };
    const sameNameIndex = personas.findIndex((persona) => normalizePersonaName(persona.name).toLowerCase() === name.toLowerCase());
    if (sameNameIndex >= 0) {
        personas[sameNameIndex] = nextPersona;
    } else {
        personas.push(nextPersona);
    }

    personas.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    saveSavedPersonas(personas.slice(0, MAX_BLACKJACK_PERSONAS));
    player.displayName = name;
    markSessionDirty();
    renderSeats();
    closeSavePersonaOverlay();
    CommonUtils.showTableToast(`Saved player: ${name}`, {
        containerId: 'table',
        duration: 1300
    });
}

function savePlayerPersona(idx) {
    const player = state.players[idx];
    if (!player || !ui.personaSaveOverlay || !ui.personaSaveName) return;
    pendingPersonaSaveSeat = idx;
    ui.personaSaveName.value = normalizePersonaName(player.displayName);
    ui.personaSaveOverlay.classList.add('show');
    ui.personaSaveOverlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
        ui.personaSaveName.focus();
        ui.personaSaveName.select();
    });
}

function loadPlayerPersona(idx) {
    if (state.players[idx] || !ui.personaLoadOverlay || !ui.personaLoadSelect) return;
    const personas = loadSavedPersonas();
    if (!personas.length) {
        CommonUtils.showTableToast('No saved players', {
            containerId: 'table',
            duration: 1200
        });
        return;
    }
    pendingPersonaLoadSeat = idx;
    ui.personaLoadSelect.innerHTML = personas.map((persona) => {
        const name = normalizePersonaName(persona.name);
        return `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`;
    }).join('');
    ui.personaLoadOverlay.classList.add('show');
    ui.personaLoadOverlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => ui.personaLoadSelect.focus());
}

function confirmLoadPlayerPersona() {
    if (pendingPersonaLoadSeat === null || state.players[pendingPersonaLoadSeat]) {
        closeLoadPersonaOverlay();
        return;
    }
    const selectedName = normalizePersonaName(ui.personaLoadSelect ? ui.personaLoadSelect.value : '');
    if (!selectedName) return;
    const personas = loadSavedPersonas();
    const persona = personas.find((entry) => normalizePersonaName(entry.name) === selectedName);
    if (!persona) return;
    sit(pendingPersonaLoadSeat, persona);
    closeLoadPersonaOverlay();
    CommonUtils.showTableToast(`Loaded player: ${normalizePersonaName(persona.name)}`, {
        containerId: 'table',
        duration: 1300
    });
}

function deleteSelectedPersona() {
    const selectedName = normalizePersonaName(ui.personaLoadSelect ? ui.personaLoadSelect.value : '');
    if (!selectedName) return;

    const personas = loadSavedPersonas();
    const next = personas.filter((entry) => normalizePersonaName(entry.name) !== selectedName);
    if (next.length === personas.length) return;

    saveSavedPersonas(next);
    CommonUtils.showTableToast(`Deleted player: ${selectedName}`, {
        containerId: 'table',
        duration: 1200
    });

    if (!ui.personaLoadSelect) return;
    if (!next.length) {
        closeLoadPersonaOverlay();
        renderSeats();
        return;
    }

    ui.personaLoadSelect.innerHTML = next.map((persona) => {
        const name = normalizePersonaName(persona.name);
        return `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`;
    }).join('');
    renderSeats();
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

function sit(idx, persona = null) {
    if (state.players[idx]) return;

    if (persona && typeof persona === 'object') {
        state.players[idx] = buildPlayerFromPersona(idx, persona);
        if (state.phase === 'BETTING') {
            updateGameFlow();
        } else {
            renderSeat(idx);
        }
        markSessionDirty();
        return;
    }

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
        displayName: '',
    };

    if (state.phase === 'BETTING') {
        updateGameFlow();
    } else {
        renderSeat(idx);
    }
    markSessionDirty();
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
        markSessionDirty();
    } else {
        // Safe to remove immediately
        state.players[idx] = null;
        if (state.phase === 'BETTING') {
            updateGameFlow();
        } else {
            renderSeats();
        }
        markSessionDirty();
    }
}

function renderSeat(idx) {
    const viewportSnapshot = captureViewportState();
    const el = document.getElementById(`seat-slot-${idx}`);
    if (!el) return;
    el.outerHTML = getSeatHTML(idx);
    scheduleTableSizing();
    restoreViewportStateForFrames(viewportSnapshot, 2);
}

function renderSeats() {
    const viewportSnapshot = captureViewportState();
    ui.seats.innerHTML = '';
    for (let i = 0; i < state.seatCount; i++) {
        ui.seats.innerHTML += getSeatHTML(i);
    }
    scheduleTableSizing();
    restoreViewportStateForFrames(viewportSnapshot, 2);
}

function render() {
    renderDealer();
    renderSeats();
    updateStats();
}

function getHandResultOverlayHTML(hand) {
    if (state.phase !== 'RESOLVING' || !hand || !hand.result) return '';

    let resClass = 'result-push';
    let contentHTML = '<span class="res-text">PUSH</span>';

    if (hand.result === 'win') {
        resClass = 'result-win';
        contentHTML = `<span class="res-profit">+$${hand.profit}</span>`;
    } else if (hand.result === 'lose') {
        resClass = 'result-lose';
        contentHTML = `<span class="res-profit">-$${hand.bet}</span>`;
    }

    return `
        <div class="hand-result ${resClass}">
            ${contentHTML}
        </div>
    `;
}

function getSeatHTML(idx) {
    const p = state.players[idx];

    if (!p) {
        return `
                    <div class="seat-slot" id="seat-slot-${idx}">
                        <div class="seat seat-empty" id="seat-${idx}">
                            <div class="seat-empty-label">Empty</div>
                            <div class="player-hand-area" aria-hidden="true"></div>
                            <div class="seat-controls">
                                <button class="btn-sit" onclick="sit(${idx})">Sit Down</button>
                            </div>
                        </div>
                        <div class="seat-automation">
                            <div class="persona-save-row">
                                <button class="btn-mini persona-btn persona-accent-btn" onclick="loadPlayerPersona(${idx})">Load Player</button>
                            </div>
                        </div>
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

    const displayName = getPlayerDisplayName(p, idx);
    const automationHTML = `
                <div class="seat-automation">
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
                    <div class="persona-save-row">
                        <button class="btn-mini persona-btn persona-accent-btn" onclick="savePlayerPersona(${idx})">Save Player</button>
                    </div>
                </div>
    `;

    // Betting Phase Controls
    if (state.phase === 'BETTING') {
        controlsHTML = `
                    <button class="btn-standup" onclick="standUp(${idx})">${p.pendingStandUp ? 'Cancel' : 'Stand Up'}</button>
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
                        <button class="btn-standup" onclick="standUp(${idx})">${p.pendingStandUp ? 'Cancel' : 'Stand Up'}</button>
                        <div class="controls">
                            <button class="action-btn btn-hit" onclick="playerHit()">H</button>
                            <button class="action-btn btn-stand" onclick="playerStand()">S</button>
                            <button class="action-btn btn-double" onclick="playerDouble()" ${p.chips < h.bet || h.cards.length !== 2 ? 'disabled' : ''}>D</button>
                            <button class="action-btn btn-split" onclick="playerSplit()" ${!canSplit ? 'disabled' : ''}>SP</button>
                        </div>
                    `;
        } else {
            controlsHTML = `<button class="btn-standup" onclick="standUp(${idx})">${p.pendingStandUp ? 'Cancel' : 'Stand Up'}</button>`;
        }
    } else {
        controlsHTML = `<button class="btn-standup" onclick="standUp(${idx})">${p.pendingStandUp ? 'Cancel' : 'Stand Up'}</button>`;
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
                <div class="seat-slot" id="seat-slot-${idx}">
                    <div class="seat ${classList}" id="seat-${idx}">
                        <div class="seat-info">
                            <span>${escapeHTML(displayName)} ${p.autoPlay && !p.pendingStandUp ? '(Bot)' : ''}</span>
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
                    const resultHTML = getHandResultOverlayHTML(h);

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
                const resultHTML = getHandResultOverlayHTML(h);

                html = `
                                    <div class="cards seat-main-cards">
                                        ${h.cards.map(c => createCardEl(c).outerHTML).join('')}
                                        ${resultHTML}
                                    </div>
                                `;
            }
            return html;
        })()}

                            ${betAmount > 0 ? `<div class="bet-bubble">Bet: $${betAmount}</div>` : ''}
                        </div>

                        <div class="seat-controls">
                            ${controlsHTML}
                        </div>
                    </div>
                    ${automationHTML}
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
    markSessionDirty();
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
    markSessionDirty();
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
    markSessionDirty();
});

if (ui.resetStats) {
    ui.resetStats.addEventListener('click', () => {
        resetBlackjackStatistics();
    });
}

if (ui.personaSaveConfirm) {
    ui.personaSaveConfirm.addEventListener('click', confirmSavePlayerPersona);
}

if (ui.personaSaveCancel) {
    ui.personaSaveCancel.addEventListener('click', closeSavePersonaOverlay);
}

if (ui.personaSaveOverlay) {
    ui.personaSaveOverlay.addEventListener('click', (event) => {
        if (event.target === ui.personaSaveOverlay) {
            closeSavePersonaOverlay();
        }
    });
}

if (ui.personaSaveName) {
    ui.personaSaveName.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            confirmSavePlayerPersona();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            closeSavePersonaOverlay();
        }
    });
}

if (ui.personaLoadConfirm) {
    ui.personaLoadConfirm.addEventListener('click', confirmLoadPlayerPersona);
}

if (ui.personaLoadDelete) {
    ui.personaLoadDelete.addEventListener('click', deleteSelectedPersona);
}

if (ui.personaLoadCancel) {
    ui.personaLoadCancel.addEventListener('click', closeLoadPersonaOverlay);
}

if (ui.personaLoadOverlay) {
    ui.personaLoadOverlay.addEventListener('click', (event) => {
        if (event.target === ui.personaLoadOverlay) {
            closeLoadPersonaOverlay();
        }
    });
}

if (ui.personaLoadSelect) {
    ui.personaLoadSelect.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            confirmLoadPlayerPersona();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            closeLoadPersonaOverlay();
        }
    });
}


// Start
const handleFirstInteraction = (event) => {
    init();
    // Clean up all listeners so it doesn't fire again
    window.removeEventListener('click', handleFirstInteraction);
    window.removeEventListener('keydown', handleFirstInteraction);
    window.removeEventListener('touchstart', handleFirstInteraction);

};

window.addEventListener('click', handleFirstInteraction);
window.addEventListener('keydown', handleFirstInteraction);
window.addEventListener('touchstart', handleFirstInteraction);
