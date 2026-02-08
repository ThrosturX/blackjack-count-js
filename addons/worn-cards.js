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

    const parseHexColor = (hex) => {
        const clean = hex.replace('#', '').trim();
        if (clean.length === 3) {
            return [
                parseInt(clean[0] + clean[0], 16),
                parseInt(clean[1] + clean[1], 16),
                parseInt(clean[2] + clean[2], 16),
                1
            ];
        }
        if (clean.length === 6) {
            return [
                parseInt(clean.slice(0, 2), 16),
                parseInt(clean.slice(2, 4), 16),
                parseInt(clean.slice(4, 6), 16),
                1
            ];
        }
        return null;
    };

    const parseRgbColor = (value) => {
        const match = value.match(/rgba?\(([^)]+)\)/i);
        if (!match) return null;
        const parts = match[1].split(/[,\/\s]+/).filter(Boolean);
        if (parts.length < 3) return null;
        const r = parseFloat(parts[0]);
        const g = parseFloat(parts[1]);
        const b = parseFloat(parts[2]);
        const a = parts.length >= 4 ? parseFloat(parts[3]) : 1;
        if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
        return [r, g, b, a];
    };

    const parseColor = (value) => {
        if (!value) return null;
        if (value.startsWith('#')) return parseHexColor(value);
        if (value.startsWith('rgb')) return parseRgbColor(value);
        return null;
    };

    const findFirstColor = (value) => {
        if (!value || value === 'none') return null;
        const match = value.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/);
        return match ? parseColor(match[0]) : null;
    };

    const findAllColors = (value) => {
        if (!value || value === 'none') return [];
        const matches = value.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g);
        if (!matches) return [];
        return matches.map(parseColor).filter(Boolean);
    };

    const rgbToHsl = (r, g, b) => {
        const rn = r / 255;
        const gn = g / 255;
        const bn = b / 255;
        const max = Math.max(rn, gn, bn);
        const min = Math.min(rn, gn, bn);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case rn:
                    h = (gn - bn) / d + (gn < bn ? 6 : 0);
                    break;
                case gn:
                    h = (bn - rn) / d + 2;
                    break;
                default:
                    h = (rn - gn) / d + 4;
                    break;
            }
            h /= 6;
        }
        return [h, s, l];
    };

    const hslToRgb = (h, s, l) => {
        if (s === 0) {
            const v = Math.round(l * 255);
            return [v, v, v];
        }
        const hue2rgb = (p, q, t) => {
            let tt = t;
            if (tt < 0) tt += 1;
            if (tt > 1) tt -= 1;
            if (tt < 1 / 6) return p + (q - p) * 6 * tt;
            if (tt < 1 / 2) return q;
            if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
        const g = Math.round(hue2rgb(p, q, h) * 255);
        const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
        return [r, g, b];
    };

    const luminance = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    const setWearColorVars = (cardEl, vars) => {
        Object.entries(vars).forEach(([key, value]) => {
            if (value === null) {
                cardEl.style.removeProperty(key);
            } else {
                cardEl.style.setProperty(key, value);
            }
        });
    };

    const applyGrimePalette = (cardEl) => {
        const styles = getComputedStyle(cardEl);
        let base = null;
        const backgroundColors = findAllColors(styles.backgroundImage);
        if (backgroundColors.length) {
            base = backgroundColors.reduce((darkest, current) => {
                if (!darkest) return current;
                const darkLum = luminance(darkest[0], darkest[1], darkest[2]);
                const curLum = luminance(current[0], current[1], current[2]);
                return curLum < darkLum ? current : darkest;
            }, null);
        }
        if (!base || base[3] === 0) {
            base = parseColor(styles.backgroundColor);
        }
        if (!base || base[3] === 0) {
            setWearColorVars(cardEl, {
                '--wear-grime-rgb': null,
                '--wear-grime-rgb-2': null,
                '--wear-scuff-light-rgb': null,
                '--wear-scuff-dark-rgb': null
            });
            return;
        }

        if (document.body.classList.contains('deck-neon-vibe')) {
            if (cardEl.classList.contains('black')) {
                setWearColorVars(cardEl, {
                    '--wear-grime-rgb': '0, 210, 120',
                    '--wear-grime-rgb-2': '0, 185, 105',
                    '--wear-scuff-light-rgb': '30, 235, 155',
                    '--wear-scuff-dark-rgb': '0, 105, 65'
                });
                return;
            }
            if (cardEl.classList.contains('red')) {
                setWearColorVars(cardEl, {
                    '--wear-grime-rgb': '235, 0, 170',
                    '--wear-grime-rgb-2': '210, 0, 150',
                    '--wear-scuff-light-rgb': '245, 80, 200',
                    '--wear-scuff-dark-rgb': '135, 0, 85'
                });
                return;
            }
        }

        const [r, g, b] = base;
        const lum = luminance(r, g, b);
        const [h, s, l] = rgbToHsl(r, g, b);
        const hueDeg = h * 360;
        const isWarmTan = hueDeg >= 20 && hueDeg <= 55 && s >= 0.18 && l >= 0.62;
        if (lum > 0.74 || isWarmTan) {
            setWearColorVars(cardEl, {
                '--wear-grime-rgb': null,
                '--wear-grime-rgb-2': null,
                '--wear-scuff-light-rgb': null,
                '--wear-scuff-dark-rgb': null
            });
            return;
        }
        const darkMode = lum < 0.4;
        const grime = hslToRgb(h, s * 0.18, Math.max(0.06, l * (darkMode ? 0.72 : 0.8)));
        const grime2 = hslToRgb(h, s * 0.16, Math.max(0.08, l * (darkMode ? 0.78 : 0.86)));
        const scuffLight = hslToRgb(h, s * 0.14, Math.max(0.1, l * (darkMode ? 0.88 : 0.94)));
        const scuffDark = hslToRgb(h, s * 0.22, Math.max(0.06, l * (darkMode ? 0.6 : 0.68)));
        setWearColorVars(cardEl, {
            '--wear-grime-rgb': `${grime[0]}, ${grime[1]}, ${grime[2]}`,
            '--wear-grime-rgb-2': `${grime2[0]}, ${grime2[1]}, ${grime2[2]}`,
            '--wear-scuff-light-rgb': `${scuffLight[0]}, ${scuffLight[1]}, ${scuffLight[2]}`,
            '--wear-scuff-dark-rgb': `${scuffDark[0]}, ${scuffDark[1]}, ${scuffDark[2]}`
        });
    };

    const clearWearFromCardEl = (cardEl) => {
        if (!cardEl) return;
        wearVarNames.forEach((name) => cardEl.style.removeProperty(name));
        cardEl.style.removeProperty('--wear-grime-rgb');
        cardEl.style.removeProperty('--wear-grime-rgb-2');
        cardEl.style.removeProperty('--wear-scuff-light-rgb');
        cardEl.style.removeProperty('--wear-scuff-dark-rgb');
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
        applyGrimePalette(cardEl);
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
        const themeObserver = new MutationObserver(() => {
            if (!isWornEnabled()) return;
            document.querySelectorAll('.card').forEach((cardEl) => {
                if (cardEl.dataset.wearApplied === '1') {
                    applyGrimePalette(cardEl);
                }
            });
        });
        themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
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
