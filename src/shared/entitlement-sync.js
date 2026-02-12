(() => {
    if (window.EntitlementSync) return;

    const DEBUG_MOCK_KEY = 'bj_table.entitlements.authoritative_mock.v1';
    const store = window.EntitlementStore;

    const uniqueStringList = (value) => {
        if (!Array.isArray(value)) return [];
        const out = [];
        const seen = new Set();
        value.forEach((item) => {
            const id = String(item || '').trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            out.push(id);
        });
        return out;
    };

    const normalizePayload = (payload) => {
        if (!payload || typeof payload !== 'object') return null;
        const ids = uniqueStringList(payload.claimIds || payload.ids || []);
        return {
            ids,
            authority: payload.authority || 'play-backend',
            source: payload.source || 'play-billing-backend',
            revision: payload.revision || null
        };
    };

    const readDebugMockPayload = () => {
        try {
            const raw = localStorage.getItem(DEBUG_MOCK_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return normalizePayload({
                ids: parsed.ids,
                revision: parsed.revision || null,
                authority: parsed.authority || 'debug-mock',
                source: parsed.source || 'debug-mock'
            });
        } catch (err) {
            return null;
        }
    };

    const fetchFromNativeBridge = async () => {
        if (window.NativeEntitlementBridge) {
            if (typeof window.NativeEntitlementBridge.getAuthoritativeClaims === 'function') {
                const result = await window.NativeEntitlementBridge.getAuthoritativeClaims();
                return normalizePayload(result);
            }
            if (typeof window.NativeEntitlementBridge.getEntitlements === 'function') {
                const result = await window.NativeEntitlementBridge.getEntitlements();
                return normalizePayload(result);
            }
        }

        const plugins = window.Capacitor && window.Capacitor.Plugins;
        const bridge = plugins && (plugins.PlayEntitlements || plugins.EntitlementBridge);
        if (!bridge) return null;

        if (typeof bridge.getAuthoritativeClaims === 'function') {
            const result = await bridge.getAuthoritativeClaims();
            return normalizePayload(result);
        }
        if (typeof bridge.getEntitlements === 'function') {
            const result = await bridge.getEntitlements();
            return normalizePayload(result);
        }
        return null;
    };

    const applyPayload = (payload, reason = 'manual') => {
        if (!store || !payload) return { applied: false, reason: 'no-store-or-payload' };
        store.applyAuthoritativeClaims(payload.ids, {
            authority: payload.authority,
            source: payload.source,
            revision: payload.revision,
            pruneAuthoritative: true
        });
        return { applied: true, claimCount: payload.ids.length, reason, source: payload.source };
    };

    const syncNow = async (reason = 'manual') => {
        if (!store || typeof store.applyAuthoritativeClaims !== 'function') {
            return { applied: false, reason: 'no-store' };
        }
        let payload = null;
        try {
            payload = await fetchFromNativeBridge();
        } catch (err) {
            payload = null;
        }
        if (!payload) payload = readDebugMockPayload();
        if (!payload) return { applied: false, reason: 'no-authoritative-source' };
        return applyPayload(payload, reason);
    };

    const bindLifecycle = () => {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                syncNow('visibility-visible');
            }
        });
        window.addEventListener('pageshow', () => syncNow('pageshow'));
        window.addEventListener('focus', () => syncNow('window-focus'));

        const plugins = window.Capacitor && window.Capacitor.Plugins;
        const appPlugin = plugins && plugins.App;
        if (appPlugin && typeof appPlugin.addListener === 'function') {
            appPlugin.addListener('resume', () => syncNow('app-resume'));
            appPlugin.addListener('appStateChange', (state) => {
                if (state && state.isActive) syncNow('app-active');
            });
        }
    };

    const ready = (async () => {
        await syncNow('startup');
        bindLifecycle();
        return true;
    })();

    window.EntitlementSync = {
        ready,
        syncNow,
        readDebugMockPayload
    };
})();
