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
        link.onload = () => resolve({ href, loaded: true });
        link.onerror = () => resolve({ href, loaded: false });
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
            if (!response.ok) return { scripts: [], loaded: false };
            const data = await response.json();
            const scripts = Array.isArray(data.scripts) ? data.scripts : [];
            const styles = Array.isArray(data.styles) ? data.styles : [];
            return { scripts, styles, loaded: true };
        } catch (err) {
            return { scripts: [], styles: [], loaded: false };
        }
    };

    const ready = (async () => {
        const inline = parseInlineManifest();
        const useFetch = window.location && window.location.protocol !== 'file:';
        const manifest = inline || (useFetch ? await loadFromManifest() : { scripts: [], styles: [] });
        const scripts = Array.isArray(manifest.scripts) ? manifest.scripts : [];
        const styles = Array.isArray(manifest.styles) ? manifest.styles : [];
        const loads = [
            ...styles.map(loadStyle),
            ...scripts.map(loadScript)
        ];
        return Promise.all(loads);
    })();

    window.AddonLoader = { ready };
})();
