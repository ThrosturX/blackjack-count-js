/**
 * Learn the Cards - Educational card recognition game
 * Teaches card values, suits, and colors through interactive questions
 */

(function() {
    "use strict";

    // Game state
    const state = {
        score: 0,
        streak: 0,
        bestStreak: 0,
        difficulty: 3,
        autoDifficulty: true,
        currentQuestion: null,
        currentCards: [],
        recentAnswers: [],
        maxRecentAnswers: 10
    };

    // Question types
    const QUESTION_TYPES = {
        HIGHER: "higher",
        LOWER: "lower",
        SAME_SUIT: "same-suit",
        DIFFERENT_SUIT: "different-suit",
        SAME_COLOR: "same-color",
        DIFFERENT_COLOR: "different-color"
    };

    // Question type configurations
    const QUESTION_CONFIGS = {
        [QUESTION_TYPES.HIGHER]: {
            getQuestion: () => "Which card is higher?",
            getAnswers: () => ["Left Card", "Right Card"],
            checkAnswer: (cards, answerIndex) => {
                const rank1 = EducationalUtils.getRank(cards[0].val);
                const rank2 = EducationalUtils.getRank(cards[1].val);
                const higherIndex = rank1 > rank2 ? 0 : (rank2 > rank1 ? 1 : answerIndex);
                return answerIndex === higherIndex;
            },
            allowedLevels: [1, 2, 3, 4, 5]
        },
        [QUESTION_TYPES.LOWER]: {
            getQuestion: () => "Which card is lower?",
            getAnswers: () => ["Left Card", "Right Card"],
            checkAnswer: (cards, answerIndex) => {
                const rank1 = EducationalUtils.getRank(cards[0].val);
                const rank2 = EducationalUtils.getRank(cards[1].val);
                const lowerIndex = rank1 < rank2 ? 0 : (rank2 < rank1 ? 1 : answerIndex);
                return answerIndex === lowerIndex;
            },
            allowedLevels: [2, 3, 4, 5]
        },
        [QUESTION_TYPES.SAME_SUIT]: {
            getQuestion: () => "Do these cards have the same suit?",
            getAnswers: () => ["Yes", "No"],
            checkAnswer: (cards, answerIndex) => {
                const sameSuit = cards[0].suit === cards[1].suit;
                return (answerIndex === 0) === sameSuit;
            },
            allowedLevels: [2, 3, 4, 5]
        },
        [QUESTION_TYPES.DIFFERENT_SUIT]: {
            getQuestion: () => "Are these cards different suits?",
            getAnswers: () => ["Yes", "No"],
            checkAnswer: (cards, answerIndex) => {
                const differentSuits = cards[0].suit !== cards[1].suit;
                return (answerIndex === 0) === differentSuits;
            },
            allowedLevels: [2, 3, 4, 5]
        },
        [QUESTION_TYPES.SAME_COLOR]: {
            getQuestion: () => "Are these cards the same color?",
            getAnswers: () => ["Yes", "No"],
            checkAnswer: (cards, answerIndex) => {
                const color1 = EducationalUtils.getCardColor(cards[0]);
                const color2 = EducationalUtils.getCardColor(cards[1]);
                const sameColor = color1 === color2;
                return (answerIndex === 0) === sameColor;
            },
            allowedLevels: [2, 3, 4, 5]
        },
        [QUESTION_TYPES.DIFFERENT_COLOR]: {
            getQuestion: () => "Are these cards different colors?",
            getAnswers: () => ["Yes", "No"],
            checkAnswer: (cards, answerIndex) => {
                const color1 = EducationalUtils.getCardColor(cards[0]);
                const color2 = EducationalUtils.getCardColor(cards[1]);
                const differentColors = color1 !== color2;
                return (answerIndex === 0) === differentColors;
            },
            allowedLevels: [2, 3, 4, 5]
        }
    };

    // DOM elements
    const elements = {
        score: null,
        streak: null,
        difficulty: null,
        autoDifficulty: null,
        progressFill: null,
        question: null,
        cardsContainer: null,
        answerButtons: null,
        cardSlot1: null,
        cardSlot2: null
    };

    // Initialize the game
    function init() {
        cacheElements();
        loadProgress();
        bindEvents();
        startNewQuestion();
    }

    // Cache DOM elements
    function cacheElements() {
        elements.score = document.getElementById("score");
        elements.streak = document.getElementById("streak");
        elements.difficulty = document.getElementById("difficulty");
        elements.autoDifficulty = document.getElementById("auto-difficulty");
        elements.progressFill = document.getElementById("progress-fill");
        elements.question = document.getElementById("question");
        elements.answerButtons = document.getElementById("answer-buttons");
        elements.cardSlot1 = document.getElementById("card-slot-1");
        elements.cardSlot2 = document.getElementById("card-slot-2");
    }

    // Bind event listeners
    function bindEvents() {
        elements.difficulty.addEventListener("change", (e) => {
            state.difficulty = parseInt(e.target.value, 10);
            state.autoDifficulty = false;
            elements.autoDifficulty.checked = false;
            saveProgress();
        });

        elements.autoDifficulty.addEventListener("change", (e) => {
            state.autoDifficulty = e.target.checked;
            if (state.autoDifficulty) {
                elements.difficulty.value = state.difficulty;
            }
            saveProgress();
        });
    }

    // Load saved progress
    function loadProgress() {
        const saved = EducationalUtils.loadProgress("learn-cards");
        if (saved) {
            state.score = saved.score || 0;
            state.bestStreak = saved.bestStreak || 0;
            state.difficulty = saved.difficulty || 3;
            state.autoDifficulty = saved.autoDifficulty !== false;
            state.recentAnswers = saved.recentAnswers || [];
            elements.difficulty.value = state.difficulty;
            elements.autoDifficulty.checked = state.autoDifficulty;
        }
        updateUI();
    }

    // Save progress
    function saveProgress() {
        EducationalUtils.saveProgress("learn-cards", {
            score: state.score,
            bestStreak: state.bestStreak,
            difficulty: state.difficulty,
            autoDifficulty: state.autoDifficulty,
            recentAnswers: state.recentAnswers
        });
    }

    // Update UI elements
    function updateUI() {
        elements.score.textContent = state.score;
        elements.streak.textContent = state.streak;

        // Update progress bar
        const progress = Math.min(100, (state.streak / 10) * 100);
        elements.progressFill.style.width = `${progress}%`;
    }

    // Get available question types for current difficulty
    function getAvailableQuestionTypes() {
        const config = QUESTION_CONFIGS;
        const available = [];

        for (const [type, questionConfig] of Object.entries(config)) {
            if (questionConfig.allowedLevels.includes(state.difficulty)) {
                available.push(type);
            }
        }

        return available;
    }

    // Generate a new question
    function startNewQuestion() {
        // Get available deck for current difficulty
        const deck = EducationalUtils.createDeckForLevel(state.difficulty);

        // Pick two different cards
        state.currentCards = EducationalUtils.getTwoDifferentCards(deck);

        // Pick a random question type
        const availableTypes = getAvailableQuestionTypes();
        const questionType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        state.currentQuestion = QUESTION_CONFIGS[questionType];

        // Update UI
        elements.question.textContent = state.currentQuestion.getQuestion();

        // Render cards
        renderCards();

        // Render answer buttons
        renderAnswerButtons();
    }

    // Render the cards
    function renderCards() {
        elements.cardSlot1.innerHTML = "";
        elements.cardSlot2.innerHTML = "";

        const card1El = CommonUtils.createCardEl(state.currentCards[0]);
        const card2El = CommonUtils.createCardEl(state.currentCards[1]);

        elements.cardSlot1.appendChild(card1El);
        elements.cardSlot2.appendChild(card2El);
    }

    // Render answer buttons
    function renderAnswerButtons() {
        elements.answerButtons.innerHTML = "";
        const answers = state.currentQuestion.getAnswers();

        answers.forEach((answer, index) => {
            const btn = document.createElement("button");
            btn.className = "edu-answer-btn";
            btn.textContent = answer;
            btn.addEventListener("click", () => handleAnswer(index));
            elements.answerButtons.appendChild(btn);
        });
    }

    // Handle answer submission
    function handleAnswer(answerIndex) {
        const isCorrect = state.currentQuestion.checkAnswer(state.currentCards, answerIndex);

        // Record answer for difficulty adjustment
        state.recentAnswers.push(isCorrect);
        if (state.recentAnswers.length > state.maxRecentAnswers) {
            state.recentAnswers.shift();
        }

        // Update score and streak
        if (isCorrect) {
            state.score += 10;
            state.streak += 1;
            state.bestStreak = Math.max(state.bestStreak, state.streak);
            CommonUtils.playSound("win");
            showFeedback(true);
        } else {
            state.streak = 0;
            CommonUtils.playSound("error");
            showFeedback(false);
        }

        // Auto-adjust difficulty
        if (state.autoDifficulty) {
            const successRate = EducationalUtils.calculateSuccessRate(state.recentAnswers);
            const newDifficulty = EducationalUtils.adjustDifficulty(state.difficulty, successRate);
            if (newDifficulty !== state.difficulty) {
                state.difficulty = newDifficulty;
                elements.difficulty.value = state.difficulty;
            }
        }

        updateUI();
        saveProgress();

        // Next question after brief delay
        setTimeout(() => {
            startNewQuestion();
        }, 800);
    }

    // Show feedback animation
    function showFeedback(isCorrect) {
        const existing = document.querySelector(".edu-feedback");
        if (existing) existing.remove();

        const feedback = document.createElement("div");
        feedback.className = `edu-feedback ${isCorrect ? "correct" : "incorrect"}`;
        feedback.textContent = isCorrect ? "✓ Correct!" : "✗ Try Again!";

        document.body.appendChild(feedback);

        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 1000);
    }

    // Start the game when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
