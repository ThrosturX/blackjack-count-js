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
    const appProfile = (window.AppProfile && typeof window.AppProfile === 'object') ? window.AppProfile : {};

    const parseCsvDataset = (value) => {
        if (!value || typeof value !== 'string') return null;
        const items = value
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
        return items.length ? new Set(items) : null;
    };

    const getAddonToggleAllowlist = () => {
        const bodyAllow = parseCsvDataset(document.body?.dataset?.addonToggleAllowlist);
        if (bodyAllow) return bodyAllow;
        if (Array.isArray(appProfile.addonToggleAllowlist) && appProfile.addonToggleAllowlist.length) {
            return new Set(appProfile.addonToggleAllowlist.map(String));
        }
        return null;
    };

    const shouldShowAddonToggle = (addon) => {
        if (!addon || !addon.id) return false;
        if (addon.id === 'default-themes') return false;
        const allowlist = getAddonToggleAllowlist();
        if (!allowlist) return true;
        return allowlist.has(addon.id);
    };

    const shouldAutoEnableHiddenAddons = () => (
        document.body?.dataset?.autoEnableHiddenAddons === 'true'
        || appProfile.autoEnableHiddenAddons === true
    );

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

    const getThemeDefaults = () => {
        const profileDefaults = appProfile.themeDefaults && typeof appProfile.themeDefaults === 'object'
            ? appProfile.themeDefaults
            : {};
        return {
            table: document.body?.dataset?.themeDefaultTable || profileDefaults.table || null,
            deck: document.body?.dataset?.themeDefaultDeck || profileDefaults.deck || null
        };
    };

    const applyThemeDefaultsIfNeeded = () => {
        const defaults = getThemeDefaults();
        const updates = {};
        if (!storedSettings.table && defaults.table) updates.table = defaults.table;
        if (!storedSettings.deck && defaults.deck) updates.deck = defaults.deck;
        if (!Object.keys(updates).length) return;
        persistSettings(updates);
    };

    const applyAddonDefaultsIfNeeded = () => {
        if (!window.AddonLoader || !window.AddonLoader.addons || !window.AddonLoader.addons.size) return;
        const defaults = appProfile.addonDefaults && typeof appProfile.addonDefaults === 'object'
            ? appProfile.addonDefaults
            : {};
        if (document.body?.dataset?.addonDefaultClassicFaces === 'true') {
            defaults['classic-faces'] = true;
        }
        Object.entries(defaults).forEach(([id, enabled]) => {
            if (!window.AddonLoader.addons.has(id)) return;
            if (typeof storedSettings.addons?.[id] === 'boolean') return;
            const shouldEnable = enabled !== false;
            window.AddonLoader.setAddonEnabled(id, shouldEnable);
            persistSettings({ addons: { [id]: shouldEnable } });
        });
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
        const addonsLoaded = window.AddonLoader && window.AddonLoader.addons && window.AddonLoader.addons.size > 0;
        const allowExtras = themesCssLoaded() || addonsLoaded;
        const tableSelect = document.getElementById('table-style-select');
        const deckSelect = document.getElementById('deck-style-select');
        const tablePreferred = tableSelect?.dataset.themeForce || storedSettings.table;
        const deckPreferred = deckSelect?.dataset.themeForce || storedSettings.deck;
        populateSelect(tableSelect, {
            core: catalog.core.table,
            extras: catalog.extras.table
        }, 'felt', allowExtras, tablePreferred);
        populateSelect(deckSelect, {
            core: catalog.core.deck,
            extras: catalog.extras.deck
        }, 'red', allowExtras, deckPreferred);

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
        addons.forEach((addon) => {
            if (!addon || !addon.id) return;
            if (!shouldAutoEnableHiddenAddons()) return;
            if (shouldShowAddonToggle(addon)) return;
            window.AddonLoader.setAddonEnabled(addon.id, true);
            persistSettings({ addons: { [addon.id]: true } });
        });
        Object.entries(storedSettings.addons || {}).forEach(([id, enabled]) => {
            if (!addons.has(id)) return;
            window.AddonLoader.setAddonEnabled(id, enabled !== false);
        });
    };

    const shouldPersistThemeSelect = (select) => select && select.dataset.themePersist !== 'false';

    const bindSelectPersistence = () => {
        const tableSelect = document.getElementById('table-style-select');
        const deckSelect = document.getElementById('deck-style-select');
        if (tableSelect && tableSelect.dataset.persistBound !== 'true' && shouldPersistThemeSelect(tableSelect)) {
            tableSelect.addEventListener('change', () => {
                persistSettings({ table: tableSelect.value });
            });
            tableSelect.dataset.persistBound = 'true';
        }
        if (deckSelect && deckSelect.dataset.persistBound !== 'true' && shouldPersistThemeSelect(deckSelect)) {
            deckSelect.addEventListener('change', () => {
                persistSettings({ deck: deckSelect.value });
            });
            deckSelect.dataset.persistBound = 'true';
        }
    };

    const getAddonToggleContainer = () => document.getElementById('addons-toggle-list');
    const resolveStoreHref = () => 'store.html';
    const getCurrentGameId = () => {
        const path = (window.location && window.location.pathname) || '';
        const file = path.split('/').pop() || '';
        return file.replace(/\.html$/i, '').toLowerCase();
    };

    const addonSupportsCurrentGame = (addon) => {
        const games = addon && Array.isArray(addon.games) ? addon.games : null;
        if (!games || !games.length) return true;
        const gameId = getCurrentGameId();
        return games.map(String).map(name => name.toLowerCase()).includes(gameId);
    };

    const ensureAddonStoreLink = () => {
        const addonsArea = document.getElementById('addons-area');
        if (!addonsArea) return;
        const stats = addonsArea.querySelector('.stats');
        if (!stats) return;
        const shouldShowStore = appProfile.storeEnabled !== false
            && addonsArea.dataset.noStoreLink !== 'true'
            && document.body?.dataset?.noStoreLink !== 'true';
        let button = stats.querySelector('.addon-store-button');
        if (!shouldShowStore) {
            if (button && button.parentNode) button.parentNode.removeChild(button);
            return;
        }
        if (!button) {
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn-toggle btn-mini addon-store-button';
            button.textContent = 'Store';
            button.setAttribute('aria-label', 'Open store page');
            button.addEventListener('click', () => {
                window.location.href = resolveStoreHref();
            });
            stats.appendChild(button);
        }
    };

    const createAddonToggleLabel = (addon) => {
        const label = document.createElement('label');
        label.className = 'addon-toggle-card';

        const meta = document.createElement('div');
        meta.className = 'addon-toggle-meta';
        const titleRow = document.createElement('div');
        titleRow.className = 'addon-toggle-title-row';
        const title = document.createElement('span');
        title.className = 'addon-toggle-title';
        title.textContent = addon.label || addon.id;
        const badge = document.createElement('span');
        badge.className = 'addon-toggle-badge';
        const idLower = String(addon.id || '').toLowerCase();
        const labelLower = String(addon.label || '').toLowerCase();
        const descriptionLower = String(addon.description || '').toLowerCase();
        const classify = (text) => {
            if (text.includes('theme')) return 'Themes';
            if (text.includes('effect')) return 'Effects';
            if (text.includes('count')) return 'Counting';
            if (text.includes('deck') || text.includes('card')) return 'Cards';
            if (text.includes('sound') || text.includes('audio')) return 'Audio';
            return '';
        };
        const badgeText = classify(descriptionLower) || classify(idLower) || classify(labelLower) || 'Addon';
        badge.textContent = badgeText;
        const description = document.createElement('span');
        description.className = 'addon-toggle-description';
        description.textContent = addon.description || (badgeText === 'Themes'
            ? 'Adds extra table and deck styles'
            : badgeText === 'Effects'
                ? 'Adds visual effects and polish'
                : badgeText === 'Counting'
                    ? 'Adds extra counting systems'
                    : badgeText === 'Cards'
                        ? 'Adds card/deck styling'
                        : badgeText === 'Audio'
                            ? 'Adds sound variations'
                            : 'Toggle to apply styles or scripts');
        titleRow.append(title, badge);
        meta.append(titleRow, description);

        const control = document.createElement('div');
        control.className = 'addon-toggle-control';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.addonId = addon.id;
        input.checked = addon.enabled;

        const indicator = document.createElement('span');
        indicator.className = 'addon-toggle-indicator';
        const updateIndicator = () => {
            indicator.textContent = input.checked ? 'Enabled' : 'Disabled';
            label.classList.toggle('addon-toggle-card--active', input.checked);
        };
        updateIndicator();

        input.addEventListener('change', () => {
            window.AddonLoader.setAddonEnabled(addon.id, input.checked);
            persistSettings({ addons: { [addon.id]: input.checked } });
            initThemes();
            if (window.CountingUI && typeof window.CountingUI.refresh === 'function') {
                window.CountingUI.refresh();
            }
            updateIndicator();
        });

        control.append(input, indicator);
        label.append(meta, control);
        return label;
    };

    const initAddonToggles = () => {
        ensureAddonStoreLink();
        const container = getAddonToggleContainer();
        if (container) {
            container.innerHTML = '';
            container.classList.remove('addon-toggle-empty');
            const showMessage = (message) => {
                container.classList.add('addon-toggle-empty');
                container.textContent = message;
            };
            if (!window.AddonLoader || !window.AddonLoader.addons) {
                showMessage('Loading add-ons…');
            } else if (!window.AddonLoader.addons.size) {
                showMessage('No claimed add-ons available.');
            } else {
                let rendered = 0;
                window.AddonLoader.addons.forEach(addon => {
                    if (!addonSupportsCurrentGame(addon)) return;
                    if (!shouldShowAddonToggle(addon)) return;
                    container.appendChild(createAddonToggleLabel(addon));
                    rendered += 1;
                });
                if (!rendered) showMessage('No claimed add-ons available for this game.');
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
                    const enabled = input.dataset.addonId === 'default-themes';
                    input.checked = enabled;
                    window.AddonLoader.setAddonEnabled(input.dataset.addonId, enabled);
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
                applyThemeDefaultsIfNeeded();
                applyStoredAddonStates();
                applyAddonDefaultsIfNeeded();
                initThemes();
                bindSelectPersistence();
                initAddonToggles();
            });
        });
    } else {
        whenAddonsReady().then(() => {
            applyThemeDefaultsIfNeeded();
            applyStoredAddonStates();
            applyAddonDefaultsIfNeeded();
            initThemes();
            bindSelectPersistence();
            initAddonToggles();
        });
    }

    window.ThemeUI = { refresh: initThemes };
})();
