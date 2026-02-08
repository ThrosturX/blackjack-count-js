/*
 * Table Top sandbox controller
 */

const TABLETOP_DEFAULT_DECKS = 1;
const TABLETOP_DEFAULT_GROUPS = 1;
const TABLETOP_DEFAULT_PILES = 0;
const TABLETOP_DEFAULT_FOUNDATIONS = 1;
const TABLETOP_MAX_DECKS = 8;
const TABLETOP_MAX_GROUPS = 8;
const TABLETOP_MAX_PILES = 6;
const TABLETOP_MAX_FOUNDATIONS = 6;
const TABLETOP_DRAG_THRESHOLD = 5;
const TABLETOP_SNAP_RADIUS = 120;
const CARD_SCALE_STORAGE_KEY = 'bj_table.card_scale';

const tabletopState = {
    deckGroups: [],
    piles: [],
    foundations: [],
    discard: [],
    tableau: [],
    nextZ: 1,
    deckCount: TABLETOP_DEFAULT_DECKS,
    deckGroupsCount: TABLETOP_DEFAULT_GROUPS,
    pileCount: TABLETOP_DEFAULT_PILES,
    foundationCount: TABLETOP_DEFAULT_FOUNDATIONS
};

const tabletopDrag = {
    active: false,
    sourceType: null,
    sourceIndex: null,
    card: null,
    entry: null,
    groupEntries: null,
    dragEls: [],
    groupOffsets: [],
    dragEl: null,
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    offsetX: 0,
    offsetY: 0,
    moved: false,
    lastLeft: 0,
    lastTop: 0,
    startFromStackCard: false,
    cardWasPopped: false
};

const tabletopRotate = {
    active: false,
    pointerId: null,
    entry: null,
    targetEl: null,
    startAngle: 0,
    startRotation: 0,
    centerX: 0,
    centerY: 0
};

const tabletopSoundFiles = {
    card: ['card1.wav', 'card2.wav', 'card3.wav', 'card4.wav'],
    shuffle: ['shuffle.wav']
};

let nextTabletopCardId = 1;
let stackMenuEl = null;

document.addEventListener('DOMContentLoaded', () => {
    CommonUtils.preloadAudio(tabletopSoundFiles);
    setupTabletopEventListeners();
    initCardScale();
    initTabletop();
});

function setupTabletopEventListeners() {
    const newGameBtn = document.getElementById('tabletop-new-game');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', initTabletop);
    }

    const shuffleBtn = document.getElementById('tabletop-shuffle');
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', shuffleAllDeckGroups);
    }

    const deckSelect = document.getElementById('tabletop-deck-count');
    const groupSelect = document.getElementById('tabletop-deck-groups');
    const pileSelect = document.getElementById('tabletop-pile-count');
    const foundationSelect = document.getElementById('tabletop-foundation-count');
    const onConfigChange = () => {
        if (hasCardsInPlay()) {
            CommonUtils.showTableToast('New setup created for updated configuration.', { variant: 'warn' });
        }
        initTabletop();
    };
    if (deckSelect) deckSelect.addEventListener('change', onConfigChange);
    if (groupSelect) groupSelect.addEventListener('change', onConfigChange);
    if (pileSelect) pileSelect.addEventListener('change', onConfigChange);
    if (foundationSelect) foundationSelect.addEventListener('change', onConfigChange);

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

function initCardScale() {
    const input = document.getElementById('tabletop-card-scale');
    const output = document.getElementById('tabletop-card-scale-value');
    if (!input) return;
    let stored = NaN;
    try {
        stored = parseFloat(localStorage.getItem(CARD_SCALE_STORAGE_KEY));
    } catch (err) {
        stored = NaN;
    }
    const initial = Number.isFinite(stored) ? stored : parseFloat(input.value);
    applyCardScale(initial, output, input);

    input.addEventListener('input', () => {
        const value = parseFloat(input.value);
        applyCardScale(value, output, input);
    });
}

function applyCardScale(value, outputEl, inputEl) {
    const scale = clampNumber(value, 0.6, 3, 1);
    document.documentElement.style.setProperty('--card-scale', scale);
    if (outputEl) outputEl.textContent = `${Math.round(scale * 100)}%`;
    if (inputEl && String(inputEl.value) !== String(scale)) inputEl.value = scale;
    try {
        localStorage.setItem(CARD_SCALE_STORAGE_KEY, String(scale));
    } catch (err) {
        // Ignore storage failures.
    }
}

function clampNumber(value, min, max, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
}

function clampDeckCount(value) {
    return clampNumber(value, 1, TABLETOP_MAX_DECKS, TABLETOP_DEFAULT_DECKS);
}

