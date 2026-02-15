(function () {
    "use strict";

    const FALLBACK_BREAK_CARDS_COMMON = [
        {
            text: "The Jack is also called the Knave.",
            buildCards: buildKnaveFactCards
        },
        {
            text: "Traditional French suits are Hearts, Spades, Diamonds, and Clubs.",
            buildCards: buildTraditionalFrenchSuitCards
        },
        {
            text: "A standard deck has 52 cards: 13 per suit.",
            buildCards: buildStandardDeckFactCards
        },
        {
            text: "Face cards are Jack, Queen, and King.",
            buildCards: buildFaceCardFactCards
        },
        {
            text: "Aces can be low or high depending on the game.",
            buildCards: buildAceFactCards
        },
        {
            text: "Many solitaire games build by alternating red and black.",
            buildCards: buildAlternatingColorFactCards
        },
        {
            text: "Every suit has its own royal family cards.",
            buildCards: buildRoyalFamilyFactCards
        }
    ];

    const FALLBACK_BREAK_CARD_KNIGHT = [{
        text: "The Knight appeared in 56-card decks between Knave and Queen.",
        buildCards: () => EducationalUtils.shuffle([
            new Card("♣", "J"),
            new Card("♦", "C"),
            new Card("♥", "Q")
        ])
    }];

    const FALLBACK_LEVEL_FACTS = {
        1: ["Hearts and Diamonds are red.", "Spades and Clubs are black.", "Each suit has 13 cards."],
        2: ["A then 2 to 10, then J-Q-K.", "Suits are shown by symbol.", "Cards can share rank across suits."],
        3: ["Same rank can have many suits.", "Colors are red or black.", "Highest means the biggest rank value."],
        4: ["Find the lowest or highest card by rank.", "Ace is low in this mode.", "Practice makes rank comparison fast."],
        5: ["History breaks appear between drills.", "Knight sits between Knave and Queen in 56-card decks.", "Card symbols evolved over centuries."]
    };

    const sharedFactoids = (typeof CardFactoids === "object" && CardFactoids) ? CardFactoids : null;
    const BREAK_CARDS_COMMON = sharedFactoids && Array.isArray(sharedFactoids.common) && sharedFactoids.common.length
        ? sharedFactoids.common
        : FALLBACK_BREAK_CARDS_COMMON;
    const BREAK_CARD_KNIGHT = sharedFactoids && Array.isArray(sharedFactoids.knight) && sharedFactoids.knight.length
        ? sharedFactoids.knight
        : FALLBACK_BREAK_CARD_KNIGHT;
    const LEVEL_FACTS = (sharedFactoids && sharedFactoids.levelTips) || FALLBACK_LEVEL_FACTS;

    const state = {
        score: 0,
        streak: 0,
        bestStreak: 0,
        level: 1,
        autoLevel: true,
        recentAnswers: [],
        maxRecentAnswers: 12,
        autoLevelBatch: [],
        question: null,
        lastStandardDeckFactRank: null,
        expertUnlocked: false
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
        deckSelect: null,
        resetStats: null
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
        elements.resetStats = document.getElementById("learn-reset-stats");
    }

    function bindEvents() {
        elements.nextButton.addEventListener("click", nextQuestion);
        elements.breakNextButton?.addEventListener("click", advanceBreakQuestion);

        elements.levelSelect.addEventListener("change", (event) => {
            state.level = clampLevel(parseInt(event.target.value, 10));
            state.autoLevel = false;
            elements.autoLevel.checked = false;
            saveProgress();
            nextQuestion();
        });

        elements.autoLevel.addEventListener("change", (event) => {
            state.autoLevel = event.target.checked;
            saveProgress();
            nextQuestion();
        });

        elements.resetStats?.addEventListener("click", () => {
            SolitaireCheckModal.showConfirm({
                title: "Reset Stats",
                message: "This will clear all your progress and scores in this game. Are you sure?",
                confirmLabel: "Reset",
                cancelLabel: "Keep Stats"
            }).then(confirmed => {
                if (confirmed) resetStats();
            });
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
        state.autoLevelBatch = Array.isArray(saved.autoLevelBatch) ? saved.autoLevelBatch : [];
        state.expertUnlocked = saved.expertUnlocked === true || state.level >= 5;

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
            recentAnswers: state.recentAnswers,
            autoLevelBatch: state.autoLevelBatch,
            expertUnlocked: state.expertUnlocked
        });
    }

    function nextQuestion() {
        if (state.level >= 5) state.expertUnlocked = true;
        state.question = buildQuestion();
        renderQuestion();
        setFeedback("");
        rotateFact();
    }

    function buildQuestion() {
        const deck = EducationalUtils.createDeckForLevel(Math.min(5, state.level + 1));
        const pickCard = () => deck[Math.floor(Math.random() * deck.length)];

        // 10% chance to show style comparison instead of normal question
        if (Math.random() < 0.1) {
            return buildComparisonQuestion();
        }

        const builders = {
            1: [questionSuitOnCard, questionColorOnCard, questionFindCardByRank, questionFindSuitGroup],
            2: [questionRankOnCard, questionFindCardByRank, questionFindSuitGroup],
            3: [questionFindSuitGroup, questionRankOnCard, questionFindCardByRank, questionHigherCard, questionLowerCard],
            4: [questionHigherCard, questionLowerCard, questionFaceCardTap, questionMiddleRankTap],
            5: [questionHigherCard, questionLowerCard, questionFaceCardTap, questionMiddleRankTap]
        };

        if (state.level === 5) {
            return buildExpertQuestion(pickCard, deck);
        }

        const list = builders[state.level] || builders[1];
        const build = list[Math.floor(Math.random() * list.length)];
        return build(pickCard, deck);
    }

    function buildComparisonQuestion() {
        const deck = EducationalUtils.createDeckForLevel(5);
        const card = deck[Math.floor(Math.random() * deck.length)];
        return {
            kind: "comparison",
            prompt: "Card Styles Comparison",
            cue: { text: "🔍 Style Check", tone: "blue" },
            card: card,
            fact: "Classic faces show full pips/art. Simplified faces are for fast reading.",
            boardCards: [card],
            choices: []
        };
    }

    function buildExpertQuestion(pickCard, deck) {
        const roll = Math.random();
        if (roll < 0.07) {
            return questionMiddleRankTap(pickCard, deck, true);
        }
        if (roll < 0.14) {
            return questionDidYouKnowBreak(true);
        }
        if (roll < 0.40) {
            return questionDidYouKnowBreak(false);
        }
        const nonBreakBuilders = [
            questionHigherCard,
            questionLowerCard,
            questionFaceCardTap,
            questionMiddleRankTap,
            questionFindSuitGroup,
            questionFindCardByRank,
            questionRankOnCard
        ];
        const pick = nonBreakBuilders[Math.floor(Math.random() * nonBreakBuilders.length)];
        return pick(pickCard, deck);
    }

    function getPracticeValues(includeKnight = false) {
        const values = EducationalUtils.getValuesForLevel(Math.min(5, state.level + 1)).slice();
        if (includeKnight && state.level >= 5 && !values.includes("C")) {
            const queenIndex = values.indexOf("Q");
            if (queenIndex >= 0) {
                values.splice(queenIndex, 0, "C");
            } else {
                values.push("C");
            }
        }
        return values;
    }

    function getExerciseChoiceCount() {
        return Math.max(2, Math.min(6, state.level + 1));
    }

    function getHighestLowestCardCount() {
        if (state.level >= 5) return 5;
        if (state.level === 4) return 4;
        if (state.level === 3) return 3;
        return 2;
    }

    function getComparableRank(value, context) {
        return EducationalUtils.getRank(value, context);
    }

    function pickDistinctValuesByRank(values, count) {
        const result = [];
        const seenRanks = new Set();
        const shuffled = EducationalUtils.shuffle(values);

        shuffled.forEach((value) => {
            if (result.length >= count) return;
            const rank = getComparableRank(value, values);
            if (seenRanks.has(rank)) return;
            seenRanks.add(rank);
            result.push(value);
        });

        return result;
    }

    function randomSuit() {
        return SUITS[Math.floor(Math.random() * SUITS.length)];
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
        const options = EducationalUtils.shuffle([
            { card: new Card(randomSuit(), card.val), isCorrect: true },
            ...wrong.map((value) => ({ card: new Card(randomSuit(), value), isCorrect: false }))
        ]);
        return {
            kind: "choice",
            prompt: "Match rank",
            cue: { text: "Pick same rank", tone: "blue" },
            boardCards: [card],
            hideBoardCardRank: state.level >= 3,
            disableClassicFacesForChoices: state.level > 1,
            choices: options
        };
    }

    function removeClassicFaces(cardEl) {
        if (!cardEl) return;
        cardEl.classList.remove("classic-faces-card", "classic-faces-art-card");
        cardEl.dataset.classicFaces = "";
        const suitCenter = cardEl.querySelector(".suit-center");
        if (suitCenter && cardEl.dataset.suit) {
            suitCenter.textContent = cardEl.dataset.suit;
        }
    }

    function markCardAsNoClassic(cardEl) {
        if (!cardEl) return;
        cardEl.dataset.noClassicFaces = "1";
        removeClassicFaces(cardEl);
    }

    function questionFindCardByRank() {
        const choiceCount = getExerciseChoiceCount();
        const valuePool = getPracticeValues(state.level >= 5);
        const values = pickDistinctValuesByRank(valuePool, Math.min(choiceCount, valuePool.length));
        const cards = values.map((value) => new Card(randomSuit(), value));
        const targetIndex = Math.floor(Math.random() * cards.length);
        const target = cards[targetIndex];

        return {
            kind: "board",
            prompt: "Find card",
            cue: { text: `${EducationalUtils.getValueLabel(target.val)} 👆`, tone: "blue" },
            boardCards: cards,
            boardCheck: (index) => index === targetIndex
        };
    }

    function questionFindSuitGroup() {
        const choiceCount = getExerciseChoiceCount();
        const targetSuit = SUITS[Math.floor(Math.random() * SUITS.length)];
        const cards = [new Card(targetSuit, pickRandom(getPracticeValues(false)))];
        const cueCard = new Card(targetSuit, pickRandom(getPracticeValues(false)));
        cueCard.rotation = 0;

        while (cards.length < choiceCount) {
            const nonTargetSuits = SUITS.filter((suit) => suit !== targetSuit);
            const suit = pickRandom(nonTargetSuits);
            cards.push(new Card(suit, pickRandom(getPracticeValues(false))));
        }

        const shuffledCards = EducationalUtils.shuffle(cards);
        const targetIndex = shuffledCards.findIndex((card) => card.suit === targetSuit);

        return {
            kind: "board",
            prompt: "Find suit",
            cue: { text: "Match this suit", tone: "blue", card: cueCard, simplified: true },
            boardCards: shuffledCards,
            boardCheck: (index) => index === targetIndex
        };
    }

    function questionHigherCard() {
        const cardCount = getHighestLowestCardCount();
        const valuePool = getPracticeValues(state.level >= 5);
        const pickedValues = pickDistinctValuesByRank(valuePool, Math.min(cardCount, valuePool.length));
        const cards = EducationalUtils.shuffle(pickedValues.map((value) => new Card(randomSuit(), value)));

        let targetIndex = 0;
        cards.forEach((card, index) => {
            const rank = getComparableRank(card.val, cards);
            const targetRank = getComparableRank(cards[targetIndex].val, cards);
            if (rank > targetRank) targetIndex = index;
        });

        return {
            kind: "board",
            prompt: "Highest Card",
            cue: { text: "⬆ Highest", tone: "gold" },
            boardCards: cards,
            boardCheck: (index) => index === targetIndex
        };
    }

    function questionLowerCard() {
        const cardCount = getHighestLowestCardCount();
        const valuePool = getPracticeValues(state.level >= 5);
        const pickedValues = pickDistinctValuesByRank(valuePool, Math.min(cardCount, valuePool.length));
        const cards = EducationalUtils.shuffle(pickedValues.map((value) => new Card(randomSuit(), value)));

        let targetIndex = 0;
        cards.forEach((card, index) => {
            const rank = getComparableRank(card.val, cards);
            const targetRank = getComparableRank(cards[targetIndex].val, cards);
            if (rank < targetRank) targetIndex = index;
        });

        return {
            kind: "board",
            prompt: "Lowest Card",
            cue: { text: "⬇ Lowest", tone: "orange" },
            boardCards: cards,
            boardCheck: (index) => index === targetIndex
        };
    }

    function questionFaceCardTap() {
        const facePool = state.level >= 5
            ? ["J", "Q", "K", "J", "Q", "K", "C"]
            : ["J", "Q", "K"];
        const face = pickRandom(facePool);
        const numbers = EducationalUtils.shuffle(["2", "4", "6", "8", "9", "10"]).slice(0, 3);
        const cards = EducationalUtils.shuffle([
            new Card(randomSuit(), face),
            new Card(randomSuit(), numbers[0]),
            new Card(randomSuit(), numbers[1]),
            new Card(randomSuit(), numbers[2])
        ]);

        return {
            kind: "board",
            prompt: "Tap a face card",
            cue: { text: "🙂 Face Card", tone: "gold" },
            boardCards: cards,
            boardCheck: (index) => ["J", "Q", "K", "C"].includes(cards[index].val)
        };
    }

    function questionMiddleRankTap(_, __, forceKnight = false) {
        let values;
        if (forceKnight || (state.level >= 5 && Math.random() < 0.25)) {
            values = ["J", "C", "Q"];
        } else {
            const pool = getPracticeValues(false);
            values = pickDistinctValuesByRank(pool, 3);
            if (values.length < 3) {
                values = ["4", "7", "10"];
            }
        }

        const sortedByRank = values.slice().sort((left, right) => getComparableRank(left, values) - getComparableRank(right, values));
        const middleValue = sortedByRank[1];
        const cards = EducationalUtils.shuffle(values.map((value) => new Card(randomSuit(), value)));
        return {
            kind: "board",
            prompt: "Tap middle rank",
            cue: { text: `${sortedByRank[0]} < ? < ${sortedByRank[2]}`, tone: "blue" },
            boardCards: cards,
            boardCheck: (index) => cards[index].val === middleValue
        };
    }

    function questionDidYouKnowBreak(includeKnight = false) {
        const pool = includeKnight ? BREAK_CARD_KNIGHT : BREAK_CARDS_COMMON;
        const item = pool[Math.floor(Math.random() * pool.length)];
        return {
            kind: "break",
            prompt: item?.text || "Did you know?",
            cue: { text: "📘 Card Fact", tone: "blue" },
            boardCards: buildFactCards(item),
            choices: []
        };
    }

    function buildFactCards(item) {
        if (!item) return [];
        if (typeof item.buildCards === "function") {
            const cards = item.buildCards();
            return Array.isArray(cards) ? cards : [];
        }
        if (Array.isArray(item.cards)) {
            return item.cards;
        }
        return [];
    }

    function pickRandom(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function pickWeightedFactRank() {
        const weightedPool = [
            "2", "3", "4", "5", "6", "7", "8", "9", "10", "A",
            "J", "Q", "K", "J", "Q", "K", "J", "Q", "K"
        ];
        if (state.expertUnlocked) {
            weightedPool.push("C", "C");
        }

        let next = pickRandom(weightedPool);
        if (state.lastStandardDeckFactRank && weightedPool.length > 1 && next === state.lastStandardDeckFactRank) {
            const alternatives = weightedPool.filter((value) => value !== state.lastStandardDeckFactRank);
            next = pickRandom(alternatives.length ? alternatives : weightedPool);
        }
        state.lastStandardDeckFactRank = next;
        return next;
    }

    function buildAlternatingSuitCards(rank) {
        const reds = EducationalUtils.shuffle(["♥", "♦"]);
        const blacks = EducationalUtils.shuffle(["♠", "♣"]);
        const suits = Math.random() < 0.5
            ? [reds[0], blacks[0], reds[1], blacks[1]]
            : [blacks[0], reds[0], blacks[1], reds[1]];
        return suits.map((suit) => new Card(suit, rank));
    }

    function buildRandomFactCard() {
        const valuePool = state.expertUnlocked ? EXTENDED_VALUES : VALUES;
        return new Card(randomSuit(), pickRandom(valuePool));
    }

    function buildKnaveFactCards() {
        const jackCount = 1 + Math.floor(Math.random() * 3);
        const suits = EducationalUtils.shuffle(SUITS).slice(0, jackCount);
        return suits.map((suit) => new Card(suit, "J"));
    }

    function buildTraditionalFrenchSuitCards() {
        const swapSpadeAndClub = Math.random() < 0.5;
        const secondSuit = swapSpadeAndClub ? "♣" : "♠";
        const fourthSuit = swapSpadeAndClub ? "♠" : "♣";

        const ah = new Card("♥", "A");
        const asOrAc = new Card(secondSuit, "A");
        const ad = new Card("♦", "A");
        const acOrAs = new Card(fourthSuit, "A");
        const randomOne = buildRandomFactCard();
        const randomTwo = buildRandomFactCard();

        if (Math.random() < 0.5) {
            return [ah, asOrAc, ad, randomOne, acOrAs, randomTwo];
        }
        return [randomOne, ah, randomTwo, asOrAc, ad, acOrAs];
    }

    function buildStandardDeckFactCards() {
        return buildAlternatingSuitCards(pickWeightedFactRank());
    }

    function buildFaceCardFactCards() {
        const suits = EducationalUtils.shuffle(SUITS);
        return [
            new Card(suits[0], "J"),
            new Card(suits[1], "Q"),
            new Card(suits[2], "K")
        ];
    }

    function buildAceFactCards() {
        const cards = [
            new Card("♥", "A"),
            new Card("♣", "2"),
            new Card("♦", "A"),
            new Card("♠", "K")
        ];
        return EducationalUtils.shuffle(cards);
    }

    function buildAlternatingColorFactCards() {
        const suits = buildAlternatingSuitCards("9").map((card) => card.suit);
        const values = ["9", "8", "7", "6"];
        return suits.map((suit, index) => new Card(suit, values[index]));
    }

    function buildRoyalFamilyFactCards() {
        const suit = randomSuit();
        const values = state.expertUnlocked && Math.random() < 0.25 ? ["J", "C", "Q", "K"] : ["J", "Q", "K"];
        return values.map((value) => new Card(suit, value));
    }

    function renderQuestion() {
        const question = state.question;
        elements.prompt.textContent = question.prompt;
        const cue = question.cue || { text: "🎯 Match", tone: "blue" };
        elements.visualCue.dataset.tone = cue.tone;
        elements.visualCue.innerHTML = "";
        if (cue.card) {
            const label = document.createElement("span");
            label.textContent = cue.text || "🎯 Match";
            elements.visualCue.appendChild(label);

            const cueCard = CommonUtils.createCardEl(new Card(cue.card.suit, cue.card.val));
            cueCard.style.transform = "rotate(0deg) scale(var(--card-scale))";
            if (cue.simplified) {
                markCardAsNoClassic(cueCard);
            }

            const cardWrap = document.createElement("span");
            cardWrap.className = "edu-cue-card";
            if (cue.simplified) cardWrap.dataset.noClassicFaces = "1";
            cardWrap.appendChild(cueCard);
            elements.visualCue.appendChild(cardWrap);
        } else {
            elements.visualCue.textContent = cue.text;
        }

        renderBoard(question);
        renderChoices(question);
        elements.breakNextButton.style.display = (question.kind === "break" || question.kind === "comparison") ? "inline-flex" : "none";
    }

    function renderBoard(question) {
        elements.board.innerHTML = "";

        if (question.kind === "comparison") {
            const container = document.createElement("div");
            container.className = "edu-row";
            container.style.width = "100%";
            container.style.textAlign = "center";

            const createComparisonCard = (card, labelText, isClassic) => {
                const wrapper = document.createElement("div");
                wrapper.style.display = "inline-block";
                wrapper.style.margin = "0 10px";
                wrapper.style.textAlign = "center";
                wrapper.style.verticalAlign = "top";

                const button = document.createElement("button");
                button.type = "button";
                button.className = "edu-card-button";
                button.addEventListener("click", advanceBreakQuestion);

                const shell = document.createElement("div");
                shell.className = "edu-card-shell";

                const cardEl = CommonUtils.createCardEl(card);
                if (!isClassic) {
                    cardEl.classList.remove("classic-faces-card", "classic-faces-art-card");
                    const suitCenter = cardEl.querySelector(".suit-center");
                    if (suitCenter) {
                        suitCenter.innerHTML = card.suit;
                        suitCenter.style.fontSize = "2.5em";
                        suitCenter.style.display = "flex";
                        suitCenter.style.alignItems = "center";
                        suitCenter.style.justifyContent = "center";
                    }
                }

                shell.appendChild(cardEl);
                button.appendChild(shell);
                wrapper.appendChild(button);

                const label = document.createElement("div");
                label.className = "edu-subtle";
                label.style.marginTop = "8px";
                label.textContent = labelText;
                wrapper.appendChild(label);

                return wrapper;
            };

            const left = createComparisonCard(question.card, "Classic (Pips)", true);
            const right = createComparisonCard(question.card, "Simplified", false);

            container.appendChild(left);
            container.appendChild(right);
            elements.board.appendChild(container);

            elements.fact.textContent = question.fact;
            return;
        }

        question.boardCards.forEach((card, index) => {
            if (question.kind === "board" || question.kind === "break") {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "edu-card-button";
                const shell = document.createElement("div");
                shell.className = "edu-card-shell";
                const cardEl = CommonUtils.createCardEl(new Card(card.suit, card.val));
                if (question.hideBoardCardRank) {
                    cardEl.classList.add("edu-card-rank-hidden");
                }
                shell.appendChild(cardEl);
                button.appendChild(shell);

                if (question.kind === "board") {
                    button.addEventListener("click", () => handleBoardAnswer(index, shell));
                } else {
                    button.addEventListener("click", advanceBreakQuestion);
                }

                elements.board.appendChild(button);
                return;
            }

            const shell = document.createElement("div");
            shell.className = "edu-card-shell";
            const cardEl = CommonUtils.createCardEl(new Card(card.suit, card.val));
            if (question.hideBoardCardRank) {
                cardEl.classList.add("edu-card-rank-hidden");
            }
            shell.appendChild(cardEl);
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
            const choiceLabel = choice.label || (choice.card ? `${choice.card.val} ${choice.card.suit}` : "Choice");
            button.setAttribute("aria-label", choiceLabel);
            button.addEventListener("click", () => handleChoiceAnswer(choice, button));

            const panel = document.createElement("div");
            panel.className = "edu-choice-card";
            if (choice.symbolOnly) panel.classList.add("symbol-only");
            if (choice.card) {
                const cardEl = CommonUtils.createCardEl(choice.card);
                if (question.disableClassicFacesForChoices) {
                    markCardAsNoClassic(cardEl);
                }
                panel.appendChild(cardEl);
            } else {
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
            }

            button.appendChild(panel);
            elements.choices.appendChild(button);
        });

        const columns = Math.min(6, Math.max(2, question.choices.length));
        elements.choices.style.setProperty("--choice-columns", String(columns));
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

    function advanceBreakQuestion() {
        if (state.question?.kind !== "break" && state.question?.kind !== "comparison") return;
        disableInputs();
        nextQuestion();
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
            setTimeout(nextQuestion, 920);
        } else {
            state.streak = 0;
            CommonUtils.playSound("error");

            // Interaction pause for incorrect answers
            const resumeHandler = (e) => {
                const target = e.target;
                if (target && (target.closest('.game-controls') || target.closest('header'))) return; // Don't block controls
                e.preventDefault();
                e.stopPropagation();
                window.removeEventListener("click", resumeHandler, true);
                window.removeEventListener("touchstart", resumeHandler, true);
                nextQuestion();
            };
            setTimeout(() => {
                window.addEventListener("click", resumeHandler, true);
                window.addEventListener("touchstart", resumeHandler, true);
            }, 300);

            message += " (Tap to continue)";
        }

        if (state.autoLevel) {
            const batch = EducationalUtils.consumeAutoLevelBatch(state.autoLevelBatch, good, 7);
            if (batch) {
                state.level = EducationalUtils.adjustDifficultyFromBatch(state.level, batch, 1, 5, 6, 4);
                elements.levelSelect.value = String(state.level);
            }
        }

        setFeedback(message, good);
        updateStats();
        saveProgress();
    }

    function resetStats() {
        state.score = 0;
        state.streak = 0;
        state.bestStreak = 0;
        state.recentAnswers = [];
        updateStats();
        saveProgress();
        nextQuestion();
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
