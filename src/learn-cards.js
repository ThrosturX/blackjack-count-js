(function() {
    "use strict";

    const BREAK_CARDS_COMMON = [
        {
            text: "Did you know? Jack is often called the Knave.",
            cards: [new Card("♠", "J")]
        },
        {
            text: "Did you know? Traditional French suits are Hearts, Spades, Diamonds, and Clubs.",
            cards: [new Card("♥", "A"), new Card("♠", "A"), new Card("♦", "A"), new Card("♣", "A")]
        },
        {
            text: "Did you know? A standard deck has 52 cards: 13 per suit.",
            cards: [new Card("♥", "K"), new Card("♣", "K"), new Card("♦", "K"), new Card("♠", "K")]
        },
        {
            text: "Did you know? Face cards are Jack, Queen, and King.",
            cards: [new Card("♠", "J"), new Card("♦", "Q"), new Card("♣", "K")]
        }
    ];

    const BREAK_CARD_KNIGHT = {
        text: "Did you know? The Knight appeared in 56-card decks between Knave and Queen.",
        cards: [new Card("♣", "J"), new Card("♦", "C"), new Card("♥", "Q")]
    };

    const LEVEL_FACTS = {
        1: ["Hearts and Diamonds are red.", "Spades and Clubs are black.", "Each suit has 13 cards."],
        2: ["A then 2 to 10, then J-Q-K.", "Suits are shown by symbol.", "Cards can share rank across suits."],
        3: ["Same rank can have many suits.", "Colors are red or black.", "Higher means bigger rank value."],
        4: ["Tap higher or lower by rank.", "Ace is low in this mode.", "Practice makes rank comparison fast."],
        5: ["History breaks appear between drills.", "Knight sits between Knave and Queen in 56-card decks.", "Card symbols evolved over centuries."]
    };

    const state = {
        score: 0,
        streak: 0,
        bestStreak: 0,
        level: 1,
        autoLevel: true,
        recentAnswers: [],
        maxRecentAnswers: 12,
        question: null
    };

    const elements = {
        nextButton: null,
        breakNextButton: null,
        levelSelect: null,
        autoLevel: null,
        score: null,
        streak: null,
        bestStreak: null,
        correctRate: null,
        prompt: null,
        visualCue: null,
        board: null,
        choices: null,
        feedback: null,
        fact: null,
        tableSelect: null,
        deckSelect: null
    };

    function init() {
        cacheElements();
        HeaderControls?.init({ openKeys: ["game", "stats"] });
        loadProgress();
        bindEvents();
        syncThemeClasses();
        nextQuestion();
    }

    function cacheElements() {
        elements.nextButton = document.getElementById("learn-next");
        elements.breakNextButton = document.getElementById("learn-break-next");
        elements.levelSelect = document.getElementById("learn-level-select");
        elements.autoLevel = document.getElementById("learn-auto-level");
        elements.score = document.getElementById("learn-score");
        elements.streak = document.getElementById("learn-streak");
        elements.bestStreak = document.getElementById("learn-best-streak");
        elements.correctRate = document.getElementById("learn-correct-rate");
        elements.prompt = document.getElementById("learn-prompt");
        elements.visualCue = document.getElementById("learn-visual-cue");
        elements.board = document.getElementById("learn-board");
        elements.choices = document.getElementById("learn-choices");
        elements.feedback = document.getElementById("learn-feedback");
        elements.fact = document.getElementById("learn-fact");
        elements.tableSelect = document.getElementById("table-style-select");
        elements.deckSelect = document.getElementById("deck-style-select");
    }

    function bindEvents() {
        elements.nextButton.addEventListener("click", nextQuestion);
        elements.breakNextButton?.addEventListener("click", nextQuestion);

        elements.levelSelect.addEventListener("change", (event) => {
            state.level = clampLevel(parseInt(event.target.value, 10));
            state.autoLevel = false;
            elements.autoLevel.checked = false;
            saveProgress();
            nextQuestion();
        });

        elements.autoLevel.addEventListener("change", (event) => {
            state.autoLevel = event.target.checked;
            if (state.autoLevel) {
                state.level = 1;
                elements.levelSelect.value = "1";
            }
            saveProgress();
            nextQuestion();
        });

        elements.tableSelect?.addEventListener("change", syncThemeClasses);
        elements.deckSelect?.addEventListener("change", syncThemeClasses);
        window.addEventListener("addons:changed", syncThemeClasses);
    }

    function clampLevel(level) {
        return Math.max(1, Math.min(5, Number.isFinite(level) ? level : 1));
    }

    function loadProgress() {
        const saved = EducationalUtils.loadProgress("learn-cards");
        if (!saved) {
            updateStats();
            return;
        }

        state.score = saved.score || 0;
        state.streak = saved.streak || 0;
        state.bestStreak = saved.bestStreak || 0;
        state.level = clampLevel(saved.level || 1);
        state.autoLevel = saved.autoLevel !== false;
        state.recentAnswers = Array.isArray(saved.recentAnswers) ? saved.recentAnswers : [];

        if (state.autoLevel) {
            state.level = 1;
        }

        elements.levelSelect.value = String(state.level);
        elements.autoLevel.checked = state.autoLevel;
        updateStats();
    }

    function saveProgress() {
        EducationalUtils.saveProgress("learn-cards", {
            score: state.score,
            streak: state.streak,
            bestStreak: state.bestStreak,
            level: state.level,
            autoLevel: state.autoLevel,
            recentAnswers: state.recentAnswers
        });
    }

    function nextQuestion() {
        state.question = buildQuestion();
        renderQuestion();
        setFeedback("");
        rotateFact();
    }

    function buildQuestion() {
        const deck = EducationalUtils.createDeckForLevel(Math.min(5, state.level + 1));
        const pickCard = () => deck[Math.floor(Math.random() * deck.length)];

        const builders = {
            1: [questionSuitOnCard, questionColorOnCard],
            2: [questionRankOnCard, questionFindCardByRank],
            3: [questionFindSuitGroup, questionRankOnCard, questionFindCardByRank],
            4: [questionHigherCard, questionLowerCard, questionFaceCardTap],
            5: [questionHigherCard, questionLowerCard, questionFaceCardTap]
        };

        if (state.level === 5) {
            return buildExpertQuestion(pickCard, deck);
        }

        const list = builders[state.level] || builders[1];
        const build = list[Math.floor(Math.random() * list.length)];
        return build(pickCard, deck);
    }

    function buildExpertQuestion(pickCard, deck) {
        const roll = Math.random();
        if (roll < 0.04) {
            // Rare direct Knight drill.
            return questionKnightMiddleTap();
        }
        if (roll < 0.10) {
            // Rare Knight history break.
            return questionDidYouKnowBreak(true);
        }
        if (roll < 0.32) {
            // Common non-Knight educational break.
            return questionDidYouKnowBreak(false);
        }
        const nonKnightBuilders = [
            questionHigherCard,
            questionLowerCard,
            questionFaceCardTap,
            questionFindSuitGroup,
            questionFindCardByRank,
            questionRankOnCard
        ];
        const pick = nonKnightBuilders[Math.floor(Math.random() * nonKnightBuilders.length)];
        return pick(pickCard, deck);
    }

    function questionSuitOnCard(pickCard) {
        const card = pickCard();
        const suitChoices = EducationalUtils.shuffle([
            card.suit,
            ...EducationalUtils.shuffle(SUITS.filter((suit) => suit !== card.suit)).slice(0, 2)
        ]);
        return {
            kind: "choice",
            prompt: "Match suit",
            cue: { text: `${card.suit} = ?`, tone: "blue" },
            boardCards: [card],
            choices: suitChoices.map((suit) => ({ label: suit, symbolOnly: true, isCorrect: suit === card.suit }))
        };
    }

    function questionColorOnCard(pickCard) {
        const card = pickCard();
        const color = EducationalUtils.getCardColor(card);
        return {
            kind: "choice",
            prompt: "Match color",
            cue: { text: "🔴 / ⚫", tone: "blue" },
            boardCards: [card],
            choices: [
                { label: "🔴", symbolOnly: true, isCorrect: color === "red" },
                { label: "⚫", symbolOnly: true, isCorrect: color === "black" }
            ]
        };
    }

    function questionRankOnCard(pickCard) {
        const card = pickCard();
        const wrong = EducationalUtils.shuffle(VALUES.filter((value) => value !== card.val)).slice(0, 2);
        const options = EducationalUtils.shuffle([card.val, ...wrong]);
        return {
            kind: "choice",
            prompt: "Match rank",
            cue: { text: `${card.val} = ?`, tone: "blue" },
            boardCards: [card],
            choices: options.map((value) => ({ label: value, sublabel: `${EducationalUtils.getRank(value)}`, isCorrect: value === card.val }))
        };
    }

    function questionFindCardByRank(_, deck) {
        const values = EducationalUtils.shuffle(VALUES).slice(0, 4);
        const cards = values.map((value, index) => new Card(SUITS[index % SUITS.length], value));
        const target = cards[Math.floor(Math.random() * cards.length)];
        return {
            kind: "board",
            prompt: "Find card",
            cue: { text: `${target.val} 👆`, tone: "blue" },
            boardCards: cards,
            boardCheck: (index) => cards[index].val === target.val
        };
    }

    function questionFindSuitGroup(_, deck) {
        const cards = EducationalUtils.pickRandom(deck, 4);
        const targetCard = cards[Math.floor(Math.random() * cards.length)];
        return {
            kind: "board",
            prompt: "Find suit",
            cue: { text: `${targetCard.suit} 👆`, tone: "blue" },
            boardCards: cards,
            boardCheck: (index) => cards[index].suit === targetCard.suit
        };
    }

    function questionHigherCard(_, deck) {
        const cards = EducationalUtils.pickRandom(deck, 2);
        return {
            kind: "board",
            prompt: "Higher Card",
            cue: { text: "➕ Higher", tone: "gold" },
            boardCards: cards,
            boardCheck: (index) => {
                const a = EducationalUtils.getRank(cards[0].val);
                const b = EducationalUtils.getRank(cards[1].val);
                const higher = a >= b ? 0 : 1;
                return index === higher;
            }
        };
    }

    function questionLowerCard(_, deck) {
        const cards = EducationalUtils.pickRandom(deck, 2);
        return {
            kind: "board",
            prompt: "Lower Card",
            cue: { text: "➖ Lower", tone: "orange" },
            boardCards: cards,
            boardCheck: (index) => {
                const a = EducationalUtils.getRank(cards[0].val);
                const b = EducationalUtils.getRank(cards[1].val);
                const lower = a <= b ? 0 : 1;
                return index === lower;
            }
        };
    }

    function questionFaceCardTap() {
        const face = ["J", "Q", "K"][Math.floor(Math.random() * 3)];
        const numbers = EducationalUtils.shuffle(["2", "4", "7", "9", "10"]).slice(0, 3);
        const cards = EducationalUtils.shuffle([
            new Card("♠", face),
            new Card("♥", numbers[0]),
            new Card("♦", numbers[1]),
            new Card("♣", numbers[2])
        ]);

        return {
            kind: "board",
            prompt: "Tap a face card",
            cue: { text: "🙂 Face Card", tone: "gold" },
            boardCards: cards,
            boardCheck: (index) => ["J", "Q", "K"].includes(cards[index].val)
        };
    }

    function questionKnightMiddleTap() {
        const cards = EducationalUtils.shuffle([
            new Card("♣", "J"),
            new Card("♦", "C"),
            new Card("♥", "Q")
        ]);
        return {
            kind: "board",
            prompt: "Tap middle rank",
            cue: { text: "J < ? < Q", tone: "blue" },
            boardCards: cards,
            boardCheck: (index) => cards[index].val === "C"
        };
    }

    function questionDidYouKnowBreak(includeKnight = false) {
        const item = includeKnight
            ? BREAK_CARD_KNIGHT
            : BREAK_CARDS_COMMON[Math.floor(Math.random() * BREAK_CARDS_COMMON.length)];
        return {
            kind: "break",
            prompt: item.text,
            cue: { text: "📘 Did you know?", tone: "blue" },
            boardCards: item.cards,
            choices: []
        };
    }

    function renderQuestion() {
        const question = state.question;
        elements.prompt.textContent = question.prompt;
        const cue = question.cue || { text: "🎯 Match", tone: "blue" };
        elements.visualCue.textContent = cue.text;
        elements.visualCue.dataset.tone = cue.tone;

        renderBoard(question);
        renderChoices(question);
        elements.breakNextButton.style.display = question.kind === "break" ? "inline-flex" : "none";
    }

    function renderBoard(question) {
        elements.board.innerHTML = "";

        question.boardCards.forEach((card, index) => {
            if (question.kind === "board") {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "edu-card-button";
                const shell = document.createElement("div");
                shell.className = "edu-card-shell";
                shell.appendChild(CommonUtils.createCardEl(new Card(card.suit, card.val)));
                button.appendChild(shell);
                button.addEventListener("click", () => handleBoardAnswer(index, shell));
                elements.board.appendChild(button);
                return;
            }

            const shell = document.createElement("div");
            shell.className = "edu-card-shell";
            shell.appendChild(CommonUtils.createCardEl(new Card(card.suit, card.val)));
            elements.board.appendChild(shell);
        });
    }

    function renderChoices(question) {
        elements.choices.innerHTML = "";
        elements.choices.style.setProperty("--choice-columns", "3");
        const choicesSurface = elements.choices.closest(".edu-surface");

        if (!question.choices || !question.choices.length || question.kind !== "choice") {
            if (choicesSurface) choicesSurface.style.display = "none";
            elements.choices.classList.remove("has-choices");
            return;
        }

        if (choicesSurface) choicesSurface.style.display = "";
        elements.choices.classList.add("has-choices");

        question.choices.forEach((choice) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "edu-choice-button";
            button.setAttribute("aria-label", choice.label);
            button.addEventListener("click", () => handleChoiceAnswer(choice, button));

            const panel = document.createElement("div");
            panel.className = "edu-choice-card";
            if (choice.symbolOnly) panel.classList.add("symbol-only");

            const title = document.createElement("div");
            title.className = "edu-choice-label";
            title.textContent = choice.label;
            panel.appendChild(title);

            if (choice.sublabel) {
                const subtitle = document.createElement("div");
                subtitle.className = "edu-choice-help";
                subtitle.textContent = choice.sublabel;
                panel.appendChild(subtitle);
            }

            button.appendChild(panel);
            elements.choices.appendChild(button);
        });

        elements.choices.style.setProperty("--choice-columns", String(Math.max(2, question.choices.length)));
    }

    function handleChoiceAnswer(choice, button) {
        const good = choice.isCorrect === true;
        const panel = button.querySelector(".edu-choice-card");
        if (panel) panel.classList.add(good ? "success" : "fail");
        disableInputs();
        resolveAnswer(good, good ? "Correct!" : "Try next one.");
    }

    function handleBoardAnswer(index, shell) {
        const question = state.question;
        const good = question.boardCheck ? question.boardCheck(index) : false;
        shell.classList.add(good ? "success" : "fail");
        disableInputs();
        resolveAnswer(good, good ? "Great!" : "Try next one.");
    }

    function disableInputs() {
        elements.board.querySelectorAll("button").forEach((button) => {
            button.disabled = true;
        });
        elements.choices.querySelectorAll("button").forEach((button) => {
            button.disabled = true;
        });
    }

    function resolveAnswer(good, message) {
        state.recentAnswers.push(good);
        if (state.recentAnswers.length > state.maxRecentAnswers) {
            state.recentAnswers.shift();
        }

        if (good) {
            state.score += 10 + state.level;
            state.streak += 1;
            state.bestStreak = Math.max(state.bestStreak, state.streak);
            CommonUtils.playSound("win");
        } else {
            state.streak = 0;
            CommonUtils.playSound("error");
        }

        if (state.autoLevel) {
            const rate = EducationalUtils.calculateSuccessRate(state.recentAnswers);
            state.level = EducationalUtils.adjustDifficulty(state.level, rate, 1, 5);
            elements.levelSelect.value = String(state.level);
            if (state.level === 5 && rate > 0.9) {
                state.level = 1;
                elements.levelSelect.value = "1";
            }
        }

        setFeedback(message, good);
        updateStats();
        saveProgress();

        setTimeout(nextQuestion, 920);
    }

    function setFeedback(message, good) {
        elements.feedback.textContent = message;
        elements.feedback.classList.remove("ok", "bad");
        if (!message) return;
        elements.feedback.classList.add(good ? "ok" : "bad");
    }

    function rotateFact() {
        const list = LEVEL_FACTS[state.level] || LEVEL_FACTS[1];
        const fact = list[Math.floor(Math.random() * list.length)];
        elements.fact.textContent = `Card tip: ${fact}`;
    }

    function updateStats() {
        elements.score.textContent = String(state.score);
        elements.streak.textContent = String(state.streak);
        elements.bestStreak.textContent = String(state.bestStreak);
        const success = Math.round(EducationalUtils.calculateSuccessRate(state.recentAnswers) * 100);
        elements.correctRate.textContent = `${success}%`;
    }

    function syncThemeClasses() {
        const tableTheme = elements.tableSelect?.value || "felt";
        const deckTheme = elements.deckSelect?.value || "red";

        Array.from(document.body.classList)
            .filter((cls) => cls.startsWith("table-") || cls.startsWith("deck-"))
            .forEach((cls) => document.body.classList.remove(cls));

        document.body.classList.add(`table-${tableTheme}`);
        document.body.classList.add(`deck-${deckTheme}`);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
