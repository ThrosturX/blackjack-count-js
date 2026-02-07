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
    let swimTimer = null;

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

    const clearSwimTimer = () => {
        if (swimTimer) {
            clearTimeout(swimTimer);
            swimTimer = null;
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

    window.addEventListener('addons:changed', scheduleSwim);
    window.addEventListener('addons:changed', () => {
        if (!isPremiumEffectsEnabled() && creature) {
            creature.remove();
            creature = null;
        }
    });
    if (document.body) {
        const observer = new MutationObserver(scheduleSwim);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    window.addEventListener('DOMContentLoaded', scheduleSwim);
    scheduleSwim();
})();
