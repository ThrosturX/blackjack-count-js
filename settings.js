(() => {
    const state = {
        ownedAssets: {
            themes: {
                table: new Set(),
                deck: new Set()
            },
            countingSystems: new Set()
        }
    };

    const ownsAsset = (category, id) => {
        const set = state.ownedAssets[category];
        if (!set) return false;
        return set.has(id);
    };

    const grantAsset = (category, id) => {
        if (!state.ownedAssets[category]) return;
        state.ownedAssets[category].add(id);
    };

    const getOwnedAssets = () => ({
        themes: {
            table: new Set(state.ownedAssets.themes.table),
            deck: new Set(state.ownedAssets.themes.deck)
        },
        countingSystems: new Set(state.ownedAssets.countingSystems)
    });

    window.SettingsStore = {
        ownsAsset,
        grantAsset,
        getOwnedAssets
    };
})();
