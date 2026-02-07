(() => {
    if (!window.AssetRegistry || typeof window.AssetRegistry.registerThemePack !== 'function') return;

    window.AssetRegistry.registerThemePack({
        id: 'wildlife-themes',
        group: 'extras',
        table: [],
        deck: [
            ['Oceanic', 'oceanic'],
            ['Cetaceous', 'whale'],
            ['Woolly', 'mammoth']
        ]
    });
})();