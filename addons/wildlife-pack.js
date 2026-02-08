(() => {
    if (!window.AssetRegistry || typeof window.AssetRegistry.registerThemePack !== 'function') return;

    window.AssetRegistry.registerThemePack({
        id: 'wildlife-themes',
        group: 'extras',
        table: [
            ['Open Ocean', 'ocean']
        ],
        deck: [
            ['Oceanic', 'oceanic'],
            ['Cetaceous', 'whale'],
            ['Woolly', 'mammoth']
        ]
    });

    const getTableElement = () => document.getElementById('table') || document.getElementById('solitaire-table');
    let creature = null;
    let orca = null;
    let swimTimer = null;
    let orcaTimer = null;

    const isOceanTable = () => document.body.classList.contains('table-ocean');
    const isPremiumEffectsEnabled = () => {
        if (!window.AddonLoader || !window.AddonLoader.addons) return false;
        const addon = window.AddonLoader.addons.get('premium-effects');
        return !!(addon && addon.enabled);
    };

    const ensureCreature = () => {
        if (creature) return creature;
        const table = getTableElement();
        if (!table) return null;
        creature = document.createElement('div');
        creature.className = 'ocean-creature';
        table.appendChild(creature);
        return creature;
    };

    const ensureOrca = () => {
        if (orca) return orca;
        const table = getTableElement();
        if (!table) return null;
        orca = document.createElement('div');
        orca.className = 'ocean-orca';
        table.appendChild(orca);
        return orca;
    };

    const clearSwimTimer = () => {
        if (swimTimer) {
            clearTimeout(swimTimer);
            swimTimer = null;
        }
    };

    const clearOrcaTimer = () => {
        if (orcaTimer) {
            clearTimeout(orcaTimer);
            orcaTimer = null;
        }
    };

    const scheduleSwim = () => {
        clearSwimTimer();
        if (!isOceanTable() || !isPremiumEffectsEnabled()) return;
        swimTimer = setTimeout(() => {
            const el = ensureCreature();
            if (!el) return;
            el.classList.remove('ocean-creature-swim');
            const top = 20 + Math.random() * 55;
            const duration = 9 + Math.random() * 7;
            const dir = Math.random() > 0.5 ? 1 : -1;
            el.style.setProperty('--swim-top', `${top}%`);
            el.style.setProperty('--swim-dir', `${dir}`);
            el.style.animationDuration = `${duration}s`;
            void el.offsetWidth;
            el.classList.add('ocean-creature-swim');
            scheduleSwim();
        }, 4000 + Math.random() * 8000);
    };

    const scheduleOrca = () => {
        clearOrcaTimer();
        if (!isOceanTable() || !isPremiumEffectsEnabled()) return;
        const startDelay = 5000 + Math.random() * 9000;
        orcaTimer = setTimeout(() => {
            const el = ensureOrca();
            if (!el) return;
            el.classList.remove('ocean-orca-swim');
            const top = 12 + Math.random() * 55;
            const duration = 22 + Math.random() * 12;
            const dir = Math.random() > 0.5 ? 1 : -1;
            const start = '8%';
            const end = 'calc(100% - 8% - var(--orca-width, 260px))';
            el.style.setProperty('--orca-top', `${top}%`);
            el.style.setProperty('--orca-dir', `${dir}`);
            el.style.setProperty('--orca-start', dir === 1 ? start : end);
            el.style.setProperty('--orca-end', dir === 1 ? end : start);
            el.style.animationDuration = `${duration}s`;
            void el.offsetWidth;
            el.classList.add('ocean-orca-swim');
            const gap = 5000 + Math.random() * 9000;
            orcaTimer = setTimeout(scheduleOrca, duration * 1000 + gap);
        }, startDelay);
    };

    window.addEventListener('addons:changed', scheduleSwim);
    window.addEventListener('addons:changed', scheduleOrca);
    window.addEventListener('addons:changed', () => {
        if (!isPremiumEffectsEnabled() && creature) {
            creature.remove();
            creature = null;
        }
        if (!isPremiumEffectsEnabled() && orca) {
            orca.remove();
            orca = null;
        }
    });
    if (document.body) {
        const observer = new MutationObserver(() => {
            scheduleSwim();
            scheduleOrca();
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    window.addEventListener('DOMContentLoaded', scheduleSwim);
    window.addEventListener('DOMContentLoaded', scheduleOrca);
    scheduleSwim();
    scheduleOrca();
})();
