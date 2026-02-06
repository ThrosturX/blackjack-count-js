(() => {
    const themeCatalog = {
        core: {
            table: [],
            deck: []
        },
        extras: {
            table: [],
            deck: []
        }
    };

    const countingCatalog = {
        core: [],
        extras: []
    };

    const addonStates = new Map();

    const setAddonEnabled = (id, enabled) => {
        if (!id) return;
        addonStates.set(id, enabled);
    };

    const isAddonEnabled = (id) => {
        if (!id) return true;
        return addonStates.get(id) !== false;
    };

    const registerThemePack = (pack = {}) => {
        const group = pack.group === 'core' ? 'core' : 'extras';
        const table = Array.isArray(pack.table) ? pack.table : [];
        const deck = Array.isArray(pack.deck) ? pack.deck : [];
        const packId = pack.id || pack.packId || (group === 'core' ? 'core-themes' : 'themes-pack');
        if (!addonStates.has(packId)) addonStates.set(packId, true);
        table.forEach(([label, id]) => themeCatalog[group].table.push({ label, id, packId }));
        deck.forEach(([label, id]) => themeCatalog[group].deck.push({ label, id, packId }));
    };

    const registerCountingSystems = (pack = {}) => {
        const group = pack.group === 'core' ? 'core' : 'extras';
        const systems = Array.isArray(pack.systems) ? pack.systems : [];
        const packId = pack.id || pack.packId || (group === 'core' ? 'core-counting' : 'counting-pack');
        if (!addonStates.has(packId)) addonStates.set(packId, true);
        systems.forEach(system => countingCatalog[group].push({ ...system, packId }));
    };

    const getThemeCatalog = () => {
        const defaultThemesEnabled = isAddonEnabled('default-themes');
        const build = (items) => {
            const map = new Map();
            items.forEach(item => {
                if (item.packId === 'hidden-defaults' && defaultThemesEnabled) return;
                if (!isAddonEnabled(item.packId)) return;
                map.set(item.label, item.id);
            });
            return map;
        };
        return {
            core: {
                table: build(themeCatalog.core.table),
                deck: build(themeCatalog.core.deck)
            },
            extras: {
                table: build(themeCatalog.extras.table),
                deck: build(themeCatalog.extras.deck)
            }
        };
    };

    const getCountingSystems = () => ({
        core: countingCatalog.core.filter(item => isAddonEnabled(item.packId)),
        extras: countingCatalog.extras.filter(item => isAddonEnabled(item.packId))
    });

    registerThemePack({
        id: 'hidden-defaults',
        group: 'core',
        table: [
            ['Diner Grit', 'diner']
        ],
        deck: [
            ['Sun Deck', 'sun'],
            ['Water Deck', 'water']
        ]
    });

    registerCountingSystems({
        id: 'core-counting',
        group: 'core',
        systems: [{ id: 'hi-lo', name: 'Hi-Lo', description: '2-6 +1, 7-9 0, 10-A -1.' }]
    });

    window.AssetRegistry = {
        registerThemePack,
        registerCountingSystems,
        setAddonEnabled,
        getThemeCatalog,
        getCountingSystems
    };
})();
