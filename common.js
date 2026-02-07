/**
 * Shared utility functions for card games.
 */

const CommonUtils = {
    audioAssets: {},

    /**
     * Applies deterministic wear variables based on suit/value.
     * @param {HTMLElement} cardEl
     * @param {Object} card
     */
    applyDeterministicWear: function (cardEl, card) {
        if (!cardEl || !card) return;
        const identity = `${card.val}${card.suit}`;
        let hash = 0;
        for (let i = 0; i < identity.length; i++) {
            hash = (hash * 31 + identity.charCodeAt(i)) >>> 0;
        }
        let state = hash || 1;
        const rand = () => {
            state = (1664525 * state + 1013904223) >>> 0;
            return state / 4294967296;
        };

        const scuffX = Math.round(15 + rand() * 70);
        const scuffY = Math.round(12 + rand() * 70);
        const scuff2X = Math.round(10 + rand() * 75);
        const scuff2Y = Math.round(15 + rand() * 70);
        const scratchAngle = Math.round(-60 + rand() * 120);
        const scratchAngle2 = Math.round(-60 + rand() * 120);
        const scratchAlpha = (0.92 + rand() * 0.16).toFixed(3);
        const foldAlpha = rand() > 0.6 ? (0.08 + rand() * 0.12).toFixed(3) : '0';
        const foldAngle = Math.round(15 + rand() * 150);
        const foldX = Math.round(15 + rand() * 70);
        const foldY = Math.round(18 + rand() * 67);
        const tearAlpha = rand() > 0.86 ? (0.45 + rand() * 0.25).toFixed(3) : '0';
        const tearAngle = Math.round(-20 + rand() * 40);
        const tearSize = Math.round(10 + rand() * 18);
        const stainAlpha = rand() > 0.88 ? (0.12 + rand() * 0.18).toFixed(3) : '0';
        const stainX = Math.round(20 + rand() * 60);
        const stainY = Math.round(20 + rand() * 60);
        const stainSize = Math.round(18 + rand() * 16);
        const graphiteAlpha = rand() > 0.78 ? (0.1 + rand() * 0.18).toFixed(3) : '0';
        const graphiteX = Math.round(10 + rand() * 75);
        const graphiteY = Math.round(10 + rand() * 75);
        const graphiteSize = Math.round(20 + rand() * 22);
        const dustAlpha = rand() > 0.6 ? (0.04 + rand() * 0.08).toFixed(3) : '0';
        const dustX = Math.round(5 + rand() * 80);
        const dustY = Math.round(5 + rand() * 80);
        const dustSize = Math.round(35 + rand() * 30);
        const nicotineAlpha = rand() > 0.82 ? (0.08 + rand() * 0.12).toFixed(3) : '0';
        const nicotineX = Math.round(15 + rand() * 70);
        const nicotineY = Math.round(15 + rand() * 70);
        const nicotineSize = Math.round(28 + rand() * 20);
        const warpAlpha = rand() > 0.86 ? (0.08 + rand() * 0.12).toFixed(3) : '0';
        const warpAngle = Math.round(-45 + rand() * 90);
        const warpX = Math.round(10 + rand() * 70);
        const warpY = Math.round(10 + rand() * 70);
        const inkAlpha = rand() > 0.9 ? (0.16 + rand() * 0.2).toFixed(3) : '0';
        const inkAngle = Math.round(-60 + rand() * 120);
        const inkX = Math.round(10 + rand() * 75);
        const inkY = Math.round(10 + rand() * 75);
        const matteAlpha = rand() > 0.7 ? (0.05 + rand() * 0.12).toFixed(3) : '0';
        const matteX = Math.round(15 + rand() * 70);
        const matteY = Math.round(15 + rand() * 70);
        const matteSize = Math.round(25 + rand() * 20);

        cardEl.style.setProperty('--wear-scuff-x', `${scuffX}%`);
        cardEl.style.setProperty('--wear-scuff-y', `${scuffY}%`);
        cardEl.style.setProperty('--wear-scuff2-x', `${scuff2X}%`);
        cardEl.style.setProperty('--wear-scuff2-y', `${scuff2Y}%`);
        cardEl.style.setProperty('--wear-scratch-angle', `${scratchAngle}deg`);
        cardEl.style.setProperty('--wear-scratch-angle-2', `${scratchAngle2}deg`);
        cardEl.style.setProperty('--wear-scratch-alpha', scratchAlpha);
        cardEl.style.setProperty('--wear-fold-alpha', foldAlpha);
        cardEl.style.setProperty('--wear-fold-angle', `${foldAngle}deg`);
        cardEl.style.setProperty('--wear-fold-x', `${foldX}%`);
        cardEl.style.setProperty('--wear-fold-y', `${foldY}%`);
        cardEl.style.setProperty('--wear-tear-alpha', tearAlpha);
        cardEl.style.setProperty('--wear-tear-angle', `${tearAngle}deg`);
        cardEl.style.setProperty('--wear-tear-size', `${tearSize}%`);
        cardEl.style.setProperty('--wear-stain-alpha', stainAlpha);
        cardEl.style.setProperty('--wear-stain-x', `${stainX}%`);
        cardEl.style.setProperty('--wear-stain-y', `${stainY}%`);
        cardEl.style.setProperty('--wear-stain-size', `${stainSize}%`);
        cardEl.style.setProperty('--wear-graphite-alpha', graphiteAlpha);
        cardEl.style.setProperty('--wear-graphite-x', `${graphiteX}%`);
        cardEl.style.setProperty('--wear-graphite-y', `${graphiteY}%`);
        cardEl.style.setProperty('--wear-graphite-size', `${graphiteSize}%`);
        cardEl.style.setProperty('--wear-dust-alpha', dustAlpha);
        cardEl.style.setProperty('--wear-dust-x', `${dustX}%`);
        cardEl.style.setProperty('--wear-dust-y', `${dustY}%`);
        cardEl.style.setProperty('--wear-dust-size', `${dustSize}%`);
        cardEl.style.setProperty('--wear-nicotine-alpha', nicotineAlpha);
        cardEl.style.setProperty('--wear-nicotine-x', `${nicotineX}%`);
        cardEl.style.setProperty('--wear-nicotine-y', `${nicotineY}%`);
        cardEl.style.setProperty('--wear-nicotine-size', `${nicotineSize}%`);
        cardEl.style.setProperty('--wear-warp-alpha', warpAlpha);
        cardEl.style.setProperty('--wear-warp-angle', `${warpAngle}deg`);
        cardEl.style.setProperty('--wear-warp-x', `${warpX}%`);
        cardEl.style.setProperty('--wear-warp-y', `${warpY}%`);
        cardEl.style.setProperty('--wear-ink-alpha', inkAlpha);
        cardEl.style.setProperty('--wear-ink-angle', `${inkAngle}deg`);
        cardEl.style.setProperty('--wear-ink-x', `${inkX}%`);
        cardEl.style.setProperty('--wear-ink-y', `${inkY}%`);
        cardEl.style.setProperty('--wear-matte-alpha', matteAlpha);
        cardEl.style.setProperty('--wear-matte-x', `${matteX}%`);
        cardEl.style.setProperty('--wear-matte-y', `${matteY}%`);
        cardEl.style.setProperty('--wear-matte-size', `${matteSize}%`);
    },

    /**
     * Preloads audio assets.
     * @param {Object} soundFiles - Mapping of sound types to arrays of filenames.
     */
    preloadAudio: function (soundFiles) {
        for (const [type, filepaths] of Object.entries(soundFiles)) {
            this.audioAssets[type] = filepaths.map(path => {
                const audio = new Audio();
                audio.preload = 'auto';
                audio.src = 'audio/' + path;
                audio.load();
                audio.addEventListener('error', () => {
                    console.warn(`Could not load audio file: ${path}`);
                });
                return audio;
            });
        }
    },

    /**
     * Plays a sound of a given type.
     * @param {string} type - Sound type.
     */
    playSound: function (type) {
        if (this.audioAssets[type]) {
            const sounds = this.audioAssets[type];
            const audioChoice = sounds[Math.floor(Math.random() * sounds.length)];
            const audio = new Audio(audioChoice.src);
            audio.volume = 0.05;
            if (type === 'card' || type === 'chip') {
                audio.volume = 0.3;
            }
            audio.play().catch(e => {
                console.warn(`Could not play ${type} sound:`, e.message);
            });
        } else {
            console.warn("Audio not implemented for: " + type);
        }
    },

    /**
     * Creates a shoe of cards.
     * @param {number} deckCount - Number of decks.
     * @param {Array} suits - Array of suit symbols.
     * @param {Array} values - Array of value symbols.
     * @returns {Array} Shuffled array of Card objects.
     */
    createShoe: function (deckCount, suits, values) {
        let shoe = [];
        for (let i = 0; i < deckCount; i++) {
            for (let s of suits) {
                for (let v of values) {
                    shoe.push(new Card(s, v));
                }
            }
        }
        // Fisher-Yates Shuffle
        for (let i = shoe.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
        }
        return shoe;
    },

    /**
     * Creates a DOM element representation of a card.
     * @param {Object} card - Card object.
     * @returns {HTMLElement}
     */
    createCardEl: function (card) {
        const div = document.createElement('div');
        div.className = `card ${card.color}${card.hidden ? ' hidden' : ''}${card.isSplitCard ? ' split-card' : ''}`;
        div.dataset.suit = card.suit;
        div.dataset.val = card.val;
        div.dataset.rank = card.rank;
        div.dataset.color = card.color;
        // if we can give it a random rotation, let's do that
        if (card.rotation !== undefined) {
            div.style.transform = `rotate(${card.rotation}deg)`;
        }
        this.applyDeterministicWear(div, card);

        const valTop = document.createElement('div');
        valTop.className = 'val-top';
        valTop.innerHTML = `${card.val}<br><small>${card.suit}</small>`;
        div.appendChild(valTop);

        const suitCenter = document.createElement('div');
        suitCenter.className = 'suit-center';
        suitCenter.textContent = card.suit;
        div.appendChild(suitCenter);

        const valBot = document.createElement('div');
        valBot.className = 'val-bot';
        valBot.innerHTML = `${card.val}<br><small>${card.suit}</small>`;
        div.appendChild(valBot);

        return div;
    },

    /**
     * Updates the visual representation of the shoe.
     * @param {HTMLElement} cardStack - Container for card stack.
     * @param {Array} shoe - The cards in the shoe.
     * @param {boolean} isShuffling - Whether the game is currently shuffling.
     * @param {number} deckCount - Total deck count for scaling.
     * @param {number} totalInitialCards - Initial total cards for separator positioning.
     */
    updateShoeVisual: function (cardStack, shoe, isShuffling, deckCount, totalInitialCards) {
        if (!cardStack) return;

        requestAnimationFrame(() => {
            cardStack.innerHTML = '';
            if (shoe.length === 0 || isShuffling) return;

            const totalCards = shoe.length;
            const separatorIndex = shoe.findIndex(card => card.isSplitCard);

            // 1. SET REALISTIC BOUNDS
            // A real 8-deck stack is ~12.5cm. 260px is a realistic "UI size" for this.
            // If you want it "Life-Size" (1px = 1 card), change this to 416.
            const MAX_PHYSICAL_WIDTH = 260;

            // 2. UNPACKING & SAMPLING LOGIC
            // The shoe fills up to 260px. If > 260 cards, we compress (decimate).
            // If < 260 cards, we use 1px per card (the "unpacking" effect).
            const visualLines = Math.min(totalCards, MAX_PHYSICAL_WIDTH);
            const reductionFactor = totalCards / visualLines;

            for (let i = 0; i < visualLines; i++) {
                // Mapping: i=0 is the bottom (right), i=max is the top/mouth (left).
                const realIndex = Math.floor(i * reductionFactor);

                // Position 0 is the mouth. Higher values are deeper in the shoe.
                const leftPos = visualLines - i;

                const line = document.createElement('div');
                // Alternate classes to preserve the "paper edge" texture from the intern's CSS
                line.className = (i % 2 === 0) ? 'card-back-line' : 'card-edge-line';

                line.style.cssText = `
                    position: absolute;
                    width: 1px;
                    height: 70px;
                    left: ${leftPos}px;
                    z-index: ${i};
                `;

                // 3. CORRECT CUT CARD POSITION
                // We highlight the line if the separator falls within this sampled slice.
                if (separatorIndex !== -1 && Math.abs(realIndex - separatorIndex) < reductionFactor) {
                    line.style.width = '2px'; // Make the plastic slightly visible
                    line.style.background = 'linear-gradient(0deg, #FFEED7 0%, #FFEEA5 50%, #FFEED7 100%)';
                    line.style.zIndex = 1000;
                }

                cardStack.appendChild(line);
            }
            // finally, place the top card so it comes out of the lip
            const previewEl = document.getElementById('top-card-preview');
            if (!previewEl || shoe.length === 0) {
                // no card to draw
                if (previewEl) {
                    // if we have a draw pile/shoe and no card to draw, hide it
                    previewEl.style.opacity = 0;
                }
                return;
            }
            previewEl.innerHTML = '';
            previewEl.style.opacity = 0.92;
            let topCard = this.createCardEl(shoe[shoe.length - 1]);
            topCard.classList.add('hidden');
            topCard.classList.add('top-card-preview-card');
            topCard.style.zIndex = visualLines + 1;
            const TOP_CARD_ROTATION_MAX = 2;
            const TOP_CARD_ROTATION_MIN = -3;
            let rot = Math.floor(Math.random() * (TOP_CARD_ROTATION_MAX - TOP_CARD_ROTATION_MIN + 1)) + TOP_CARD_ROTATION_MIN;
            topCard.style.transform = `rotate(${rot}deg)`;
            previewEl.appendChild(topCard);
        });
    },

    /**
     * Animates a card being drawn from the shoe.
     * @param {HTMLElement} shoeBody - The shoe element to start from.
     * @param {number} destX - Target X coordinate.
     * @param {number} destY - Target Y coordinate.
     * @param {Function} onComplete - Callback when animation finishes.
     */
    animateCardDraw: function (shoeBody, destX, destY, onComplete) {
        if (!shoeBody) return;

        const flyingCard = document.createElement('div');
        flyingCard.className = 'card hidden';
        flyingCard.style.position = 'fixed';
        flyingCard.style.width = '70px';
        flyingCard.style.height = '95px';
        flyingCard.style.zIndex = '1000';
        flyingCard.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        flyingCard.style.pointerEvents = 'none';
        flyingCard.style.opacity = '0.95';
        flyingCard.style.borderRadius = '6px';
        flyingCard.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4), inset 0 0 10px rgba(255,255,255,0.1)';

        const shoeRect = shoeBody.getBoundingClientRect();
        flyingCard.style.left = `${shoeRect.left + 5}px`;
        flyingCard.style.top = `${shoeRect.top + 15}px`;

        document.body.appendChild(flyingCard);
        let rot = Math.floor(Math.random() * (11)) - 5;

        setTimeout(() => {
            flyingCard.style.left = `${destX}px`;
            flyingCard.style.top = `${destY}px`;
            flyingCard.style.transform = `scale(0.8) rotate(${rot}deg)`;
            flyingCard.style.opacity = '0.7';

            setTimeout(() => {
                if (flyingCard.parentNode) {
                    flyingCard.parentNode.removeChild(flyingCard);
                }
                if (onComplete) onComplete();
            }, 400);
        }, 10);
    },

    /**
     * Returns a score display string or "BUST".
     * @param {number} score - The score.
     * @returns {string}
     */
    getScoreDisplay: function (score) {
        if (score > 21) return 'BUST (' + score + ')';
        return score.toString();
    }
};

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CommonUtils;
}
