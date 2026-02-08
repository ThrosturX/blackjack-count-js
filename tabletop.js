/*
 * Table Top sandbox controller
 */

const TABLETOP_DEFAULT_DECKS = 1;
const TABLETOP_MAX_DECKS = 8;
const TABLETOP_DRAG_THRESHOLD = 5;

const tabletopState = {
    deck: [],
    discard: [],
    tableau: [],
    nextZ: 1,
    deckCount: TABLETOP_DEFAULT_DECKS
};

const tabletopDrag = {
    active: false,
    source: null,
    card: null,
    entry: null,
    dragEl: null,
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    offsetX: 0,
    offsetY: 0,
    moved: false,
    lastLeft: 0,
    lastTop: 0
};

const tabletopSoundFiles = {
    card: ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav'],
    shuffle: ['shuffle.wav']
};

let nextTabletopCardId = 1;

document.addEventListener('DOMContentLoaded', () => {
    CommonUtils.preloadAudio(tabletopSoundFiles);
    setupTabletopEventListeners();
    initTabletop();
});

function setupTabletopEventListeners() {
    const newGameBtn = document.getElementById('tabletop-new-game');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', initTabletop);
    }

    const shuffleBtn = document.getElementById('tabletop-shuffle');
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', shuffleDeck);
    }

    const deckSelect = document.getElementById('tabletop-deck-count');
    if (deckSelect) {
        deckSelect.addEventListener('change', () => {
            tabletopState.deckCount = clampDeckCount(parseInt(deckSelect.value, 10));
        });
    }

    const deckEl = document.getElementById('tabletop-deck');
    if (deckEl) {
        deckEl.addEventListener('pointerdown', handleDeckPointerDown);
    }

    document.getElementById('toggle-settings').addEventListener('click', () => {
        const settingsArea = document.getElementById('settings-area');
        const btn = document.getElementById('toggle-settings');
        settingsArea.classList.toggle('collapsed');
        btn.classList.toggle('active');
    });

    const addonsArea = document.getElementById('addons-area');
    const addonsBtn = document.getElementById('toggle-addons');
    addonsBtn.addEventListener('click', () => {
        addonsArea.classList.toggle('collapsed');
        addonsBtn.classList.toggle('active');
    });
    addonsBtn.classList.toggle('active', !addonsArea.classList.contains('collapsed'));

    document.getElementById('toggle-themes').addEventListener('click', () => {
        const themeArea = document.getElementById('theme-area');
        const btn = document.getElementById('toggle-themes');
        themeArea.classList.toggle('collapsed');
        btn.classList.toggle('active');
    });

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

    const deckStyleSelect = document.getElementById('deck-style-select');
    if (deckStyleSelect) {
        deckStyleSelect.addEventListener('change', applyDeckStyle);
        applyDeckStyle();
    }

    if (window.AddonLoader && window.AddonLoader.ready) {
        window.AddonLoader.ready.then(scheduleThemeSync);
    } else {
        scheduleThemeSync();
    }
    window.addEventListener('addons:changed', scheduleThemeSync);
}

function clampDeckCount(value) {
    if (Number.isNaN(value)) return TABLETOP_DEFAULT_DECKS;
    return Math.min(TABLETOP_MAX_DECKS, Math.max(1, value));
}

function initTabletop() {
    const deckSelect = document.getElementById('tabletop-deck-count');
    const selected = deckSelect ? parseInt(deckSelect.value, 10) : TABLETOP_DEFAULT_DECKS;
    tabletopState.deckCount = clampDeckCount(selected);

    tabletopState.deck = buildDeck(tabletopState.deckCount);
    tabletopState.discard = [];
    tabletopState.tableau = [];
    tabletopState.nextZ = 1;

    updateTabletopUI();
    CommonUtils.playSound('shuffle');
}

function buildDeck(deckCount) {
    const deck = CommonUtils.createShoe(deckCount, SUITS, VALUES);
    deck.forEach(card => {
        card.id = `tt-${nextTabletopCardId++}`;
        card.hidden = true;
    });
    return deck;
}

