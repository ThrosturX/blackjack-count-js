(() => {
    if (!window.AssetRegistry || typeof window.AssetRegistry.registerThemePack !== 'function') return;

    window.AssetRegistry.registerThemePack({
        id: 'ghostly-themes',
        group: 'extras',
        table: [],
        deck: [
            ['Ghost Ship', 'ghost']
        ]
    });
})();