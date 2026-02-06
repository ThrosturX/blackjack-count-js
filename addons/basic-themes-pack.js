(() => {
    if (!window.AssetRegistry || typeof window.AssetRegistry.registerThemePack !== 'function') return;

    window.AssetRegistry.registerThemePack({
        id: 'basic-themes',
        group: 'extras',
        table: [
            ['Crimson Velvet', 'crimson'],
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
        ]
    });
})();
