/**
 * Shared UI feedback helper for solitaire pages.
 * Uses SolitaireCheckModal when available and falls back gracefully.
 */
(function (globalScope) {
    function getModalApi() {
        if (typeof globalScope.SolitaireCheckModal !== 'undefined') return globalScope.SolitaireCheckModal;
        return null;
    }

    function showInfo(options = {}) {
        const modal = getModalApi();
        if (modal && typeof modal.showInfo === 'function') {
            return modal.showInfo(options);
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
        showToast
    };
})(typeof window !== 'undefined' ? window : globalThis);
