(() => {
    if (!window.AssetRegistry || typeof window.AssetRegistry.registerThemePack !== 'function') return;

    window.AssetRegistry.registerThemePack({
        id: 'basic-themes',
        group: 'extras',
        table: [
            ['Lavender Dusk', 'lavender'],
            ['Ocean Depths', 'depths'],
            ['Rolling Waves', 'waves'],
            ['Dark Stone', 'stone']
        ],
        deck: [
            ['Royal Gold', 'gold'],
            ['Regal Velvet', 'velvet'],
            ['Cherry Blossom', 'cherry'],
            ['Starlight', 'starlight']
        ]
    });
})();