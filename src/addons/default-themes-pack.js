(() => {
    if (!window.AssetRegistry || typeof window.AssetRegistry.registerThemePack !== 'function') return;

    window.AssetRegistry.registerThemePack({
        id: 'default-themes',
        group: 'extras',
        table: [
            ['Green Felt', 'felt'],
            ['Crimson Velvet', 'crimson']
        ],
        deck: [
            ['Red Striped', 'red'],
            ['Blue Classic', 'blue'],
            ['Green Pattern', 'green']
        ]
    });
})();
