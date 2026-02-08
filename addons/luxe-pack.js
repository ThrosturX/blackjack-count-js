(() => {
    if (!window.AssetRegistry || typeof window.AssetRegistry.registerThemePack !== 'function') return;

    window.AssetRegistry.registerThemePack({
        id: 'luxe-collection',
        group: 'extras',
        table: [],
        deck: [
            ['Emerald Luxe', 'emerald'],
            ['Ruby Luxe', 'ruby'],
            ['Midnight Luxe', 'dark'],
        ]
    });
})();
