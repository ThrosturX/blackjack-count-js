(() => {
    const themeCatalog = {
        core: {
            table: new Map(),
            deck: new Map()
        },
        extras: {
            table: new Map(),
            deck: new Map()
        }
    };

    const countingCatalog = {
        core: [],
        extras: []
    };

    const registerThemePack = (pack = {}) => {
        const group = pack.group === 'core' ? 'core' : 'extras';
        const table = Array.isArray(pack.table) ? pack.table : [];
        const deck = Array.isArray(pack.deck) ? pack.deck : [];
        table.forEach(([label, id]) => themeCatalog[group].table.set(label, id));
        deck.forEach(([label, id]) => themeCatalog[group].deck.set(label, id));
    };

    const registerCountingSystems = (pack = {}) => {
        const group = pack.group === 'core' ? 'core' : 'extras';
        const systems = Array.isArray(pack.systems) ? pack.systems : [];
        countingCatalog[group].push(...systems);
    };

    const getThemeCatalog = () => ({
        core: {
            table: new Map(themeCatalog.core.table),
            deck: new Map(themeCatalog.core.deck)
        },
        extras: {
            table: new Map(themeCatalog.extras.table),
            deck: new Map(themeCatalog.extras.deck)
        }
    });

    const getCountingSystems = () => ({
        core: [...countingCatalog.core],
        extras: [...countingCatalog.extras]
    });

    registerThemePack({
        group: 'core',
        table: [['Green Felt', 'felt']],
        deck: [['Red Striped', 'red']]
    });

    registerCountingSystems({
        group: 'core',
        systems: [{ id: 'hi-lo', name: 'Hi-Lo', description: '2-6 +1, 7-9 0, 10-A -1.' }]
    });

    window.AssetRegistry = {
        registerThemePack,
        registerCountingSystems,
        getThemeCatalog,
        getCountingSystems
    };
})();
