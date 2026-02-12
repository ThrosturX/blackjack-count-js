(() => {
    const entitlementStore = window.EntitlementStore;
    const isAddonClaimed = (id) => entitlementStore ? entitlementStore.isClaimed(id) : id === 'default-themes';

    const getCurrentGameId = () => {
        const path = (window.location && window.location.pathname) || '';
        const file = path.split('/').pop() || '';
        return file.replace(/\.html$/i, '').toLowerCase();
    };

    const supportsCurrentGame = (addon) => {
        const games = addon && Array.isArray(addon.games) ? addon.games : null;
        if (!games || !games.length) return true;
        const current = getCurrentGameId();
        return games.map(String).map(name => name.toLowerCase()).includes(current);
    };

    const loadScript = (src) => new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.onload = () => resolve({ src, loaded: true });
        script.onerror = () => resolve({ src, loaded: false });
        document.head.appendChild(script);
    });

    const loadStyle = (href) => new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => resolve({ href, loaded: true, element: link });
        link.onerror = () => resolve({ href, loaded: false, element: link });
        document.head.appendChild(link);
    });

    const parseInlineManifest = () => {
        const tag = document.getElementById('addons-manifest');
        if (!tag) return null;
        try {
            return JSON.parse(tag.textContent);
        } catch (err) {
            return null;
        }
    };

    const readScriptManifest = () => {
        if (!window.AddonManifest || typeof window.AddonManifest !== 'object') return null;
        const addons = Array.isArray(window.AddonManifest.addons) ? window.AddonManifest.addons : null;
        if (!addons) return null;
        return window.AddonManifest;
    };

    const loadFromManifest = async () => {
        try {
            const response = await fetch('addons/manifest.json', { cache: 'no-store' });
            if (!response.ok) return { addons: [], loaded: false };
            const data = await response.json();
            const addons = Array.isArray(data.addons) ? data.addons : [];
            return { addons, loaded: true };
        } catch (err) {
            return { addons: [], loaded: false };
        }
    };

    const addons = new Map();

    const loadAddon = async (addon) => {
        const id = addon.id;
        if (!id) return null;
        const scripts = Array.isArray(addon.scripts) ? addon.scripts : [];
        const styles = Array.isArray(addon.styles) ? addon.styles : [];
        const links = await Promise.all(styles.map(loadStyle));
        const loadedScripts = [];
        for (const src of scripts) {
            loadedScripts.push(await loadScript(src));
        }
        const stylesLoaded = links.every(link => link && link.loaded);
        const scriptsLoaded = loadedScripts.every(script => script && script.loaded);
        if (!stylesLoaded || !scriptsLoaded) {
            links.forEach(link => {
                if (link && link.element && link.element.parentNode) {
                    link.element.parentNode.removeChild(link.element);
                }
            });
            return null;
        }
        const entry = {
            id,
            label: addon.label || id,
            description: addon.description || '',
            games: Array.isArray(addon.games) ? addon.games.slice() : null,
            styles,
            scripts,
            links,
            loadedScripts,
            enabled: false
        };
        addons.set(id, entry);
        setAddonEnabled(id, id === 'default-themes');
        return entry;
    };

    const setAddonEnabled = (id, enabled) => {
        const addon = addons.get(id);
        if (!addon) return;
        addon.enabled = enabled;
        addon.links.forEach(link => {
            if (link && link.element) {
                link.element.disabled = !enabled;
            }
        });
        if (window.AssetRegistry && typeof window.AssetRegistry.setAddonEnabled === 'function') {
            window.AssetRegistry.setAddonEnabled(id, enabled);
        }
        window.dispatchEvent(new CustomEvent('addons:changed', { detail: { id, enabled } }));
    };

    const ready = (async () => {
        if (window.EntitlementSync && window.EntitlementSync.ready) {
            try {
                await window.EntitlementSync.ready;
            } catch (err) {
                // Continue with local claims if sync fails.
            }
        }
        const scriptManifest = readScriptManifest();
        const inline = parseInlineManifest();
        const useFetch = window.location && window.location.protocol !== 'file:';
        const manifest = scriptManifest || inline || (useFetch ? await loadFromManifest() : { addons: [] });
        const list = Array.isArray(manifest.addons) ? manifest.addons : [];
        for (const addon of list) {
            if (!isAddonClaimed(addon.id)) continue;
            if (!supportsCurrentGame(addon)) continue;
            await loadAddon(addon);
        }
        return Array.from(addons.values());
    })();

    window.StoreEntitlements = entitlementStore || null;

    window.AddonLoader = { ready, addons, setAddonEnabled };
})();
