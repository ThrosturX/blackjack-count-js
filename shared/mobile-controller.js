/**
 * MobileSolitaireController
 * A shared state machine for handling "tap-to-pick" and "tap-to-drop" interactions
 * in solitaire-style games.
 */
class MobileSolitaireController {
    constructor(delegate) {
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

        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.deselect = this.deselect.bind(this);
    }

    /**
     * Entry point for the controller. Call this from the game's pointerdown handler.
     * @param {PointerEvent} e
     * @returns {boolean} Whether the event was handled by the controller.
     */
    handlePointerDown(e) {
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
