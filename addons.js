(() => {
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
    let entitlementsLoaded = false;

    const getConfig = () => window.AddonEntitlementsConfig || {};

    const resolveDefaultEnabled = (addon) => addon.optInDefault === true;

    const loadAddonAssets = async (addon) => {
        if (!addon || addon.loaded) return addon;
        const links = await Promise.all(addon.styles.map(loadStyle));
        const loadedScripts = [];
        for (const src of addon.scripts) {
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
        addon.links = links;
        addon.loadedScripts = loadedScripts;
        addon.loaded = true;
        if (!addon.enabled) {
            addon.links.forEach(link => {
                if (link && link.element) {
                    link.element.disabled = true;
                }
            });
        }
        return addon;
    };

    const getItchAccessToken = async () => {
        const config = getConfig();
        if (config.accessToken) return config.accessToken;
        if (window.itchio && typeof window.itchio.getAccessToken === 'function') {
            return window.itchio.getAccessToken();
        }
        if (window.itchio && typeof window.itchio.accessToken === 'string') {
            return window.itchio.accessToken;
        }
        if (window.Itch && typeof window.Itch.getAccessToken === 'function') {
            return window.Itch.getAccessToken();
        }
        return null;
    };

    const fetchEntitlements = async () => {
        const config = getConfig();
        if (typeof config.getEntitlements === 'function') {
            try {
                const rewardIds = await config.getEntitlements();
                entitlementsLoaded = true;
                return new Set((rewardIds || []).map(id => String(id)));
            } catch (err) {
                entitlementsLoaded = true;
                return new Set();
            }
        }
        if (!config.workerUrl || !config.gameId) {
            entitlementsLoaded = true;
            return new Set();
        }
        const token = await getItchAccessToken();
        if (!token) {
            entitlementsLoaded = true;
            return new Set();
        }
        try {
            const url = new URL(config.workerUrl);
            url.searchParams.set('game_id', String(config.gameId));
            const response = await fetch(url.toString(), {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (!response.ok) {
                entitlementsLoaded = true;
                return new Set();
            }
            const data = await response.json();
            const rewardIds = Array.isArray(data.rewardIds) ? data.rewardIds : [];
            entitlementsLoaded = true;
            return new Set(rewardIds.map(id => String(id)));
        } catch (err) {
            entitlementsLoaded = true;
            return new Set();
        }
    };

    const setAddonEnabled = async (id, enabled) => {
        const addon = addons.get(id);
        if (!addon) return;
        if (!addon.allowed) {
            addon.enabled = false;
            return;
        }
        addon.enabled = enabled;
        if (enabled) {
            await loadAddonAssets(addon);
        }
        if (addon.links.length) {
            addon.links.forEach(link => {
                if (link && link.element) {
                    link.element.disabled = !enabled;
                }
            });
        }
        if (window.AssetRegistry && typeof window.AssetRegistry.setAddonEnabled === 'function') {
            window.AssetRegistry.setAddonEnabled(id, enabled);
        }
        window.dispatchEvent(new CustomEvent('addons:changed', { detail: { id, enabled } }));
    };

    const resetAddonsToDefault = () => {
        addons.forEach((addon) => {
            setAddonEnabled(addon.id, resolveDefaultEnabled(addon));
        });
    };

    const ready = (async () => {
        const inline = parseInlineManifest();
        const useFetch = window.location && window.location.protocol !== 'file:';
        const manifest = inline || (useFetch ? await loadFromManifest() : { addons: [] });
        const list = Array.isArray(manifest.addons) ? manifest.addons : [];
        list.forEach((addon) => {
            if (!addon || !addon.id) return;
            const scripts = Array.isArray(addon.scripts) ? addon.scripts : [];
            const styles = Array.isArray(addon.styles) ? addon.styles : [];
            const entry = {
                id: addon.id,
                label: addon.label || addon.id,
                scripts,
                styles,
                links: [],
                loadedScripts: [],
                enabled: resolveDefaultEnabled(addon),
                optInDefault: resolveDefaultEnabled(addon),
                loaded: false,
                allowed: !addon.requiresEntitlement,
                requiresEntitlement: addon.requiresEntitlement === true,
                rewardId: addon.rewardId ? String(addon.rewardId) : null
            };
            addons.set(entry.id, entry);
        });
        const rewardIds = await fetchEntitlements();
        addons.forEach((addon) => {
            if (addon.requiresEntitlement) {
                addon.allowed = addon.rewardId ? rewardIds.has(addon.rewardId) : false;
                if (!addon.allowed) {
                    addon.enabled = false;
                }
            }
        });
        for (const addon of addons.values()) {
            if (addon.enabled && addon.allowed) {
                await loadAddonAssets(addon);
            }
        }
        return Array.from(addons.values());
    })();

    window.AddonLoader = {
        ready,
        addons,
        setAddonEnabled,
        resetAddonsToDefault,
        entitlementsLoaded: () => entitlementsLoaded
    };
})();
