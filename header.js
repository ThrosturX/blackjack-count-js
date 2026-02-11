(() => {
    if (window.HeaderControls) return;

    const CONTROL_MAP = [
        { key: 'game', buttonId: 'toggle-game', areaId: 'game-area' },
        { key: 'settings', buttonId: 'toggle-settings', areaId: 'settings-area' },
        { key: 'addons', buttonId: 'toggle-addons', areaId: 'addons-area' },
        { key: 'themes', buttonId: 'toggle-themes', areaId: 'theme-area' },
        { key: 'stats', buttonId: 'toggle-stats', areaId: 'stats-area' }
    ];

    const controls = new Map();
    let initialized = false;

    const setCollapsed = (control, collapsed) => {
        if (!control) return;
        const { button, area } = control;
        if (area) area.classList.toggle('collapsed', collapsed);
        if (button) {
            button.classList.toggle('active', !collapsed);
            button.setAttribute('aria-expanded', (!collapsed).toString());
        }
    };

    const bindControl = ({ key, buttonId, areaId }) => {
        const button = document.getElementById(buttonId);
        const area = document.getElementById(areaId);
        if (!button || !area) return;
        const control = { key, button, area };
        controls.set(key, control);
        if (button.dataset.headerBound !== 'true') {
            button.dataset.headerBound = 'true';
            button.addEventListener('click', () => toggle(key));
        }
    };

    const init = (options = {}) => {
        if (initialized) return;
        initialized = true;
        const openKeys = new Set(options.openKeys || ['game']);
        CONTROL_MAP.forEach(bindControl);
        controls.forEach(control => {
            const shouldOpen = openKeys.has(control.key);
            setCollapsed(control, !shouldOpen);
        });
    };

    const toggle = (key, force) => {
        const control = controls.get(key);
        if (!control) return;
        const isCollapsed = control.area.classList.contains('collapsed');
        const nextCollapsed = typeof force === 'boolean' ? !force : !isCollapsed;
        setCollapsed(control, nextCollapsed);
    };

    window.HeaderControls = { init, toggle };

    document.addEventListener('DOMContentLoaded', () => {
        if (!document.querySelector('.game-controls')) return;
        init();
    });
})();
