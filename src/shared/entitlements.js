(() => {
    if (window.EntitlementStore) return;

    const STORAGE_KEY = 'bj_table.entitlements.v2';
    const LEGACY_KEYS = ['bj_table.entitlements.v1'];
    const VERSION = 2;
    const DEFAULT_CLAIMS = [
        {
            id: 'default-themes',
            ownership: 'default',
            source: 'system-default'
        }
    ];

    const nowIso = () => new Date().toISOString();

    const clone = (value) => JSON.parse(JSON.stringify(value));

    const createEmptyState = () => ({
        version: VERSION,
        claims: {},
        sync: {
            authority: 'local-only',
            revision: null,
            updatedAt: null
        }
    });

    const normalizeClaimRecord = (id, record = {}) => {
        if (!id) return null;
        const ownership = record.ownership === 'authoritative'
            ? 'authoritative'
            : record.ownership === 'default'
                ? 'default'
                : 'local';
        const fallbackSource = ownership === 'authoritative'
            ? 'authoritative-sync'
            : ownership === 'default'
                ? 'system-default'
                : 'store-claim';
        return {
            id,
            claimed: true,
            ownership,
            source: typeof record.source === 'string' && record.source ? record.source : fallbackSource,
            updatedAt: typeof record.updatedAt === 'string' && record.updatedAt ? record.updatedAt : nowIso()
        };
    };

    const normalizeLegacyClaims = (legacyClaims = {}) => {
        const claims = {};
        if (!legacyClaims || typeof legacyClaims !== 'object') return claims;
        Object.entries(legacyClaims).forEach(([id, claimed]) => {
            if (claimed !== true) return;
            const normalized = normalizeClaimRecord(id, {
                ownership: id === 'default-themes' ? 'default' : 'local',
                source: id === 'default-themes' ? 'system-default' : 'legacy-local-claim'
            });
            if (normalized) claims[id] = normalized;
        });
        return claims;
    };

    const normalizeState = (input) => {
        const state = createEmptyState();
        if (input && typeof input === 'object') {
            if (input.sync && typeof input.sync === 'object') {
                state.sync.authority = typeof input.sync.authority === 'string' && input.sync.authority
                    ? input.sync.authority
                    : state.sync.authority;
                state.sync.revision = input.sync.revision || null;
                state.sync.updatedAt = input.sync.updatedAt || null;
            }
            if (input.claims && typeof input.claims === 'object') {
                Object.entries(input.claims).forEach(([id, raw]) => {
                    if (raw === true) {
                        const normalized = normalizeClaimRecord(id, { ownership: 'local', source: 'legacy-local-claim' });
                        if (normalized) state.claims[id] = normalized;
                        return;
                    }
                    if (!raw || raw.claimed === false) return;
                    const normalized = normalizeClaimRecord(id, raw);
                    if (normalized) state.claims[id] = normalized;
                });
            }
        }
        DEFAULT_CLAIMS.forEach((claim) => {
            const normalized = normalizeClaimRecord(claim.id, claim);
            if (normalized && !state.claims[claim.id]) {
                state.claims[claim.id] = normalized;
            }
        });
        state.version = VERSION;
        return state;
    };

    const loadState = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                return normalizeState(JSON.parse(raw));
            }
        } catch (err) {
            // fall through to legacy/default loading
        }
        for (const key of LEGACY_KEYS) {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') continue;
                const migrated = createEmptyState();
                migrated.claims = normalizeLegacyClaims(parsed.claims);
                return normalizeState(migrated);
            } catch (err) {
                // keep trying
            }
        }
        return normalizeState(createEmptyState());
    };

    let state = loadState();

    const applyProfileAutoClaims = () => {
        const profile = (window.AppProfile && typeof window.AppProfile === 'object') ? window.AppProfile : null;
        if (!profile || profile.autoClaimAllAddons !== true) return false;
        const manifest = window.AddonManifest;
        const addons = manifest && Array.isArray(manifest.addons) ? manifest.addons : [];
        if (!addons.length) return false;
        let changed = false;
        addons.forEach((addon) => {
            const id = addon && addon.id;
            if (!id) return;
            if (state.claims[id]) return;
            setClaim(id, {
                ownership: id === 'default-themes' ? 'default' : 'local',
                source: 'profile-default',
                updatedAt: nowIso()
            });
            changed = true;
        });
        return changed;
    };

    if (applyProfileAutoClaims()) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
        } catch (err) {
            // Ignore storage failures.
        }
    }

    const persist = () => {
        state = normalizeState(state);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (err) {
            // Ignore storage failures.
        }
    };

    const emitChange = (detail = {}) => {
        window.dispatchEvent(new CustomEvent('entitlements:changed', {
            detail: { ...detail, snapshot: clone(state) }
        }));
    };

    const setClaim = (id, record) => {
        const normalized = normalizeClaimRecord(id, record);
        if (!normalized) return;
        state.claims[id] = normalized;
    };

    const claimLocal = (id, options = {}) => {
        if (!id) return false;
        const current = state.claims[id];
        if (current && current.ownership === 'authoritative') return true;
        setClaim(id, {
            ownership: id === 'default-themes' ? 'default' : 'local',
            source: options.source || 'store-claim',
            updatedAt: nowIso()
        });
        persist();
        emitChange({ action: 'claim-local', id });
        return true;
    };

    const revokeLocal = (id) => {
        if (!id) return false;
        const current = state.claims[id];
        if (!current) return true;
        if (current.ownership === 'default' || current.ownership === 'authoritative') return false;
        delete state.claims[id];
        persist();
        emitChange({ action: 'revoke-local', id });
        return true;
    };

    // Future integration boundary: Play/backend sync should call this API.
    const applyAuthoritativeClaims = (claimIds = [], options = {}) => {
        const ids = new Set((Array.isArray(claimIds) ? claimIds : []).filter(Boolean));
        const source = options.source || 'authoritative-sync';
        const revision = options.revision || null;
        const authority = options.authority || 'play-backend';
        const prune = options.pruneAuthoritative !== false;

        if (prune) {
            Object.entries(state.claims).forEach(([id, record]) => {
                if (record.ownership !== 'authoritative') return;
                if (ids.has(id)) return;
                delete state.claims[id];
            });
        }

        ids.forEach((id) => {
            setClaim(id, {
                ownership: 'authoritative',
                source,
                updatedAt: nowIso()
            });
        });

        state.sync = {
            authority,
            revision,
            updatedAt: nowIso()
        };
        persist();
        emitChange({ action: 'apply-authoritative', ids: Array.from(ids), authority, revision });
    };

    const resetLocalClaims = () => {
        Object.entries(state.claims).forEach(([id, record]) => {
            if (record.ownership === 'local') delete state.claims[id];
        });
        persist();
        emitChange({ action: 'reset-local' });
    };

    const resetAllForDebug = () => {
        state = normalizeState(createEmptyState());
        persist();
        emitChange({ action: 'reset-all-debug' });
    };

    const isClaimed = (id) => !!(id && state.claims[id]);

    const getClaim = (id) => {
        if (!id || !state.claims[id]) return null;
        return clone(state.claims[id]);
    };

    const getSnapshot = () => clone(state);

    const listClaimedIds = () => Object.keys(state.claims);

    window.EntitlementStore = {
        STORAGE_KEY,
        VERSION,
        getSnapshot,
        getClaim,
        isClaimed,
        listClaimedIds,
        claimLocal,
        revokeLocal,
        applyAuthoritativeClaims,
        resetLocalClaims,
        resetAllForDebug
    };
})();
