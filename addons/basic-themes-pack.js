(() => {
    if (!window.AssetRegistry || typeof window.AssetRegistry.registerThemePack !== 'function') return;

    window.AssetRegistry.registerThemePack({
        id: 'basic-themes',
        group: 'extras',
        table: [
            ['Lavender Dusk', 'lavender'],
            ['Ocean Depths', 'depths'],
            ['Rolling Waves', 'waves'],
            ['Dark Stone', 'stone'],
            ['Neon Nights', 'neon'],
            ['Cyberpunk Grid', 'cyber'],
            ['Obsidian Floor', 'obsidian'],
            ['The Abyss', 'abyss']
        ],
        deck: [
            ['Royal Gold', 'gold'],
            ['Regal Velvet', 'velvet'],
            ['Oceanic', 'oceanic'],
            ['Cetaceous', 'whale'],
            ['Woolly', 'mammoth'],
            ['Cherry Blossom', 'cherry'],
            ['Starlight', 'starlight'],
            ['Emerald Luxe', 'emerald'],
            ['Ruby Luxe', 'ruby'],
            ['Midnight Luxe', 'dark'],
            ['Midnight Onyx', 'luxury-dark'],
            ['Neon Vibe', 'neon-vibe'],
            ['Ghost Ship', 'ghost']
        ]
    });
})();