function shuffleDeck() {
    if (tabletopState.deck.length < 2) return;
    for (let i = tabletopState.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tabletopState.deck[i], tabletopState.deck[j]] = [tabletopState.deck[j], tabletopState.deck[i]];
    }
    updateTabletopUI();
    CommonUtils.playSound('shuffle');
}

function updateTabletopUI() {
    renderDeck();
    renderDiscard();
    renderTableau();
    updateTabletopStats();
}

function renderDeck() {
    const surface = document.getElementById('tabletop-deck-surface');
    if (!surface) return;
    surface.innerHTML = '';

    if (tabletopState.deck.length > 0) {
        const cardBack = document.createElement('div');
        cardBack.className = 'card hidden';
        surface.appendChild(cardBack);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'pile-placeholder';
        placeholder.textContent = 'Empty';
        surface.appendChild(placeholder);
    }
}

function renderDiscard() {
    const surface = document.getElementById('tabletop-discard-surface');
    if (!surface) return;
    surface.innerHTML = '';

    if (tabletopState.discard.length > 0) {
        const topCard = tabletopState.discard[tabletopState.discard.length - 1];
        const cardEl = CommonUtils.createCardEl(topCard);
        cardEl.classList.add('tabletop-card');
        cardEl.dataset.cardId = topCard.id;
        cardEl.addEventListener('pointerdown', handleDiscardPointerDown);
        cardEl.style.cursor = 'grab';
        surface.appendChild(cardEl);
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'pile-placeholder';
        placeholder.textContent = 'Empty';
        surface.appendChild(placeholder);
    }
}

function renderTableau() {
    const tableauEl = document.getElementById('tabletop-tableau');
    if (!tableauEl) return;
    tableauEl.innerHTML = '';

    const entries = [...tabletopState.tableau].sort((a, b) => a.z - b.z);
    entries.forEach(entry => {
        const cardEl = CommonUtils.createCardEl(entry.card);
        cardEl.classList.add('tabletop-card');
        cardEl.dataset.cardId = entry.card.id;
        cardEl.style.left = `${entry.x}px`;
        cardEl.style.top = `${entry.y}px`;
        cardEl.style.zIndex = entry.z;
        cardEl.addEventListener('pointerdown', handleTableauPointerDown);
        cardEl.addEventListener('contextmenu', handleTableauContextMenu);
        tableauEl.appendChild(cardEl);
    });
}

function updateTabletopStats() {
    const deckCount = document.getElementById('tabletop-deck-remaining');
    const deckCountInline = document.getElementById('tabletop-deck-remaining-inline');
    const discardCount = document.getElementById('tabletop-discard-count');
    const discardCountInline = document.getElementById('tabletop-discard-count-inline');
    const tableauCount = document.getElementById('tabletop-tableau-count');

    if (deckCount) deckCount.textContent = tabletopState.deck.length;
    if (deckCountInline) deckCountInline.textContent = tabletopState.deck.length;
    if (discardCount) discardCount.textContent = tabletopState.discard.length;
    if (discardCountInline) discardCountInline.textContent = tabletopState.discard.length;
    if (tableauCount) tableauCount.textContent = tabletopState.tableau.length;
}

function handleTableauPointerDown(event) {
    if (!canStartPointer(event)) return;
    event.preventDefault();
    const cardId = event.currentTarget.dataset.cardId;
    const entry = findTableauEntry(cardId);
    if (!entry) return;

    entry.z = ++tabletopState.nextZ;
    startDrag({
        source: 'tableau',
        card: entry.card,
        entry,
        dragEl: event.currentTarget,
        event
    });
}

function handleDiscardPointerDown(event) {
    if (!canStartPointer(event)) return;
    event.preventDefault();
    if (!tabletopState.discard.length) return;
    const card = tabletopState.discard.pop();
    renderDiscard();
    updateTabletopStats();
    startDrag({
        source: 'discard',
        card,
        entry: null,
        dragEl: createDragElement(card),
        event
    });
}

