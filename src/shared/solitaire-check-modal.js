/**
 * Shared modal for solitaire check flows.
 * Handles choice, confirm, and info dialogs with safe focus/inert behavior.
 */
(function (globalScope) {
    const MODAL_ROOT_ID = 'solitaire-check-modal-root';
    let previousFocus = null;

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
                    <p data-modal-message></p>
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
        els.root.inert = true;
        els.root.hidden = true;
        if (previousFocus && typeof previousFocus.focus === 'function') {
            previousFocus.focus();
        }
        previousFocus = null;
    }

    function withDialog(options, initUI) {
        const els = ensureModalElements();
        if (!els) return Promise.resolve(null);

        openRoot(els);
        els.title.textContent = options.title || 'Check';
        els.message.textContent = options.message || '';
        els.root.classList.toggle('busy', options.busy === true);

        return new Promise((resolve) => {
            let settled = false;
            const settle = (value) => {
                if (settled) return;
                settled = true;
                closeRoot(els);
                resolve(value);
            };
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
