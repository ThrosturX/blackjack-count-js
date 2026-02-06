(() => {
    const fallbackThemes = {
        core: {
            table: new Map([
                ['Green Felt', 'felt']
            ]),
            deck: new Map([
                ['Red Striped', 'red']
            ])
        },
        extras: {
            table: new Map(),
            deck: new Map()
        }
    };

    const createOption = (label, value, group) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.dataset.themeGroup = group;
        return option;
    };

    const addOptions = (select, themes, group) => {
        for (const [label, value] of themes.entries()) {
            select.appendChild(createOption(label, value, group));
        }
    };

    const populateSeq = new WeakMap();
    const populateSelect = (select, themes, defaultValue, allowExtras) => {
        if (!select) return;

        const seq = (populateSeq.get(select) || 0) + 1;
        populateSeq.set(select, seq);
        const currentValue = select.value;
        select.innerHTML = '';
        addOptions(select, themes.core, 'core');
        if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
            select.value = currentValue;
        } else {
            select.value = defaultValue;
        }

        if (allowExtras) {
            requestAnimationFrame(() => {
                if (seq !== populateSeq.get(select)) return;
                addOptions(select, themes.extras, 'extras');
                if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
                    select.value = currentValue;
                }
            });
        }
    };

    const themesCssLoaded = () => {
        const value = getComputedStyle(document.documentElement)
            .getPropertyValue('--themes-css-loaded')
            .trim();
        return value === '1';
    };

    const applySelectValue = (select, value) => {
        if (!select) return;
        if (select.value === value) return;
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const initThemes = () => {
        const registry = window.AssetRegistry;
        const catalog = registry && typeof registry.getThemeCatalog === 'function'
            ? registry.getThemeCatalog()
            : fallbackThemes;
        const addonsLoaded = window.AddonLoader && window.AddonLoader.addons && window.AddonLoader.addons.size > 0;
        const allowExtras = themesCssLoaded() || addonsLoaded;
        const tableSelect = document.getElementById('table-style-select');
        const deckSelect = document.getElementById('deck-style-select');
        populateSelect(tableSelect, {
            core: catalog.core.table,
            extras: catalog.extras.table
        }, 'felt', allowExtras);
        populateSelect(deckSelect, {
            core: catalog.core.deck,
            extras: catalog.extras.deck
        }, 'red', allowExtras);

        if (catalog.extras.table.size === 0 && catalog.extras.deck.size === 0) {
            applySelectValue(tableSelect, 'diner');
            applySelectValue(deckSelect, 'worn');
        }
    };

    const whenAddonsReady = () => {
        if (window.AddonLoader && window.AddonLoader.ready) {
            return window.AddonLoader.ready.then(initThemes);
        }
        return initThemes();
    };

    const initAddonToggles = () => {
        const toggleEls = document.querySelectorAll('[data-addon-id]');
        if (!toggleEls.length || !window.AddonLoader) return;
        const addons = window.AddonLoader.addons || new Map();
        toggleEls.forEach(toggle => {
            if (toggle.dataset.addonBound === 'true') return;
            const id = toggle.getAttribute('data-addon-id');
            const addon = addons.get(id);
            if (addon) {
                toggle.checked = addon.enabled;
            }
            toggle.addEventListener('change', () => {
                window.AddonLoader.setAddonEnabled(id, toggle.checked);
                initThemes();
                if (window.CountingUI && typeof window.CountingUI.refresh === 'function') {
                    window.CountingUI.refresh();
                }
            });
            toggle.dataset.addonBound = 'true';
        });

        const resetButtons = document.querySelectorAll('#toggle-addons-all');
        resetButtons.forEach(button => {
            if (button.dataset.addonBound === 'true') return;
            button.addEventListener('click', () => {
                const toggles = document.querySelectorAll('[data-addon-id]');
                const allEnabled = Array.from(toggles).every(input => input.checked);
                toggles.forEach(input => {
                    input.checked = !allEnabled;
                    window.AddonLoader.setAddonEnabled(input.dataset.addonId, !allEnabled);
                });
                initThemes();
                if (window.CountingUI && typeof window.CountingUI.refresh === 'function') {
                    window.CountingUI.refresh();
                }
            });
            button.dataset.addonBound = 'true';
        });
        window.addEventListener('addons:changed', () => initThemes());
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            whenAddonsReady().then(initAddonToggles);
        });
    } else {
        whenAddonsReady().then(initAddonToggles);
    }

    window.ThemeUI = { refresh: initThemes };
})();
