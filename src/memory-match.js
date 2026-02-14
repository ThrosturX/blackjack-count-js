/**
 * Memory Match - Educational card matching game
 * Teaches memory and pattern recognition through card matching
 */

(function() {
    "use strict";

    // Game state
    const state = {
        cards: [],
        flippedCards: [],
        matchedPairs: 0,
        totalPairs: 6,
        moves: 0,
        isProcessing: false,
        currentLevel: 3,
        consecutiveWins: 0,
        autoLevel: true,
        levelProgress: {}
    };

    // Level configurations - optimized for portrait mode
    const LEVEL_CONFIG = {
        1: { pairs: 3, cols: 3 },    // 3x2 = 6 cards
        2: { pairs: 4, cols: 4 },    // 2x4 = 8 cards
        3: { pairs: 6, cols: 3 },    // 3x4 = 12 cards
        4: { pairs: 8, cols: 4 },    // 4x4 = 16 cards
        5: { pairs: 10, cols: 5 },   // 4x5 = 20 cards
        6: { pairs: 12, cols: 4 },   // 4x6 = 24 cards
        7: { pairs: 14, cols: 3, note: "Extended deck" }  // 3x10 = 30 cells, 28 cards
    };

    // DOM elements
    const elements = {
        moves: null,
        pairs: null,
        pairsSelect: null,
        autoLevel: null,
        levelInfo: null,
        gameGrid: null,
        winOverlay: null,
        finalMoves: null,
        finalPairs: null,
        newGameBtn: null,
        playAgainBtn: null
    };

    // Initialize the game
    function init() {
        cacheElements();
        loadProgress();
        bindEvents();
        startNewGame();
    }

    // Cache DOM elements
    function cacheElements() {
        elements.moves = document.getElementById("moves");
        elements.pairs = document.getElementById("pairs");
        elements.pairsSelect = document.getElementById("pairs-select");
        elements.autoLevel = document.getElementById("auto-level");
        elements.levelInfo = document.getElementById("level-info");
        elements.gameGrid = document.getElementById("game-grid");
        elements.winOverlay = document.getElementById("win-overlay");
        elements.finalMoves = document.getElementById("final-moves");
        elements.finalPairs = document.getElementById("final-pairs");
        elements.newGameBtn = document.getElementById("new-game-btn");
        elements.playAgainBtn = document.getElementById("play-again-btn");
    }

    // Bind event listeners
    function bindEvents() {
        elements.pairsSelect.addEventListener("change", (e) => {
            state.totalPairs = parseInt(e.target.value, 10);
            state.autoLevel = false;
            elements.autoLevel.checked = false;
            startNewGame();
            saveProgress();
        });

        elements.autoLevel.addEventListener("change", (e) => {
            state.autoLevel = e.target.checked;
            if (state.autoLevel) {
                // Set pairs based on current level
                const config = LEVEL_CONFIG[state.currentLevel];
                if (config) {
                    state.totalPairs = config.pairs;
                    elements.pairsSelect.value = config.pairs;
                }
            }
            saveProgress();
        });

        elements.newGameBtn.addEventListener("click", () => {
            startNewGame();
        });

        elements.playAgainBtn.addEventListener("click", () => {
            hideWinOverlay();
            if (state.autoLevel && state.consecutiveWins > 0) {
                // Try to advance level
                advanceLevel();
            }
            startNewGame();
        });
    }

    // Load saved progress
    function loadProgress() {
        const saved = EducationalUtils.loadProgress("memory-match");
        if (saved) {
            state.currentLevel = saved.currentLevel || 3;
            state.consecutiveWins = saved.consecutiveWins || 0;
            state.autoLevel = saved.autoLevel !== false;
            state.levelProgress = saved.levelProgress || {};

            // Set pairs from level or saved value
            if (state.autoLevel) {
                const config = LEVEL_CONFIG[state.currentLevel];
                if (config) {
                    state.totalPairs = config.pairs;
                }
            } else {
                state.totalPairs = saved.totalPairs || 6;
            }

            elements.pairsSelect.value = state.totalPairs;
            elements.autoLevel.checked = state.autoLevel;
        }
        updateLevelInfo();
    }

    // Save progress
    function saveProgress() {
        EducationalUtils.saveProgress("memory-match", {
            currentLevel: state.currentLevel,
            consecutiveWins: state.consecutiveWins,
            totalPairs: state.totalPairs,
            autoLevel: state.autoLevel,
            levelProgress: state.levelProgress
        });
    }

    // Update level info display
    function updateLevelInfo() {
        const config = LEVEL_CONFIG[state.currentLevel];
        if (config) {
            elements.levelInfo.textContent = `Level ${state.currentLevel}: ${config.pairs} pairs (${config.cols}×${Math.ceil(config.pairs * 2 / config.cols)} grid)`;
        }
    }

    // Start a new game
    function startNewGame() {
        state.cards = [];
        state.flippedCards = [];
        state.matchedPairs = 0;
        state.moves = 0;
        state.isProcessing = false;

        generateCards();
        renderGrid();
        updateUI();
    }

    // Generate cards for the game
    function generateCards() {
        // Create a pool of cards - use extended deck for 14 pairs (with Knights)
        const fullDeck = [];
        const cardValues = state.totalPairs >= 14 ? EXTENDED_VALUES : VALUES;

        for (const suit of SUITS) {
            for (const val of cardValues) {
                fullDeck.push(new Card(suit, val));
            }
        }

        // Shuffle the deck
        const shuffled = EducationalUtils.shuffle(fullDeck);

        // Pick the required number of pairs
        state.cards = [];
        for (let i = 0; i < state.totalPairs; i++) {
            const card = shuffled[i];
            // Add two of each card (for the pair)
            state.cards.push({ ...card, id: i, matchId: i });
            state.cards.push({ ...card, id: i + state.totalPairs, matchId: i });
        }

        // Shuffle the card pairs
        state.cards = EducationalUtils.shuffle(state.cards);
    }

    // Render the card grid
    function renderGrid() {
        elements.gameGrid.innerHTML = "";

        // Calculate grid dimensions
        const totalCards = state.cards.length;
        let cols = 4;
        for (const config of Object.values(LEVEL_CONFIG)) {
            if (config.pairs * 2 === totalCards) {
                cols = config.cols;
                break;
            }
        }

        elements.gameGrid.style.gridTemplateColumns = `repeat(${cols}, var(--edu-card-size))`;

        state.cards.forEach((card, index) => {
            const cardEl = document.createElement("div");
            cardEl.className = "edu-card";
            cardEl.dataset.index = index;

            // Card back (hidden state)
            const cardBack = document.createElement("div");
            cardBack.className = "edu-card-back";
            cardBack.textContent = "?";
            cardEl.appendChild(cardBack);

            // Actual card (shown when flipped)
            const cardObj = new Card(card.suit, card.val);
            const cardVisual = CommonUtils.createCardEl(cardObj);
            cardVisual.style.display = "none";
            cardEl.appendChild(cardVisual);

            // Click handler
            cardEl.addEventListener("click", () => handleCardClick(index));

            elements.gameGrid.appendChild(cardEl);
        });
    }

    // Handle card click
    function handleCardClick(index) {
        if (state.isProcessing) return;

        const cardEl = elements.gameGrid.children[index];
        const card = state.cards[index];

        // Ignore if already flipped or matched
        if (cardEl.classList.contains("flipped") || cardEl.classList.contains("matched")) {
            return;
        }

        // Flip the card
        flipCard(cardEl, index);

        // Add to flipped cards
        state.flippedCards.push({ index, card });

        // Check for match if two cards are flipped
        if (state.flippedCards.length === 2) {
            state.moves++;
            checkForMatch();
        }

        updateUI();
    }

    // Flip a card
    function flipCard(cardEl, index) {
        cardEl.classList.add("flipped");
        const cardVisual = cardEl.querySelector(".card");
        if (cardVisual) {
            cardVisual.style.display = "block";
        }
    }

    // Unflip a card
    function unflipCard(cardEl) {
        cardEl.classList.remove("flipped");
        const cardVisual = cardEl.querySelector(".card");
        if (cardVisual) {
            cardVisual.style.display = "none";
        }
    }

    // Check if flipped cards match
    function checkForMatch() {
        state.isProcessing = true;

        const [first, second] = state.flippedCards;
        const isMatch = first.card.matchId === second.card.matchId;

        if (isMatch) {
            // Match found!
            setTimeout(() => {
                const cardEl1 = elements.gameGrid.children[first.index];
                const cardEl2 = elements.gameGrid.children[second.index];
                cardEl1.classList.add("matched");
                cardEl2.classList.add("matched");

                state.matchedPairs++;
                state.flippedCards = [];
                state.isProcessing = false;

                CommonUtils.playSound("win");
                updateUI();

                // Check for win
                if (state.matchedPairs === state.totalPairs) {
                    handleWin();
                }
            }, 300);
        } else {
            // No match - flip back after delay
            setTimeout(() => {
                const cardEl1 = elements.gameGrid.children[first.index];
                const cardEl2 = elements.gameGrid.children[second.index];
                unflipCard(cardEl1);
                unflipCard(cardEl2);

                state.flippedCards = [];
                state.isProcessing = false;

                CommonUtils.playSound("error");
            }, 1000);
        }
    }

    // Handle win condition
    function handleWin() {
        // Record level progress
        const pairsKey = state.totalPairs;
        if (!state.levelProgress[pairsKey] || state.levelProgress[pairsKey] > state.moves) {
            state.levelProgress[pairsKey] = state.moves;
        }

        // Track consecutive wins for auto-levelling
        state.consecutiveWins++;

        // Show win overlay
        elements.finalMoves.textContent = state.moves;
        elements.finalPairs.textContent = state.totalPairs;
        elements.winOverlay.classList.remove("hidden");

        CommonUtils.playSound("win");
        saveProgress();
    }

    // Hide win overlay
    function hideWinOverlay() {
        elements.winOverlay.classList.add("hidden");
    }

    // Advance to next level
    function advanceLevel() {
        if (state.currentLevel < 7 && state.consecutiveWins >= 3) {
            state.currentLevel++;
            state.consecutiveWins = 0;
            const config = LEVEL_CONFIG[state.currentLevel];
            state.totalPairs = config.pairs;
            elements.pairsSelect.value = config.pairs;
            updateLevelInfo();
        }
    }

    // Update UI elements
    function updateUI() {
        elements.moves.textContent = state.moves;
        elements.pairs.textContent = `${state.matchedPairs}/${state.totalPairs}`;
    }

    // Start the game when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
