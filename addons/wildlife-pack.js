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
            const duration = 20 + Math.random() * 10;
            const startX = 8 + Math.random() * 70;
            const endX = 8 + Math.random() * 70;
            const startY = top;
            const endY = Math.min(70, Math.max(10, startY + (Math.random() * 30 - 15)));
            const dx = endX - startX;
            const dy = endY - startY;
            const length = Math.hypot(dx, dy) || 1;
            const nx = dx / length;
            const ny = dy / length;
            const extend = 32;
            const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
            const extendedStartX = clamp(startX - nx * extend, -20, 110);
            const extendedEndX = clamp(endX + nx * extend, -20, 110);
            const extendedStartY = clamp(startY - ny * extend, 0, 90);
            const extendedEndY = clamp(endY + ny * extend, 0, 90);
            const tilt = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
            el.style.setProperty('--orca-start-x', `${extendedStartX.toFixed(2)}%`);
            el.style.setProperty('--orca-end-x', `${extendedEndX.toFixed(2)}%`);
            el.style.setProperty('--orca-start-y', `${extendedStartY.toFixed(2)}%`);
            el.style.setProperty('--orca-end-y', `${extendedEndY.toFixed(2)}%`);
            el.style.setProperty('--orca-tilt', `${tilt.toFixed(2)}deg`);
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