function handleDeckPointerDown(event) {
    if (!canStartPointer(event)) return;
    event.preventDefault();
    if (!tabletopState.deck.length) return;
    const card = tabletopState.deck[tabletopState.deck.length - 1];
    startDrag({
        source: 'deck',
        card,
        entry: null,
        dragEl: createDragElement(card),
        event
    });
}

function handleTableauContextMenu(event) {
    event.preventDefault();
    const cardId = event.currentTarget.dataset.cardId;
    const entry = findTableauEntry(cardId);
    if (!entry) return;
    const current = typeof entry.card.rotation === 'number' ? entry.card.rotation : 0;
    const input = window.prompt('Rotate card to degrees:', `${current}`);
    if (input === null) return;
    const value = parseFloat(input);
    if (Number.isNaN(value)) return;
    entry.card.rotation = value;
    renderTableau();
}

function canStartPointer(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return false;
    if (tabletopDrag.active) return false;
    return true;
}

function startDrag({ source, card, entry, dragEl, event }) {
    const tableauEl = document.getElementById('tabletop-tableau');
    if (!tableauEl) return;

    tabletopDrag.active = true;
    tabletopDrag.source = source;
    tabletopDrag.card = card;
    tabletopDrag.entry = entry;
    tabletopDrag.dragEl = dragEl;
    tabletopDrag.pointerId = event.pointerId;
    tabletopDrag.startClientX = event.clientX;
    tabletopDrag.startClientY = event.clientY;
    tabletopDrag.moved = false;

    if (!dragEl.parentNode) {
        tableauEl.appendChild(dragEl);
    }

    dragEl.classList.add('tabletop-dragging');
    if (source === 'tableau' && entry) {
        dragEl.style.zIndex = entry.z;
    } else {
        dragEl.style.zIndex = ++tabletopState.nextZ;
    }

    const rect = dragEl.getBoundingClientRect();
    if (source === 'tableau') {
        tabletopDrag.offsetX = event.clientX - rect.left;
        tabletopDrag.offsetY = event.clientY - rect.top;
    } else {
        tabletopDrag.offsetX = rect.width / 2;
        tabletopDrag.offsetY = rect.height / 2;
    }

    tabletopDrag.lastLeft = entry ? entry.x : 0;
    tabletopDrag.lastTop = entry ? entry.y : 0;

    if (source !== 'tableau') {
        positionDraggedCard(event.clientX, event.clientY);
    }

    dragEl.setPointerCapture(event.pointerId);
    document.addEventListener('pointermove', handleDragMove);
    document.addEventListener('pointerup', handleDragEnd, { once: true });
    document.addEventListener('pointercancel', handleDragEnd, { once: true });
}

function handleDragMove(event) {
    if (!tabletopDrag.active || event.pointerId !== tabletopDrag.pointerId) return;
    const dx = event.clientX - tabletopDrag.startClientX;
    const dy = event.clientY - tabletopDrag.startClientY;
    if (!tabletopDrag.moved && Math.hypot(dx, dy) < TABLETOP_DRAG_THRESHOLD) return;

    tabletopDrag.moved = true;
    positionDraggedCard(event.clientX, event.clientY);
}

