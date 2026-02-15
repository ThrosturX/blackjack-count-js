(function () {
    "use strict";

    const CHALLENGE_TYPES = {
        MISSING_ADDEND: "missing-addend",
        SUBTRACT_TO_TARGET: "subtract-to-target",
        FIND_SUM: "find-sum",
        BALANCE_TWO_CARD_SIDE: "balance-two-card-side"
    };

    const LEVELS = {
        1: {
            values: ["A", "2", "3", "4", "5"],
            challengeTypes: [CHALLENGE_TYPES.MISSING_ADDEND],
            choiceRange: [2, 2]
        },
        2: {
            values: ["A", "2", "3", "4", "5", "6", "7", "8"],
            challengeTypes: [CHALLENGE_TYPES.MISSING_ADDEND, CHALLENGE_TYPES.FIND_SUM],
            choiceRange: [3, 3]
        },
        3: {
            values: ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q"],
            challengeTypes: [CHALLENGE_TYPES.MISSING_ADDEND, CHALLENGE_TYPES.FIND_SUM, CHALLENGE_TYPES.SUBTRACT_TO_TARGET],
            choiceRange: [4, 4]
        },
        4: {
            values: ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"],
            challengeTypes: [CHALLENGE_TYPES.MISSING_ADDEND, CHALLENGE_TYPES.FIND_SUM, CHALLENGE_TYPES.SUBTRACT_TO_TARGET],
            choiceRange: [6, 8]
        },
        5: {
            values: VALUES.slice(),
            challengeTypes: [
                CHALLENGE_TYPES.MISSING_ADDEND,
                CHALLENGE_TYPES.FIND_SUM,
                CHALLENGE_TYPES.SUBTRACT_TO_TARGET,
                CHALLENGE_TYPES.BALANCE_TWO_CARD_SIDE
            ],
            choiceRange: [8, 8]
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
        maxRecentAnswers: 12,
        autoLevelBatch: []
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
        elements.resetStats = document.getElementById("math-reset-stats");
        elements.board = document.getElementById("table");
    }

    function bindEvents() {
        elements.levelSelect.addEventListener("change", (event) => {
            state.level = clampLevel(parseInt(event.target.value, 10));
            // User manually selected a level - we allow this even if auto-level is on.
            // If they want to "maintain" this level, they should uncheck auto-level manually.
            // But typically, auto-level means "adjust from here", so we don't disable it.
            // Regression fix: previously distinct control.
            saveProgress();
            nextChallenge();
        });

        elements.autoLevel.addEventListener("change", (event) => {
            state.autoLevel = event.target.checked;
            // Regression fix: Toggling auto-level should not reset difficulty to 1.
            // It just enables the logic for the *next* success/fail.
            saveProgress();
            nextChallenge();
        });

        elements.newChallenge.addEventListener("click", nextChallenge);
        elements.tableSelect?.addEventListener("change", syncThemeClasses);
        elements.deckSelect?.addEventListener("change", syncThemeClasses);
        elements.resetStats?.addEventListener("click", () => {
            SolitaireCheckModal.showConfirm({
                title: "Clear Math Stats",
                message: "This will reset your score and best streak. Continue?",
                confirmLabel: "Reset",
                cancelLabel: "Cancel"
            }).then(confirmed => {
                if (confirmed) resetStats();
            });
        });
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
        state.autoLevelBatch = Array.isArray(saved.autoLevelBatch) ? saved.autoLevelBatch : [];

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
            recentAnswers: state.recentAnswers,
            autoLevelBatch: state.autoLevelBatch
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
        const choiceCount = randomIntBetween(config.choiceRange[0], config.choiceRange[1]);

        if (state.level === 5 && challengeType === CHALLENGE_TYPES.BALANCE_TWO_CARD_SIDE) {
            return buildExpertBalanceChallenge(values, choiceCount);
        }

        if (state.level === 5 && challengeType === CHALLENGE_TYPES.MISSING_ADDEND && Math.random() < 0.45) {
            return buildExpertTwoCardMissing(values, choiceCount);
        }

        return buildSingleCardChallenge(challengeType, values, choiceCount);
    }

    function buildExpertTwoCardMissing(values, choiceCount) {
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
        const choices = buildChoiceObjects(expectedValues, values, choiceCount);

        return {
            prompt: "Place cards in ?",
            help: "Drag cards into ? (or tap card, then tap ?).",
            cue: { text: "🧩 Place 2 cards", tone: "blue" },
            expressionParts: [cardPart(left), symbolPart("+"), unknownPart(), symbolPart("+"), unknownPart(), symbolPart("="), numberPart(targetTotal)],
            requiredCards: 2,
            expectedValues,
            choices
        };
    }

    function buildExpertBalanceChallenge(values, choiceCount) {
        const valuePool = values.filter((value) => EducationalUtils.getRank(value) <= 10);
        const workingPool = valuePool.length >= 4 ? valuePool : values;
        const leftPair = pickTwoDistinct(workingPool, 2);
        const leftTotal = EducationalUtils.getRank(leftPair[0]) + EducationalUtils.getRank(leftPair[1]);

        const pairCandidates = [];
        for (let i = 0; i < workingPool.length; i += 1) {
            for (let j = i; j < workingPool.length; j += 1) {
                const left = workingPool[i];
                const right = workingPool[j];
                if (EducationalUtils.getRank(left) + EducationalUtils.getRank(right) === leftTotal) {
                    pairCandidates.push([left, right]);
                }
            }
        }

        let expectedValues = leftPair.slice().sort(sortByRankThenLabel);
        if (pairCandidates.length) {
            expectedValues = pickRandom(pairCandidates).slice().sort(sortByRankThenLabel);
        }

        const choices = buildChoiceObjects(expectedValues, values, choiceCount);

        return {
            prompt: "Balance both sides",
            help: "Place 2 cards in the right side so both sides are equal.",
            cue: { text: "⚖️ Balance equation", tone: "gold" },
            expressionParts: [cardPart(leftPair[0]), symbolPart("+"), cardPart(leftPair[1]), symbolPart("="), unknownPart(), symbolPart("+"), unknownPart()],
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

    function createStaticCardEl(value) {
        const card = new Card(randomSuit(), value);
        card.rotation = 0;
        return CommonUtils.createCardEl(card);
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

        const oldOverlay = elements.board.querySelector(".edu-solution-overlay");
        if (oldOverlay) oldOverlay.remove();

        elements.expression.innerHTML = "";
        elements.answerSlots = [];

        state.challenge.expressionParts.forEach((part) => {
            const node = document.createElement("div");

            if (part.type === "card") {
                node.className = "edu-card-shell";
                node.appendChild(createStaticCardEl(part.value));
            } else if (part.type === "unknown") {
                node.className = "edu-drop-slot";
                node.textContent = "?";
                node.dataset.slotIndex = String(elements.answerSlots.length);
                node.addEventListener("click", () => {
                    const slotIdx = parseInt(node.dataset.slotIndex, 10);
                    if (state.selectedChoiceId) {
                        placeChoiceInSlot(state.selectedChoiceId, slotIdx);
                        return;
                    }
                    removeChoiceFromSlot(slotIdx);
                });
                elements.answerSlots.push(node);
            } else if (part.type === "number") {
                node.className = "edu-pill edu-pill--number";
                const valNode = document.createElement("div");
                valNode.className = "edu-pill-value";
                valNode.textContent = String(part.value);
                node.appendChild(valNode);

                const visualNode = renderVisualTotal(part.value);
                node.appendChild(visualNode);
            } else {
                node.className = "edu-pill edu-pill--symbol";
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
            button.dataset.rank = String(EducationalUtils.getRank(choice.value));
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
            cardWrap.dataset.rankLabel = String(EducationalUtils.getRank(choice.value));
            cardWrap.appendChild(createStaticCardEl(choice.value));

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

    }

    function attachPointerDrag(button, choiceId) {
        let pointerId = null;
        let startX = 0;
        let startY = 0;
        let cardOffsetX = 0;
        let cardOffsetY = 0;
        let dragging = false;
        let ghost = null;

        const cleanup = (restoreCard) => {
            if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
            ghost = null;
            pointerId = null;
            if (restoreCard) {
                button.classList.remove("dragging-source");
            }
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

                const cardEl = button.querySelector(".card");
                if (cardEl) {
                    const cardRect = cardEl.getBoundingClientRect();
                    ghost = cardEl.cloneNode(true);
                    ghost.classList.add("edu-drag-ghost");
                    ghost.style.position = "fixed";
                    ghost.style.pointerEvents = "none";
                    ghost.style.zIndex = "3000";
                    ghost.style.width = `${cardRect.width}px`;
                    ghost.style.height = `${cardRect.height}px`;
                    ghost.style.margin = "0";
                    // Center ghost under pointer
                    cardOffsetX = cardRect.width / 2;
                    cardOffsetY = cardRect.height / 2;
                    ghost.style.left = `${event.clientX - cardOffsetX}px`;
                    ghost.style.top = `${event.clientY - cardOffsetY}px`;
                    document.body.appendChild(ghost);

                    // Hide card, show numeric placeholder
                    button.classList.add("dragging-source");
                }
            }

            if (dragging && ghost) {
                ghost.style.left = `${event.clientX - cardOffsetX}px`;
                ghost.style.top = `${event.clientY - cardOffsetY}px`;
                highlightSlotForPoint(event.clientX, event.clientY);
            }
        };

        const onUp = (event) => {
            if (event.pointerId !== pointerId) return;
            if (dragging) {
                const dropped = tryDropChoiceAtPoint(choiceId, event.clientX, event.clientY);
                if (!dropped) {
                    clearSlotHighlight();
                    cleanup(true); // restore card to choices
                    return;
                }
                // Dropped successfully — keep placeholder visible (button stays dragging-source)
                cleanup(false);
                return;
            }
            cleanup(true);
        };

        button.addEventListener("pointerdown", (event) => {
            if (button.disabled || state.answerLocked) return;
            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            window.addEventListener("pointermove", onMove, true);
            window.addEventListener("pointerup", onUp, true);
            window.addEventListener("pointercancel", onUp, true);
        });
    }

    function highlightSlotForPoint(x, y) {
        let overSlot = null;
        const target = document.elementFromPoint(x, y);
        if (target) {
            overSlot = elements.answerSlots.find(slot => slot === target || slot.contains(target));
        }
        elements.answerSlots.forEach(slot => {
            slot.classList.toggle("ready", slot === overSlot);
        });
    }

    function clearSlotHighlight() {
        elements.answerSlots.forEach(slot => slot.classList.remove("ready"));
    }

    function tryDropChoiceAtPoint(choiceId, x, y) {
        const target = document.elementFromPoint(x, y);
        if (!target) return false;
        const slot = elements.answerSlots.find(s => s === target || s.contains(target));
        if (!slot) return false;

        const slotIdx = parseInt(slot.dataset.slotIndex, 10);
        placeChoiceInSlot(choiceId, slotIdx);
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

        // Highlight all empty slots
        elements.answerSlots.forEach((slot, idx) => {
            if (!state.placedChoiceIds[idx]) {
                slot.classList.add("ready");
            }
        });
    }

    function getChoiceButton(choiceId) {
        return elements.choices.querySelector(`.edu-choice-button[data-choice-id="${choiceId}"]`);
    }

    function getChoiceById(choiceId) {
        return state.challenge.choices.find((choice) => choice.id === choiceId) || null;
    }

    function placeChoiceInSlot(choiceId, slotIdx) {
        if (state.answerLocked || !choiceId) return;
        if (state.placedChoiceIds.includes(choiceId)) return;

        // If slot is non-empty, we can either replace or just return.
        // For simplicity, if slot defined by index in placedChoiceIds is occupied, we don't auto-replace here unless we want to.
        if (state.placedChoiceIds[slotIdx]) {
            const oldId = state.placedChoiceIds[slotIdx];
            const oldButton = getChoiceButton(oldId);
            if (oldButton) {
                oldButton.disabled = false;
                oldButton.classList.remove("dragging-source");
            }
        }

        const choice = getChoiceById(choiceId);
        const button = getChoiceButton(choiceId);
        if (!choice || !button || button.disabled) return;

        state.placedChoiceIds[slotIdx] = choiceId;
        button.disabled = true;
        button.classList.remove("selected");
        state.selectedChoiceId = null;

        renderPlacedCards();

        const countValid = state.placedChoiceIds.filter(Boolean).length;
        if (countValid >= state.challenge.requiredCards) {
            evaluatePlacedChoices();
        }
    }

    function removeChoiceFromSlot(slotIdx) {
        if (state.answerLocked) return;
        const choiceId = state.placedChoiceIds[slotIdx];
        if (!choiceId) return;

        state.placedChoiceIds[slotIdx] = null;
        const button = getChoiceButton(choiceId);
        if (button) {
            button.disabled = false;
            button.classList.remove("dragging-source");
        }
        renderPlacedCards();
    }

    function renderPlacedCards() {
        elements.answerSlots.forEach((slot, slotIdx) => {
            slot.innerHTML = "";
            const choiceId = state.placedChoiceIds[slotIdx];
            if (!choiceId) {
                slot.textContent = "?";
                slot.classList.remove("success", "fail");
                return;
            }

            const choice = getChoiceById(choiceId);
            slot.appendChild(createStaticCardEl(choice.value));
            slot.classList.remove("ready");
        });
    }

    function renderVisualTotal(value) {
        const container = document.createElement("div");
        container.className = "edu-visual-total-container";

        const targetValue = parseInt(value, 10) || 0;

        // 1. Fan of cards (derived from value)
        const ranks = decomposeValueToRanks(targetValue);
        container.appendChild(renderFan(ranks));

        // 2. Numeric sum label
        const sumLabel = document.createElement("div");
        sumLabel.className = "edu-pill-sum";
        sumLabel.textContent = String(targetValue);
        container.appendChild(sumLabel);

        // 3. Dots/Pips
        container.appendChild(renderPips(targetValue));

        return container;
    }

    function renderFan(ranks) {
        const fan = document.createElement("div");
        fan.className = "edu-card-fan";
        ranks.forEach(rank => {
            const fanItem = document.createElement("div");
            fanItem.className = "edu-fan-card";
            fanItem.appendChild(createStaticCardEl(rank));
            fan.appendChild(fanItem);
        });
        return fan;
    }

    function renderPips(value) {
        const dotContainer = document.createElement("div");
        dotContainer.className = "edu-visual-total";
        const count = Math.min(30, parseInt(value, 10) || 0);

        for (let i = 0; i < count; i += 5) {
            const group = document.createElement("div");
            group.className = "edu-dot-group";
            const groupSize = Math.min(5, count - i);
            for (let j = 0; j < groupSize; j++) {
                const dot = document.createElement("div");
                dot.className = "edu-visual-dot";
                group.appendChild(dot);
            }
            dotContainer.appendChild(group);
        }
        return dotContainer;
    }

    function decomposeValueToRanks(value) {
        // We want two cards that sum to 'value'
        // Knights are present in Expert mode, check state.level
        const hasKnight = state.level === 5;
        const maxRank = hasKnight ? 14 : 13;

        if (value <= 1) return ["A"];

        // Try to find a pair
        for (let attempt = 0; attempt < 50; attempt++) {
            const r1 = Math.floor(Math.random() * Math.min(value, maxRank)) + 1;
            const r2 = value - r1;
            if (r2 >= 1 && r2 <= maxRank) {
                return [rankToValue(r1, hasKnight), rankToValue(r2, hasKnight)];
            }
        }

        // Fallback: use 3 cards if value is too large for 2
        if (value > maxRank * 2) {
            const r1 = maxRank;
            const r2 = maxRank;
            const r3 = value - (maxRank * 2);
            return [rankToValue(r1, hasKnight), rankToValue(r2, hasKnight), rankToValue(r3, hasKnight)];
        }

        // Ultimate fallback
        return [rankToValue(Math.min(value, maxRank), hasKnight)];
    }

    function rankToValue(rank, hasKnight) {
        if (rank === 1) return "A";
        if (rank <= 10) return String(rank);
        if (rank === 11) return "J";
        if (rank === 12) return hasKnight ? "C" : "Q";
        if (rank === 13) return hasKnight ? "Q" : "K";
        if (rank === 14) return "K";
        return "10";
    }

    function evaluatePlacedChoices() {
        if (state.answerLocked) return;
        state.answerLocked = true;

        const placedValues = state.placedChoiceIds.map((id) => getChoiceById(id)?.value).filter(Boolean);

        const isCorrect = validateExpression(state.challenge.expressionParts, placedValues);
        recordAnswer(isCorrect);

        const placedButtons = state.placedChoiceIds.map((choiceId) => getChoiceButton(choiceId)).filter(Boolean);
        Array.from(elements.choices.querySelectorAll("button")).forEach((node) => { node.disabled = true; });
        placedButtons.forEach((button) => {
            const panel = button.querySelector(".edu-choice-card");
            if (panel) panel.classList.add(isCorrect ? "success" : "fail");
        });

        elements.answerSlots.forEach((slot) => {
            slot.classList.remove("ready");
            slot.classList.add(isCorrect ? "success" : "fail");
        });

        if (isCorrect) {
            state.score += 10 + state.level + (state.challenge.requiredCards > 1 ? 4 : 0);
            state.streak += 1;
            state.bestStreak = Math.max(state.bestStreak, state.streak);
            setFeedback("Correct! Great placement.", true);
            CommonUtils.playSound("win");
            setTimeout(nextChallenge, 1050);
        } else {
            state.streak = 0;
            setFeedback(`Try again. (Tap to continue)`, false);
            CommonUtils.playSound("error");

            // Highlight incorrect slots
            elements.answerSlots.forEach(slot => {
                slot.classList.add("fail");
            });

            renderSolutionFans();
        }

        if (state.autoLevel) {
            const batch = EducationalUtils.consumeAutoLevelBatch(state.autoLevelBatch, isCorrect, 7);
            if (batch) {
                state.level = EducationalUtils.adjustDifficultyFromBatch(state.level, batch, 1, 5, 6, 4);
                elements.levelSelect.value = String(state.level);
            }
        }
        updateStats();
        saveProgress();
    }

    function validateExpression(expressionParts, placedValues) {
        // Collect all card values involved to establish context (e.g., presence of a Knight)
        const allCardValues = [
            ...expressionParts.filter(p => p.type === "card").map(p => p.value),
            ...placedValues
        ];

        let placedIdx = 0;
        const ranks = expressionParts.map(part => {
            if (part && part.type === "unknown") {
                const val = placedValues[placedIdx++];
                return val ? EducationalUtils.getRank(val, allCardValues) : null;
            }
            if (part && part.type === "card") return EducationalUtils.getRank(part.value, allCardValues);
            if (part && part.type === "number") return parseInt(part.value, 10);
            // Use .text instead of .value for symbols
            return part ? (part.value !== undefined ? part.value : part.text) : null;
        });

        const eqIdx = ranks.indexOf("=");
        if (eqIdx === -1) return false;

        const evalSide = (side) => {
            if (side.length === 0) return 0;
            // First item should be a number
            let total = typeof side[0] === 'number' ? side[0] : NaN;
            for (let i = 1; i < side.length; i += 2) {
                const op = side[i];
                const val = side[i + 1];
                if (typeof val !== 'number') return NaN;
                if (op === "+") total += val;
                else if (op === "-") total -= val;
            }
            return total;
        };

        const leftTotal = evalSide(ranks.slice(0, eqIdx));
        const rightTotal = evalSide(ranks.slice(eqIdx + 1));

        return !isNaN(leftTotal) && !isNaN(rightTotal) && leftTotal === rightTotal;
    }

    function resetStats() {
        state.score = 0; state.streak = 0; state.bestStreak = 0;
        state.totalPlayed = 0; state.correctAnswers = 0;
        state.recentAnswers = [];
        updateStats(); nextChallenge();
    }

    function renderSolutionFans() {
        const parts = state.challenge.expressionParts;
        const eqIdx = parts.findIndex(p => p.text === "=");
        if (eqIdx === -1) return;

        // --- 1. Calculate Expected Values & Totals ---
        let expIdx = 0;
        const mapPartToValues = (part) => {
            if (part.type === "card") return [part.value];
            if (part.type === "unknown") {
                const val = state.challenge.expectedValues[expIdx];
                // Increment only if we access it, but filter might call this multiple times if we aren't careful.
                // Better to map first, then sum.
                return [val];
            }
            return [];
        };

        // We need a stable mapping of unknowns to expected values
        let unknownCounter = 0;
        const resolvedParts = parts.map(p => {
            if (p.type === "unknown") {
                const val = state.challenge.expectedValues[unknownCounter++];
                return { ...p, value: val, resolved: true };
            }
            return p;
        });

        const leftParts = resolvedParts.slice(0, eqIdx);
        const rightParts = resolvedParts.slice(eqIdx + 1);

        // Calculate totals for context (using all cards in play)
        const allCardValues = resolvedParts
            .filter(p => p.type === "card" || p.resolved)
            .map(p => p.value);

        const getPartValue = (p) => {
            if (p.type === "number") return parseInt(p.value, 10);
            if (p.type === "card" || p.resolved) return EducationalUtils.getRank(p.value, allCardValues);
            return 0;
        };

        // --- 2. Render Equation Visualizer ---
        const overlay = document.createElement("div");
        overlay.className = "edu-solution-overlay";

        const title = document.createElement("div");
        title.className = "edu-subtle";
        title.textContent = "Correct Logic:";
        overlay.appendChild(title);

        const fans = document.createElement("div");
        fans.className = "edu-solution-fans";

        // Helper to render a single part (Stack)
        const renderPart = (p) => {
            const container = document.createElement("div");
            container.className = "edu-solution-stack";

            if (p.type === "symbol") {
                const sym = document.createElement("div");
                sym.textContent = p.text;
                // Add specific class based on symbol content
                if (p.text === "+") sym.className = "edu-sol-symbol edu-sol-symbol--plus";
                else if (p.text === "-") sym.className = "edu-sol-symbol edu-sol-symbol--minus";
                else sym.className = "edu-sol-symbol"; // Fallback/Equals (though equals is handled separately below)

                return sym;
            }

            let val = 0;

            if (p.type === "number") {
                val = parseInt(p.value, 10);
                const ranks = decomposeValueToRanks(val);
                container.appendChild(renderFan(ranks));
            } else if (p.type === "card" || p.resolved) {
                val = EducationalUtils.getRank(p.value, allCardValues);
                // Card Stack: [Card] [Value Pill] [Pips]
                const cardDiv = document.createElement("div");
                cardDiv.className = "edu-solution-card-wrapper";
                cardDiv.appendChild(createStaticCardEl(p.value));
                container.appendChild(cardDiv);
            }

            // [Value Pill]
            const pill = document.createElement("div");
            pill.className = "edu-pill-sum";
            pill.textContent = String(val);
            container.appendChild(pill);

            // [Pips]
            container.appendChild(renderPips(val));

            return container;
        };

        // Render Left Side
        const leftContainer = document.createElement("div");
        leftContainer.className = "edu-solution-side";
        leftParts.forEach(p => leftContainer.appendChild(renderPart(p)));
        fans.appendChild(leftContainer);

        // Render Equals
        const eq = document.createElement("div");
        eq.textContent = "=";
        eq.className = "edu-sol-symbol edu-sol-symbol--equals";
        fans.appendChild(eq);

        // Render Right Side
        // Special case: If RHS was just a "?", we want to show the CARD result
        // If RHS was "10 + 2", we show that structure too? 
        // User requested: "RHS must contain a single card" if the exercise was "?". 
        // But if the exercise was "Search for total", the structure IS "Card + Card = ?"
        // The resolvedParts handle this naturally.
        const rightContainer = document.createElement("div");
        rightContainer.className = "edu-solution-side";
        rightParts.forEach(p => rightContainer.appendChild(renderPart(p)));
        fans.appendChild(rightContainer);

        overlay.appendChild(fans);

        const tap = document.createElement("div");
        tap.className = "edu-subtle";
        tap.style.marginTop = "6px";
        tap.textContent = "(Tap to continue)";
        overlay.appendChild(tap);

        // Wrap in a backdrop
        const backdrop = document.createElement("div");
        backdrop.className = "edu-modal-backdrop";
        backdrop.appendChild(overlay);

        document.body.appendChild(backdrop);

        // Ensure dismissal removes the backdrop
        // We attach the listener to the backdrop to catch clicks outside the content too, 
        // effectively treating the whole screen as the "tap to continue" surface.
        const dismiss = (e) => {
            // If the user taps, we dismiss. 
            // We do NOT want scrolling drags to dismiss, so we stick to 'click'.

            // Optional: check if e.target is the backdrop itself if needed,
            // but the prompt says "Tap to continue" and "attempting to scroll will close correct answer". 
            // If the user scrolls, they are doing a touch-move sequence. That's not a click.
            // So a simple 'click' listener is usually safe. 
            // However, to be extra safe against accidental taps while scrolling:
            // Browsers usually suppress 'click' if a scroll occurred.

            e.preventDefault();
            e.stopPropagation();

            backdrop.removeEventListener("click", dismiss);
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
            nextChallenge();
        };

        backdrop.addEventListener("click", dismiss);

        // --- 3. Dynamic Layout Adjustment ---
        // Final polish: calculate if cards protrude and adjust padding/gap to prevent overlap.
        // We do this after adding to body so getBoundingClientRect() is valid.
        adjustSolutionLayout(overlay);
    }

    function adjustSolutionLayout(overlay) {
        const sides = overlay.querySelectorAll(".edu-solution-side");
        let maxProtrusion = 0;

        sides.forEach(side => {
            const sideRect = side.getBoundingClientRect();
            const cards = side.querySelectorAll(".card");

            cards.forEach(card => {
                const cardRect = card.getBoundingClientRect();
                // Protrusion is how much the card sticks out ABOVE the side's top margin/boundary.
                // We use sideRect.top to find the container's visual start.
                const protrusion = sideRect.top - cardRect.top;
                if (protrusion > maxProtrusion) {
                    maxProtrusion = protrusion;
                }
            });
        });

        if (maxProtrusion > 0) {
            // Apply padding to containers and increased row-gap to parents to push rows apart.
            const fans = overlay.querySelector(".edu-solution-fans");
            if (fans) {
                // Buffer plus the protrusion
                const buffer = 12;
                fans.style.rowGap = `${24 + maxProtrusion}px`;
                sides.forEach(side => {
                    side.style.paddingTop = `${buffer + maxProtrusion}px`;
                    // Ensure the side is tall enough to prevent RHS cards from hitting LHS bottom
                    side.style.minHeight = "120px";
                });
            }
        }
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

    function randomIntBetween(min, max) {
        if (min >= max) return min;
        return min + Math.floor(Math.random() * (max - min + 1));
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
