(function () {
    "use strict";

    const RULES = {
        "same-card": {
            label: "Same card pair",
            copy: "Tap two identical cards.",
            isMatch: (a, b) => a.matchKey === b.matchKey,
            buildPairs: buildSameCardPairs
        },
        "same-color": {
            label: "Same color",
            copy: "Match any two cards that are both red or both black.",
            isMatch: (a, b) => EducationalUtils.getCardColor(a.card) === EducationalUtils.getCardColor(b.card),
            buildPairs: buildColorPairs
        },
        "complement-suit": {
            label: "Complement suits",
            copy: "Match Hearts with Spades, and Diamonds with Clubs.",
            isMatch: (a, b) => a.matchKey === b.matchKey,
            buildPairs: buildComplementSuitPairs
        },
        "same-rank": {
            label: "Same rank",
            copy: "Match cards with the same rank (same number/face value).",
            isMatch: (a, b) => EducationalUtils.getRank(a.card.val, state.cards) === EducationalUtils.getRank(b.card.val, state.cards),
            buildPairs: buildSameRankPairs
        },
        "sequence": {
            label: "Sequence (+/-1)",
            copy: "Match cards one step apart (A can pair with K).",
            isMatch: (a, b) => areAdjacentRanks(EducationalUtils.getRank(a.card.val, state.cards), EducationalUtils.getRank(b.card.val, state.cards)),
            buildPairs: buildSequencePairs
        },
        "sequence-same-color": {
            label: "Sequence same color",
            copy: "Match one-step sequences with the same color only (A can pair with K).",
            isMatch: (a, b) => areAdjacentRanks(EducationalUtils.getRank(a.card.val, state.cards), EducationalUtils.getRank(b.card.val, state.cards))
                && EducationalUtils.getCardColor(a.card) === EducationalUtils.getCardColor(b.card),
            buildPairs: (count) => buildSequencePairs(count, "same-color")
        },
        "sequence-different-color": {
            label: "Sequence different color",
            copy: "Match one-step sequences with different colors only (A can pair with K).",
            isMatch: (a, b) => areAdjacentRanks(EducationalUtils.getRank(a.card.val, state.cards), EducationalUtils.getRank(b.card.val, state.cards))
                && EducationalUtils.getCardColor(a.card) !== EducationalUtils.getCardColor(b.card),
            buildPairs: (count) => buildSequencePairs(count, "different-color")
        }
    };

    const LEVEL_CONFIG = {
        1: { pairs: 3, cols: 3, rule: "same-card" },
        2: { pairs: 4, cols: 4, rule: "same-card" },
        3: { pairs: 6, cols: 4, rule: "same-color" },
        4: { pairs: 8, cols: 4, rule: "complement-suit" },
        5: { pairs: 10, cols: 5, rule: "same-rank" },
        6: { pairs: 12, cols: 6, rule: "complement-suit" },
        7: { pairs: 14, cols: 7, rule: "same-rank" }
    };

    const state = {
        cards: [],
        flippedIndexes: [],
        matchedPairs: 0,
        moves: 0,
        lockInput: false,
        currentLevel: 1,
        totalPairs: 3,
        autoLevel: true,
        selectedRule: "auto",
        activeRule: "same-card",
        bestMoves: {},
        winStreak: 0
    };

    const elements = {
        newGameButton: null,
        levelSelect: null,
        pairsSelect: null,
        ruleSelect: null,
        autoLevel: null,
        moves: null,
        pairsProgress: null,
        bestMoves: null,
        winStreak: null,
        levelInfo: null,
        ruleCopy: null,
        ruleExamples: null,
        feedback: null,
        grid: null,
        tableSelect: null,
        deckSelect: null
    };

    function init() {
        cacheElements();
        HeaderControls?.init({ openKeys: ["game", "stats"] });
        loadProgress();
        bindEvents();
        syncThemeClasses();
        startNewGame();
    }

    function cacheElements() {
        elements.newGameButton = document.getElementById("memory-new-game");
        elements.levelSelect = document.getElementById("memory-level-select");
        elements.pairsSelect = document.getElementById("memory-pairs-select");
        elements.ruleSelect = document.getElementById("memory-rule-select");
        elements.autoLevel = document.getElementById("memory-auto-level");
        elements.moves = document.getElementById("memory-moves");
        elements.pairsProgress = document.getElementById("memory-pairs-progress");
        elements.bestMoves = document.getElementById("memory-best-moves");
        elements.winStreak = document.getElementById("memory-win-streak");
        elements.levelInfo = document.getElementById("memory-level-info");
        elements.ruleCopy = document.getElementById("memory-rule-copy");
        elements.ruleExamples = document.getElementById("memory-rule-examples");
        elements.feedback = document.getElementById("memory-feedback");
        elements.grid = document.getElementById("memory-grid");
        elements.tableSelect = document.getElementById("table-style-select");
        elements.deckSelect = document.getElementById("deck-style-select");
        elements.resetStats = document.getElementById("memory-reset-stats");
    }

    function bindEvents() {
        elements.newGameButton.addEventListener("click", startNewGame);

        elements.levelSelect.addEventListener("change", (event) => {
            state.currentLevel = clampLevel(parseInt(event.target.value, 10));
            state.autoLevel = false;
            elements.autoLevel.checked = false;
            const levelConfig = LEVEL_CONFIG[state.currentLevel];
            state.totalPairs = levelConfig.pairs;
            elements.pairsSelect.value = String(levelConfig.pairs);
            if (state.selectedRule === "auto") {
                state.activeRule = levelConfig.rule;
            }
            updateRuleAndLevelUI();
            saveProgress();
            startNewGame();
        });

        elements.pairsSelect.addEventListener("change", (event) => {
            const pairs = parseInt(event.target.value, 10) || 3;
            state.totalPairs = pairs;
            state.currentLevel = findLevelForPairs(pairs);
            state.autoLevel = false;
            elements.autoLevel.checked = false;
            elements.levelSelect.value = String(state.currentLevel);
            if (state.selectedRule === "auto") {
                state.activeRule = LEVEL_CONFIG[state.currentLevel].rule;
            }
            updateRuleAndLevelUI();
            saveProgress();
            startNewGame();
        });

        elements.ruleSelect.addEventListener("change", (event) => {
            state.selectedRule = event.target.value;
            state.activeRule = resolveActiveRule();
            state.autoLevel = false;
            elements.autoLevel.checked = false;
            updateRuleAndLevelUI();
            saveProgress();
            startNewGame();
        });

        elements.autoLevel.addEventListener("change", (event) => {
            state.autoLevel = event.target.checked;
            if (state.autoLevel) {
                state.currentLevel = 1;
                state.totalPairs = LEVEL_CONFIG[1].pairs;
                elements.levelSelect.value = "1";
                elements.pairsSelect.value = String(state.totalPairs);
            }
            state.activeRule = resolveActiveRule();
            updateRuleAndLevelUI();
            saveProgress();
            startNewGame();
        });

        elements.tableSelect?.addEventListener("change", syncThemeClasses);
        elements.deckSelect?.addEventListener("change", syncThemeClasses);
        elements.resetStats?.addEventListener("click", () => {
            SolitaireCheckModal.showConfirm({
                title: "Reset Progress",
                message: "Do you want to clear your best moves and win streak for Memory Match?",
                confirmLabel: "Reset",
                cancelLabel: "Cancel"
            }).then(confirmed => {
                if (confirmed) resetStats();
            });
        });
        window.addEventListener("addons:changed", syncThemeClasses);
    }

    function clampLevel(level) {
        return Math.max(1, Math.min(7, Number.isFinite(level) ? level : 1));
    }

    function findLevelForPairs(pairs) {
        const entry = Object.entries(LEVEL_CONFIG).find(([, config]) => config.pairs === pairs);
        return entry ? parseInt(entry[0], 10) : 1;
    }

    function resolveActiveRule() {
        if (state.selectedRule && state.selectedRule !== "auto") return state.selectedRule;
        return LEVEL_CONFIG[state.currentLevel].rule;
    }

    function loadProgress() {
        const saved = EducationalUtils.loadProgress("memory-match");
        if (!saved) {
            updateRuleAndLevelUI();
            updateStats();
            return;
        }

        state.currentLevel = clampLevel(saved.currentLevel || 1);
        state.totalPairs = saved.totalPairs || LEVEL_CONFIG[state.currentLevel].pairs;
        state.autoLevel = saved.autoLevel !== false;
        state.selectedRule = saved.selectedRule || "auto";
        state.activeRule = saved.activeRule || resolveActiveRule();
        state.bestMoves = saved.bestMoves || {};
        state.winStreak = saved.winStreak || 0;

        elements.levelSelect.value = String(state.currentLevel);
        elements.pairsSelect.value = String(state.totalPairs);
        elements.autoLevel.checked = state.autoLevel;
        elements.ruleSelect.value = state.selectedRule;

        if (state.autoLevel) {
            state.currentLevel = 1;
            state.totalPairs = LEVEL_CONFIG[1].pairs;
            elements.levelSelect.value = "1";
            elements.pairsSelect.value = String(state.totalPairs);
        }

        state.activeRule = resolveActiveRule();
        updateRuleAndLevelUI();
        updateStats();
    }

    function saveProgress() {
        EducationalUtils.saveProgress("memory-match", {
            currentLevel: state.currentLevel,
            totalPairs: state.totalPairs,
            autoLevel: state.autoLevel,
            selectedRule: state.selectedRule,
            activeRule: state.activeRule,
            bestMoves: state.bestMoves,
            winStreak: state.winStreak
        });
    }

    function updateRuleAndLevelUI() {
        const cols = LEVEL_CONFIG[state.currentLevel].cols;
        const rows = Math.ceil((state.totalPairs * 2) / cols);
        const rule = RULES[state.activeRule];
        elements.levelInfo.textContent = `Level ${state.currentLevel} · ${state.totalPairs} pairs · ${cols}x${rows} grid`;
        elements.ruleCopy.textContent = rule.copy;
        renderRuleExamples();
    }

    function renderRuleExamples() {
        elements.ruleExamples.innerHTML = "";
        const rule = state.activeRule;

        if (rule === "same-card") {
            appendExampleSet([new Card("♥", "7"), new Card("♥", "7")], "↔");
            appendExampleSet([new Card("♣", "K"), new Card("♣", "K")], "↔");
            return;
        }

        if (rule === "same-color") {
            appendExampleSet([new Card("♥", "4"), new Card("♦", "Q")], "↔");
            appendExampleSet([new Card("♣", "8"), new Card("♠", "A")], "↔");
            return;
        }

        if (rule === "complement-suit") {
            appendExampleSet([new Card("♥", "9"), new Card("♠", "9")], "↔");
            appendExampleSet([new Card("♦", "5"), new Card("♣", "5")], "↔");
            return;
        }

        if (rule === "sequence") {
            appendExampleSet([new Card("♥", "7"), new Card("♣", "8")], "+1");
            appendExampleSet([new Card("♠", "K"), new Card("♦", "A")], "wrap");
            return;
        }

        if (rule === "sequence-same-color") {
            appendExampleSet([new Card("♥", "4"), new Card("♦", "5")], "+1");
            appendExampleSet([new Card("♠", "Q"), new Card("♣", "K")], "+1");
            return;
        }

        if (rule === "sequence-different-color") {
            appendExampleSet([new Card("♥", "10"), new Card("♣", "J")], "+1");
            appendExampleSet([new Card("♦", "K"), new Card("♠", "A")], "wrap");
            return;
        }

        appendExampleSet([new Card("♣", "K"), new Card("♥", "K")], "↔");
        appendExampleSet([new Card("♦", "3"), new Card("♠", "3")], "↔");
    }

    function appendExampleSet(cards, symbol) {
        const group = document.createElement("div");
        group.className = "edu-example-cardset";

        const leftWrap = document.createElement("span");
        leftWrap.className = "edu-card-shell";
        leftWrap.appendChild(CommonUtils.createCardEl(cards[0]));
        group.appendChild(leftWrap);

        const divider = document.createElement("span");
        divider.className = "edu-example-divider";
        divider.textContent = symbol;
        group.appendChild(divider);

        const rightWrap = document.createElement("span");
        rightWrap.className = "edu-card-shell";
        rightWrap.appendChild(CommonUtils.createCardEl(cards[1]));
        group.appendChild(rightWrap);

        elements.ruleExamples.appendChild(group);
    }

    function startNewGame() {
        state.moves = 0;
        state.matchedPairs = 0;
        state.lockInput = false;
        state.flippedIndexes = [];
        state.activeRule = resolveActiveRule();
        updateRuleAndLevelUI();
        generateDeck();
        renderGrid();
        setFeedback("");
        updateStats();
    }

    function generateDeck() {
        const builder = RULES[state.activeRule].buildPairs;
        const pairCards = builder(state.totalPairs);
        state.cards = EducationalUtils.shuffle(pairCards).map((entry, index) => ({
            ...entry,
            boardId: index,
            flipped: false,
            matched: false
        }));
    }

    function buildSameCardPairs(pairCount) {
        const values = pairCount >= 14 ? EXTENDED_VALUES : VALUES;
        const baseDeck = [];
        for (const suit of SUITS) {
            for (const val of values) {
                baseDeck.push(new Card(suit, val));
            }
        }
        const picks = EducationalUtils.pickRandom(baseDeck, pairCount);
        const cards = [];
        picks.forEach((card, index) => {
            cards.push({ card: cloneCard(card), matchKey: `same-${index}` });
            cards.push({ card: cloneCard(card), matchKey: `same-${index}` });
        });
        return cards;
    }

    function buildColorPairs(pairCount) {
        const values = pairCount >= 14 ? EXTENDED_VALUES : VALUES;
        const cards = [];
        for (let i = 0; i < pairCount; i += 1) {
            const targetColor = i % 2 === 0 ? "red" : "black";
            const suits = targetColor === "red" ? ["♥", "♦"] : ["♠", "♣"];
            const valueA = values[Math.floor(Math.random() * values.length)];
            const valueB = values[Math.floor(Math.random() * values.length)];
            cards.push({ card: new Card(suits[0], valueA), matchKey: `color-${i}` });
            cards.push({ card: new Card(suits[1], valueB), matchKey: `color-${i}` });
        }
        return cards;
    }

    function buildComplementSuitPairs(pairCount) {
        const values = pairCount >= 14 ? EXTENDED_VALUES : VALUES;
        const pairs = [["♥", "♠"], ["♦", "♣"]];
        const cards = [];
        for (let i = 0; i < pairCount; i += 1) {
            const pair = pairs[i % pairs.length];
            const value = values[Math.floor(Math.random() * values.length)];
            cards.push({ card: new Card(pair[0], value), matchKey: `comp-${i}` });
            cards.push({ card: new Card(pair[1], value), matchKey: `comp-${i}` });
        }
        return cards;
    }

    function buildSameRankPairs(pairCount) {
        const values = pairCount >= 14 ? EXTENDED_VALUES : VALUES;
        const cards = [];
        for (let i = 0; i < pairCount; i += 1) {
            const rank = values[Math.floor(Math.random() * values.length)];
            const suitA = SUITS[Math.floor(Math.random() * SUITS.length)];
            let suitB = SUITS[Math.floor(Math.random() * SUITS.length)];
            while (suitB === suitA) {
                suitB = SUITS[Math.floor(Math.random() * SUITS.length)];
            }
            cards.push({ card: new Card(suitA, rank), matchKey: `rank-${i}` });
            cards.push({ card: new Card(suitB, rank), matchKey: `rank-${i}` });
        }
        return cards;
    }

    function areAdjacentRanks(rankA, rankB) {
        const diff = Math.abs(rankA - rankB);
        if (diff === 1) return true;
        return (rankA === 1 && rankB === 13) || (rankA === 13 && rankB === 1);
    }

    function getNextValue(value, values) {
        const currentRank = EducationalUtils.getRank(value, values);
        const wrapRank = currentRank === (values.includes("C") ? 14 : 13) ? 1 : currentRank + 1;
        return values.find((candidate) => EducationalUtils.getRank(candidate, values) === wrapRank) || values[0];
    }

    function buildSequencePairs(pairCount, colorMode = "any") {
        const values = pairCount >= 14 ? EXTENDED_VALUES : VALUES;
        const cards = [];

        for (let i = 0; i < pairCount; i += 1) {
            const startValue = values[Math.floor(Math.random() * values.length)];
            const nextValue = getNextValue(startValue, values);

            let suitA = SUITS[Math.floor(Math.random() * SUITS.length)];
            let suitB = SUITS[Math.floor(Math.random() * SUITS.length)];

            if (colorMode === "same-color") {
                const pool = EducationalUtils.getCardColor({ suit: suitA }) === "red" ? ["♥", "♦"] : ["♠", "♣"];
                suitA = pool[Math.floor(Math.random() * pool.length)];
                suitB = pool[Math.floor(Math.random() * pool.length)];
            } else if (colorMode === "different-color") {
                const red = ["♥", "♦"];
                const black = ["♠", "♣"];
                suitA = red[Math.floor(Math.random() * red.length)];
                suitB = black[Math.floor(Math.random() * black.length)];
                if (Math.random() > 0.5) {
                    const temp = suitA;
                    suitA = suitB;
                    suitB = temp;
                }
            }

            cards.push({ card: new Card(suitA, startValue), matchKey: `seq-${i}` });
            cards.push({ card: new Card(suitB, nextValue), matchKey: `seq-${i}` });
        }

        return cards;
    }

    function cloneCard(card) {
        return new Card(card.suit, card.val);
    }

    function renderGrid() {
        elements.grid.innerHTML = "";
        const cols = LEVEL_CONFIG[state.currentLevel].cols;
        elements.grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 92px))`;

        state.cards.forEach((entry, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "edu-card-button";
            button.dataset.index = String(index);
            button.addEventListener("click", () => onCardTapped(index));

            const shell = document.createElement("span");
            shell.className = "edu-card-shell";

            if (entry.matched || entry.flipped) {
                shell.appendChild(CommonUtils.createCardEl(entry.card));
                if (entry.matched) shell.classList.add("success");
            } else {
                const backCard = new Card("♠", "A");
                backCard.hidden = true;
                shell.appendChild(CommonUtils.createCardEl(backCard));
            }

            button.appendChild(shell);
            elements.grid.appendChild(button);
        });
    }

    function onCardTapped(index) {
        if (state.lockInput) return;
        const cardEntry = state.cards[index];
        if (!cardEntry || cardEntry.matched || cardEntry.flipped) return;

        cardEntry.flipped = true;
        state.flippedIndexes.push(index);
        renderGrid();

        if (state.flippedIndexes.length < 2) return;

        state.lockInput = true;
        state.moves += 1;
        const [leftIndex, rightIndex] = state.flippedIndexes;
        const left = state.cards[leftIndex];
        const right = state.cards[rightIndex];
        const isMatch = RULES[state.activeRule].isMatch(left, right);

        if (isMatch) {
            setTimeout(() => {
                left.matched = true;
                right.matched = true;
                state.matchedPairs += 1;
                state.flippedIndexes = [];
                state.lockInput = false;
                setFeedback("Great match!", true);
                CommonUtils.playSound("win");
                updateStats();
                renderGrid();
                if (state.matchedPairs >= state.totalPairs) {
                    onWin();
                }
            }, 280);
            return;
        }

        setTimeout(() => {
            left.flipped = false;
            right.flipped = false;
            state.flippedIndexes = [];
            state.lockInput = false;
            setFeedback("No match yet. Try another pair.", false);
            CommonUtils.playSound("error");
            updateStats();
            renderGrid();
        }, 760);

        updateStats();
    }

    function onWin() {
        const key = `${state.activeRule}:${state.totalPairs}`;
        const existing = state.bestMoves[key];
        if (!existing || state.moves < existing) {
            state.bestMoves[key] = state.moves;
        }

        state.winStreak += 1;
        setFeedback(`You cleared the board in ${state.moves} moves!`, true);
        CommonUtils.playSound("youwin");

        if (state.autoLevel) {
            state.currentLevel = state.currentLevel >= 7 ? 1 : state.currentLevel + 1;
            state.totalPairs = LEVEL_CONFIG[state.currentLevel].pairs;
            elements.levelSelect.value = String(state.currentLevel);
            elements.pairsSelect.value = String(state.totalPairs);
        }

        updateStats();
        saveProgress();
    }

    function setFeedback(message, good) {
        elements.feedback.textContent = message;
        elements.feedback.classList.remove("ok", "bad");
        if (!message) return;
        elements.feedback.classList.add(good ? "ok" : "bad");
    }

    function updateStats() {
        elements.moves.textContent = String(state.moves);
        elements.pairsProgress.textContent = `${state.matchedPairs}/${state.totalPairs}`;
        const key = `${state.activeRule}:${state.totalPairs}`;
        elements.bestMoves.textContent = state.bestMoves[key] || "-";
        elements.winStreak.textContent = String(state.winStreak);
    }

    function resetStats() {
        state.bestMoves = {};
        state.winStreak = 0;
        state.moves = 0;
        state.matchedPairs = 0;
        updateStats();
        saveProgress();
        startNewGame();
    }

    function syncThemeClasses() {
        const tableTheme = elements.tableSelect?.value || "felt";
        const deckTheme = elements.deckSelect?.value || "red";

        Array.from(document.body.classList)
            .filter(cls => cls.startsWith("table-") || cls.startsWith("deck-"))
            .forEach(cls => document.body.classList.remove(cls));

        document.body.classList.add(`table-${tableTheme}`);
        document.body.classList.add(`deck-${deckTheme}`);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