function clampGroupCount(value) {
    return clampNumber(value, 1, TABLETOP_MAX_GROUPS, TABLETOP_DEFAULT_GROUPS);
}

function clampPileCount(value) {
    return clampNumber(value, 0, TABLETOP_MAX_PILES, TABLETOP_DEFAULT_PILES);
}

function clampFoundationCount(value) {
    return clampNumber(value, 1, TABLETOP_MAX_FOUNDATIONS, TABLETOP_DEFAULT_FOUNDATIONS);
}

function initTabletop() {
    const deckSelect = document.getElementById('tabletop-deck-count');
    const groupSelect = document.getElementById('tabletop-deck-groups');
    const pileSelect = document.getElementById('tabletop-pile-count');
    const foundationSelect = document.getElementById('tabletop-foundation-count');

    tabletopState.deckCount = clampDeckCount(deckSelect ? parseInt(deckSelect.value, 10) : TABLETOP_DEFAULT_DECKS);
    tabletopState.deckGroupsCount = clampGroupCount(groupSelect ? parseInt(groupSelect.value, 10) : TABLETOP_DEFAULT_GROUPS);
    tabletopState.pileCount = clampPileCount(pileSelect ? parseInt(pileSelect.value, 10) : TABLETOP_DEFAULT_PILES);
    tabletopState.foundationCount = clampFoundationCount(foundationSelect ? parseInt(foundationSelect.value, 10) : TABLETOP_DEFAULT_FOUNDATIONS);

    tabletopState.deckGroups = buildDeckGroups(tabletopState.deckCount, tabletopState.deckGroupsCount);
    tabletopState.piles = Array.from({ length: tabletopState.pileCount }, () => []);
    tabletopState.foundations = Array.from({ length: tabletopState.foundationCount }, () => []);
    tabletopState.discard = [];
    tabletopState.tableau = [];
    tabletopState.nextZ = 1;

    updateTabletopUI();
    CommonUtils.playSound('shuffle');
}

function buildDeckGroups(deckCount, groupCount) {
    const deck = CommonUtils.createShoe(deckCount, SUITS, VALUES);
    deck.forEach(card => {
        card.id = `tt-${nextTabletopCardId++}`;
        card.hidden = true;
    });

    const groups = Array.from({ length: groupCount }, () => []);
    const baseSize = Math.floor(deck.length / groupCount);
    const remainder = deck.length % groupCount;
    let index = 0;
    for (let g = 0; g < groupCount; g++) {
        const size = baseSize + (g < remainder ? 1 : 0);
        groups[g] = deck.slice(index, index + size);
        index += size;
    }
    return groups;
}

function shuffleAllDeckGroups() {
    let shuffled = false;
    tabletopState.deckGroups.forEach(stack => {
        if (stack.length > 1) {
            shuffleStack(stack);
            shuffled = true;
        }
    });
    if (shuffled) {
        updateTabletopUI();
        CommonUtils.playSound('shuffle');
    }
}

function shuffleStack(stack) {
    tidyStack(stack);
    for (let i = stack.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [stack[i], stack[j]] = [stack[j], stack[i]];
    }
}

function tidyStack(stack) {
    stack.forEach(card => {
        card.hidden = true;
        card.rotation = getTidyRotation();
    });
}

function flipStack(stack) {
    if (!stack.length) return;
    const wasHidden = stack[stack.length - 1].hidden;
    stack.reverse();
    const nextHidden = !wasHidden;
    stack.forEach(card => {
        card.hidden = nextHidden;
    });
}

function getTidyRotation() {
    return Math.floor(Math.random() * 7) - 3;
}

function resetCardForDeck(card) {
    card.hidden = true;
    if (typeof getRandomRotation === 'function') {
        card.rotation = getRandomRotation();
    } else {
        card.rotation = getTidyRotation();
    }
}

function updateTabletopUI() {
    renderStackAreas();
    renderTableau();
    updateTabletopStats();
}

function renderStackAreas() {
    renderStackArea('tabletop-deck-area', [
        ...tabletopState.deckGroups.map((stack, index) => ({
            stack,
            type: 'deck',
            index,
            showAll: false,
            showLabel: false
        })),
        {
            stack: tabletopState.discard,
            type: 'discard',
            index: 0,
            showAll: true,
            showLabel: true,
            label: 'Discard'
        }
    ]);
    renderStackArea('tabletop-pile-area', tabletopState.piles.map((stack, index) => ({
        stack,
        type: 'pile',
        index,
        showAll: true,
        showLabel: false
    })));
    renderStackArea('tabletop-foundation-area', tabletopState.foundations.map((stack, index) => ({
        stack,
        type: 'foundation',
        index,
        showAll: true,
        showLabel: false
    })));
}

