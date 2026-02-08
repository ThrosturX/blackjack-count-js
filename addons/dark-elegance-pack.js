(() => {
    if (!window.AssetRegistry || typeof window.AssetRegistry.registerThemePack !== 'function') return;

    window.AssetRegistry.registerThemePack({
        id: 'dark-elegance-themes',
        group: 'extras',
        table: [
            ['Obsidian Floor', 'obsidian'],
            ['The Abyss', 'abyss']
        ],
        deck: [ ['Midnight Onyx', 'luxury-dark'] ]
    });
})();
