(function() {
    "use strict";

    const CHALLENGE_TYPES = {
        MISSING_ADDEND: "missing-addend",
        SUBTRACT_TO_TARGET: "subtract-to-target",
        FIND_SUM: "find-sum"
    };

    const LEVELS = {
        1: {
            values: ["A", "2", "3", "4", "5"],
            challengeTypes: [CHALLENGE_TYPES.MISSING_ADDEND],
            choiceCount: 3
        },
        2: {
            values: ["A", "2", "3", "4", "5", "6", "7", "8"],
            challengeTypes: [CHALLENGE_TYPES.MISSING_ADDEND, CHALLENGE_TYPES.FIND_SUM],
            choiceCount: 3
        },
        3: {
            values: ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q"],
            challengeTypes: [CHALLENGE_TYPES.MISSING_ADDEND, CHALLENGE_TYPES.FIND_SUM, CHALLENGE_TYPES.SUBTRACT_TO_TARGET],
            choiceCount: 4
        },
        4: {
            values: ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"],
            challengeTypes: [CHALLENGE_TYPES.MISSING_ADDEND, CHALLENGE_TYPES.FIND_SUM, CHALLENGE_TYPES.SUBTRACT_TO_TARGET],
            choiceCount: 4
        },
        5: {
            values: VALUES.slice(),
            challengeTypes: [CHALLENGE_TYPES.MISSING_ADDEND, CHALLENGE_TYPES.FIND_SUM, CHALLENGE_TYPES.SUBTRACT_TO_TARGET],
            choiceCount: 5
        }
    };

    const state = {
        score: 0,
        streak: 0,
        bestStreak: 0,
        level: 1,
        autoLevel: true,
        challenge: null,
        selectedChoiceId: null,
        placedChoiceIds: [],
        answerLocked: false,
        suppressClickChoiceId: null,
        recentAnswers: [],
        maxRecentAnswers: 12
    };

    const elements = {
        levelSelect: null,
        autoLevel: null,
        newChallenge: null,
        score: null,
        streak: null,
        bestStreak: null,
        correctRate: null,
        prompt: null,
        help: null,
        visualCue: null,
        expression: null,
        feedback: null,
        choices: null,
        answerSlot: null,
        tableSelect: null,
        deckSelect: null
    };

    function init() {
        cacheElements();
        HeaderControls?.init({ openKeys: ["game", "stats"] });
        loadProgress();
        bindEvents();
        syncThemeClasses();
        nextChallenge();
    }

    function cacheElements() {
        elements.levelSelect = document.getElementById("math-level-select");
        elements.autoLevel = document.getElementById("math-auto-level");
        elements.newChallenge = document.getElementById("math-new-challenge");
        elements.score = document.getElementById("math-score");
        elements.streak = document.getElementById("math-streak");
        elements.bestStreak = document.getElementById("math-best-streak");
        elements.correctRate = document.getElementById("math-correct-rate");
        elements.prompt = document.getElementById("math-prompt");
        elements.help = document.getElementById("math-help");
        elements.visualCue = document.getElementById("math-visual-cue");
        elements.expression = document.getElementById("math-expression");
        elements.feedback = document.getElementById("math-feedback");
        elements.choices = document.getElementById("math-choices");
        elements.tableSelect = document.getElementById("table-style-select");
        elements.deckSelect = document.getElementById("deck-style-select");
    }

    function bindEvents() {
        elements.levelSelect.addEventListener("change", (event) => {
            state.level = clampLevel(parseInt(event.target.value, 10));
            state.autoLevel = false;
            elements.autoLevel.checked = false;
            saveProgress();
            nextChallenge();
        });

        elements.autoLevel.addEventListener("change", (event) => {
            state.autoLevel = event.target.checked;
            if (state.autoLevel) {
                state.level = 1;
                elements.levelSelect.value = "1";
            }
            saveProgress();
            nextChallenge();
        });

        elements.newChallenge.addEventListener("click", nextChallenge);
        elements.tableSelect?.addEventListener("change", syncThemeClasses);
        elements.deckSelect?.addEventListener("change", syncThemeClasses);
        window.addEventListener("addons:changed", syncThemeClasses);
    }

    function clampLevel(level) {
        return Math.max(1, Math.min(5, Number.isFinite(level) ? level : 1));
    }

    function loadProgress() {
        const saved = EducationalUtils.loadProgress("math-challenges");
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
        EducationalUtils.saveProgress("math-challenges", {
            score: state.score,
            streak: state.streak,
            bestStreak: state.bestStreak,
            level: state.level,
            autoLevel: state.autoLevel,
            recentAnswers: state.recentAnswers
        });
    }

    function nextChallenge() {
        state.challenge = buildChallenge();
        state.selectedChoiceId = null;
        state.placedChoiceIds = [];
        state.answerLocked = false;
        state.suppressClickChoiceId = null;
        renderChallenge();
        setFeedback("");
    }

    function buildChallenge() {
        const config = LEVELS[state.level];
        const challengeType = config.challengeTypes[Math.floor(Math.random() * config.challengeTypes.length)];
        const values = config.values.slice();

        if (state.level === 5 && challengeType === CHALLENGE_TYPES.MISSING_ADDEND && Math.random() < 0.6) {
            return buildExpertTwoCardMissing(values);
        }

        return buildSingleCardChallenge(challengeType, values, config.choiceCount);
    }

    function buildExpertTwoCardMissing(values) {
        const lowValues = values.filter((value) => EducationalUtils.getRank(value) <= 10);
        const left = pickRandom(lowValues.length ? lowValues : values);
        const leftRank = EducationalUtils.getRank(left);

        const pairSource = values.filter((value) => {
            const rank = EducationalUtils.getRank(value);
            return rank >= 2 && rank <= 10;
        });
        let pair = pickTwoDistinct(pairSource.length >= 2 ? pairSource : values, 2);
        let neededTotal = EducationalUtils.getRank(pair[0]) + EducationalUtils.getRank(pair[1]);
        let guard = 0;
        while (neededTotal <= 13 && guard < 60) {
            pair = pickTwoDistinct(pairSource.length >= 2 ? pairSource : values, 2);
            neededTotal = EducationalUtils.getRank(pair[0]) + EducationalUtils.getRank(pair[1]);
            guard += 1;
        }
        const targetTotal = leftRank + neededTotal;

        const expectedValues = pair.slice().sort(sortByRankThenLabel);
        const choices = buildChoiceObjects(expectedValues, values, 6);

        return {
            prompt: "Place cards in ?",
            help: "Drag cards into ? (or tap card, then tap ?).",
            cue: { text: "🧩 Place 2 cards", tone: "blue" },
            expressionParts: [cardPart(left), symbolPart("+"), unknownPart(), symbolPart("="), numberPart(targetTotal)],
            requiredCards: 2,
            expectedValues,
            choices
        };
    }

    function buildSingleCardChallenge(challengeType, values, choiceCount) {
        const pickValue = () => pickRandom(values);
        const rankOf = (value) => EducationalUtils.getRank(value);
        const valueFromRank = (rank) => rankToPlayableValue(rank, values);

        let prompt;
        let help;
        let cue;
        let expressionParts;
        let answerValue;

        if (challengeType === CHALLENGE_TYPES.MISSING_ADDEND) {
            let left = pickValue();
            let answer = pickValue();
            let sum = rankOf(left) + rankOf(answer);
            let guard = 0;
            while ((sum < 1 || sum > 13 || !valueFromRank(sum)) && guard < 50) {
                left = pickValue();
                answer = pickValue();
                sum = rankOf(left) + rankOf(answer);
                guard += 1;
            }
            const target = valueFromRank(sum) || "K";
            prompt = "Find the missing card";
            help = "Drag or tap a card into ?";
            cue = { text: "🧩 Place card in ?", tone: "blue" };
            expressionParts = [cardPart(left), symbolPart("+"), unknownPart(), symbolPart("="), cardPart(target)];
            answerValue = answer;
        } else if (challengeType === CHALLENGE_TYPES.SUBTRACT_TO_TARGET) {
            let top = pickValue();
            let answer = pickValue();
            let difference = rankOf(top) - rankOf(answer);
            let guard = 0;
            while ((difference < 1 || difference > 13 || !valueFromRank(difference)) && guard < 50) {
                top = pickValue();
                answer = pickValue();
                difference = rankOf(top) - rankOf(answer);
                guard += 1;
            }
            const target = valueFromRank(difference) || "A";
            prompt = "Fill the minus puzzle";
            help = "Move one card into ?";
            cue = { text: "➖ Solve subtraction", tone: "orange" };
            expressionParts = [cardPart(top), symbolPart("-"), unknownPart(), symbolPart("="), cardPart(target)];
            answerValue = answer;
        } else {
            let left = pickValue();
            let right = pickValue();
            let sum = rankOf(left) + rankOf(right);
            let guard = 0;
            while ((sum < 1 || sum > 13 || !valueFromRank(sum)) && guard < 50) {
                left = pickValue();
                right = pickValue();
                sum = rankOf(left) + rankOf(right);
                guard += 1;
            }
            const result = valueFromRank(sum) || "Q";
            prompt = "Find the total card";
            help = "Move one card into ?";
            cue = { text: "➕ Solve addition", tone: "gold" };
            expressionParts = [cardPart(left), symbolPart("+"), cardPart(right), symbolPart("="), unknownPart()];
            answerValue = result;
        }

        const expectedValues = [answerValue].sort(sortByRankThenLabel);
        const choices = buildChoiceObjects(expectedValues, values, choiceCount);

        return {
            prompt,
            help,
            cue,
            expressionParts,
            requiredCards: 1,
            expectedValues,
            choices
        };
    }

    function rankToPlayableValue(rank, allowedValues) {
        const available = new Set((allowedValues || VALUES).map(String));
        const mapping = {
            1: "A",
            11: "J",
            12: "Q",
            13: "K"
        };
        if (mapping[rank] && available.has(mapping[rank])) {
            return mapping[rank];
        }
        const plain = String(rank);
        if (available.has(plain)) return plain;
        return null;
    }

    function buildChoiceObjects(requiredValues, values, count) {
        const pool = [];
        const requiredPool = requiredValues.slice();

        requiredPool.forEach((value, index) => {
            pool.push({ id: `req-${index}-${value}`, value, required: true });
        });

        const candidates = EducationalUtils.shuffle(values.filter((value) => !requiredValues.includes(value)));
        while (pool.length < count && candidates.length) {
            const value = candidates.pop();
            pool.push({ id: `alt-${pool.length}-${value}`, value, required: false });
        }

        return EducationalUtils.shuffle(pool);
    }

    function cardPart(value) {
        return { type: "card", value };
    }

    function unknownPart() {
        return { type: "unknown" };
    }

    function symbolPart(text) {
        return { type: "symbol", text };
    }

    function numberPart(value) {
        return { type: "number", value };
    }

    function renderChallenge() {
        if (!state.challenge) return;

        elements.prompt.textContent = state.challenge.prompt;
        elements.help.textContent = state.challenge.help;
        elements.visualCue.textContent = state.challenge.cue?.text || "🧩 Place card in ?";
        elements.visualCue.dataset.tone = state.challenge.cue?.tone || "blue";

        elements.expression.innerHTML = "";
        elements.answerSlot = null;

        state.challenge.expressionParts.forEach((part) => {
            const node = document.createElement("div");

            if (part.type === "card") {
                node.className = "edu-card-shell";
                node.appendChild(CommonUtils.createCardEl(new Card(randomSuit(), part.value)));
            } else if (part.type === "unknown") {
                node.className = "edu-drop-slot";
                node.textContent = "?";
                node.dataset.requiredCards = String(state.challenge.requiredCards || 1);
                node.addEventListener("click", () => {
                    if (state.selectedChoiceId) {
                        placeChoiceById(state.selectedChoiceId);
                        return;
                    }
                    if (state.placedChoiceIds.length) {
                        removeLastPlacedChoice();
                    }
                });
                elements.answerSlot = node;
            } else if (part.type === "number") {
                node.className = "edu-pill";
                node.textContent = String(part.value);
            } else {
                node.className = "edu-pill";
                node.textContent = part.text;
            }

            elements.expression.appendChild(node);
        });

        renderChoices();
        renderPlacedCards();
    }

    function renderChoices() {
        elements.choices.innerHTML = "";
        elements.choices.classList.add("has-choices");

        state.challenge.choices.forEach((choice) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "edu-choice-button";
            button.dataset.choiceId = choice.id;
            button.dataset.value = choice.value;
            button.setAttribute("aria-label", `Answer ${choice.value}`);

            button.addEventListener("click", () => {
                if (state.suppressClickChoiceId === choice.id) {
                    state.suppressClickChoiceId = null;
                    return;
                }
                selectChoice(choice.id);
            });

            attachPointerDrag(button, choice.id);

            const cardWrap = document.createElement("div");
            cardWrap.className = "edu-choice-card";
            cardWrap.appendChild(CommonUtils.createCardEl(new Card(randomSuit(), choice.value)));

            const label = document.createElement("div");
            label.className = "edu-choice-label";
            label.textContent = EducationalUtils.getValueLabel(choice.value);

            const help = document.createElement("div");
            help.className = "edu-choice-help";
            help.textContent = `${EducationalUtils.getRank(choice.value)}`;

            cardWrap.append(label, help);
            button.appendChild(cardWrap);
            elements.choices.appendChild(button);
        });

        const columns = Math.max(3, Math.min(4, state.challenge.choices.length));
        elements.choices.style.setProperty("--choice-columns", String(columns));
    }

    function attachPointerDrag(button, choiceId) {
        let pointerId = null;
        let startX = 0;
        let startY = 0;
        let originLeft = 0;
        let originTop = 0;
        let dragging = false;
        let ghost = null;

        const cleanup = () => {
            if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
            ghost = null;
            pointerId = null;
            dragging = false;
            window.removeEventListener("pointermove", onMove, true);
            window.removeEventListener("pointerup", onUp, true);
            window.removeEventListener("pointercancel", onUp, true);
        };

        const onMove = (event) => {
            if (event.pointerId !== pointerId) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            if (!dragging && Math.hypot(dx, dy) > 8) {
                dragging = true;
                state.suppressClickChoiceId = choiceId;
                ghost = button.cloneNode(true);
                ghost.classList.add("edu-drag-ghost");
                ghost.style.position = "fixed";
                ghost.style.left = `${originLeft}px`;
                ghost.style.top = `${originTop}px`;
                ghost.style.pointerEvents = "none";
                ghost.style.zIndex = "3000";
                ghost.style.width = `${button.getBoundingClientRect().width}px`;
                document.body.appendChild(ghost);
            }

            if (dragging && ghost) {
                ghost.style.transform = `translate(${dx}px, ${dy}px)`;
                highlightSlotForPoint(event.clientX, event.clientY);
            }
        };

        const onUp = (event) => {
            if (event.pointerId !== pointerId) return;
            if (dragging) {
                const dropped = tryDropChoiceAtPoint(choiceId, event.clientX, event.clientY);
                if (!dropped) clearSlotHighlight();
            }
            cleanup();
        };

        button.addEventListener("pointerdown", (event) => {
            if (button.disabled || state.answerLocked) return;
            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            const rect = button.getBoundingClientRect();
            originLeft = rect.left;
            originTop = rect.top;
            window.addEventListener("pointermove", onMove, true);
            window.addEventListener("pointerup", onUp, true);
            window.addEventListener("pointercancel", onUp, true);
        });
    }

    function highlightSlotForPoint(x, y) {
        if (!elements.answerSlot) return;
        const target = document.elementFromPoint(x, y);
        const onSlot = !!(target && (target === elements.answerSlot || elements.answerSlot.contains(target)));
        elements.answerSlot.classList.toggle("ready", onSlot);
    }

    function clearSlotHighlight() {
        elements.answerSlot?.classList.remove("ready");
    }

    function tryDropChoiceAtPoint(choiceId, x, y) {
        if (!elements.answerSlot) return false;
        const target = document.elementFromPoint(x, y);
        const onSlot = !!(target && (target === elements.answerSlot || elements.answerSlot.contains(target)));
        if (!onSlot) return false;
        placeChoiceById(choiceId);
        return true;
    }

    function selectChoice(choiceId) {
        if (state.answerLocked) return;
        const choiceButton = getChoiceButton(choiceId);
        if (!choiceButton || choiceButton.disabled) return;

        state.selectedChoiceId = choiceId;
        Array.from(elements.choices.querySelectorAll(".edu-choice-button")).forEach((node) => {
            node.classList.remove("selected");
        });
        choiceButton.classList.add("selected");
        elements.answerSlot?.classList.add("ready");
    }

    function getChoiceButton(choiceId) {
        return elements.choices.querySelector(`.edu-choice-button[data-choice-id="${choiceId}"]`);
    }

    function getChoiceById(choiceId) {
        return state.challenge.choices.find((choice) => choice.id === choiceId) || null;
    }

    function placeChoiceById(choiceId) {
        if (state.answerLocked || !choiceId) return;
        if (state.placedChoiceIds.includes(choiceId)) return;
        if (state.placedChoiceIds.length >= state.challenge.requiredCards) return;

        const choice = getChoiceById(choiceId);
        const button = getChoiceButton(choiceId);
        if (!choice || !button || button.disabled) return;

        state.placedChoiceIds.push(choiceId);
        button.disabled = true;
        button.classList.remove("selected");
        state.selectedChoiceId = null;

        renderPlacedCards();

        if (state.placedChoiceIds.length >= state.challenge.requiredCards) {
            evaluatePlacedChoices();
        } else {
            elements.answerSlot?.classList.add("ready");
        }
    }

    function removeLastPlacedChoice() {
        if (state.answerLocked || !state.placedChoiceIds.length) return;
        const choiceId = state.placedChoiceIds.pop();
        const button = getChoiceButton(choiceId);
        if (button) button.disabled = false;
        renderPlacedCards();
    }

    function renderPlacedCards() {
        if (!elements.answerSlot) return;
        elements.answerSlot.innerHTML = "";

        const placedChoices = state.placedChoiceIds.map((choiceId) => getChoiceById(choiceId)).filter(Boolean);
        if (!placedChoices.length) {
            elements.answerSlot.textContent = "?";
            elements.answerSlot.classList.remove("success", "fail");
            return;
        }

        const stack = document.createElement("div");
        stack.className = "edu-drop-stack";

        placedChoices.forEach((choice, index) => {
            const cardEl = CommonUtils.createCardEl(new Card(randomSuit(), choice.value));
            cardEl.classList.add("edu-drop-stack-card");
            cardEl.style.left = `${index * 12}px`;
            cardEl.style.top = `${index * 9}px`;
            stack.appendChild(cardEl);
        });

        elements.answerSlot.appendChild(stack);
        elements.answerSlot.classList.remove("ready");
    }

    function evaluatePlacedChoices() {
        if (state.answerLocked) return;
        state.answerLocked = true;

        const placedValues = state.placedChoiceIds
            .map((choiceId) => getChoiceById(choiceId))
            .filter(Boolean)
            .map((choice) => choice.value)
            .sort(sortByRankThenLabel);

        const expectedValues = state.challenge.expectedValues.slice().sort(sortByRankThenLabel);
        const isCorrect = arraysEqual(placedValues, expectedValues);

        recordAnswer(isCorrect);

        const placedButtons = state.placedChoiceIds
            .map((choiceId) => getChoiceButton(choiceId))
            .filter(Boolean);

        Array.from(elements.choices.querySelectorAll("button")).forEach((node) => {
            node.disabled = true;
        });

        placedButtons.forEach((button) => {
            const panel = button.querySelector(".edu-choice-card");
            if (panel) panel.classList.add(isCorrect ? "success" : "fail");
        });

        if (elements.answerSlot) {
            elements.answerSlot.classList.remove("ready");
            elements.answerSlot.classList.add(isCorrect ? "success" : "fail");
        }

        if (isCorrect) {
            state.score += 10 + state.level + (state.challenge.requiredCards > 1 ? 4 : 0);
            state.streak += 1;
            state.bestStreak = Math.max(state.bestStreak, state.streak);
            setFeedback("Correct! Great placement.", true);
            CommonUtils.playSound("win");
        } else {
            state.streak = 0;
            const answerText = expectedValues.join(" + ");
            setFeedback(`Try again. Correct was ${answerText}.`, false);
            CommonUtils.playSound("error");
        }

        if (state.autoLevel) {
            const rate = EducationalUtils.calculateSuccessRate(state.recentAnswers);
            state.level = EducationalUtils.adjustDifficulty(state.level, rate, 1, 5);
            elements.levelSelect.value = String(state.level);
            if (state.level === 5 && rate > 0.85) {
                state.level = 1;
                elements.levelSelect.value = "1";
            }
        }

        updateStats();
        saveProgress();
        setTimeout(nextChallenge, 1050);
    }

    function recordAnswer(isCorrect) {
        state.recentAnswers.push(isCorrect);
        if (state.recentAnswers.length > state.maxRecentAnswers) {
            state.recentAnswers.shift();
        }
    }

    function setFeedback(text, good) {
        elements.feedback.textContent = text;
        elements.feedback.classList.remove("ok", "bad");
        if (!text) return;
        elements.feedback.classList.add(good ? "ok" : "bad");
    }

    function updateStats() {
        elements.score.textContent = String(state.score);
        elements.streak.textContent = String(state.streak);
        elements.bestStreak.textContent = String(state.bestStreak);
        const success = Math.round(EducationalUtils.calculateSuccessRate(state.recentAnswers) * 100);
        elements.correctRate.textContent = `${success}%`;
    }

    function sortByRankThenLabel(left, right) {
        const rankDiff = EducationalUtils.getRank(left) - EducationalUtils.getRank(right);
        if (rankDiff !== 0) return rankDiff;
        return String(left).localeCompare(String(right));
    }

    function arraysEqual(left, right) {
        if (left.length !== right.length) return false;
        for (let i = 0; i < left.length; i += 1) {
            if (left[i] !== right[i]) return false;
        }
        return true;
    }

    function pickRandom(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function pickTwoDistinct(list, count) {
        const shuffled = EducationalUtils.shuffle(list);
        return shuffled.slice(0, count);
    }

    function randomSuit() {
        return SUITS[Math.floor(Math.random() * SUITS.length)];
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