function renderStackArea(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    items.forEach((item) => {
        const { stack, type, index, showAll, showLabel } = item;
        const pile = document.createElement('div');
        pile.className = 'tabletop-pile pile';
        pile.dataset.stackType = type;
        pile.dataset.stackIndex = index;

        const count = document.createElement('span');
        count.className = 'pile-count';
        count.textContent = stack.length;
        if (type === 'deck') {
            count.style.cursor = 'pointer';
            count.title = 'Deal';
            count.addEventListener('click', (event) => {
                event.stopPropagation();
                if (stack.length === 0) return;
                dealDeckGroupToCenter(index);
                updateTabletopUI();
            });
        }

        const surface = document.createElement('div');
        surface.className = 'pile-surface';
        surface.dataset.stackType = type;
        surface.dataset.stackIndex = index;
        surface.addEventListener('pointerdown', handleStackPointerDown);
        surface.addEventListener('contextmenu', handleStackContextMenu);

        if (showLabel) {
            const label = document.createElement('span');
            label.className = 'pile-label';
            label.textContent = item.label || getStackLabel(type, index);
            pile.appendChild(label);
        }

        if (stack.length > 0) {
            const cardsToRender = showAll ? stack : [stack[stack.length - 1]];
            const { w, h } = getCardDimensions();
            const offsetStepX = Math.max(2, Math.round(w * 0.04));
            const offsetStepY = Math.max(2, Math.round(h * 0.04));
            cardsToRender.forEach((card, cardIndex) => {
                const cardEl = CommonUtils.createCardEl(card);
                cardEl.classList.add('tabletop-card');
                cardEl.dataset.cardId = card.id;
                cardEl.style.cursor = 'grab';
                const offsetIndex = showAll ? cardIndex : 0;
                const offsetX = Math.min(18, offsetIndex * offsetStepX);
                const offsetY = Math.min(18, offsetIndex * offsetStepY);
                cardEl.style.left = `${offsetX}px`;
                cardEl.style.top = `${offsetY}px`;
                cardEl.style.zIndex = cardIndex + 1;
                if (cardIndex === cardsToRender.length - 1) {
                    cardEl.addEventListener('pointerdown', handleStackCardPointerDown);
                }
                surface.appendChild(cardEl);
            });
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'pile-placeholder';
            placeholder.textContent = 'Empty';
            surface.appendChild(placeholder);
        }

        pile.append(count, surface);
        container.appendChild(pile);
    });
}

function getStackLabel(type, index) {
    if (type === 'deck') return `Deck ${index + 1}`;
    if (type === 'pile') return `Center Pile ${index + 1}`;
    if (type === 'foundation') return `Foundation ${index + 1}`;
    if (type === 'discard') return 'Discard';
    return `Stack ${index + 1}`;
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
        cardEl.addEventListener('pointerdown', handleTableauRotateStart);
        cardEl.addEventListener('contextmenu', event => event.preventDefault());
        tableauEl.appendChild(cardEl);
    });
}

function updateTabletopStats() {
    const deckCount = document.getElementById('tabletop-deck-remaining');
    const foundationCount = document.getElementById('tabletop-foundation-count-display');
    const tableauCount = document.getElementById('tabletop-tableau-count');

    if (deckCount) deckCount.textContent = sumStacks(tabletopState.deckGroups);
    if (foundationCount) foundationCount.textContent = sumStacks(tabletopState.foundations);
    if (tableauCount) tableauCount.textContent = tabletopState.tableau.length;
}

function sumStacks(stacks) {
    return stacks.reduce((sum, stack) => sum + stack.length, 0);
}

function hasCardsInPlay() {
    return tabletopState.tableau.length > 0
        || sumStacks(tabletopState.deckGroups) === 0
        || sumStacks(tabletopState.piles) > 0
        || sumStacks(tabletopState.foundations) > 0
        || tabletopState.discard.length > 0;
}

function handleStackPointerDown(event) {
    if (!canStartPointer(event)) return;
    event.preventDefault();
    if (event.target.closest('.card')) return;

    const type = event.currentTarget.dataset.stackType;
    const index = parseInt(event.currentTarget.dataset.stackIndex, 10);
    const stack = getStack(type, index);
    if (!stack || stack.length === 0) return;

    if (type === 'deck') {
        const card = stack[stack.length - 1];
        startDrag({
            sourceType: type,
            sourceIndex: index,
            card,
            entry: null,
            dragEl: createDragElement(card),
            event
        });
    } else {
        const card = stack.pop();
        renderStackAreas();
        updateTabletopStats();
        startDrag({
            sourceType: type,
            sourceIndex: index,
            card,
            entry: null,
            dragEl: createDragElement(card),
            event,
            startFromStackCard: false,
            cardWasPopped: true
        });
    }
}

