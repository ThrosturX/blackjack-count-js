(() => {
    const tableThemes = {
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
    };

    const deckThemes = {
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
    };

    const countingSystems = {
        core: [
            { id: 'standard', name: 'Standard Hi-Lo', description: 'Baseline counting system.' }
        ],
        extras: []
    };

    const getThemeCatalog = () => ({
        table: {
            core: new Map(tableThemes.core),
            extras: new Map(tableThemes.extras)
        },
        deck: {
            core: new Map(deckThemes.core),
            extras: new Map(deckThemes.extras)
        }
    });

    const getCountingSystems = () => ({
        core: [...countingSystems.core],
        extras: [...countingSystems.extras]
    });

    window.AssetRegistry = {
        getThemeCatalog,
        getCountingSystems
    };
})();
