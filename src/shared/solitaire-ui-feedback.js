/**
 * Shared UI feedback helper for solitaire pages.
 * Uses SolitaireCheckModal when available and falls back gracefully.
 */
(function (globalScope) {
    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderHelpMessageHtml(message) {
        const lines = String(message || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

        if (!lines.length) return '<div class="solitaire-help-content"><p>No help text available.</p></div>';

        const items = lines.map((line) => {
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0 && colonIndex < 28) {
                const label = escapeHtml(line.slice(0, colonIndex + 1));
                const detail = escapeHtml(line.slice(colonIndex + 1).trim());
                return `<li><strong>${label}</strong> ${detail}</li>`;
            }
            return `<li>${escapeHtml(line)}</li>`;
        }).join('');

        return `<div class="solitaire-help-content"><ul>${items}</ul></div>`;
    }

    function getModalApi() {
        if (typeof globalScope.SolitaireCheckModal !== 'undefined') return globalScope.SolitaireCheckModal;
        return null;
    }

    function showInfo(options = {}) {
        const modal = getModalApi();
        if (modal && typeof modal.showInfo === 'function') {
            return modal.showInfo({
                ...options,
                variant: options.variant || 'solver'
            });
        }
        const title = options.title ? `${options.title}\n\n` : '';
        const message = options.message || '';
        alert(`${title}${message}`.trim());
        return Promise.resolve(true);
    }

    function showHelp(options = {}) {
        const modal = getModalApi();
        if (modal && typeof modal.showInfo === 'function') {
            return modal.showInfo({
                title: options.title || 'How to Play',
                message: String(options.message || ''),
                messageHtml: renderHelpMessageHtml(options.message),
                allowHtml: true,
                closeLabel: options.closeLabel || 'Back to Game',
                variant: 'help'
            });
        }
        const title = options.title ? `${options.title}\n\n` : '';
        const message = options.message || '';
        alert(`${title}${message}`.trim());
        return Promise.resolve(true);
    }

    function showToast(message, options = {}) {
        if (typeof CommonUtils !== 'undefined' && typeof CommonUtils.showTableToast === 'function') {
            CommonUtils.showTableToast(String(message || ''), options || {});
            return;
        }
        showInfo({ title: options.title || 'Notice', message: String(message || '') });
    }

    globalScope.SolitaireUiFeedback = {
        showInfo,
        showHelp,
        showToast
    };
})(typeof window !== 'undefined' ? window : globalThis);
