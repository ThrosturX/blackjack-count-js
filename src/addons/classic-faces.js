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

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const syncClassicSizing = (cardEl) => {
        if (!cardEl) return;
        const computed = window.getComputedStyle ? window.getComputedStyle(cardEl) : null;
        let width = computed ? parseFloat(computed.width) : NaN;
        let height = computed ? parseFloat(computed.height) : NaN;
        if (!(width > 0) || !(height > 0)) {
            const rect = cardEl.getBoundingClientRect ? cardEl.getBoundingClientRect() : null;
            if (!(width > 0) && rect && rect.width > 0) width = rect.width;
            if (!(height > 0) && rect && rect.height > 0) height = rect.height;
        }
        if (!(width > 0)) width = 70;
        if (!(height > 0)) height = 100;

        cardEl.style.setProperty('--classic-pip-size', `${clamp(width * 0.32, 10, 24).toFixed(2)}px`);
        cardEl.style.setProperty('--classic-ace-size', `${clamp(width * 0.5, 16, 36).toFixed(2)}px`);
        cardEl.style.setProperty('--classic-rank-size', `${clamp(width * 0.21, 8.5, 15.5).toFixed(2)}px`);
        cardEl.style.setProperty('--classic-center-size', `${clamp(width * 0.48, 14, 38).toFixed(2)}px`);
        cardEl.style.setProperty('--classic-corner-inset-y', `${clamp(height * 0.01, 0.5, 2).toFixed(2)}px`);
        cardEl.style.setProperty('--classic-rank-inset-x', `${clamp(width * 0.07, 2.5, 7).toFixed(2)}px`);
        cardEl.style.setProperty('--classic-suit-inset-x', `${clamp(width * 0.085, 3, 8).toFixed(2)}px`);
        cardEl.style.setProperty('--classic-suit-inset-y', `${clamp(height * 0.16, 7, 16).toFixed(2)}px`);
    };

    const resetClassicOnCardEl = (cardEl) => {
        if (!cardEl) return;
        const suitCenter = cardEl.querySelector('.suit-center');
        if (!suitCenter) return;
        const isJoker = cardEl.classList.contains('joker') || cardEl.dataset.val === 'JK';
        if (isJoker) {
            suitCenter.innerHTML = '';
            if (!cardEl.classList.contains('hidden')) {
                const icon = document.createElement('span');
                icon.className = 'joker-face-art';
                suitCenter.appendChild(icon);
            }
        } else {
            suitCenter.textContent = cardEl.dataset.suit || '';
            suitCenter.innerHTML = suitCenter.textContent;
        }
        cardEl.classList.remove('classic-faces-card');
        cardEl.classList.remove('classic-faces-art-card');
        cardEl.dataset.classicFaces = '';
    };

    const applyClassicToCardEl = (cardEl) => {
        if (!cardEl) return;
        if (!isClassicEnabled()) return;
        syncClassicSizing(cardEl);
        if (cardEl.dataset.classicFaces === '1') return;
        const val = cardEl.dataset.val;
        const suit = cardEl.dataset.suit;
        if (!val || !suit) return;
        const isJoker = cardEl.classList.contains('joker') || val === 'JK';
        if (isJoker) {
            resetClassicOnCardEl(cardEl);
            return;
        }
        const suitCenter = cardEl.querySelector('.suit-center');
        if (!suitCenter) return;
        cardEl.classList.add('classic-faces-card');
        cardEl.classList.remove('classic-faces-art-card');
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
            cardEl.classList.add('classic-faces-art-card');
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

        const syncExistingClassicCards = () => {
            if (!isClassicEnabled()) return;
            document.querySelectorAll('.card.classic-faces-card').forEach(syncClassicSizing);
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
        window.addEventListener('resize', syncExistingClassicCards);
        window.addEventListener('card-scale:changed', syncExistingClassicCards);

        window.__classicFacesInstalled = true;
        return true;
    };

    const waitForCommonUtils = () => {
        if (install()) return;
        requestAnimationFrame(waitForCommonUtils);
    };

    waitForCommonUtils();
})();
