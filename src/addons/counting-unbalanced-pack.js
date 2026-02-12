(() => {
    if (!window.AssetRegistry || typeof window.AssetRegistry.registerCountingSystems !== 'function') return;

    window.AssetRegistry.registerCountingSystems({
        id: 'counting-unbalanced',
        group: 'extras',
        systems: [
            { id: 'ko', name: 'KO (U)', description: '2-7 +1, 8-9 0, 10-A -1.', balanced: false },
            { id: 'red-7', name: 'Red 7 (U)', description: '2-6 +1, red 7 +1, black 7 0, 8-9 0, 10-A -1.', balanced: false }
        ]
    });
})();
