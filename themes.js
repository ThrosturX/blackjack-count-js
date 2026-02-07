(() => {
    const STORAGE_KEY = 'bj_table.settings';
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

    const loadSettings = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { addons: {} };
            const data = JSON.parse(raw);
            if (!data || typeof data !== 'object') return { addons: {} };
            if (!data.addons || typeof data.addons !== 'object') data.addons = {};
            return data;
        } catch (err) {
            return { addons: {} };
        }
    };

    let storedSettings = loadSettings();
    let isResetting = false;

    const persistSettings = (updates = {}) => {
        if (isResetting) return;
        const next = {
            ...storedSettings,
            ...updates,
            addons: {
                ...storedSettings.addons,
                ...(updates.addons || {})
            }
        };
        storedSettings = next;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (err) {
            // Ignore storage failures.
        }
    };

    const clearSettings = () => {
        storedSettings = { addons: {} };
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (err) {
            // Ignore storage failures.
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
    const hasOptionValue = (select, value) => {
        if (!select || !value) return false;
        return Array.from(select.options).some(option => option.value === value);
    };
    const resolveSelectValue = (select, preferredValue, fallbackValue) => {
        if (hasOptionValue(select, preferredValue)) return preferredValue;
        if (hasOptionValue(select, fallbackValue)) return fallbackValue;
        return select.options.length ? select.options[0].value : '';
    };
    const populateSelect = (select, themes, defaultValue, allowExtras, preferredValue) => {
        if (!select) return;

        const seq = (populateSeq.get(select) || 0) + 1;
        populateSeq.set(select, seq);
        const previousValue = select.value;
        const desiredValue = select.value || preferredValue || defaultValue;
        const desiredInExtras = allowExtras && Array.from(themes.extras.values()).includes(desiredValue);
        select.innerHTML = '';
        addOptions(select, themes.core, 'core');
        if (desiredInExtras) {
            // Avoid temporary fallback when the desired value lives in extras.
            let desiredLabel = null;
            for (const [label, value] of themes.extras.entries()) {
                if (value === desiredValue) {
                    desiredLabel = label;
                    break;
                }
            }
            const activeOption = createOption(desiredLabel || `${desiredValue} (Active)`, desiredValue, 'active');
            activeOption.dataset.tempActive = 'true';
            select.appendChild(activeOption);
            select.value = desiredValue;
        } else {
            select.value = resolveSelectValue(select, desiredValue, defaultValue);
            if (select.value !== previousValue) {
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        if (allowExtras) {
            requestAnimationFrame(() => {
                if (seq !== populateSeq.get(select)) return;
                addOptions(select, themes.extras, 'extras');
                const tempActive = select.querySelector('option[data-temp-active="true"]');
                if (tempActive && hasOptionValue(select, desiredValue)) {
                    // Remove the temporary option once real extras are added.
                    tempActive.remove();
                }
                const before = select.value;
                const resolved = resolveSelectValue(select, desiredValue, before);
                if (resolved && resolved !== before) {
                    select.value = resolved;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
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
        const addonsLoaded = window.AddonLoader
            && window.AddonLoader.addons
            && Array.from(window.AddonLoader.addons.values()).some(addon => addon.loaded && addon.enabled);
        const allowExtras = themesCssLoaded() || addonsLoaded;
        const tableSelect = document.getElementById('table-style-select');
        const deckSelect = document.getElementById('deck-style-select');
        populateSelect(tableSelect, {
            core: catalog.core.table,
            extras: catalog.extras.table
        }, 'felt', allowExtras, storedSettings.table);
        populateSelect(deckSelect, {
            core: catalog.core.deck,
            extras: catalog.extras.deck
        }, 'red', allowExtras, storedSettings.deck);

    };

    const whenAddonsReady = () => {
        if (window.AddonLoader && window.AddonLoader.ready) {
            return window.AddonLoader.ready.then(initThemes);
        }
        return initThemes();
    };

    const applyStoredAddonStates = () => {
        if (!window.AddonLoader || !window.AddonLoader.addons) return;
        const addons = window.AddonLoader.addons;
        Object.entries(storedSettings.addons || {}).forEach(([id, enabled]) => {
            if (!addons.has(id)) return;
            window.AddonLoader.setAddonEnabled(id, enabled !== false);
        });
    };

    const bindSelectPersistence = () => {
        const tableSelect = document.getElementById('table-style-select');
        const deckSelect = document.getElementById('deck-style-select');
        if (tableSelect && tableSelect.dataset.persistBound !== 'true') {
            tableSelect.addEventListener('change', () => {
                persistSettings({ table: tableSelect.value });
            });
            tableSelect.dataset.persistBound = 'true';
        }
        if (deckSelect && deckSelect.dataset.persistBound !== 'true') {
            deckSelect.addEventListener('change', () => {
                persistSettings({ deck: deckSelect.value });
            });
            deckSelect.dataset.persistBound = 'true';
        }
    };

    const getAddonToggleContainer = () => document.getElementById('addons-toggle-list');

    const createAddonToggleLabel = (addon) => {
        const label = document.createElement('label');
        label.className = 'addon-toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.addonId = addon.id;
        input.checked = addon.enabled;

        input.addEventListener('change', () => {
            window.AddonLoader.setAddonEnabled(addon.id, input.checked);
            persistSettings({ addons: { [addon.id]: input.checked } });
            initThemes();
            if (window.CountingUI && typeof window.CountingUI.refresh === 'function') {
                window.CountingUI.refresh();
            }
        });

        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${addon.label || addon.id}`));
        return label;
    };

    const initAddonToggles = () => {
        const container = getAddonToggleContainer();
        const addonsAvailable = window.AddonLoader && window.AddonLoader.addons;
        const addonsList = addonsAvailable ? Array.from(window.AddonLoader.addons.values()) : [];
        const visibleAddons = addonsList.filter(addon => addon.allowed);
        if (container) {
            container.innerHTML = '';
            if (!addonsAvailable) {
                container.textContent = 'Loading add-ons…';
            } else if (addonsList.some(addon => addon.requiresEntitlement) && !window.AddonLoader.entitlementsLoaded()) {
                container.textContent = 'Checking add-ons…';
            } else if (!visibleAddons.length) {
                container.textContent = 'No add-ons available.';
            } else {
                visibleAddons.forEach(addon => {
                    container.appendChild(createAddonToggleLabel(addon));
                });
            }
        }

        const toggleEls = document.querySelectorAll('[data-addon-id]');
        if (!toggleEls.length || !window.AddonLoader) return;

        const resetButtons = document.querySelectorAll('#toggle-addons-all');
        resetButtons.forEach(button => {
            if (button.dataset.addonBound === 'true') return;
            button.addEventListener('click', () => {
                const toggles = document.querySelectorAll('[data-addon-id]');
                const allEnabled = Array.from(toggles).every(input => input.checked);
                toggles.forEach(input => {
                    input.checked = !allEnabled;
                    window.AddonLoader.setAddonEnabled(input.dataset.addonId, !allEnabled);
                    persistSettings({ addons: { [input.dataset.addonId]: !allEnabled } });
                });
                initThemes();
                if (window.CountingUI && typeof window.CountingUI.refresh === 'function') {
                    window.CountingUI.refresh();
                }
            });
            button.dataset.addonBound = 'true';
        });

        const clearButtons = document.querySelectorAll('#clear-addon-storage');
        clearButtons.forEach(button => {
            if (button.dataset.addonBound === 'true') return;
            button.addEventListener('click', () => {
                clearSettings();
                isResetting = true;
                window.__settingsResetInProgress = true;
                const toggles = document.querySelectorAll('[data-addon-id]');
                toggles.forEach(input => {
                    const addon = window.AddonLoader.addons.get(input.dataset.addonId);
                    const defaultEnabled = addon ? addon.optInDefault === true : false;
                    input.checked = defaultEnabled;
                    window.AddonLoader.setAddonEnabled(input.dataset.addonId, defaultEnabled);
                });
                initThemes();
                applySelectValue(document.getElementById('table-style-select'), 'felt');
                applySelectValue(document.getElementById('deck-style-select'), 'red');
                applySelectValue(document.getElementById('count-system-select'), 'hi-lo');
                if (window.CountingUI && typeof window.CountingUI.refresh === 'function') {
                    window.CountingUI.refresh();
                }
                isResetting = false;
                window.__settingsResetInProgress = false;
            });
            button.dataset.addonBound = 'true';
        });
        window.addEventListener('addons:changed', () => initThemes());
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            whenAddonsReady().then(() => {
                applyStoredAddonStates();
                initThemes();
                bindSelectPersistence();
                initAddonToggles();
            });
        });
    } else {
        whenAddonsReady().then(() => {
            applyStoredAddonStates();
            initThemes();
            bindSelectPersistence();
            initAddonToggles();
        });
    }

    window.ThemeUI = { refresh: initThemes };
})();
