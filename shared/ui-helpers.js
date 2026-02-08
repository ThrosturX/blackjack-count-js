/**
 * UI helper utilities that multiple card games can reuse for drag/drop hit testing.
 */
const UIHelpers = (function () {
    return {
        getRectWithPadding(rect, padding) {
            return {
                top: rect.top - padding,
                right: rect.right + padding,
                bottom: rect.bottom + padding,
                left: rect.left - padding
            };
        },

        isPointInRect(x, y, rect) {
            return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        },

        distanceToRect(x, y, rect) {
            const dx = Math.max(rect.left - x, 0, x - rect.right);
            const dy = Math.max(rect.top - y, 0, y - rect.bottom);
            return Math.hypot(dx, dy);
        },

        getStackBounds(columnEl, cardHeight, stackOffset) {
            const rect = columnEl.getBoundingClientRect();
            const cards = columnEl.querySelectorAll('.card');
            const stackHeight = cards.length > 0
                ? cardHeight + Math.max(0, cards.length - 1) * stackOffset
                : cardHeight;
            return {
                top: rect.top,
                bottom: rect.top + Math.max(rect.height, stackHeight),
                left: rect.left,
                right: rect.right
            };
        }
    };
})();