function handleDragEnd(event) {
    if (!tabletopDrag.active || event.pointerId !== tabletopDrag.pointerId) return;

    const dropX = event.clientX;
    const dropY = event.clientY;

    const tableauRect = getRectById('tabletop-tableau');
    const discardRect = getRectById('tabletop-discard');

    const inDiscard = discardRect ? isPointInRect(dropX, dropY, discardRect) : false;
    const inTableau = tableauRect ? isPointInRect(dropX, dropY, tableauRect) : false;

    const wasMoved = tabletopDrag.moved;

    if (tabletopDrag.source === 'tableau') {
        if (!wasMoved) {
            if (inTableau) {
                tabletopDrag.entry.card.hidden = !tabletopDrag.entry.card.hidden;
                CommonUtils.playSound('card');
            } else {
                moveTableauToDeck(tabletopDrag.entry);
            }
        } else if (inDiscard) {
            moveTableauToDiscard(tabletopDrag.entry);
        } else if (inTableau) {
            tabletopDrag.entry.x = tabletopDrag.lastLeft;
            tabletopDrag.entry.y = tabletopDrag.lastTop;
        } else {
            moveTableauToDeck(tabletopDrag.entry);
        }
    } else if (tabletopDrag.source === 'deck') {
        if (wasMoved && inDiscard) {
            drawDeckCardToDiscard();
        } else if (wasMoved && inTableau) {
            drawDeckCardToTableau(tabletopDrag.lastLeft, tabletopDrag.lastTop);
        }
    } else if (tabletopDrag.source === 'discard') {
        if (inDiscard) {
            tabletopState.discard.push(tabletopDrag.card);
        } else if (inTableau) {
            addCardToTableau(tabletopDrag.card, tabletopDrag.lastLeft, tabletopDrag.lastTop);
        } else {
            sendCardToDeckBottom(tabletopDrag.card);
        }
    }

    cleanupDrag(event.pointerId);
    updateTabletopUI();
}

function cleanupDrag(pointerId) {
    if (tabletopDrag.dragEl && tabletopDrag.dragEl.releasePointerCapture) {
        tabletopDrag.dragEl.releasePointerCapture(pointerId);
    }
    if (tabletopDrag.dragEl) {
        tabletopDrag.dragEl.classList.remove('tabletop-dragging');
    }
    document.removeEventListener('pointermove', handleDragMove);
    tabletopDrag.active = false;
    tabletopDrag.source = null;
    tabletopDrag.card = null;
    tabletopDrag.entry = null;
    tabletopDrag.dragEl = null;
    tabletopDrag.pointerId = null;
    tabletopDrag.moved = false;
}

function positionDraggedCard(clientX, clientY) {
    const tableauRect = getRectById('tabletop-tableau');
    if (!tableauRect || !tabletopDrag.dragEl) return;
    const left = clientX - tableauRect.left - tabletopDrag.offsetX;
    const top = clientY - tableauRect.top - tabletopDrag.offsetY;
    tabletopDrag.dragEl.style.left = `${left}px`;
    tabletopDrag.dragEl.style.top = `${top}px`;
    tabletopDrag.lastLeft = left;
    tabletopDrag.lastTop = top;
}

function drawDeckCardToTableau(x, y) {
    if (!tabletopState.deck.length) return;
    const card = tabletopState.deck.pop();
    card.hidden = true;
    addCardToTableau(card, x, y);
}

function drawDeckCardToDiscard() {
    if (!tabletopState.deck.length) return;
    const card = tabletopState.deck.pop();
    card.hidden = true;
    tabletopState.discard.push(card);
}

function addCardToTableau(card, x, y) {
    tabletopState.tableau.push({
        card,
        x,
        y,
        z: ++tabletopState.nextZ
    });
}

function moveTableauToDiscard(entry) {
    const index = tabletopState.tableau.indexOf(entry);
    if (index !== -1) {
        tabletopState.tableau.splice(index, 1);
    }
    tabletopState.discard.push(entry.card);
}

function moveTableauToDeck(entry) {
    const index = tabletopState.tableau.indexOf(entry);
    if (index !== -1) {
        tabletopState.tableau.splice(index, 1);
    }
    sendCardToDeckBottom(entry.card);
}

function sendCardToDeckBottom(card) {
    card.hidden = true;
    tabletopState.deck.unshift(card);
}

function findTableauEntry(cardId) {
    return tabletopState.tableau.find(entry => entry.card.id === cardId);
}

function createDragElement(card) {
    const dragEl = CommonUtils.createCardEl(card);
    dragEl.classList.add('tabletop-card');
    dragEl.style.left = '0px';
    dragEl.style.top = '0px';
    return dragEl;
}

function getRectById(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    return el.getBoundingClientRect();
}

function isPointInRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
