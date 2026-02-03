/**
 * Shared utility functions for card games.
 */

const CommonUtils = {
    audioAssets: {},

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

            const baseRenderedCards = 52;
            const deckScalingFactor = Math.sqrt(deckCount);
            let maxRenderedCards = Math.floor(baseRenderedCards * deckScalingFactor);
            const maxWidthCards = 188;
            maxRenderedCards = Math.min(maxRenderedCards, maxWidthCards);

            let cardsToShow, reductionFactor = 1;
            if (totalCards > maxRenderedCards) {
                reductionFactor = totalCards / maxRenderedCards;
                cardsToShow = maxRenderedCards;
            } else {
                cardsToShow = totalCards;
            }

            const totalWidth = cardsToShow * 2;

            for (let i = 0; i < cardsToShow; i++) {
                const realIndex = Math.floor(i * reductionFactor);
                const cardBackLine = document.createElement('div');
                cardBackLine.className = 'card-back-line';
                const positionFromRight = totalWidth - (i * 2);

                cardBackLine.style.cssText = `
                    position: absolute;
                    width: 2px;
                    height: 70px;
                    left: ${positionFromRight}px;
                    z-index: ${i * 2};
                `;

                if (separatorIndex !== -1 && Math.abs(realIndex - separatorIndex) < reductionFactor) {
                    cardBackLine.style.width = '1px';
                    cardBackLine.style.background = 'linear-gradient(0deg, #FFEED7 0%, #FFEEA5 50%, #FFEED7 100%)';
                    cardBackLine.style.zIndex = 100;
                }
                cardStack.appendChild(cardBackLine);

                const cardEdgeLine = document.createElement('div');
                cardEdgeLine.className = 'card-edge-line';
                const edgePositionFromRight = totalWidth - (i * 2 + 1);

                cardEdgeLine.style.cssText = `
                    position: absolute;
                    width: 2px;
                    height: 70px;
                    left: ${edgePositionFromRight}px;
                    z-index: ${i * 2 + 1};
                `;

                if (separatorIndex !== -1 && Math.abs(realIndex - separatorIndex) < reductionFactor) {
                    cardEdgeLine.style.width = '2px';
                    cardEdgeLine.style.backgroundColor = '#FFF7A2';
                    cardEdgeLine.style.zIndex = 99;
                }
                cardStack.appendChild(cardEdgeLine);
            }
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

        setTimeout(() => {
            flyingCard.style.left = `${destX}px`;
            flyingCard.style.top = `${destY}px`;
            flyingCard.style.transform = 'scale(0.8) rotate(5deg)';
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