function handleStackCardPointerDown(event) {
    if (!canStartPointer(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const surface = event.currentTarget.closest('.pile-surface');
    if (!surface) return;
    const type = surface.dataset.stackType;
    const index = parseInt(surface.dataset.stackIndex, 10);
    const stack = getStack(type, index);
    if (!stack || stack.length === 0) return;

    if (type === 'deck') {
        const card = stack[stack.length - 1];
        startDrag({
            sourceType: type,
            sourceIndex: index,
            card,
            entry: null,
            dragEl: createDragElement(card),
            event,
            startFromStackCard: true,
            cardWasPopped: false
        });
    } else {
        const card = stack.pop();
        renderStackAreas();
        updateTabletopStats();
        startDrag({
            sourceType: type,
            sourceIndex: index,
            card,
            entry: null,
            dragEl: createDragElement(card),
            event,
            startFromStackCard: true,
            cardWasPopped: true
        });
    }
}

function toggleTopCard(type, index) {
    const stack = getStack(type, index);
    if (!stack || stack.length === 0) return;
    const topCard = stack[stack.length - 1];
    topCard.hidden = !topCard.hidden;
    updateTabletopUI();
}

function handleStackContextMenu(event) {
    if (tabletopDrag.active || tabletopRotate.active) return;
    event.preventDefault();
    event.stopPropagation();
    const type = event.currentTarget.dataset.stackType;
    const index = parseInt(event.currentTarget.dataset.stackIndex, 10);
    openStackMenu(event.clientX, event.clientY, type, index);
}

function handleTableauPointerDown(event) {
    if (!canStartPointer(event)) return;
    event.preventDefault();
    const cardId = event.currentTarget.dataset.cardId;
    const entry = findTableauEntry(cardId);
    if (!entry) return;

    entry.z = ++tabletopState.nextZ;
    const groupEntries = event.shiftKey ? getStackGroup(entry) : null;
    startDrag({
        sourceType: 'tableau',
        sourceIndex: null,
        card: entry.card,
        entry,
        groupEntries,
        dragEl: event.currentTarget,
        event
    });
}

function handleTableauRotateStart(event) {
    if (event.button !== 2) return;
    event.preventDefault();
    event.stopPropagation();
    if (tabletopRotate.active || tabletopDrag.active) return;

    const cardId = event.currentTarget.dataset.cardId;
    const entry = findTableauEntry(cardId);
    if (!entry) return;

    const rect = event.currentTarget.getBoundingClientRect();
    tabletopRotate.centerX = rect.left + rect.width / 2;
    tabletopRotate.centerY = rect.top + rect.height / 2;
    tabletopRotate.startAngle = Math.atan2(event.clientY - tabletopRotate.centerY, event.clientX - tabletopRotate.centerX) * 180 / Math.PI;
    tabletopRotate.startRotation = typeof entry.card.rotation === 'number' ? entry.card.rotation : 0;
    tabletopRotate.pointerId = event.pointerId;
    tabletopRotate.entry = entry;
    tabletopRotate.targetEl = event.currentTarget;
    tabletopRotate.active = true;

    event.currentTarget.setPointerCapture(event.pointerId);
    document.addEventListener('pointermove', handleRotateMove);
    document.addEventListener('pointerup', handleRotateEnd, { once: true });
    document.addEventListener('pointercancel', handleRotateEnd, { once: true });
}

function handleRotateMove(event) {
    if (!tabletopRotate.active || event.pointerId !== tabletopRotate.pointerId) return;
    const angle = Math.atan2(event.clientY - tabletopRotate.centerY, event.clientX - tabletopRotate.centerX) * 180 / Math.PI;
    const delta = angle - tabletopRotate.startAngle;
    const rotation = tabletopRotate.startRotation + delta;
    tabletopRotate.entry.card.rotation = rotation;
    if (tabletopRotate.targetEl) {
        tabletopRotate.targetEl.style.transform = `rotate(${rotation}deg) scale(var(--card-scale))`;
    }
}

function handleRotateEnd(event) {
    if (!tabletopRotate.active || event.pointerId !== tabletopRotate.pointerId) return;
    if (tabletopRotate.targetEl && tabletopRotate.targetEl.releasePointerCapture) {
        tabletopRotate.targetEl.releasePointerCapture(event.pointerId);
    }
    document.removeEventListener('pointermove', handleRotateMove);
    tabletopRotate.active = false;
    tabletopRotate.pointerId = null;
    tabletopRotate.entry = null;
    tabletopRotate.targetEl = null;
}

function canStartPointer(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return false;
    if (tabletopDrag.active || tabletopRotate.active) return false;
    return true;
}

function startDrag({ sourceType, sourceIndex, card, entry, groupEntries, dragEl, event, startFromStackCard = false, cardWasPopped = false }) {
    const tableauEl = document.getElementById('tabletop-tableau');
    if (!tableauEl) return;

    tabletopDrag.active = true;
    tabletopDrag.sourceType = sourceType;
    tabletopDrag.sourceIndex = sourceIndex;
    tabletopDrag.card = card;
    tabletopDrag.entry = entry;
    tabletopDrag.groupEntries = Array.isArray(groupEntries) && groupEntries.length > 1 ? groupEntries : null;
    tabletopDrag.dragEls = [];
    tabletopDrag.groupOffsets = [];
    tabletopDrag.startFromStackCard = startFromStackCard;
    tabletopDrag.cardWasPopped = cardWasPopped;
    tabletopDrag.dragEl = dragEl;
    tabletopDrag.pointerId = event.pointerId;
    tabletopDrag.startClientX = event.clientX;
    tabletopDrag.startClientY = event.clientY;
    tabletopDrag.moved = false;

    if (!dragEl.parentNode) {
        tableauEl.appendChild(dragEl);
    }

    if (tabletopDrag.groupEntries) {
        const baseEntry = entry;
        const baseX = baseEntry.x;
        const baseY = baseEntry.y;
        const baseZ = ++tabletopState.nextZ;
        const total = tabletopDrag.groupEntries.length;
        tabletopDrag.groupEntries.forEach((groupEntry, idx) => {
            const el = groupEntry.card.id === entry.card.id
                ? dragEl
                : tableauEl.querySelector(`.tabletop-card[data-card-id=\"${groupEntry.card.id}\"]`);
            if (!el) return;
            groupEntry.z = baseZ + (total - idx);
            el.style.zIndex = groupEntry.z;
            el.classList.add('tabletop-dragging');
            tabletopDrag.dragEls.push(el);
            tabletopDrag.groupOffsets.push({
                entry: groupEntry,
                dx: groupEntry.x - baseX,
                dy: groupEntry.y - baseY
            });
        });
    } else {
        dragEl.classList.add('tabletop-dragging');
        if (sourceType === 'tableau' && entry) {
            dragEl.style.zIndex = entry.z;
        } else {
            dragEl.style.zIndex = ++tabletopState.nextZ;
        }
        tabletopDrag.dragEls.push(dragEl);
    }

    const rect = dragEl.getBoundingClientRect();
    if (sourceType === 'tableau') {
        tabletopDrag.offsetX = event.clientX - rect.left;
        tabletopDrag.offsetY = event.clientY - rect.top;
    } else {
        tabletopDrag.offsetX = rect.width / 2;
        tabletopDrag.offsetY = rect.height / 2;
    }

    tabletopDrag.lastLeft = entry ? entry.x : 0;
    tabletopDrag.lastTop = entry ? entry.y : 0;

    if (sourceType !== 'tableau') {
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
    const inTableau = tableauRect ? isPointInRect(dropX, dropY, tableauRect) : false;
    const stackTarget = findStackTarget(dropX, dropY);
    const wasMoved = tabletopDrag.moved;

    if (tabletopDrag.sourceType === 'tableau') {
        if (!wasMoved) {
            if (inTableau) {
                tabletopDrag.entry.card.hidden = !tabletopDrag.entry.card.hidden;
                CommonUtils.playSound('card');
            } else {
                moveTableauCardToStack(tabletopDrag.entry, { type: 'discard', index: 0 });
            }
        } else if (stackTarget) {
            if (tabletopDrag.groupEntries) {
                moveTableauGroupToStack(tabletopDrag.groupEntries, stackTarget);
            } else {
                moveTableauCardToStack(tabletopDrag.entry, stackTarget);
            }
        } else if (inTableau) {
            const pos = resolveTableauDropPosition(event, tabletopDrag.entry.card.id);
            applyGroupDropPosition(pos, tabletopDrag.entry);
        } else {
            if (tabletopDrag.groupEntries) {
                moveTableauGroupToStack(tabletopDrag.groupEntries, { type: 'discard', index: 0 });
            } else {
                moveTableauCardToStack(tabletopDrag.entry, { type: 'discard', index: 0 });
            }
        }
    } else if (tabletopDrag.sourceType === 'deck') {
        if (!wasMoved) {
            if (tabletopDrag.startFromStackCard) {
                toggleTopCard('deck', tabletopDrag.sourceIndex);
            } else {
                dealDeckGroupToCenter(tabletopDrag.sourceIndex);
            }
        } else if (stackTarget) {
            if (stackTarget.type !== 'deck' || stackTarget.index !== tabletopDrag.sourceIndex) {
                moveCardBetweenStacks({
                    sourceType: 'deck',
                    sourceIndex: tabletopDrag.sourceIndex,
                    targetType: stackTarget.type,
                    targetIndex: stackTarget.index
                });
            }
        } else if (inTableau) {
            drawDeckGroupToTableau(tabletopDrag.sourceIndex, resolveTableauDropPosition(event));
        } else {
            moveCardBetweenStacks({
                sourceType: 'deck',
                sourceIndex: tabletopDrag.sourceIndex,
                targetType: 'discard',
                targetIndex: 0
            });
        }
    } else {
        if (!wasMoved && tabletopDrag.startFromStackCard) {
            pushCardToStack(tabletopDrag.sourceType, tabletopDrag.sourceIndex, tabletopDrag.card);
            toggleTopCard(tabletopDrag.sourceType, tabletopDrag.sourceIndex);
        } else if (stackTarget) {
            if (stackTarget.type === tabletopDrag.sourceType && stackTarget.index === tabletopDrag.sourceIndex) {
                pushCardToStack(tabletopDrag.sourceType, tabletopDrag.sourceIndex, tabletopDrag.card);
            } else {
                pushCardToStack(stackTarget.type, stackTarget.index, tabletopDrag.card, stackTarget.type === 'deck');
            }
        } else if (inTableau) {
            addCardToTableau(tabletopDrag.card, resolveTableauDropPosition(event));
        } else {
            pushCardToStack('discard', 0, tabletopDrag.card);
        }
    }

    cleanupDrag(event.pointerId);
    updateTabletopUI();
}

function cleanupDrag(pointerId) {
    if (tabletopDrag.dragEl && tabletopDrag.dragEl.releasePointerCapture) {
        tabletopDrag.dragEl.releasePointerCapture(pointerId);
    }
    tabletopDrag.dragEls.forEach(el => el.classList.remove('tabletop-dragging'));
    document.removeEventListener('pointermove', handleDragMove);
    tabletopDrag.active = false;
    tabletopDrag.sourceType = null;
    tabletopDrag.sourceIndex = null;
    tabletopDrag.card = null;
    tabletopDrag.entry = null;
    tabletopDrag.groupEntries = null;
    tabletopDrag.dragEls = [];
    tabletopDrag.groupOffsets = [];
    tabletopDrag.dragEl = null;
    tabletopDrag.pointerId = null;
    tabletopDrag.moved = false;
    tabletopDrag.startFromStackCard = false;
    tabletopDrag.cardWasPopped = false;
}

function positionDraggedCard(clientX, clientY) {
    const tableauRect = getRectById('tabletop-tableau');
    if (!tableauRect || !tabletopDrag.dragEl) return;
    const left = clientX - tableauRect.left - tabletopDrag.offsetX;
    const top = clientY - tableauRect.top - tabletopDrag.offsetY;
    if (tabletopDrag.groupEntries) {
        tabletopDrag.groupOffsets.forEach(({ entry, dx, dy }, idx) => {
            const el = tabletopDrag.dragEls[idx];
            if (!el) return;
            const nextLeft = left + dx;
            const nextTop = top + dy;
            el.style.left = `${nextLeft}px`;
            el.style.top = `${nextTop}px`;
            entry.x = nextLeft;
            entry.y = nextTop;
        });
    } else {
        tabletopDrag.dragEl.style.left = `${left}px`;
        tabletopDrag.dragEl.style.top = `${top}px`;
        if (tabletopDrag.entry) {
            tabletopDrag.entry.x = left;
            tabletopDrag.entry.y = top;
        }
    }
    tabletopDrag.lastLeft = left;
    tabletopDrag.lastTop = top;
}

function resolveTableauDropPosition(event, ignoreCardId) {
    const tableauRect = getRectById('tabletop-tableau');
    if (!tableauRect) {
        return { x: tabletopDrag.lastLeft, y: tabletopDrag.lastTop };
    }

    let x = tabletopDrag.lastLeft;
    let y = tabletopDrag.lastTop;

    if (event.shiftKey) {
        const snap = getSnapPosition(x, y, ignoreCardId);
        if (snap) {
            x = snap.x;
            y = snap.y;
        }
    }

    const { w, h } = getCardDimensions();
    x = clampNumber(x, 0, Math.max(0, tableauRect.width - w), x);
    y = clampNumber(y, 0, Math.max(0, tableauRect.height - h), y);
    return { x, y };
}

function getSnapPosition(x, y, ignoreCardId) {
    const { w, h } = getCardDimensions();
    const dropCenterX = x + w / 2;
    const dropCenterY = y + h / 2;
    let nearest = null;
    let nearestDistance = Infinity;
    tabletopState.tableau.forEach(entry => {
        if (ignoreCardId && entry.card.id === ignoreCardId) return;
        const centerX = entry.x + w / 2;
        const centerY = entry.y + h / 2;
        const dist = Math.hypot(centerX - dropCenterX, centerY - dropCenterY);
        if (dist < nearestDistance) {
            nearestDistance = dist;
            nearest = entry;
        }
    });
    const radius = Math.max(TABLETOP_SNAP_RADIUS, Math.max(w, h) * 1.5);
    if (!nearest || nearestDistance > radius) return null;
    const { offsetX, offsetY } = getStackOffsets();
    return { x: nearest.x + offsetX, y: nearest.y + offsetY };
}

function getStackOffsets() {
    const { w, h } = getCardDimensions();
    const offsetX = Math.max(2, Math.round(w * 0.05));
    const offsetY = Math.max(10, Math.round(h * 0.22));
    return { offsetX, offsetY };
}

function getStackGroup(entry) {
    const group = [entry];
    const { offsetX, offsetY } = getStackOffsets();
    const tolerance = Math.max(8, Math.round(Math.min(offsetX, offsetY) * 0.6));
    let current = entry;
    while (true) {
        const next = tabletopState.tableau.find(candidate => {
            if (group.includes(candidate)) return false;
            return Math.abs(candidate.x - (current.x + offsetX)) <= tolerance
                && Math.abs(candidate.y - (current.y + offsetY)) <= tolerance;
        });
        if (!next) break;
        group.push(next);
        current = next;
    }
    return group;
}

function applyGroupDropPosition(basePos, baseEntry) {
    if (!baseEntry) return;
    if (tabletopDrag.groupEntries) {
        tabletopDrag.groupOffsets.forEach(({ entry, dx, dy }) => {
            entry.x = basePos.x + dx;
            entry.y = basePos.y + dy;
        });
    } else {
        baseEntry.x = basePos.x;
        baseEntry.y = basePos.y;
    }
}

function drawDeckGroupToTableau(groupIndex, position) {
    const card = popCardFromStack('deck', groupIndex);
    if (!card) return;
    card.hidden = true;
    addCardToTableau(card, position);
}

function dealDeckGroupToCenter(groupIndex) {
    const card = popCardFromStack('deck', groupIndex);
    if (!card) return;
    card.hidden = true;
    const position = getCenterDealPosition();
    addCardToTableau(card, position);
}

function getCenterDealPosition() {
    const tableauRect = getRectById('tabletop-tableau');
    if (!tableauRect) return { x: 0, y: 0 };
    const { w, h } = getCardDimensions();
    const baseX = (tableauRect.width - w) / 2;
    const baseY = (tableauRect.height - h) / 2;
    const jitterX = (Math.random() - 0.5) * Math.min(90, tableauRect.width * 0.18);
    const jitterY = (Math.random() - 0.5) * Math.min(70, tableauRect.height * 0.2);
    const x = clampNumber(baseX + jitterX, 0, Math.max(0, tableauRect.width - w), baseX);
    const y = clampNumber(baseY + jitterY, 0, Math.max(0, tableauRect.height - h), baseY);
    return { x, y };
}

function addCardToTableau(card, position) {
    if (!position) return;
    tabletopState.tableau.push({
        card,
        x: position.x,
        y: position.y,
        z: ++tabletopState.nextZ
    });
}

function removeTableauEntry(entry) {
    const index = tabletopState.tableau.indexOf(entry);
    if (index !== -1) {
        tabletopState.tableau.splice(index, 1);
    }
}

function moveTableauCardToStack(entry, target) {
    removeTableauEntry(entry);
    pushCardToStack(target.type, target.index, entry.card, target.type === 'deck');
}

function moveTableauGroupToStack(entries, target) {
    if (!entries || entries.length === 0) return;
    const ordered = [...entries].sort((a, b) => a.z - b.z);
    ordered.forEach(entry => removeTableauEntry(entry));
    ordered.forEach(entry => {
        pushCardToStack(target.type, target.index, entry.card, target.type === 'deck');
    });
}

function pushCardToStack(type, index, card, toBottom = false) {
    const stack = getStack(type, index);
    if (!stack || !card) return;
    if (type === 'deck') {
        resetCardForDeck(card);
    }
    if (type === 'deck' && toBottom) {
        stack.unshift(card);
    } else {
        stack.push(card);
    }
}

function sendCardToDeckBottom(card, groupIndex) {
    pushCardToStack('deck', groupIndex, card, true);
}

function popCardFromStack(type, index) {
    const stack = getStack(type, index);
    if (!stack || stack.length === 0) return null;
    return stack.pop();
}

function moveCardBetweenStacks({ sourceType, sourceIndex, targetType, targetIndex }) {
    const card = popCardFromStack(sourceType, sourceIndex);
    if (!card) return;
    pushCardToStack(targetType, targetIndex, card, targetType === 'deck');
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

function getStack(type, index) {
    if (type === 'deck') return tabletopState.deckGroups[index];
    if (type === 'pile') return tabletopState.piles[index];
    if (type === 'foundation') return tabletopState.foundations[index];
    if (type === 'discard') return tabletopState.discard;
    return null;
}

function findStackTarget(clientX, clientY) {
    const piles = document.querySelectorAll('.tabletop-pile');
    for (const pile of piles) {
        const rect = pile.getBoundingClientRect();
        if (isPointInRect(clientX, clientY, rect)) {
            return {
                type: pile.dataset.stackType,
                index: parseInt(pile.dataset.stackIndex, 10)
            };
        }
    }
    return null;
}

function getCardDimensions() {
    const styles = getComputedStyle(document.documentElement);
    const w = parseFloat(styles.getPropertyValue('--card-w')) || 70;
    const h = parseFloat(styles.getPropertyValue('--card-h')) || 100;
    const scale = parseFloat(styles.getPropertyValue('--card-scale')) || 1;
    return { w: w * scale, h: h * scale };
}

function openStackMenu(x, y, sourceType, sourceIndex) {
    closeStackMenu();

    const sourceStack = getStack(sourceType, sourceIndex);
    if (!sourceStack) return;

    const menu = document.createElement('div');
    menu.className = 'tabletop-stack-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    if (sourceStack.length > 1) {
        const shuffleBtn = document.createElement('button');
        shuffleBtn.textContent = 'Shuffle Stack';
        shuffleBtn.addEventListener('click', () => {
            shuffleStack(sourceStack);
            updateTabletopUI();
            CommonUtils.playSound('shuffle');
            closeStackMenu();
        });
        menu.appendChild(shuffleBtn);
    }

    const tidyBtn = document.createElement('button');
    tidyBtn.textContent = 'Tidy Stack';
    tidyBtn.addEventListener('click', () => {
        tidyStack(sourceStack);
        updateTabletopUI();
        closeStackMenu();
    });
    menu.appendChild(tidyBtn);

    if (sourceStack.length > 0) {
        const flipBtn = document.createElement('button');
        flipBtn.textContent = 'Flip Stack';
        flipBtn.addEventListener('click', () => {
            flipStack(sourceStack);
            updateTabletopUI();
            closeStackMenu();
        });
        menu.appendChild(flipBtn);
    }

    const title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = 'Move Stack To';
    menu.appendChild(title);

    const destinations = getStackDestinations(sourceType, sourceIndex);
    if (destinations.length === 0) {
        const emptyBtn = document.createElement('button');
        emptyBtn.textContent = 'No other stacks';
        emptyBtn.disabled = true;
        menu.appendChild(emptyBtn);
    } else {
        destinations.forEach(dest => {
            const btn = document.createElement('button');
            btn.textContent = dest.label;
            btn.addEventListener('click', () => {
                moveStack(sourceType, sourceIndex, dest.type, dest.index);
                closeStackMenu();
            });
            menu.appendChild(btn);
        });
    }

    document.body.appendChild(menu);
    stackMenuEl = menu;

    setTimeout(() => {
        document.addEventListener('pointerdown', handleStackMenuOutside, { once: true });
    }, 0);
}

function handleStackMenuOutside(event) {
    if (stackMenuEl && stackMenuEl.contains(event.target)) {
        document.addEventListener('pointerdown', handleStackMenuOutside, { once: true });
        return;
    }
    closeStackMenu();
}

function closeStackMenu() {
    if (stackMenuEl && stackMenuEl.parentNode) {
        stackMenuEl.parentNode.removeChild(stackMenuEl);
    }
    stackMenuEl = null;
}

function getStackDestinations(sourceType, sourceIndex) {
    const destinations = [];
    const addDestinations = (type, stacks) => {
        stacks.forEach((stack, index) => {
            if (type === sourceType && index === sourceIndex) return;
            destinations.push({
                type,
                index,
                label: getStackLabel(type, index)
            });
        });
    };
    addDestinations('deck', tabletopState.deckGroups);
    addDestinations('pile', tabletopState.piles);
    addDestinations('foundation', tabletopState.foundations);
    addDestinations('discard', [tabletopState.discard]);
    return destinations;
}

function moveStack(sourceType, sourceIndex, destType, destIndex) {
    if (sourceType === destType && sourceIndex === destIndex) return;
    const sourceStack = getStack(sourceType, sourceIndex);
    const destStack = getStack(destType, destIndex);
    if (!sourceStack || !destStack || sourceStack.length === 0) return;

    const moved = sourceStack.splice(0, sourceStack.length);
    if (destType === 'deck') {
        moved.forEach(card => resetCardForDeck(card));
        destStack.unshift(...moved);
    } else {
        destStack.push(...moved);
    }
    updateTabletopUI();
}
