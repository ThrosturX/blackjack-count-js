(() => {
    const fallbackThemes = {
        table: {
            core: new Map([
                ['Green Felt', 'felt']
            ]),
            extras: new Map([
                ['Crimson Velvet', 'crimson'],
                ['Lavender Dusk', 'lavender'],
                ['Ocean Depths', 'depths'],
                ['Rolling Waves', 'waves'],
                ['Dark Stone', 'stone'],
                ['Neon Nights', 'neon'],
                ['Cyberpunk Grid', 'cyber'],
                ['Obsidian Floor', 'obsidian'],
                ['The Abyss', 'abyss']
            ])
        },
        deck: {
            core: new Map([
                ['Red Striped', 'red']
            ]),
            extras: new Map([
                ['Blue Classic', 'blue'],
                ['Green Pattern', 'green'],
                ['Royal Gold', 'gold'],
                ['Regal Velvet', 'velvet'],
                ['Oceanic', 'oceanic'],
                ['Cetaceous', 'whale'],
                ['Woolly', 'mammoth'],
                ['Emerald Luxe', 'emerald'],
                ['Ruby Luxe', 'ruby'],
                ['Cherry Blossom', 'cherry'],
                ['Starlight', 'starlight'],
                ['Midnight Luxe', 'dark'],
                ['Midnight Onyx', 'luxury-dark'],
                ['Neon Vibe', 'neon-vibe'],
                ['Ghost Ship', 'ghost']
            ])
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
        populateSelect(document.getElementById('table-style-select'), catalog.table, 'felt', allowExtras);
        populateSelect(document.getElementById('deck-style-select'), catalog.deck, 'red', allowExtras);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initThemes);
    } else {
        initThemes();
    }
})();
