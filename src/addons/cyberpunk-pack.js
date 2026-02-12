(() => {
    if (!window.AssetRegistry || typeof window.AssetRegistry.registerThemePack !== 'function') return;

    window.AssetRegistry.registerThemePack({
        id: 'cyberpunk-themes',
        group: 'extras',
        table: [
            ['Neon Nights', 'neon'],
            ['Cyberpunk Grid', 'cyber']
        ],
        deck: [
            ['Neon Vibe', 'neon-vibe']
        ]
    });
})();