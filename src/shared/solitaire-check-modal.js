/**
 * Shared modal for solitaire check flows.
 * Handles choice, confirm, and info dialogs with safe focus/inert behavior.
 */
(function (globalScope) {
    const MODAL_ROOT_ID = 'solitaire-check-modal-root';
    const MODAL_HISTORY_STATE_KEY = 'solitaireCheckModalOpen';
    let previousFocus = null;
    let ignoreNextModalPopstate = false;
    let activeDialogSettle = null;

    function installModalHistoryHandler(onPop) {
        if (
            typeof window === 'undefined'
            || !window.history
            || typeof window.history.pushState !== 'function'
        ) {
            return null;
        }
        const state = { [MODAL_HISTORY_STATE_KEY]: true };
        const popHandler = () => {
            if (ignoreNextModalPopstate) {
                ignoreNextModalPopstate = false;
                return;
            }
            onPop();
        };
        window.history.pushState(state, '', window.location.href);
        window.addEventListener('popstate', popHandler);
        return () => {
            window.removeEventListener('popstate', popHandler);
            if (window.history.state && window.history.state[MODAL_HISTORY_STATE_KEY]) {
                ignoreNextModalPopstate = true;
                window.history.back();
            }
        };
    }

    function ensureModalElements() {
        if (typeof document === 'undefined') return null;
        let root = document.getElementById(MODAL_ROOT_ID);
        if (!root) {
            root = document.createElement('div');
            root.id = MODAL_ROOT_ID;
            root.className = 'solitaire-check-overlay';
            root.hidden = true;
            root.inert = true;
            root.innerHTML = `
                <div class="solitaire-check-modal" role="dialog" aria-modal="true" aria-labelledby="solitaire-check-modal-title">
                    <h3 id="solitaire-check-modal-title" data-modal-title>Check</h3>
                    <div class="solitaire-check-modal-message" data-modal-message></div>
                    <div class="solitaire-check-modal-actions">
                        <button type="button" class="btn-toggle btn-mini" data-modal-cancel>Cancel</button>
                        <button type="button" class="btn-toggle btn-mini solitaire-check-secondary" data-modal-secondary>Secondary</button>
                        <button type="button" class="btn-toggle btn-mini solitaire-check-primary" data-modal-confirm>Confirm</button>
                        <button type="button" class="btn-toggle btn-mini" data-modal-close>Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(root);
        }
        return {
            root,
            modal: root.querySelector('.solitaire-check-modal'),
            title: root.querySelector('[data-modal-title]'),
            message: root.querySelector('[data-modal-message]'),
            cancelBtn: root.querySelector('[data-modal-cancel]'),
            secondaryBtn: root.querySelector('[data-modal-secondary]'),
            confirmBtn: root.querySelector('[data-modal-confirm]'),
            closeBtn: root.querySelector('[data-modal-close]')
        };
    }

    function openRoot(els) {
        previousFocus = document.activeElement;
        els.root.hidden = false;
        els.root.inert = false;
        els.root.classList.add('show');
    }

    function closeRoot(els) {
        if (els.root.contains(document.activeElement) && document.activeElement.blur) {
            document.activeElement.blur();
        }
        els.root.classList.remove('show');
        els.root.classList.remove('busy');
        els.root.classList.remove('solitaire-check-overlay--expanded');
        if (els.modal) {
            els.modal.classList.remove('solitaire-check-modal--expanded');
        }
        els.root.inert = true;
        els.root.hidden = true;
        if (previousFocus && typeof previousFocus.focus === 'function') {
            previousFocus.focus();
        }
        previousFocus = null;
    }

    function setMessageContent(els, options) {
        const message = options.message || '';
        if (options.allowHtml === true && typeof options.messageHtml === 'string') {
            els.message.innerHTML = options.messageHtml;
            return;
        }
        els.message.textContent = message;
    }

    function setVariantClasses(els, variant) {
        const isExpanded = variant === 'help';
        els.root.classList.toggle('solitaire-check-overlay--expanded', isExpanded);
        if (els.modal) {
            els.modal.classList.toggle('solitaire-check-modal--expanded', isExpanded);
        }
    }

    function withDialog(options, initUI) {
        const els = ensureModalElements();
        if (!els) return Promise.resolve(null);
        if (activeDialogSettle) activeDialogSettle(null);

        openRoot(els);
        els.title.textContent = options.title || 'Check';
        const variant = options.variant || 'solver';
        setMessageContent(els, options);
        setVariantClasses(els, variant);
        els.root.classList.toggle('busy', options.busy === true);

        return new Promise((resolve) => {
            let settled = false;
            let cleanupModalHistory = null;
            const settle = (value) => {
                if (settled) return;
                settled = true;
                activeDialogSettle = null;
                if (cleanupModalHistory) {
                    cleanupModalHistory();
                    cleanupModalHistory = null;
                }
                closeRoot(els);
                resolve(value);
            };
            activeDialogSettle = settle;
            cleanupModalHistory = installModalHistoryHandler(() => settle(null));
            els.root.onclick = (event) => {
                if (event.target === els.root && options.busy !== true) {
                    settle(null);
                }
            };
            initUI(els, settle);
        });
    }

    function showInfo(options = {}) {
        return withDialog(options, (els, settle) => {
            els.cancelBtn.style.display = 'none';
            els.secondaryBtn.style.display = 'none';
            els.confirmBtn.style.display = 'none';
            els.closeBtn.style.display = '';
            els.closeBtn.disabled = options.busy === true;
            els.closeBtn.textContent = options.closeLabel || 'Close';
            els.closeBtn.onclick = () => {
                if (options.busy === true) return;
                settle(true);
                if (typeof options.onClose === 'function') options.onClose();
            };
            if (!els.closeBtn.disabled) els.closeBtn.focus();
        });
    }

    function showConfirm(options = {}) {
        return withDialog(options, (els, settle) => {
            els.cancelBtn.style.display = '';
            els.confirmBtn.style.display = '';
            els.secondaryBtn.style.display = 'none';
            els.closeBtn.style.display = 'none';
            els.cancelBtn.textContent = options.cancelLabel || 'Cancel';
            els.confirmBtn.textContent = options.confirmLabel || 'Proceed';
            els.cancelBtn.onclick = () => settle(false);
            els.confirmBtn.onclick = () => settle(true);
            els.confirmBtn.focus();
        }).then((value) => value === true);
    }

    function showChoice(options = {}) {
        return withDialog(options, (els, settle) => {
            els.cancelBtn.style.display = '';
            els.secondaryBtn.style.display = '';
            els.confirmBtn.style.display = '';
            els.closeBtn.style.display = 'none';
            els.cancelBtn.textContent = options.cancelLabel || 'Cancel';
            els.secondaryBtn.textContent = options.secondaryLabel || 'Quick Check';
            els.confirmBtn.textContent = options.confirmLabel || 'Attempt Solve';
            els.cancelBtn.onclick = () => settle(null);
            els.secondaryBtn.onclick = () => settle('secondary');
            els.confirmBtn.onclick = () => settle('confirm');
            els.confirmBtn.focus();
        });
    }

    function close() {
        if (activeDialogSettle) {
            activeDialogSettle(null);
            return;
        }
        const els = ensureModalElements();
        if (!els || els.root.hidden) return;
        closeRoot(els);
    }

    globalScope.SolitaireCheckModal = {
        showInfo,
        showConfirm,
        showChoice,
        close
    };
})(typeof window !== 'undefined' ? window : globalThis);
