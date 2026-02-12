(() => {
    if (!window.AssetRegistry || typeof window.AssetRegistry.registerCountingSystems !== 'function') return;

    window.AssetRegistry.registerCountingSystems({
        id: 'counting-balanced',
        group: 'extras',
        systems: [
            {
                id: 'wong-halves',
                name: 'Wong Halves',
                description: '2,7 +0.5; 3,4,6 +1; 5 +1.5; 8 0; 9 -0.5; 10-A -1.',
                balanced: true,
                sideCounts: [{ id: 'aces', name: 'Aces', values: ['A'] }]
            },
            {
                id: 'hi-opt-ii',
                name: 'Hi-Opt II',
                description: '2,3,6,7 +1; 4,5 +2; 8,9,A 0; 10 -2.',
                balanced: true,
                sideCounts: [{ id: 'aces', name: 'Aces', values: ['A'] }]
            },
            {
                id: 'zen',
                name: 'Zen',
                description: '2,3,7 +1; 4,5,6 +2; 8,9 0; 10-A -2.',
                balanced: true,
                sideCounts: [{ id: 'aces', name: 'Aces', values: ['A'] }]
            }
        ]
    });
})();
