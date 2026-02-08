(() => {
    const columns = {
        left: '26%',
        right: '74%',
        center: '50%'
    };

    const rows = {
        outerTop: 14,
        center: 50,
        outerBottom: 86
    };

    const innerGap = 14;
    rows.upper = rows.center - innerGap;
    rows.lower = rows.center + innerGap;
    rows.topHalfCenter = Math.round((rows.outerTop + rows.center) / 2);
    rows.topHalfInnerCenter = Math.round((rows.outerTop + rows.upper) / 2);
    rows.bottomHalfInnerCenter = Math.round((rows.lower + rows.outerBottom) / 2);

    const layout = {
        A: [{ row: 'center', cols: ['center'], ace: true }],
        '2': [
            { row: 'outerTop', cols: ['center'] },
            { row: 'outerBottom', cols: ['center'] }
        ],
        '3': [
            { row: 'outerTop', cols: ['center'] },
            { row: 'center', cols: ['center'] },
            { row: 'outerBottom', cols: ['center'] }
        ],
        '4': [
            { row: 'outerTop', cols: ['left', 'right'] },
            { row: 'outerBottom', cols: ['left', 'right'] }
        ],
        '5': [
            { row: 'outerTop', cols: ['left', 'right'] },
            { row: 'center', cols: ['center'] },
            { row: 'outerBottom', cols: ['left', 'right'] }
        ],
        '6': [
            { row: 'outerTop', cols: ['left', 'right'] },
            { row: 'center', cols: ['left', 'right'] },
            { row: 'outerBottom', cols: ['left', 'right'] }
        ],
        '7': [
            { row: 'outerTop', cols: ['left', 'right'] },
            { row: 'topHalfCenter', cols: ['center'] },
            { row: 'center', cols: ['left', 'right'] },
            { row: 'outerBottom', cols: ['left', 'right'] }
        ],
        '8': [
            { row: 'outerTop', cols: ['left', 'right'] },
            { row: 'upper', cols: ['left', 'right'] },
            { row: 'lower', cols: ['left', 'right'] },
            { row: 'outerBottom', cols: ['left', 'right'] }
        ],
        '9': [
            { row: 'outerTop', cols: ['left', 'right'] },
            { row: 'upper', cols: ['left', 'right'] },
            { row: 'center', cols: ['center'] },
            { row: 'lower', cols: ['left', 'right'] },
            { row: 'outerBottom', cols: ['left', 'right'] }
        ],
        '10': [
            { row: 'outerTop', cols: ['left', 'right'] },
            { row: 'upper', cols: ['left', 'right'] },
            { row: 'topHalfInnerCenter', cols: ['center'] },
            { row: 'lower', cols: ['left', 'right'] },
            { row: 'bottomHalfInnerCenter', cols: ['center'] },
            { row: 'outerBottom', cols: ['left', 'right'] }
        ]
    };

    const suitNames = {
        '♥': 'HEARTS',
        '♦': 'DIAMONDS',
        '♣': 'CLUBS',
        '♠': 'SPADES'
    };

    const faceArt = {
        J: 'JACK',
        C: 'KNIGHT',
        Q: 'QUEEN',
        K: 'KING'
    };

    const createPipElement = (suit, coords, isAce) => {
        const span = document.createElement('span');
        span.className = 'classic-pip';
        if (isAce) span.classList.add('classic-pip--ace');
        const inner = document.createElement('span');
        inner.className = 'classic-pip__symbol';
        inner.textContent = suit;
        span.appendChild(inner);
        span.style.left = coords.x;
        span.style.top = coords.y;
        span.style.transform = 'translate(-50%, -50%)';
        if (typeof coords.row === 'number' && coords.row > rows.center) {
            span.classList.add('classic-pip--inverted');
        }
        return span;
    };

    const isClassicEnabled = () => {
        if (window.AddonLoader && window.AddonLoader.addons) {
            const entry = window.AddonLoader.addons.get('classic-faces');
            if (entry && typeof entry.enabled === 'boolean') return entry.enabled;
        }
        return true;
    };

    const resetClassicOnCardEl = (cardEl) => {
        if (!cardEl) return;
        const suitCenter = cardEl.querySelector('.suit-center');
        if (!suitCenter) return;
        suitCenter.textContent = cardEl.dataset.suit || '';
        suitCenter.innerHTML = suitCenter.textContent;
        cardEl.classList.remove('classic-faces-card');
        cardEl.dataset.classicFaces = '';
    };

    const applyClassicToCardEl = (cardEl) => {
        if (!cardEl || cardEl.dataset.classicFaces === '1') return;
        if (!isClassicEnabled()) return;
        const val = cardEl.dataset.val;
        const suit = cardEl.dataset.suit;
        if (!val || !suit) return;
        const suitCenter = cardEl.querySelector('.suit-center');
        if (!suitCenter) return;
        cardEl.classList.add('classic-faces-card');
        suitCenter.innerHTML = '';
        if (cardEl.classList.contains('hidden')) {
            cardEl.dataset.classicFaces = '1';
            return;
        }
        if (faceArt[val]) {
            const suitName = suitNames[suit];
            if (!suitName) return;
            const art = document.createElement('span');
            art.className = 'classic-face-art';
            const faceKey = `${faceArt[val]}_${suitName}`;
            const faceData = window.ClassicFaceArt ? window.ClassicFaceArt[faceKey] : null;
            const faceUrl = faceData || `images/PLAYING_CARD_${faceArt[val]}_OF_${suitName}.svg`;
            art.style.maskImage = `url("${faceUrl}")`;
            art.style.webkitMaskImage = `url("${faceUrl}")`;
            suitCenter.appendChild(art);
            cardEl.dataset.classicFaces = '1';
            return;
        }
        const map = layout[val];
        if (!map) return;
        const container = document.createElement('div');
        container.className = 'classic-pips';
        map.forEach((rowSpec) => {
            const y = rows[rowSpec.row];
            if (typeof y !== 'number') return;
            rowSpec.cols.forEach((col) => {
                const x = columns[col];
                if (!x) return;
                const pip = createPipElement(suit, { x, y: `${y}%`, row: y }, rowSpec.ace);
                container.appendChild(pip);
            });
        });
        suitCenter.appendChild(container);
        cardEl.dataset.classicFaces = '1';
    };

    const getCommonUtils = () => {
        if (window.CommonUtils) return window.CommonUtils;
        if (typeof CommonUtils !== 'undefined') return CommonUtils;
        return null;
    };

    const install = () => {
        const common = getCommonUtils();
        if (!common || typeof common.createCardEl !== 'function') {
            return false;
        }
        if (window.__classicFacesInstalled) return true;
        const originalCreateCardEl = common.createCardEl;
        if (!window.CommonUtils) window.CommonUtils = common;

        common.createCardEl = function (card) {
            if (!card) return originalCreateCardEl.call(this, card);
            const cardEl = originalCreateCardEl.call(this, card);
            applyClassicToCardEl(cardEl);
            return cardEl;
        };

        const seedExistingCards = () => {
            document.querySelectorAll('.card').forEach(applyClassicToCardEl);
        };

        const resetExistingCards = () => {
            document.querySelectorAll('.card').forEach(resetClassicOnCardEl);
        };

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof HTMLElement)) return;
                    if (!isClassicEnabled()) return;
                    if (node.classList.contains('card')) {
                        applyClassicToCardEl(node);
                    } else {
                        node.querySelectorAll?.('.card').forEach(applyClassicToCardEl);
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        seedExistingCards();
        window.addEventListener('addons:changed', (event) => {
            if (!event || !event.detail || event.detail.id !== 'classic-faces') return;
            if (event.detail.enabled) {
                seedExistingCards();
            } else {
                resetExistingCards();
            }
        });

        window.__classicFacesInstalled = true;
        return true;
    };

    const waitForCommonUtils = () => {
        if (install()) return;
        requestAnimationFrame(waitForCommonUtils);
    };

    waitForCommonUtils();
})();
