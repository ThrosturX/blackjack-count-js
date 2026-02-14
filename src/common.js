/**
 * Shared utility functions for card games.
 */

(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const page = window.location && window.location.pathname
            ? window.location.pathname.split('/').pop()
            : '';
        const pageScaleInputs = {
            'blackjack.html': 'blackjack-card-scale',
            'klondike.html': 'klondike-card-scale',
            'freecell.html': 'freecell-card-scale',
            'cavalier-freecell.html': 'freecell-card-scale',
            'spider.html': 'spider-card-scale',
            'simple-simon.html': 'spider-card-scale',
            'royal-simon.html': 'spider-card-scale',
            'tripeaks.html': 'tripeaks-card-scale',
            'pyramid.html': 'pyramid-card-scale',
            'dark-pyramid.html': 'pyramid-card-scale',
            'cavaliers-castle.html': 'pyramid-card-scale',
            'golf.html': 'golf-card-scale',
            'forty-thieves.html': 'forty-card-scale',
            'rush-hour-patience.html': 'rush-card-scale',
            'tabletop.html': 'tabletop-card-scale'
        };
        const keys = [];
        if (pageScaleInputs[page]) {
            keys.push(`bj_table.${pageScaleInputs[page]}`);
        }
        if (page === 'tabletop.html') {
            keys.push('bj_table.card_scale');
        }

        let stored = NaN;
        for (const key of keys) {
            const parsed = parseFloat(localStorage.getItem(key));
            if (Number.isFinite(parsed)) {
                stored = parsed;
                break;
            }
        }
        if (Number.isFinite(stored)) {
            document.documentElement.style.setProperty('--card-scale', stored);
            document.documentElement.style.setProperty('--ui-scale', stored);
        }
    } catch (err) {
        // Ignore storage failures.
    }
})();

