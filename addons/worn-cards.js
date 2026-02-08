(() => {
    const wearVarNames = [
        '--wear-scuff-x',
        '--wear-scuff-y',
        '--wear-scuff2-x',
        '--wear-scuff2-y',
        '--wear-scratch-angle',
        '--wear-scratch-angle-2',
        '--wear-scratch-alpha',
        '--wear-fold-alpha',
        '--wear-fold-angle',
        '--wear-fold-x',
        '--wear-fold-y',
        '--wear-tear-alpha',
        '--wear-tear-angle',
        '--wear-tear-size',
        '--wear-stain-alpha',
        '--wear-stain-x',
        '--wear-stain-y',
        '--wear-stain-size',
        '--wear-graphite-alpha',
        '--wear-graphite-x',
        '--wear-graphite-y',
        '--wear-graphite-size',
        '--wear-dust-alpha',
        '--wear-dust-x',
        '--wear-dust-y',
        '--wear-dust-size',
        '--wear-nicotine-alpha',
        '--wear-nicotine-x',
        '--wear-nicotine-y',
        '--wear-nicotine-size',
        '--wear-warp-alpha',
        '--wear-warp-angle',
        '--wear-warp-x',
        '--wear-warp-y',
        '--wear-ink-alpha',
        '--wear-ink-angle',
        '--wear-ink-x',
        '--wear-ink-y',
        '--wear-matte-alpha',
        '--wear-matte-x',
        '--wear-matte-y',
        '--wear-matte-size',
        '--wear-ink-fade-x',
        '--wear-ink-fade-y',
        '--wear-ink-fade-size',
        '--wear-ink-fade-alpha',
        '--wear-ink-fade2-x',
        '--wear-ink-fade2-y',
        '--wear-ink-fade2-size',
        '--wear-ink-fade2-alpha',
        '--wear-ink-fade-angle'
    ];

    const isWornEnabled = () => {
        if (window.AddonLoader && window.AddonLoader.addons) {
            const entry = window.AddonLoader.addons.get('worn-cards');
            if (entry && typeof entry.enabled === 'boolean') return entry.enabled;
        }
        return true;
    };

    const getCommonUtils = () => {
        if (window.CommonUtils) return window.CommonUtils;
        if (typeof CommonUtils !== 'undefined') return CommonUtils;
        return null;
    };

    const clearWearFromCardEl = (cardEl) => {
        if (!cardEl) return;
        wearVarNames.forEach((name) => cardEl.style.removeProperty(name));
        delete cardEl.dataset.wearApplied;
        const fadeLayer = cardEl.querySelector('.ink-fade-layer');
        if (fadeLayer) fadeLayer.remove();
    };

    const ensureInkFadeLayer = (cardEl) => {
        if (!cardEl) return;
        if (cardEl.querySelector('.ink-fade-layer')) return;
        const layer = document.createElement('span');
        layer.className = 'ink-fade-layer';
        cardEl.appendChild(layer);
    };

    const applyWearToCardEl = (cardEl) => {
        if (!cardEl || cardEl.dataset.wearApplied === '1') return;
        if (!isWornEnabled()) return;
        const common = getCommonUtils();
        if (!common || typeof common.applyDeterministicWear !== 'function') return;
        const val = cardEl.dataset.val;
        const suit = cardEl.dataset.suit;
        if (!val || !suit) return;
        common.applyDeterministicWear(cardEl, { val, suit });
        ensureInkFadeLayer(cardEl);
        cardEl.dataset.wearApplied = '1';
    };

    const install = () => {
        const common = getCommonUtils();
        if (!common || typeof common.createCardEl !== 'function') {
            return false;
        }
        if (window.__wornCardsInstalled) return true;
        const originalCreateCardEl = common.createCardEl;
        if (!window.CommonUtils) window.CommonUtils = common;

        common.createCardEl = function (card) {
            if (!card) return originalCreateCardEl.call(this, card);
            const cardEl = originalCreateCardEl.call(this, card);
            if (isWornEnabled()) applyWearToCardEl(cardEl);
            return cardEl;
        };

        const seedExistingCards = () => {
            document.querySelectorAll('.card').forEach(applyWearToCardEl);
        };

        const resetExistingCards = () => {
            document.querySelectorAll('.card').forEach(clearWearFromCardEl);
        };

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof HTMLElement)) return;
                    if (!isWornEnabled()) return;
                    if (node.classList.contains('card')) {
                        applyWearToCardEl(node);
                    } else {
                        node.querySelectorAll?.('.card').forEach(applyWearToCardEl);
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        if (isWornEnabled()) seedExistingCards();

        window.addEventListener('addons:changed', (event) => {
            if (!event || !event.detail || event.detail.id !== 'worn-cards') return;
            if (event.detail.enabled) {
                seedExistingCards();
            } else {
                resetExistingCards();
            }
        });

        window.__wornCardsInstalled = true;
        return true;
    };

    const waitForCommonUtils = () => {
        if (install()) return;
        requestAnimationFrame(waitForCommonUtils);
    };

    waitForCommonUtils();
})();
