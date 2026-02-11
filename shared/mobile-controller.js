/**
 * MobileSolitaireController
 * A shared state machine for handling "tap-to-pick" and "tap-to-drop" interactions
 * in solitaire-style games.
 */
class MobileSolitaireController {
    constructor(delegate, options = {}) {
        /**
         * Delegate should implement:
         * - isMovable(element) -> boolean
         * - getSequence(element) -> Array of card objects
         * - getSource(element) -> { type, index, ... }
         * - getElements(element) -> Array of DOM elements
         * - findDropTarget(x, y) -> { type, index, ... } or null
         * - isValidMove(source, target) -> boolean
         * - executeMove(source, target) -> void
         * - onSelectionChanged(elements, isSelected) -> void (optional)
         */
        this.delegate = delegate;
        this.state = 'IDLE'; // IDLE, SELECTED
        this.selectedData = {
            cards: [],
            elements: [],
            source: null
        };

        this.tapMoveThreshold = Number.isFinite(options.tapMoveThreshold) ? options.tapMoveThreshold : 10;
        this.activePointerId = null;
        this.pointerStart = null;
        this.pointerMoved = false;

        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handlePointerCancel = this.handlePointerCancel.bind(this);
        this.deselect = this.deselect.bind(this);
    }

    resetPointerTracking() {
        this.activePointerId = null;
        this.pointerStart = null;
        this.pointerMoved = false;
    }

    /**
     * Entry point for the controller. Call this from the game's pointerdown handler.
     * @param {PointerEvent} e
     * @returns {boolean} Whether the event was handled by the controller.
     */
    handlePointerDown(e) {
        if (this.activePointerId !== null) return false;
        this.activePointerId = e.pointerId;
        this.pointerStart = { x: e.clientX, y: e.clientY };
        this.pointerMoved = false;
        return true;
    }

    /**
     * Track pointer movement so we can distinguish a tap from a pan/scroll gesture.
     * @param {PointerEvent} e
     * @returns {boolean} Whether the event was handled by the controller.
     */
    handlePointerMove(e) {
        if (this.activePointerId !== e.pointerId || !this.pointerStart) return false;

        const dx = e.clientX - this.pointerStart.x;
        const dy = e.clientY - this.pointerStart.y;
        if (Math.hypot(dx, dy) > this.tapMoveThreshold) {
            this.pointerMoved = true;
        }
        return true;
    }

    /**
     * Complete a pointer interaction. Only treat it as a tap if no pan gesture occurred.
     * @param {PointerEvent} e
     * @returns {boolean} Whether the event was handled by the controller.
     */
    handlePointerUp(e) {
        if (this.activePointerId !== e.pointerId) return false;
        const didMove = this.pointerMoved;
        this.resetPointerTracking();

        if (didMove) return false;
        return this.handleTap(e);
    }

    /**
     * Reset tracking on pointer cancel (e.g., when the browser takes over scrolling).
     * @param {PointerEvent} e
     * @returns {boolean} Whether the event was handled by the controller.
     */
    handlePointerCancel(e) {
        if (this.activePointerId !== e.pointerId) return false;
        this.resetPointerTracking();
        return true;
    }

    handleTap(e) {
        const cardEl = e.target.closest('.card');
        const x = e.clientX;
        const y = e.clientY;

        if (this.state === 'SELECTED') {
            // 1. Try to drop
            const target = this.delegate.findDropTarget(x, y);
            if (target && this.delegate.isValidMove(this.selectedData.source, target)) {
                this.delegate.executeMove(this.selectedData.source, target);
                this.deselect();
                return true;
            }

            // 2. Check if we tapped the same card/sequence (Deselect)
            if (cardEl && this.selectedData.elements.includes(cardEl)) {
                this.deselect();
                return true;
            }

            // 3. Check if we tapped another movable card (Swap)
            if (cardEl && this.delegate.isMovable(cardEl)) {
                this.deselect();
                this.select(cardEl);
                return true;
            }

            // 4. Tapped elsewhere (Deselect)
            this.deselect();
            return true;
        } else {
            // IDLE state
            if (cardEl && this.delegate.isMovable(cardEl)) {
                this.select(cardEl);
                return true;
            }
        }

        return false;
    }

    select(cardEl) {
        this.selectedData.cards = this.delegate.getSequence(cardEl);
        this.selectedData.elements = this.delegate.getElements(cardEl);
        this.selectedData.source = this.delegate.getSource(cardEl);

        this.state = 'SELECTED';

        if (this.delegate.onSelectionChanged) {
            this.delegate.onSelectionChanged(this.selectedData.elements, true);
        } else {
            this.selectedData.elements.forEach(el => el.classList.add('picked-up'));
        }

        if (typeof CommonUtils !== 'undefined' && CommonUtils.playSound) {
            CommonUtils.playSound('card');
        }
    }

    deselect() {
        if (this.state === 'IDLE') return;

        if (this.delegate.onSelectionChanged) {
            this.delegate.onSelectionChanged(this.selectedData.elements, false);
        } else {
            this.selectedData.elements.forEach(el => el.classList.remove('picked-up'));
        }

        this.state = 'IDLE';
        this.selectedData = {
            cards: [],
            elements: [],
            source: null
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileSolitaireController;
}