const CommonUtils = {
    audioAssets: {},
    burnProfileCache: new Map(),
    cardScaleGameId: null, // save card scaling on a per-game basis transparently

    getScaleStorageValue: function (keyCandidates) {
        if (!Array.isArray(keyCandidates)) return NaN;
        for (const key of keyCandidates) {
            if (!key) continue;
            try {
                const parsed = parseFloat(localStorage.getItem(key));
                if (Number.isFinite(parsed)) return parsed;
            } catch (err) {
                // Ignore storage failures.
            }
        }
        return NaN;
    },

    /**
     * Initializes a shared table scale slider.
     * @param {string} inputId
     * @param {string} outputId
     * @param {Object} options
     */
    initCardScaleControls: function (inputId, outputId, options = {}) {
        this.cardScaleGameId = inputId;
        const input = document.getElementById(inputId);
        const output = document.getElementById(outputId);
        if (!input) return;
        const min = this.clampNumber(
            parseFloat(options.min !== undefined ? options.min : input.min),
            0.25,
            5,
            0.5
        );
        const max = this.clampNumber(
            parseFloat(options.max !== undefined ? options.max : input.max),
            min,
            5,
            2
        );
        const storageKey = options.storageKey || `bj_table.${this.cardScaleGameId}`;
        const legacyStorageKeys = Array.isArray(options.legacyStorageKeys) ? options.legacyStorageKeys : [];
        const stored = this.getScaleStorageValue([storageKey, ...legacyStorageKeys]);
        const initial = Number.isFinite(stored) ? stored : parseFloat(input.value);
        this.applyCardScale(initial, output, input, {
            min,
            max,
            storageKey,
            onChange: options.onChange,
            applyUiScale: options.applyUiScale !== false,
            initial: true
        });
        input.addEventListener('input', () => {
            const value = parseFloat(input.value);
            this.applyCardScale(value, output, input, {
                min,
                max,
                storageKey,
                onChange: options.onChange,
                applyUiScale: options.applyUiScale !== false
            });
        });
    },

    /**
     * Applies the shared card scale.
     * @param {number} value
     * @param {HTMLElement} outputEl
     * @param {HTMLInputElement} inputEl
     * @param {Object} options
     */
    applyCardScale: function (value, outputEl, inputEl, options = {}) {
        const min = this.clampNumber(parseFloat(options.min), 0.25, 5, 0.5);
        const max = this.clampNumber(parseFloat(options.max), min, 5, 2);
        const scale = this.clampNumber(value, min, max, 1);
        const storageKey = options.storageKey || `bj_table.${this.cardScaleGameId}`;
        const applyUiScale = options.applyUiScale !== false;
        const current = getComputedStyle(document.documentElement).getPropertyValue('--card-scale');
        const previousScale = parseFloat(current) || 1;
        document.documentElement.style.setProperty('--card-scale', scale);
        if (applyUiScale) {
            document.documentElement.style.setProperty('--ui-scale', scale);
        }
        if (outputEl) outputEl.textContent = `${Math.round(scale * 100)}%`;
        if (inputEl && String(inputEl.value) !== String(scale)) inputEl.value = scale;
        try {
            localStorage.setItem(storageKey, String(scale));
        } catch (err) {
            // Ignore storage failures.
        }
        if (typeof options.onChange === 'function') {
            options.onChange({
                scale,
                previousScale,
                initial: options.initial === true
            });
        }
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            const detail = { scale, previousScale, initial: options.initial === true };
            window.dispatchEvent(new CustomEvent('card-scale:changed', { detail }));
            window.dispatchEvent(new CustomEvent('ui-scale:changed', { detail }));
        }
    },

    clampNumber: function (value, min, max, fallback) {
        if (!Number.isFinite(value)) return fallback;
        return Math.min(max, Math.max(min, value));
    },

    getUiScaleValue: function () {
        const styles = getComputedStyle(document.documentElement);
        const scale = parseFloat(styles.getPropertyValue('--ui-scale'));
        return this.clampNumber(scale, 0.25, 5, 1);
    },

    getSolitaireStackOffset: function (baseOffset, options = {}) {
        const base = this.clampNumber(parseFloat(baseOffset), 1, 300, 24);
        const scale = Number.isFinite(options.scale) ? options.scale : this.getUiScaleValue();
        // Below 100%: tighten proportionally. Above 100%: do not keep growing spacing.
        const scaled = base * (scale <= 1 ? scale : 1);
        const min = Number.isFinite(options.min)
            ? options.min
            : Math.max(1, base * this.clampNumber(parseFloat(options.minFactor), 0.1, 1, 0.45));
        const max = Number.isFinite(options.max) ? options.max : base;
        return this.clampNumber(scaled, min, max, base);
    },

    consumeOverflowWithSpacing: function (overflow, current, min, slotCount) {
        const slots = Number.isFinite(slotCount) ? slotCount : 0;
        if (!(overflow > 0) || slots <= 0) {
            return { value: current, overflow: Math.max(0, overflow || 0) };
        }
        const maxReduction = Math.max(0, current - min);
        const neededPerSlot = overflow / slots;
        const reduction = Math.min(maxReduction, neededPerSlot);
        return {
            value: current - reduction,
            overflow: Math.max(0, overflow - reduction * slots)
        };
    },

    resolveAdaptiveSpacing: function (options = {}) {
        const availableWidth = Number.isFinite(options.availableWidth) ? options.availableWidth : 0;
        const contentWidth = Number.isFinite(options.contentWidth) ? options.contentWidth : 0;

        const gap = {
            current: Number.isFinite(options.currentGap) ? options.currentGap : 0,
            base: Number.isFinite(options.baseGap) ? options.baseGap : 0,
            min: Number.isFinite(options.minGap) ? options.minGap : 0,
            slots: Number.isFinite(options.gapSlots) ? options.gapSlots : 0
        };

        const fanEnabled = Number.isFinite(options.currentFan)
            || Number.isFinite(options.baseFan)
            || Number.isFinite(options.minFan)
            || Number.isFinite(options.fanSlots);
        const fan = {
            current: Number.isFinite(options.currentFan) ? options.currentFan : 0,
            base: Number.isFinite(options.baseFan) ? options.baseFan : 0,
            min: Number.isFinite(options.minFan) ? options.minFan : 0,
            slots: Number.isFinite(options.fanSlots) ? options.fanSlots : 0
        };

        const requiredAtBase = contentWidth
            + Math.max(0, (gap.base - gap.current) * gap.slots)
            + (fanEnabled ? Math.max(0, (fan.base - fan.current) * fan.slots) : 0);
        let overflow = Math.max(0, requiredAtBase - availableWidth);

        const gapResult = this.consumeOverflowWithSpacing(
            overflow,
            gap.base,
            gap.min,
            gap.slots
        );
        overflow = gapResult.overflow;

        let fanResult = null;
        if (fanEnabled) {
            fanResult = this.consumeOverflowWithSpacing(
                overflow,
                fan.base,
                fan.min,
                fan.slots
            );
            overflow = fanResult.overflow;
        }

        return {
            gap: gapResult.value,
            fan: fanResult ? fanResult.value : null,
            overflow
        };
    },

    getHighScoreStore: function () {
        try {
            const raw = localStorage.getItem('bj_table.high_scores');
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (err) {
            return {};
        }
    },

    saveHighScoreStore: function (store) {
        try {
            localStorage.setItem('bj_table.high_scores', JSON.stringify(store || {}));
        } catch (err) {
            // Ignore storage failures.
        }
    },

    getHighScore: function (gameId, ruleSetKey = 'default') {
        if (!gameId) return 0;
        const store = this.getHighScoreStore();
        const gameScores = store[gameId];
        if (!gameScores || typeof gameScores !== 'object') return 0;
        const score = gameScores[String(ruleSetKey || 'default')];
        return Number.isFinite(score) ? score : 0;
    },

    updateHighScore: function (gameId, ruleSetKey = 'default', score = 0) {
        if (!gameId) return 0;
        const numericScore = Number.isFinite(score) ? score : 0;
        const normalizedScore = Math.max(0, Math.floor(numericScore));
        const normalizedRule = String(ruleSetKey || 'default');
        const store = this.getHighScoreStore();
        const gameScores = (store[gameId] && typeof store[gameId] === 'object')
            ? store[gameId]
            : {};
        const currentHigh = Number.isFinite(gameScores[normalizedRule]) ? gameScores[normalizedRule] : 0;
        const nextHigh = Math.max(currentHigh, normalizedScore);
        if (nextHigh !== currentHigh) {
            gameScores[normalizedRule] = nextHigh;
            store[gameId] = gameScores;
            this.saveHighScoreStore(store);
        }
        return nextHigh;
    },

    getCardMetrics: function () {
        const styles = getComputedStyle(document.documentElement);
        const baseW = parseFloat(styles.getPropertyValue('--card-w')) || 70;
        const baseH = parseFloat(styles.getPropertyValue('--card-h')) || 100;
        const scale = parseFloat(styles.getPropertyValue('--card-scale')) || 1;
        return {
            cardWidth: baseW * scale,
            cardHeight: baseH * scale,
            scale
        };
    },

    getStackHeight: function (cardCount, stackOffset, cardHeight) {
        if (!Number.isFinite(cardCount) || cardCount <= 0) return 0;
        const baseHeight = Number.isFinite(cardHeight) ? cardHeight : this.getCardMetrics().cardHeight;
        const offset = Number.isFinite(stackOffset) ? stackOffset : 0;
        return baseHeight + Math.max(0, cardCount - 1) * offset;
    },

    ensureTableauMinHeight: function (options = {}) {
        const tableEl = typeof options.table === 'string'
            ? document.getElementById(options.table)
            : options.table;
        if (!tableEl) return;

        const topRowEl = typeof options.topRow === 'string'
            ? document.getElementById(options.topRow)
            : options.topRow;

        const styles = getComputedStyle(tableEl);
        const paddingTop = parseFloat(styles.paddingTop) || 0;
        const paddingBottom = parseFloat(styles.paddingBottom) || 0;
        const gapValue = styles.rowGap || styles.gap;
        const gap = parseFloat(gapValue) || 0;

        const metrics = this.getCardMetrics();
        const cardHeight = Number.isFinite(options.cardHeight) ? options.cardHeight : metrics.cardHeight;
        const stackOffset = Number.isFinite(options.stackOffset) ? options.stackOffset : 0;
        const maxCards = Math.max(1, options.maxCards || 1);
        const stackHeight = this.getStackHeight(maxCards, stackOffset, cardHeight);
        const topRowHeight = topRowEl ? topRowEl.getBoundingClientRect().height : 0;
        const extraBottom = Number.isFinite(options.extraBottom) ? options.extraBottom : 0;
        const minHeight = Math.ceil(paddingTop + paddingBottom + topRowHeight + gap + stackHeight + extraBottom);
        const nextValue = `${minHeight}px`;
        if (tableEl.style.minHeight !== nextValue) {
            tableEl.style.minHeight = nextValue;
        }
    },

    createRafScheduler: function (fn) {
        let frame = null;
        return () => {
            if (frame !== null) {
                cancelAnimationFrame(frame);
            }
            frame = requestAnimationFrame(() => {
                frame = null;
                fn();
            });
        };
    },

    /**
     * Preserve horizontal scroll positions for one or more containers while a UI update runs.
     * Useful for solitaire re-renders that toggle scroll-active classes during layout.
     * @param {Object} options
     * @param {Array<string|HTMLElement>} options.targets - Elements (or IDs) to preserve.
     * @param {Function} options.update - Synchronous UI update function.
     * @param {Function} [options.beforeNextFrame] - Optional callback before next-frame restore.
     */
    preserveHorizontalScroll: function (options = {}) {
        const targets = Array.isArray(options.targets) ? options.targets : [];
        const update = typeof options.update === 'function' ? options.update : null;
        if (!update) return;

        const resolved = targets
            .map((target) => (typeof target === 'string' ? document.getElementById(target) : target))
            .filter((el) => !!el);
        const captures = resolved.map((el) => ({ el, left: el.scrollLeft || 0 }));

        const restore = () => {
            captures.forEach(({ el, left }) => {
                const maxLeft = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0));
                const clamped = Math.max(0, Math.min(left, maxLeft));
                el.scrollLeft = clamped;
            });
        };

        update();
        restore();

        requestAnimationFrame(() => {
            if (typeof options.beforeNextFrame === 'function') {
                options.beforeNextFrame();
            }
            restore();
        });
    },

    ensureScrollableWidth: function (options = {}) {
        const tableEl = typeof options.table === 'string'
            ? document.getElementById(options.table)
            : options.table;
        if (!tableEl) return false;

        const wrapperEl = typeof options.wrapper === 'string'
            ? document.getElementById(options.wrapper)
            : options.wrapper || tableEl.parentElement;
        if (!wrapperEl) return false;

        const contentSelectors = Array.isArray(options.contentSelectors) ? options.contentSelectors : [];
        let requiredWidth = Number.isFinite(options.requiredWidth) ? options.requiredWidth : 0;
        if (!requiredWidth) {
            // Clear prior sizing constraints during measurement to avoid positive feedback loops
            // where previous minWidth inflates future width calculations.
            const previousMinWidth = tableEl.style.minWidth;
            tableEl.style.minWidth = '';

            let contentWidth = 0;
            contentSelectors.forEach(selector => {
                const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
                if (!el) return;
                contentWidth = Math.max(contentWidth, el.scrollWidth || 0);
            });

            // Use the table's own scroll width only as a fallback. Premium visual
            // pseudo-elements can expand table scrollWidth without real content overflow.
            if (!contentWidth) {
                contentWidth = tableEl.scrollWidth || 0;
            }

            let tableChrome = 0;
            const includeTableChrome = options.includeTableChrome !== false;
            if (includeTableChrome && contentWidth) {
                const tableStyles = getComputedStyle(tableEl);
                tableChrome =
                    (parseFloat(tableStyles.paddingLeft) || 0) +
                    (parseFloat(tableStyles.paddingRight) || 0) +
                    (parseFloat(tableStyles.borderLeftWidth) || 0) +
                    (parseFloat(tableStyles.borderRightWidth) || 0);
            }

            const extra = Number.isFinite(options.extra) ? options.extra : 0;
            requiredWidth = Math.ceil(contentWidth + tableChrome + extra);

            tableEl.style.minWidth = previousMinWidth;
        }

        const wrapperWidth = wrapperEl.getBoundingClientRect().width || 0;
        const enterTolerance = Number.isFinite(options.enterTolerance) ? options.enterTolerance : 6;
        const exitTolerance = Number.isFinite(options.exitTolerance)
            ? options.exitTolerance
            : Math.max(2, Math.floor(enterTolerance / 2));
        const wasScrollable = wrapperEl.classList.contains('scroll-active') || tableEl.classList.contains('scroll-active');
        const threshold = wasScrollable ? exitTolerance : enterTolerance;
        const needsScroll = requiredWidth > wrapperWidth + threshold;

        tableEl.style.minWidth = needsScroll ? `${requiredWidth}px` : '';
        tableEl.classList.toggle('scroll-active', needsScroll);
        wrapperEl.classList.toggle('scroll-active', needsScroll);
        wrapperEl.style.overflowX = needsScroll ? 'auto' : 'hidden';
        return needsScroll;
    },

    /**
     * Applies deterministic wear variables based on suit/value.
     * @param {HTMLElement} cardEl
     * @param {Object} card
     */
    applyDeterministicWear: function (cardEl, card) {
        if (!cardEl || !card) return;
        const identity = `${card.val}${card.suit}`;
        let hash = 0;
        for (let i = 0; i < identity.length; i++) {
            hash = (hash * 31 + identity.charCodeAt(i)) >>> 0;
        }
        let state = hash || 1;
        const rand = () => {
            state = (1664525 * state + 1013904223) >>> 0;
            return state / 4294967296;
        };

        const scuffX = Math.round(15 + rand() * 70);
        const scuffY = Math.round(12 + rand() * 70);
        const scuff2X = Math.round(10 + rand() * 75);
        const scuff2Y = Math.round(15 + rand() * 70);
        const scratchAngle = Math.round(-60 + rand() * 120);
        const scratchAngle2 = Math.round(-60 + rand() * 120);
        const scratchAlpha = (0.92 + rand() * 0.16).toFixed(3);
        const foldAlpha = rand() > 0.6 ? (0.08 + rand() * 0.12).toFixed(3) : '0';
        const foldAngle = Math.round(15 + rand() * 150);
        const foldX = Math.round(15 + rand() * 70);
        const foldY = Math.round(18 + rand() * 67);
        const tearAlpha = rand() > 0.86 ? (0.45 + rand() * 0.25).toFixed(3) : '0';
        const tearAngle = Math.round(-20 + rand() * 40);
        const tearSize = Math.round(10 + rand() * 18);
        const stainAlpha = rand() > 0.88 ? (0.12 + rand() * 0.18).toFixed(3) : '0';
        const stainX = Math.round(20 + rand() * 60);
        const stainY = Math.round(20 + rand() * 60);
        const stainSize = Math.round(18 + rand() * 16);
        const graphiteAlpha = rand() > 0.78 ? (0.1 + rand() * 0.18).toFixed(3) : '0';
        const graphiteX = Math.round(10 + rand() * 75);
        const graphiteY = Math.round(10 + rand() * 75);
        const graphiteSize = Math.round(20 + rand() * 22);
        const dustAlpha = rand() > 0.6 ? (0.04 + rand() * 0.08).toFixed(3) : '0';
        const dustX = Math.round(5 + rand() * 80);
        const dustY = Math.round(5 + rand() * 80);
        const dustSize = Math.round(35 + rand() * 30);
        const nicotineAlpha = rand() > 0.82 ? (0.08 + rand() * 0.12).toFixed(3) : '0';
        const nicotineX = Math.round(15 + rand() * 70);
        const nicotineY = Math.round(15 + rand() * 70);
        const nicotineSize = Math.round(28 + rand() * 20);
        const warpAlpha = rand() > 0.86 ? (0.08 + rand() * 0.12).toFixed(3) : '0';
        const warpAngle = Math.round(-45 + rand() * 90);
        const warpX = Math.round(10 + rand() * 70);
        const warpY = Math.round(10 + rand() * 70);
        const inkAlpha = rand() > 0.9 ? (0.16 + rand() * 0.2).toFixed(3) : '0';
        const inkAngle = Math.round(-60 + rand() * 120);
        const inkX = Math.round(10 + rand() * 75);
        const inkY = Math.round(10 + rand() * 75);
        const matteAlpha = rand() > 0.7 ? (0.05 + rand() * 0.12).toFixed(3) : '0';
        const matteX = Math.round(15 + rand() * 70);
        const matteY = Math.round(15 + rand() * 70);
        const matteSize = Math.round(25 + rand() * 20);
        const inkFadeX = Math.round(10 + rand() * 80);
        const inkFadeY = Math.round(10 + rand() * 80);
        const inkFadeSize = Math.round(40 + rand() * 25);
        const inkFadeAlpha = (0.75 + rand() * 0.2).toFixed(3);
        const inkFade2X = Math.round(10 + rand() * 80);
        const inkFade2Y = Math.round(10 + rand() * 80);
        const inkFade2Size = Math.round(34 + rand() * 22);
        const inkFade2Alpha = (0.7 + rand() * 0.2).toFixed(3);
        const inkFadeAngle = Math.round(-45 + rand() * 90);

        cardEl.style.setProperty('--wear-scuff-x', `${scuffX}%`);
        cardEl.style.setProperty('--wear-scuff-y', `${scuffY}%`);
        cardEl.style.setProperty('--wear-scuff2-x', `${scuff2X}%`);
        cardEl.style.setProperty('--wear-scuff2-y', `${scuff2Y}%`);
        cardEl.style.setProperty('--wear-scratch-angle', `${scratchAngle}deg`);
        cardEl.style.setProperty('--wear-scratch-angle-2', `${scratchAngle2}deg`);
        cardEl.style.setProperty('--wear-scratch-alpha', scratchAlpha);
        cardEl.style.setProperty('--wear-fold-alpha', foldAlpha);
        cardEl.style.setProperty('--wear-fold-angle', `${foldAngle}deg`);
        cardEl.style.setProperty('--wear-fold-x', `${foldX}%`);
        cardEl.style.setProperty('--wear-fold-y', `${foldY}%`);
        cardEl.style.setProperty('--wear-tear-alpha', tearAlpha);
        cardEl.style.setProperty('--wear-tear-angle', `${tearAngle}deg`);
        cardEl.style.setProperty('--wear-tear-size', `${tearSize}%`);
        cardEl.style.setProperty('--wear-stain-alpha', stainAlpha);
        cardEl.style.setProperty('--wear-stain-x', `${stainX}%`);
        cardEl.style.setProperty('--wear-stain-y', `${stainY}%`);
        cardEl.style.setProperty('--wear-stain-size', `${stainSize}%`);
        cardEl.style.setProperty('--wear-graphite-alpha', graphiteAlpha);
        cardEl.style.setProperty('--wear-graphite-x', `${graphiteX}%`);
        cardEl.style.setProperty('--wear-graphite-y', `${graphiteY}%`);
        cardEl.style.setProperty('--wear-graphite-size', `${graphiteSize}%`);
        cardEl.style.setProperty('--wear-dust-alpha', dustAlpha);
        cardEl.style.setProperty('--wear-dust-x', `${dustX}%`);
        cardEl.style.setProperty('--wear-dust-y', `${dustY}%`);
        cardEl.style.setProperty('--wear-dust-size', `${dustSize}%`);
        cardEl.style.setProperty('--wear-nicotine-alpha', nicotineAlpha);
        cardEl.style.setProperty('--wear-nicotine-x', `${nicotineX}%`);
        cardEl.style.setProperty('--wear-nicotine-y', `${nicotineY}%`);
        cardEl.style.setProperty('--wear-nicotine-size', `${nicotineSize}%`);
        cardEl.style.setProperty('--wear-warp-alpha', warpAlpha);
        cardEl.style.setProperty('--wear-warp-angle', `${warpAngle}deg`);
        cardEl.style.setProperty('--wear-warp-x', `${warpX}%`);
        cardEl.style.setProperty('--wear-warp-y', `${warpY}%`);
        cardEl.style.setProperty('--wear-ink-alpha', inkAlpha);
        cardEl.style.setProperty('--wear-ink-angle', `${inkAngle}deg`);
        cardEl.style.setProperty('--wear-ink-x', `${inkX}%`);
        cardEl.style.setProperty('--wear-ink-y', `${inkY}%`);
        cardEl.style.setProperty('--wear-matte-alpha', matteAlpha);
        cardEl.style.setProperty('--wear-matte-x', `${matteX}%`);
        cardEl.style.setProperty('--wear-matte-y', `${matteY}%`);
        cardEl.style.setProperty('--wear-matte-size', `${matteSize}%`);
        cardEl.style.setProperty('--wear-ink-fade-x', `${inkFadeX}%`);
        cardEl.style.setProperty('--wear-ink-fade-y', `${inkFadeY}%`);
        cardEl.style.setProperty('--wear-ink-fade-size', `${inkFadeSize}%`);
        cardEl.style.setProperty('--wear-ink-fade-alpha', inkFadeAlpha);
        cardEl.style.setProperty('--wear-ink-fade2-x', `${inkFade2X}%`);
        cardEl.style.setProperty('--wear-ink-fade2-y', `${inkFade2Y}%`);
        cardEl.style.setProperty('--wear-ink-fade2-size', `${inkFade2Size}%`);
        cardEl.style.setProperty('--wear-ink-fade2-alpha', inkFade2Alpha);
        cardEl.style.setProperty('--wear-ink-fade-angle', `${inkFadeAngle}deg`);
    },

    /**
     * Returns true when a plain object looks like a serialized card.
     * @param {*} value
     * @returns {boolean}
     */
    isCardLike: function (value) {
        return !!(value
            && typeof value === 'object'
            && typeof value.suit === 'string'
            && typeof value.val === 'string');
    },

    /**
     * Rebuilds a serialized card into a runtime Card instance.
     * @param {Object} cardData
     * @returns {Object}
     */
    reviveCardObject: function (cardData) {
        if (!this.isCardLike(cardData)) return cardData;

        if (typeof Card === 'function') {
            const revived = new Card(cardData.suit, cardData.val);
            revived.hidden = !!cardData.hidden;
            revived.isSplitCard = !!cardData.isSplitCard;
            if (Number.isFinite(cardData.rotation)) {
                revived.rotation = cardData.rotation;
            }
            Object.keys(cardData).forEach((key) => {
                if (key === 'suit' || key === 'val' || key === 'hidden' || key === 'isSplitCard' || key === 'rotation') return;
                revived[key] = cardData[key];
            });
            return revived;
        }

        return {
            ...cardData,
            rank: (typeof window !== 'undefined' && window.CardRankOverrides && Number.isFinite(window.CardRankOverrides[cardData.val]))
                ? window.CardRankOverrides[cardData.val]
                : cardData.val === 'A' ? 1
                    : cardData.val === 'J' ? 11
                        : cardData.val === 'C' ? 12
                            : cardData.val === 'Q' ? 12
                                : cardData.val === 'K' ? 13
                                    : parseInt(cardData.val, 10),
            color: (cardData.suit === '♥' || cardData.suit === '♦') ? 'red' : 'black'
        };
    },

    /**
     * Recursively revives serialized cards inside saved state payloads.
     * @param {*} value
     * @returns {*}
     */
    hydrateSavedValue: function (value) {
        if (Array.isArray(value)) {
            return value.map((entry) => this.hydrateSavedValue(entry));
        }
        if (!value || typeof value !== 'object') {
            return value;
        }
        if (this.isCardLike(value)) {
            return this.reviveCardObject(value);
        }
        const hydrated = {};
        Object.entries(value).forEach(([key, entry]) => {
            hydrated[key] = this.hydrateSavedValue(entry);
        });
        return hydrated;
    },

    getCardIdentityHash: function (card) {
        const identity = `${card && card.val ? card.val : ''}${card && card.suit ? card.suit : ''}:${Number.isFinite(card && card.rotation) ? card.rotation : ''}`;
        let hash = 0;
        for (let i = 0; i < identity.length; i++) {
            hash = (hash * 31 + identity.charCodeAt(i)) >>> 0;
        }
        return hash || 1;
    },

    isCinderfallDeckActive: function () {
        return typeof document !== 'undefined'
            && !!document.body
            && document.body.classList.contains('deck-cinderfall');
    },

    getDeterministicBurnProfile: function (card) {
        if (!card) return null;
        const hash = this.getCardIdentityHash(card);
        const cached = this.burnProfileCache.get(hash);
        if (cached) return cached;

        let state = hash;
        const rand = () => {
            state = (1664525 * state + 1013904223) >>> 0;
            return state / 4294967296;
        };
        const roll = rand();
        let profile = 'none';
        if (roll < 0.4) profile = 'none';
        else if (roll < 0.58) profile = 'lite-a';
        else if (roll < 0.74) profile = 'lite-b';
        else if (roll < 0.88) profile = 'lite-c';
        else if (roll < 0.97) profile = 'mid-a';
        else if (roll < 0.995) profile = 'mid-b';
        else profile = 'heavy';

        const profileData = {
            profile,
            // Negative delays keep animations phase-shifted but immediately visible on render.
            glowDelay: `-${(rand() * 2.35).toFixed(3)}s`,
            emberDelay: `-${(rand() * 2.2).toFixed(3)}s`,
            smokeDuration: `${(7.2 + rand() * 2.4).toFixed(3)}s`,
            smokeLeft: `-${(2 + rand() * 5).toFixed(2)}px`,
            smokeRight: `${(2 + rand() * 5).toFixed(2)}px`,
            smokeMid: `${(-2 + rand() * 4).toFixed(2)}px`
        };
        this.burnProfileCache.set(hash, profileData);
        return profileData;
    },

    /**
     * Preloads audio assets.
     * @param {Object} soundFiles - Mapping of sound types to arrays of filenames.
     */
    preloadAudio: function (soundFiles) {
        for (const [type, filepaths] of Object.entries(soundFiles)) {
            this.audioAssets[type] = filepaths.map(path => {
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
    },

    /**
     * Plays a sound of a given type.
     * @param {string} type - Sound type.
     */
    playSound: function (type) {
        if (this.audioAssets[type]) {
            const sounds = this.audioAssets[type];
            const audioChoice = sounds[Math.floor(Math.random() * sounds.length)];
            const audio = new Audio(audioChoice.src);
            audio.volume = 0.05;
            if (type === 'card' || type === 'chip') {
                audio.volume = 0.3;
            }
            audio.play().catch(e => {
                console.warn(`Could not play ${type} sound:`, e.message);
            });
        } else {
            console.warn("Audio not implemented for: " + type);
        }
    },

    /**
     * Creates a shoe of cards.
     * @param {number} deckCount - Number of decks.
     * @param {Array} suits - Array of suit symbols.
     * @param {Array} values - Array of value symbols.
     * @returns {Array} Shuffled array of Card objects.
     */
    createShoe: function (deckCount, suits, values) {
        let shoe = [];
        for (let i = 0; i < deckCount; i++) {
            for (let s of suits) {
                for (let v of values) {
                    shoe.push(new Card(s, v));
                }
            }
        }
        // Fisher-Yates Shuffle
        for (let i = shoe.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
        }
        return shoe;
    },

    /**
     * Creates a DOM element representation of a card.
     * @param {Object} card - Card object.
     * @returns {HTMLElement}
     */
    createCardEl: function (card) {
        const isJoker = card && (card.isJoker === true || card.val === 'JK');
        const getJokerColor = () => {
            if (!isJoker) return card.color;
            const explicitColor = typeof card.jokerColor === 'string' ? card.jokerColor.toLowerCase() : '';
            if (explicitColor === 'red' || explicitColor === 'black') return explicitColor;
            if (card.isRedJoker === true) return 'red';
            if (card.isBlackJoker === true) return 'black';
            const suit = typeof card.suit === 'string' ? card.suit : '';
            const suitLower = suit.toLowerCase();
            if (suit === '♥' || suit === '♦' || suitLower.includes('red') || suitLower.includes('heart') || suitLower.includes('diamond')) {
                return 'red';
            }
            if (suit === '♣' || suit === '♠' || suitLower.includes('black') || suitLower.includes('club') || suitLower.includes('spade')) {
                return 'black';
            }
            return card.color === 'red' ? 'red' : 'black';
        };
        const displayColor = getJokerColor();
        const div = document.createElement('div');
        div.className = `card ${displayColor}${card.hidden ? ' hidden' : ''}${card.isSplitCard ? ' split-card' : ''}${isJoker ? ' joker' : ''}`;
        div.dataset.suit = card.suit;
        div.dataset.val = card.val;
        div.dataset.rank = card.rank;
        div.dataset.color = displayColor;
        if (isJoker) div.dataset.jokerColor = displayColor;
        if (!card.hidden && this.isCinderfallDeckActive()) {
            const burnProfile = this.getDeterministicBurnProfile(card);
            div.dataset.burnProfile = burnProfile.profile;
            div.style.setProperty('--cinderfall-glow-delay', burnProfile.glowDelay);
            div.style.setProperty('--cinderfall-ember-delay', burnProfile.emberDelay);
            div.style.setProperty('--cinderfall-smoke-duration', burnProfile.smokeDuration);
            div.style.setProperty('--cinderfall-smoke-left', burnProfile.smokeLeft);
            div.style.setProperty('--cinderfall-smoke-right', burnProfile.smokeRight);
            div.style.setProperty('--cinderfall-smoke-mid', burnProfile.smokeMid);
        }
        // if we can give it a random rotation, let's do that
        if (card.rotation !== undefined) {
            div.style.transform = `rotate(${card.rotation}deg) scale(var(--card-scale))`;
        }
        const valTop = document.createElement('div');
        valTop.className = 'val-top';
        if (isJoker) {
            valTop.innerHTML = `<span class="val-rank">JK</span>`;
        } else {
            valTop.innerHTML = `<span class="val-rank">${card.val}</span><br><small>${card.suit}</small>`;
        }
        div.appendChild(valTop);

        const suitCenter = document.createElement('div');
        suitCenter.className = 'suit-center';
        if (isJoker) {
            const icon = document.createElement('span');
            icon.className = 'joker-face-art';
            suitCenter.appendChild(icon);
        } else {
            suitCenter.textContent = card.suit;
        }
        div.appendChild(suitCenter);

        const valBot = document.createElement('div');
        valBot.className = 'val-bot';
        if (isJoker) {
            valBot.innerHTML = `<span class="val-rank">JK</span>`;
        } else {
            valBot.innerHTML = `<span class="val-rank">${card.val}</span><br><small>${card.suit}</small>`;
        }
        div.appendChild(valBot);

        return div;
    },

    /**
     * Renders a waste pile fan from left to right, with the newest card on the right.
     * @param {Object} options
     * @param {HTMLElement} options.containerEl
     * @param {Array} options.waste
     * @param {number} [options.visibleCount=3]
     * @param {number} [options.fanOffset=0]
     * @param {string} [options.fanStyle='ltr'] - 'ltr' or 'classic'
     * @param {Function} [options.createCardEl]
     * @param {Function} [options.onCard]
     */
    renderWasteFanPile: function (options = {}) {
        const containerEl = options.containerEl;
        const waste = Array.isArray(options.waste) ? options.waste : [];
        if (!containerEl || waste.length === 0) return;

        const requestedVisible = Number.isFinite(options.visibleCount)
            ? Math.max(1, Math.floor(options.visibleCount))
            : 3;
        const visibleCount = Math.min(requestedVisible, waste.length);
        const startIndex = waste.length - visibleCount;
        const fanOffset = Number.isFinite(options.fanOffset) ? options.fanOffset : 0;
        const fanStyle = options.fanStyle === 'classic' ? 'classic' : 'ltr';
        const createCardEl = typeof options.createCardEl === 'function'
            ? options.createCardEl
            : (card) => this.createCardEl(card);
        const onCard = typeof options.onCard === 'function' ? options.onCard : null;

        for (let i = startIndex; i < waste.length; i++) {
            const card = waste[i];
            const visibleIndex = i - startIndex;
            const isTop = i === waste.length - 1;
            const cardEl = createCardEl(card);
            let xOffset = visibleIndex * fanOffset;
            if (fanStyle === 'classic') {
                if (visibleCount === 2) {
                    xOffset = visibleIndex === 0 ? 0 : fanOffset;
                } else if (visibleCount >= 3) {
                    // Classic spread: newest card centered on top, older cards peek left/right.
                    const center = Math.floor((visibleCount - 1) / 2);
                    if (visibleIndex === visibleCount - 1) {
                        xOffset = center * fanOffset;
                    } else if (visibleIndex < center) {
                        xOffset = visibleIndex * fanOffset;
                    } else {
                        xOffset = (visibleIndex + 1) * fanOffset;
                    }
                }
            }
            cardEl.style.position = 'absolute';
            cardEl.style.marginLeft = '0';
            cardEl.style.left = `${xOffset}px`;
            cardEl.style.zIndex = String(visibleIndex + 1);
            if (onCard) {
                onCard({
                    cardEl,
                    card,
                    index: i,
                    visibleIndex,
                    visibleCount,
                    isTop
                });
            }
            containerEl.appendChild(cardEl);
        }
    },

    /**
     * Updates the visual representation of the shoe.
     * @param {HTMLElement} cardStack - Container for card stack.
     * @param {Array} shoe - The cards in the shoe.
     * @param {boolean} isShuffling - Whether the game is currently shuffling.
     * @param {number} deckCount - Total deck count for scaling.
     * @param {number} totalInitialCards - Initial total cards for separator positioning.
     */
    updateShoeVisual: function (cardStack, shoe, isShuffling, deckCount, totalInitialCards) {
        if (!cardStack) return;

        requestAnimationFrame(() => {
            cardStack.innerHTML = '';
            if (shoe.length === 0 || isShuffling) return;

            const totalCards = shoe.length;
            const separatorIndex = shoe.findIndex(card => card.isSplitCard);

            // 1. SET REALISTIC BOUNDS
            // A real 8-deck stack is ~12.5cm. 260px is a realistic "UI size" for this.
            // If you want it "Life-Size" (1px = 1 card), change this to 416.
            const MAX_PHYSICAL_WIDTH = 260;

            // 2. UNPACKING & SAMPLING LOGIC
            // The shoe fills up to 260px. If > 260 cards, we compress (decimate).
            // If < 260 cards, we use 1px per card (the "unpacking" effect).
            const visualLines = Math.min(totalCards, MAX_PHYSICAL_WIDTH);
            const reductionFactor = totalCards / visualLines;

            for (let i = 0; i < visualLines; i++) {
                // Mapping: i=0 is the bottom (right), i=max is the top/mouth (left).
                const realIndex = Math.floor(i * reductionFactor);

                // Position 0 is the mouth. Higher values are deeper in the shoe.
                const leftPos = visualLines - i;

                const line = document.createElement('div');
                // Alternate classes to preserve the "paper edge" texture from the intern's CSS
                line.className = (i % 2 === 0) ? 'card-back-line' : 'card-edge-line';

                line.style.cssText = `
                    position: absolute;
                    width: 1px;
                    height: 70px;
                    left: ${leftPos}px;
                    z-index: ${i};
                `;

                // 3. CORRECT CUT CARD POSITION
                // We highlight the line if the separator falls within this sampled slice.
                if (separatorIndex !== -1 && Math.abs(realIndex - separatorIndex) < reductionFactor) {
                    line.style.width = '2px'; // Make the plastic slightly visible
                    line.style.background = 'linear-gradient(0deg, #FFEED7 0%, #FFEEA5 50%, #FFEED7 100%)';
                    line.style.zIndex = 1000;
                }

                cardStack.appendChild(line);
            }
            // finally, place the top card so it comes out of the lip
            const previewEl = document.getElementById('top-card-preview');
            if (!previewEl || shoe.length === 0) {
                // no card to draw
                if (previewEl) {
                    // if we have a draw pile/shoe and no card to draw, hide it
                    previewEl.style.opacity = 0;
                }
                return;
            }
            previewEl.innerHTML = '';
            previewEl.style.opacity = 0.92;
            let topCard = this.createCardEl(shoe[shoe.length - 1]);
            topCard.classList.add('hidden');
            topCard.classList.add('top-card-preview-card');
            topCard.style.zIndex = visualLines + 1;
            const TOP_CARD_ROTATION_MAX = 2;
            const TOP_CARD_ROTATION_MIN = -3;
            let rot = Math.floor(Math.random() * (TOP_CARD_ROTATION_MAX - TOP_CARD_ROTATION_MIN + 1)) + TOP_CARD_ROTATION_MIN;
            topCard.style.transform = `rotate(${rot}deg) scale(var(--card-scale))`;
            previewEl.appendChild(topCard);
        });
    },

    /**
     * Animates a card being drawn from the shoe.
     * @param {HTMLElement} shoeBody - The shoe element to start from.
     * @param {number} destX - Target X coordinate.
     * @param {number} destY - Target Y coordinate.
     * @param {Function} onComplete - Callback when animation finishes.
     */
    animateCardDraw: function (shoeBody, destX, destY, onComplete, options = {}) {
        if (!shoeBody) return;
        const duration = typeof options.duration === 'number' ? options.duration : 400;

        const flyingCard = document.createElement('div');
        flyingCard.className = 'card hidden';
        flyingCard.style.position = 'fixed';
        flyingCard.style.width = '70px';
        flyingCard.style.height = '95px';
        flyingCard.style.zIndex = '1000';
        flyingCard.style.transition = `all ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
        flyingCard.style.pointerEvents = 'none';
        flyingCard.style.opacity = '0.95';
        flyingCard.style.borderRadius = '6px';
        flyingCard.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4), inset 0 0 10px rgba(255,255,255,0.1)';

        const shoeRect = shoeBody.getBoundingClientRect();
        flyingCard.style.left = `${shoeRect.left + 5}px`;
        flyingCard.style.top = `${shoeRect.top + 15}px`;

        document.body.appendChild(flyingCard);
        let rot = Math.floor(Math.random() * (11)) - 5;

        setTimeout(() => {
            flyingCard.style.left = `${destX}px`;
            flyingCard.style.top = `${destY}px`;
            const scale = getComputedStyle(document.documentElement).getPropertyValue('--card-scale');
            const scaleValue = parseFloat(scale) || 1;
            flyingCard.style.transform = `scale(${scaleValue * 0.8}) rotate(${rot}deg)`;
            flyingCard.style.opacity = '0.7';

            setTimeout(() => {
                if (flyingCard.parentNode) {
                    flyingCard.parentNode.removeChild(flyingCard);
                }
                if (onComplete) onComplete();
            }, duration);
        }, 10);
    },

    /**
     * Shows a lightweight toast inside the game table.
     * @param {string} message - Toast text.
     * @param {Object} options - Options for toast rendering.
     */
    showTableToast: function (message, options = {}) {
        if (!message) return;
        const container = options.container
            || (options.containerId ? document.getElementById(options.containerId) : null)
            || document.getElementById('table')
            || document.getElementById('klondike-table');
        if (!container) return;

        const existing = container.querySelector('.table-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'table-toast';
        if (options.variant) {
            toast.classList.add(`table-toast--${options.variant}`);
        }
        toast.textContent = message;
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        const duration = typeof options.duration === 'number' ? options.duration : 1800;
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, { once: true });
        }, duration);
    },

    /**
     * Returns a score display string or "BUST".
     * @param {number} score - The score.
     * @returns {string}
     */
    getScoreDisplay: function (score) {
        if (score > 21) return 'BUST (' + score + ')';
        return score.toString();
    },

    /**
     * Mobile detection utility.
     */
    isMobile: function () {
        return window.matchMedia('(max-width: 768px)').matches ||
            navigator.maxTouchPoints > 0 ||
            'ontouchstart' in window;
    }
};

class StateManager {
    constructor(options = {}) {
        this.gameId = options.gameId || 'game';
        this.getState = typeof options.getState === 'function' ? options.getState : null;
        this.setState = typeof options.setState === 'function' ? options.setState : null;
        this.isWon = typeof options.isWon === 'function' ? options.isWon : null;
        this.minIntervalMs = Number.isFinite(options.minIntervalMs) ? options.minIntervalMs : 2000;
        this.maxIntervalMs = Number.isFinite(options.maxIntervalMs) ? options.maxIntervalMs : 10000;
        this.key = `bj_table.save.${this.gameId}`;
        this.lastSave = 0;
        this.dirty = false;
        this.saveTimer = null;
        this.flushTimer = setInterval(() => this.flushIfDirty(), this.maxIntervalMs);
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            window.addEventListener('pagehide', () => this.saveNow());
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this.saveNow();
                }
            });
        }
    }

    load() {
        if (!this.setState) return false;
        let raw = null;
        try {
            raw = localStorage.getItem(this.key);
        } catch (err) {
            return false;
        }
        if (!raw) return false;
        try {
            const payload = JSON.parse(raw);
            if (!payload || !payload.state || typeof payload.state !== 'object') return false;
            if (payload.state.isGameWon) {
                this.clear();
                return false;
            }
            const hydratedState = typeof CommonUtils.hydrateSavedValue === 'function'
                ? CommonUtils.hydrateSavedValue(payload.state)
                : payload.state;
            this.setState(hydratedState);
            return true;
        } catch (err) {
            return false;
        }
    }

    markDirty() {
        this.dirty = true;
        const now = Date.now();
        const elapsed = now - this.lastSave;
        if (elapsed >= this.minIntervalMs) {
            this.saveNow();
            return;
        }
        this.scheduleSave(this.minIntervalMs - elapsed);
    }

    save() {
        this.markDirty();
    }

    scheduleSave(delay) {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        this.saveTimer = setTimeout(() => this.saveNow(), Math.max(0, delay));
    }

    flushIfDirty() {
        if (!this.dirty) return;
        const now = Date.now();
        if (now - this.lastSave >= this.minIntervalMs) {
            this.saveNow();
        }
    }

    saveNow() {
        if (!this.dirty || !this.getState) return;
        if (this.isWon && this.isWon()) {
            this.clear();
            return;
        }
        const state = this.getState();
        if (!state || typeof state !== 'object') return;
        try {
            const payload = {
                version: 1,
                updatedAt: Date.now(),
                state
            };
            localStorage.setItem(this.key, JSON.stringify(payload));
            this.lastSave = Date.now();
            this.dirty = false;
        } catch (err) {
            // Ignore storage failures.
        }
    }

    clear() {
        try {
            localStorage.removeItem(this.key);
        } catch (err) {
            // Ignore storage failures.
        }
        this.dirty = false;
        this.lastSave = Date.now();
    }

    destroy() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
    }
}

CommonUtils.StateManager = StateManager;

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CommonUtils;
}
