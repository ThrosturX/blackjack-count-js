/**
 * Math Challenges - Educational math game using card values
 * Teaches addition, subtraction through card-based math problems
 */

(function() {
    "use strict";

    // Game state
    const state = {
        score: 0,
        streak: 0,
        difficulty: 3,
        autoDifficulty: true,
        currentChallenge: null,
        userAnswer: "",
        recentAnswers: [],
        maxRecentAnswers: 10
    };

    // Challenge types
    const CHALLENGE_TYPES = {
        ADD: "add",
        SUBTRACT: "subtract",
        SUM_TO: "sum_to"
    };

    // Difficulty configurations
    const DIFFICULTY_CONFIG = {
        1: { // Trivial: numbers 2-5, addition only
            values: ["2", "3", "4", "5"],
            operations: [CHALLENGE_TYPES.ADD],
            maxSum: 10
        },
        2: { // Easy: numbers 2-7, addition
            values: ["2", "3", "4", "5", "6", "7"],
            operations: [CHALLENGE_TYPES.ADD],
            maxSum: 14
        },
        3: { // Medium: numbers 2-10, add/subtract
            values: ["2", "3", "4", "5", "6", "7", "8", "9", "10"],
            operations: [CHALLENGE_TYPES.ADD, CHALLENGE_TYPES.SUBTRACT],
            maxSum: 20
        },
        4: { // Hard: include face cards, add/subtract
            values: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"],
            operations: [CHALLENGE_TYPES.ADD, CHALLENGE_TYPES.SUBTRACT],
            maxSum: 26
        },
        5: { // Expert: full deck with Aces
            values: VALUES,
            operations: [CHALLENGE_TYPES.ADD, CHALLENGE_TYPES.SUBTRACT],
            maxSum: 28
        }
    };

    // DOM elements
    const elements = {
        score: null,
        streak: null,
        difficulty: null,
        autoDifficulty: null,
        question: null,
        cardsRow: null,
        submitBtn: null,
        clearBtn: null,
        newGameBtn: null,
        numButtons: null
    };

    // Initialize the game
    function init() {
        cacheElements();
        loadProgress();
        bindEvents();
        generateChallenge();
    }

    // Cache DOM elements
    function cacheElements() {
        elements.score = document.getElementById("score");
        elements.streak = document.getElementById("streak");
        elements.difficulty = document.getElementById("difficulty");
        elements.autoDifficulty = document.getElementById("auto-difficulty");
        elements.question = document.getElementById("question");
        elements.cardsRow = document.getElementById("cards-row");
        elements.submitBtn = document.getElementById("submit-btn");
        elements.clearBtn = document.getElementById("clear-btn");
        elements.newGameBtn = document.getElementById("new-game-btn");
        elements.numButtons = document.querySelectorAll(".edu-num-btn");
    }

    // Bind event listeners
    function bindEvents() {
        elements.difficulty.addEventListener("change", (e) => {
            state.difficulty = parseInt(e.target.value, 10);
            state.autoDifficulty = false;
            elements.autoDifficulty.checked = false;
            generateChallenge();
            saveProgress();
        });

        elements.autoDifficulty.addEventListener("change", (e) => {
            state.autoDifficulty = e.target.checked;
            if (state.autoDifficulty) {
                elements.difficulty.value = state.difficulty;
            }
            saveProgress();
        });

        elements.newGameBtn.addEventListener("click", () => {
            generateChallenge();
        });

        elements.submitBtn.addEventListener("click", () => {
            checkAnswer();
        });

        elements.clearBtn.addEventListener("click", () => {
            clearAnswer();
        });

        elements.numButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const num = btn.dataset.num;
                if (num === "-") {
                    handleNegativeToggle();
                } else {
                    appendDigit(num);
                }
            });
        });
    }

    // Load saved progress
    function loadProgress() {
        const saved = EducationalUtils.loadProgress("math-challenges");
        if (saved) {
            state.score = saved.score || 0;
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
        EducationalUtils.saveProgress("math-challenges", {
            score: state.score,
            difficulty: state.difficulty,
            autoDifficulty: state.autoDifficulty,
            recentAnswers: state.recentAnswers
        });
    }

    // Generate a new math challenge
    function generateChallenge() {
        const config = DIFFICULTY_CONFIG[state.difficulty];
        if (!config) return;

        // Pick random operation
        const operation = config.operations[Math.floor(Math.random() * config.operations.length)];

        // Generate two random card values
        const deck = [];
        for (const val of config.values) {
            deck.push({ val, rank: EducationalUtils.getRank(val) });
        }

        const card1 = deck[Math.floor(Math.random() * deck.length)];
        let card2;
        do {
            card2 = deck[Math.floor(Math.random() * deck.length)];
        } while (card2.val === card1.val);

        let question, answer, display;

        if (operation === CHALLENGE_TYPES.ADD) {
            answer = card1.rank + card2.rank;
            question = `What is ${formatValue(card1.val)} + ${formatValue(card2.val)}?`;
            display = {
                card1: card1,
                card2: card2,
                operator: "+",
                answer: answer
            };
        } else {
            // Subtraction - always larger minus smaller for easier difficulty
            const larger = card1.rank >= card2.rank ? card1 : card2;
            const smaller = card1.rank >= card2.rank ? card2 : card1;
            answer = larger.rank - smaller.rank;
            question = `What is ${formatValue(larger.val)} - ${formatValue(smaller.val)}?`;
            display = {
                card1: larger,
                card2: smaller,
                operator: "−",
                answer: answer
            };
        }

        state.currentChallenge = {
            question,
            ...display
        };

        // Reset user answer
        state.userAnswer = "";
        updateAnswerDisplay();

        // Render UI
        elements.question.textContent = question;
        renderCards();
    }

    // Format card value for display
    function formatValue(val) {
        if (val === "J") return "Jack (11)";
        if (val === "Q") return "Queen (12)";
        if (val === "K") return "King (13)";
        if (val === "A") return "Ace (1)";
        return val;
    }

    // Render the cards
    function renderCards() {
        elements.cardsRow.innerHTML = "";

        if (!state.currentChallenge) return;

        // Card 1
        const slot1 = document.createElement("div");
        slot1.className = "edu-card-slot";
        const card1 = new Card(state.currentChallenge.card1.suit || "♠", state.currentChallenge.card1.val);
        slot1.appendChild(CommonUtils.createCardEl(card1));
        elements.cardsRow.appendChild(slot1);

        // Operator
        const op = document.createElement("div");
        op.className = "edu-operator";
        op.textContent = state.currentChallenge.operator;
        elements.cardsRow.appendChild(op);

        // Card 2
        const slot2 = document.createElement("div");
        slot2.className = "edu-card-slot";
        const card2 = new Card(state.currentChallenge.card2.suit || "♥", state.currentChallenge.card2.val);
        slot2.appendChild(CommonUtils.createCardEl(card2));
        elements.cardsRow.appendChild(slot2);

        // Equals
        const equals = document.createElement("div");
        equals.className = "edu-equals";
        equals.textContent = "=";
        elements.cardsRow.appendChild(equals);

        // Answer slot
        const answerSlot = document.createElement("div");
        answerSlot.className = "edu-answer-slot";
        answerSlot.id = "answer-display";
        elements.cardsRow.appendChild(answerSlot);

        updateAnswerDisplay();
    }

    // Append digit to answer
    function appendDigit(digit) {
        if (state.userAnswer.length >= 3) return; // Max 3 digits

        // Handle leading zeros
        if (state.userAnswer === "0" && digit !== "-") {
            state.userAnswer = digit;
        } else if (digit === "-" && state.userAnswer === "") {
            state.userAnswer = "-";
        } else if (digit !== "-") {
            state.userAnswer += digit;
        }

        updateAnswerDisplay();
    }

    // Handle negative toggle
    function handleNegativeToggle() {
        if (state.userAnswer === "") {
            state.userAnswer = "-";
        } else if (state.userAnswer === "-") {
            state.userAnswer = "";
        } else if (state.userAnswer.startsWith("-")) {
            state.userAnswer = state.userAnswer.slice(1);
        } else {
            state.userAnswer = "-" + state.userAnswer;
        }
        updateAnswerDisplay();
    }

    // Clear answer
    function clearAnswer() {
        state.userAnswer = "";
        updateAnswerDisplay();
    }

    // Update answer display
    function updateAnswerDisplay() {
        const display = document.getElementById("answer-display");
        if (!display) return;

        display.textContent = state.userAnswer || "?";
        display.classList.toggle("filled", state.userAnswer !== "");

        elements.submitBtn.disabled = state.userAnswer === "";
    }

    // Check answer
    function checkAnswer() {
        if (!state.currentChallenge || state.userAnswer === "") return;

        const userNum = parseInt(state.userAnswer, 10);
        const correctAnswer = state.currentChallenge.answer;
        const isCorrect = userNum === correctAnswer;

        // Record answer for difficulty adjustment
        state.recentAnswers.push(isCorrect);
        if (state.recentAnswers.length > state.maxRecentAnswers) {
            state.recentAnswers.shift();
        }

        if (isCorrect) {
            state.score += 10 + state.difficulty * 2;
            state.streak += 1;
            CommonUtils.playSound("win");
            showFeedback(true, correctAnswer);
        } else {
            state.streak = 0;
            CommonUtils.playSound("error");
            showFeedback(false, correctAnswer);
        }

        // Auto-adjust difficulty
        if (state.autoDifficulty) {
            const successRate = EducationalUtils.calculateSuccessRate(state.recentAnswers);
            const newDifficulty = EducationalUtils.adjustDifficulty(state.difficulty, successRate);
            if (newDifficulty !== state.difficulty) {
                state.difficulty = newDifficulty;
                elements.difficulty.value = newDifficulty;
            }
        }

        updateUI();
        saveProgress();

        // Next challenge after delay
        setTimeout(() => {
            generateChallenge();
        }, 1200);
    }

    // Show feedback
    function showFeedback(isCorrect, correctAnswer) {
        const existing = document.querySelector(".edu-feedback");
        if (existing) existing.remove();

        const feedback = document.createElement("div");
        feedback.className = `edu-feedback ${isCorrect ? "correct" : "incorrect"}`;
        feedback.textContent = isCorrect
            ? "✓ Correct!"
            : `✗ Answer: ${correctAnswer}`;

        document.body.appendChild(feedback);

        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 1000);
    }

    // Update UI
    function updateUI() {
        elements.score.textContent = state.score;
        elements.streak.textContent = state.streak;
    }

    // Start the game when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
