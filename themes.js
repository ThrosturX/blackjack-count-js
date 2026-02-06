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

    const populateSelect = (select, themes, defaultValue, allowExtras) => {
        if (!select) return;

        select.innerHTML = '';
        addOptions(select, themes.core, 'core');
        select.value = defaultValue;

        if (allowExtras) {
            requestAnimationFrame(() => {
                addOptions(select, themes.extras, 'extras');
                select.value = defaultValue;
            });
        }
    };

    const themesCssLoaded = () => {
        const value = getComputedStyle(document.documentElement)
            .getPropertyValue('--themes-css-loaded')
            .trim();
        return value === '1';
    };

    const initThemes = () => {
        const registry = window.AssetRegistry;
        const catalog = registry && typeof registry.getThemeCatalog === 'function'
            ? registry.getThemeCatalog()
            : fallbackThemes;
        const allowExtras = themesCssLoaded();
        populateSelect(document.getElementById('table-style-select'), {
            core: catalog.core.table,
            extras: catalog.extras.table
        }, 'felt', allowExtras);
        populateSelect(document.getElementById('deck-style-select'), {
            core: catalog.core.deck,
            extras: catalog.extras.deck
        }, 'red', allowExtras);
    };

    const whenAddonsReady = () => {
        if (window.AddonLoader && window.AddonLoader.ready) {
            return window.AddonLoader.ready.then(initThemes);
        }
        return initThemes();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', whenAddonsReady);
    } else {
        whenAddonsReady();
    }
})();
