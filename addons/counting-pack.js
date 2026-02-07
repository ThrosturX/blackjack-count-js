(() => {
    if (!window.AssetRegistry || typeof window.AssetRegistry.registerCountingSystems !== 'function') return;

    window.AssetRegistry.registerCountingSystems({
        id: 'counting-pack',
        group: 'extras',
        systems: [
            { id: 'ko', name: 'KO (U)', description: '2-7 +1, 8-9 0, 10-A -1.' },
            { id: 'wong-halves', name: 'Wong Halves', description: 'Multi-level count with half points.' },
            { id: 'zen', name: 'Zen', description: 'Multi-level count with strong 10 weight.' }
        ]
    });
})();
