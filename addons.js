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

    const probeResource = async (url) => {
        if (!url) return false;
        const protocol = window.location && window.location.protocol;
        if (protocol === 'file:') return true;
        try {
            const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
            return response.ok;
        } catch (err) {
            return false;
        }
    };

    const loadAddon = async (addon) => {
        const id = addon.id;
        if (!id) return null;
        const scripts = Array.isArray(addon.scripts) ? addon.scripts : [];
        const styles = Array.isArray(addon.styles) ? addon.styles : [];
        const availableStyles = [];
        for (const href of styles) {
            if (await probeResource(href)) availableStyles.push(href);
        }
        const availableScripts = [];
        for (const src of scripts) {
            if (await probeResource(src)) availableScripts.push(src);
        }
        if (availableStyles.length !== styles.length || availableScripts.length !== scripts.length) {
            return null;
        }
        const links = await Promise.all(availableStyles.map(loadStyle));
        const loadedScripts = [];
        for (const src of availableScripts) {
            loadedScripts.push(await loadScript(src));
        }
        const entry = {
            id,
            label: addon.label || id,
            styles,
            scripts,
            links,
            loadedScripts,
            enabled: true
        };
        addons.set(id, entry);
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
        const inline = parseInlineManifest();
        const useFetch = window.location && window.location.protocol !== 'file:';
        const manifest = inline || (useFetch ? await loadFromManifest() : { addons: [] });
        const list = Array.isArray(manifest.addons) ? manifest.addons : [];
        for (const addon of list) {
            await loadAddon(addon);
        }
        return Array.from(addons.values());
    })();

    window.AddonLoader = { ready, addons, setAddonEnabled };
})();
