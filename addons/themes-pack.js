(() => {
    if (!window.AssetRegistry || typeof window.AssetRegistry.registerThemePack !== 'function') return;

    window.AssetRegistry.registerThemePack({
        id: 'premium-themes',
        group: 'extras',
        table: [
            ['Aurora Royale', 'aurora'],
            ['Imperial Marble', 'imperial'],
            ['Velour Noir', 'noir']
        ],
        deck: [
            ['Obsidian Pearl', 'pearl'],
            ['Solar Flare', 'solar'],
            ['Crimson Veil', 'crimson-veil']
        ]
    });
})();
