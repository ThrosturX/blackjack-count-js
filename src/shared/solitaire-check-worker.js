/* eslint-disable no-restricted-globals */
(function () {
    function cloneState(state) {
        return JSON.parse(JSON.stringify(state));
    }

    function cardColor(suit) {
        return (suit === '♥' || suit === '♦') ? 'red' : 'black';
    }

    function canPlaceOnTableau(card, targetCard) {
        if (!card || !targetCard) return false;
        const colorA = card.color || cardColor(card.suit);
        const colorB = targetCard.color || cardColor(targetCard.suit);
        if (colorA === colorB) return false;
        return card.rank === targetCard.rank - 1;
    }

    function canPlaceOnFoundation(card, foundationPile) {
        if (!card) return false;
        if (!foundationPile || foundationPile.length === 0) {
            return card.val === 'A' || card.rank === 1;
        }
        const top = foundationPile[foundationPile.length - 1];
        if (card.suit !== top.suit) return false;
        return card.rank === top.rank + 1;
    }

    function isWon(foundations) {
        return Array.isArray(foundations) && foundations.length === 4
            && foundations.every((pile) => Array.isArray(pile) && pile.length === 13);
    }

    function normalizeFreecellState(state) {
        const tableauKey = state.tableau.map((column) => column.map(cardId).join(',')).join('|');
        const freeCellsKey = state.freeCells.map((card) => (card ? cardId(card) : '_')).join(',');
        const foundationKey = state.foundations.map((pile) => String(pile.length)).join(',');
        return `T:${tableauKey}|C:${freeCellsKey}|F:${foundationKey}`;
    }

    function cardId(card) {
        return `${card.suit}${card.val}`;
    }

    function getMaxMovableCards(state, sourceCol, targetCol, movingCount) {
        const emptyFreeCells = state.freeCells.filter((card) => !card).length;
        let emptyColumns = state.tableau.filter((column) => column.length === 0).length;
        if (state.tableau[targetCol].length === 0) emptyColumns -= 1;
        const sourceColumn = state.tableau[sourceCol];
        if (sourceColumn && sourceColumn.length === movingCount) emptyColumns += 1;
        emptyColumns = Math.max(0, emptyColumns);
        return (emptyFreeCells + 1) * Math.pow(2, emptyColumns);
    }

    function getTableauSequence(column, startIndex) {
        if (!column || startIndex < 0 || startIndex >= column.length) return null;
        const sequence = column.slice(startIndex);
        for (let i = 1; i < sequence.length; i++) {
            if (!canPlaceOnTableau(sequence[i], sequence[i - 1])) return null;
        }
        return sequence;
    }

    function canPlaceSequenceOnTableau(baseCard, targetPile) {
        if (!baseCard) return false;
        if (!Array.isArray(targetPile) || targetPile.length === 0) return true;
        return canPlaceOnTableau(baseCard, targetPile[targetPile.length - 1]);
    }

    function foundationRanks(foundations) {
        const ranks = { '♥': 0, '♦': 0, '♠': 0, '♣': 0 };
        for (let i = 0; i < foundations.length; i++) {
            const pile = foundations[i];
            if (!pile || pile.length === 0) continue;
            const top = pile[pile.length - 1];
            if (top && top.suit && Number.isFinite(top.rank)) {
                ranks[top.suit] = top.rank;
            }
        }
        return ranks;
    }

    function isSafePromotion(card, foundations) {
        if (!card || !Number.isFinite(card.rank)) return false;
        if (card.rank <= 2) return true;
        const bySuit = foundationRanks(foundations);
        const rank = card.rank;
        if (card.suit === '♥') return Math.min(bySuit['♠'], bySuit['♣']) >= rank - 1 && bySuit['♦'] >= rank - 2;
        if (card.suit === '♦') return Math.min(bySuit['♠'], bySuit['♣']) >= rank - 1 && bySuit['♥'] >= rank - 2;
        if (card.suit === '♠') return Math.min(bySuit['♥'], bySuit['♦']) >= rank - 1 && bySuit['♣'] >= rank - 2;
        if (card.suit === '♣') return Math.min(bySuit['♥'], bySuit['♦']) >= rank - 1 && bySuit['♠'] >= rank - 2;
        return false;
    }

    function foundationTarget(state, card) {
        for (let i = 0; i < state.foundations.length; i++) {
            if (canPlaceOnFoundation(card, state.foundations[i])) return i;
        }
        return -1;
    }

    function applyForcedSafeFoundationClosure(state) {
        while (true) {
            const candidates = [];
            for (let cellIndex = 0; cellIndex < state.freeCells.length; cellIndex++) {
                const card = state.freeCells[cellIndex];
                if (!card) continue;
                const foundationIndex = foundationTarget(state, card);
                if (foundationIndex === -1) continue;
                if (!isSafePromotion(card, state.foundations)) continue;
                candidates.push({ from: 'freecell', sourceIndex: cellIndex, foundationIndex, rank: card.rank });
            }
            for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol++) {
                const source = state.tableau[sourceCol];
                if (!source || source.length === 0) continue;
                const card = source[source.length - 1];
                const foundationIndex = foundationTarget(state, card);
                if (foundationIndex === -1) continue;
                if (!isSafePromotion(card, state.foundations)) continue;
                candidates.push({ from: 'tableau', sourceIndex: sourceCol, foundationIndex, rank: card.rank });
            }
            if (candidates.length === 0) break;
            candidates.sort((a, b) => a.rank - b.rank);
            const move = candidates[0];
            if (move.from === 'freecell') {
                const card = state.freeCells[move.sourceIndex];
                if (!card) continue;
                state.freeCells[move.sourceIndex] = null;
                state.foundations[move.foundationIndex].push(card);
            } else {
                const source = state.tableau[move.sourceIndex];
                if (!source || source.length === 0) continue;
                state.foundations[move.foundationIndex].push(source.pop());
            }
        }
    }

    function hasAnyFreecellForwardMove(state) {
        for (let c = 0; c < state.freeCells.length; c++) {
            const card = state.freeCells[c];
            if (!card) continue;
            for (let f = 0; f < state.foundations.length; f++) {
                if (canPlaceOnFoundation(card, state.foundations[f])) return true;
            }
        }
        for (let s = 0; s < state.tableau.length; s++) {
            const column = state.tableau[s];
            if (!column || column.length === 0) continue;
            const top = column[column.length - 1];
            for (let f = 0; f < state.foundations.length; f++) {
                if (canPlaceOnFoundation(top, state.foundations[f])) return true;
            }
        }

        const emptyCellIndex = state.freeCells.findIndex((cell) => !cell);
        if (emptyCellIndex !== -1 && state.tableau.some((column) => column && column.length > 0)) {
            return true;
        }

        for (let c = 0; c < state.freeCells.length; c++) {
            const card = state.freeCells[c];
            if (!card) continue;
            for (let t = 0; t < state.tableau.length; t++) {
                const target = state.tableau[t];
                if (!target || target.length === 0) return true;
                if (canPlaceOnTableau(card, target[target.length - 1])) return true;
            }
        }

        for (let s = 0; s < state.tableau.length; s++) {
            const source = state.tableau[s];
            if (!source || source.length === 0) continue;
            for (let startIndex = source.length - 1; startIndex >= 0; startIndex--) {
                const sequence = getTableauSequence(source, startIndex);
                if (!sequence) continue;
                const movingCount = sequence.length;
                for (let t = 0; t < state.tableau.length; t++) {
                    if (t === s) continue;
                    if (!canPlaceSequenceOnTableau(sequence[0], state.tableau[t])) continue;
                    if (movingCount <= getMaxMovableCards(state, s, t, movingCount)) return true;
                }
            }
        }
        return false;
    }

    function listFreecellMoves(state) {
        const moves = [];
        for (let cellIndex = 0; cellIndex < state.freeCells.length; cellIndex++) {
            const card = state.freeCells[cellIndex];
            if (!card) continue;
            for (let f = 0; f < state.foundations.length; f++) {
                if (canPlaceOnFoundation(card, state.foundations[f])) {
                    moves.push({ type: 'freecell-to-foundation', cellIndex, foundationIndex: f, priority: 4 });
                }
            }
        }
        for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol++) {
            const column = state.tableau[sourceCol];
            if (!column || column.length === 0) continue;
            const top = column[column.length - 1];
            for (let f = 0; f < state.foundations.length; f++) {
                if (canPlaceOnFoundation(top, state.foundations[f])) {
                    moves.push({ type: 'tableau-to-foundation', sourceCol, foundationIndex: f, priority: 4 });
                }
            }
        }
        const emptyCellIndex = state.freeCells.findIndex((cell) => !cell);
        if (emptyCellIndex !== -1) {
            for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol++) {
                const column = state.tableau[sourceCol];
                if (!column || column.length === 0) continue;
                moves.push({ type: 'tableau-to-freecell', sourceCol, cellIndex: emptyCellIndex, priority: 2 });
            }
        }
        for (let cellIndex = 0; cellIndex < state.freeCells.length; cellIndex++) {
            const card = state.freeCells[cellIndex];
            if (!card) continue;
            for (let targetCol = 0; targetCol < state.tableau.length; targetCol++) {
                const target = state.tableau[targetCol];
                if (!target || target.length === 0 || canPlaceOnTableau(card, target[target.length - 1])) {
                    moves.push({ type: 'freecell-to-tableau', cellIndex, targetCol, priority: 2 });
                }
            }
        }
        for (let sourceCol = 0; sourceCol < state.tableau.length; sourceCol++) {
            const source = state.tableau[sourceCol];
            if (!source || source.length === 0) continue;
            for (let startIndex = source.length - 1; startIndex >= 0; startIndex--) {
                const sequence = getTableauSequence(source, startIndex);
                if (!sequence) continue;
                const movingCount = sequence.length;
                for (let targetCol = 0; targetCol < state.tableau.length; targetCol++) {
                    if (targetCol === sourceCol) continue;
                    if (!canPlaceSequenceOnTableau(sequence[0], state.tableau[targetCol])) continue;
                    if (movingCount > getMaxMovableCards(state, sourceCol, targetCol, movingCount)) continue;
                    moves.push({ type: 'tableau-to-tableau', sourceCol, targetCol, startIndex, count: movingCount, priority: movingCount > 1 ? 3 : 1 });
                }
            }
        }
        moves.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        return moves;
    }

    function applyFreecellMove(state, move) {
        const next = {
            tableau: state.tableau.map((column) => column.slice()),
            freeCells: state.freeCells.slice(),
            foundations: state.foundations.map((pile) => pile.slice())
        };
        if (move.type === 'tableau-to-foundation') {
            const source = next.tableau[move.sourceCol];
            if (!source || source.length === 0) return null;
            next.foundations[move.foundationIndex].push(source.pop());
            return next;
        }
        if (move.type === 'freecell-to-foundation') {
            const card = next.freeCells[move.cellIndex];
            if (!card) return null;
            next.freeCells[move.cellIndex] = null;
            next.foundations[move.foundationIndex].push(card);
            return next;
        }
        if (move.type === 'tableau-to-freecell') {
            const source = next.tableau[move.sourceCol];
            if (!source || source.length === 0 || next.freeCells[move.cellIndex]) return null;
            next.freeCells[move.cellIndex] = source.pop();
            return next;
        }
        if (move.type === 'freecell-to-tableau') {
            const card = next.freeCells[move.cellIndex];
            if (!card || !next.tableau[move.targetCol]) return null;
            next.freeCells[move.cellIndex] = null;
            next.tableau[move.targetCol].push(card);
            return next;
        }
        if (move.type === 'tableau-to-tableau') {
            const source = next.tableau[move.sourceCol];
            const target = next.tableau[move.targetCol];
            if (!source || !target) return null;
            const moving = source.splice(move.startIndex, move.count);
            if (!moving || moving.length === 0) return null;
            target.push.apply(target, moving);
            return next;
        }
        return null;
    }

    function runFreecellCheck(snapshot, limits) {
        const startedAt = Date.now();
        const maxStates = Number.isFinite(limits.maxStates) ? Math.max(1, limits.maxStates) : 50000;
        const maxDurationMs = Number.isFinite(limits.maxDurationMs) ? Math.max(1, limits.maxDurationMs) : 5000;
        const visited = new Set();
        const stack = [];
        const parentByKey = new Map();
        const moveByKey = new Map();
        let prunedStates = 0;
        let statesExplored = 0;

        const start = cloneState(snapshot);
        applyForcedSafeFoundationClosure(start);
        if (!hasAnyFreecellForwardMove(start) && !isWon(start.foundations)) {
            return {
                solved: false,
                reason: 'exhausted',
                statesExplored: 0,
                prunedStates: 1,
                durationMs: Date.now() - startedAt,
                maxStates,
                maxDurationMs,
                provenUnsolvable: true
            };
        }
        const startKey = normalizeFreecellState(start);
        visited.add(startKey);
        stack.push({ state: start, key: startKey });
        parentByKey.set(startKey, null);
        moveByKey.set(startKey, null);

        while (stack.length > 0) {
            if (statesExplored >= maxStates) {
                return { solved: false, reason: 'state-limit', statesExplored, prunedStates, durationMs: Date.now() - startedAt, maxStates, maxDurationMs };
            }
            if ((Date.now() - startedAt) >= maxDurationMs) {
                return { solved: false, reason: 'time-limit', statesExplored, prunedStates, durationMs: Date.now() - startedAt, maxStates, maxDurationMs };
            }

            const current = stack.pop();
            const state = current.state;
            const stateKey = current.key;
            statesExplored++;
            if (isWon(state.foundations)) {
                const path = reconstructSolutionPath(stateKey, parentByKey, moveByKey);
                return {
                    solved: true,
                    reason: 'solved',
                    statesExplored,
                    prunedStates,
                    durationMs: Date.now() - startedAt,
                    maxStates,
                    maxDurationMs,
                    solutionMoves: path.solutionMoves,
                    solutionStateKeys: path.solutionStateKeys
                };
            }
            if (!hasAnyFreecellForwardMove(state)) {
                prunedStates++;
                continue;
            }

            const moves = listFreecellMoves(state);
            for (let i = moves.length - 1; i >= 0; i--) {
                const move = moves[i];
                const next = applyFreecellMove(state, move);
                if (!next) continue;
                applyForcedSafeFoundationClosure(next);
                if (!hasAnyFreecellForwardMove(next) && !isWon(next.foundations)) {
                    prunedStates++;
                    continue;
                }
                const key = normalizeFreecellState(next);
                if (visited.has(key)) continue;
                visited.add(key);
                parentByKey.set(key, stateKey);
                moveByKey.set(key, move);
                stack.push({ state: next, key: key });
            }
        }

        return {
            solved: false,
            reason: 'exhausted',
            statesExplored,
            prunedStates,
            durationMs: Date.now() - startedAt,
            maxStates,
            maxDurationMs,
            provenUnsolvable: true
        };
    }

    function cloneKlondikeState(snapshot) {
        return {
            tableau: snapshot.tableau.map((column) => column.map((card) => Object.assign({}, card))),
            foundations: snapshot.foundations.map((pile) => pile.map((card) => Object.assign({}, card))),
            stock: snapshot.stock.map((card) => Object.assign({}, card)),
            waste: snapshot.waste.map((card) => Object.assign({}, card))
        };
    }

    function countHidden(tableau) {
        return tableau.reduce((sum, column) => sum + column.reduce((colSum, card) => colSum + (card.hidden ? 1 : 0), 0), 0);
    }

    function countFoundations(foundations) {
        return foundations.reduce((sum, pile) => sum + pile.length, 0);
    }

    function serializeCard(card, includeHidden) {
        if (!card) return '__';
        const rank = Number.isFinite(card.rank) ? card.rank : String(card.rank || '?');
        const suit = card.suit || '?';
        if (!includeHidden) return rank + suit;
        return rank + suit + (card.hidden ? 'h' : 'u');
    }

    function serializePile(pile, includeHidden) {
        if (!pile || pile.length === 0) return '';
        return pile.map(function (card) { return serializeCard(card, includeHidden); }).join(',');
    }

    function normalizeKlondikeCheckState(state) {
        return state.tableau.map(function (col) { return serializePile(col, true); }).join('|')
            + '#'
            + state.foundations.map(function (pile) { return serializePile(pile, false); }).join('|')
            + '#'
            + serializePile(state.stock, true)
            + '#'
            + serializePile(state.waste, false);
    }

    function normalizePyramidCheckState(state) {
        var pyramid = state.pyramid.map(function (row) {
            return row.map(function (card) { return serializeCard(card, false); }).join(',');
        }).join('|');
        return pyramid + '#' + serializePile(state.stock, false) + '#' + serializePile(state.waste, false);
    }

    function normalizeSpiderCheckState(state) {
        var tableau = state.tableau.map(function (col) { return serializePile(col, true); }).join('|');
        return tableau + '#' + serializePile(state.stock, true) + '#' + state.foundations.join(',');
    }

    function reconstructSolutionPath(goalKey, parentByKey, moveByKey) {
        if (!goalKey || !parentByKey.has(goalKey)) {
            return { solutionMoves: [], solutionStateKeys: [] };
        }
        var reversedStateKeys = [];
        var reversedMoves = [];
        var key = goalKey;
        while (key !== null && key !== undefined) {
            reversedStateKeys.push(key);
            var move = moveByKey.get(key);
            if (move) reversedMoves.push(move);
            key = parentByKey.get(key);
        }
        return {
            solutionMoves: reversedMoves.reverse(),
            solutionStateKeys: reversedStateKeys.reverse()
        };
    }

    function applyKlondikeAutoMoves(state) {
        let moved = false;
        while (true) {
            let found = false;
            if (state.waste.length > 0) {
                const wasteCard = state.waste[state.waste.length - 1];
                for (let f = 0; f < 4; f++) {
                    if (canPlaceOnFoundation(wasteCard, state.foundations[f])) {
                        state.foundations[f].push(state.waste.pop());
                        moved = true;
                        found = true;
                        break;
                    }
                }
                if (found) continue;
            }
            for (let col = 0; col < 7 && !found; col++) {
                const pile = state.tableau[col];
                if (!pile || pile.length === 0) continue;
                const top = pile[pile.length - 1];
                if (top.hidden) continue;
                for (let f = 0; f < 4; f++) {
                    if (canPlaceOnFoundation(top, state.foundations[f])) {
                        state.foundations[f].push(pile.pop());
                        if (pile.length > 0 && pile[pile.length - 1].hidden) pile[pile.length - 1].hidden = false;
                        moved = true;
                        found = true;
                        break;
                    }
                }
            }
            if (!found) break;
        }
        return moved;
    }

    function canMoveToEmptyKlondike(card, allowAnyCardOnEmpty) {
        if (!card) return false;
        return allowAnyCardOnEmpty ? true : card.val === 'K';
    }

    function isMovableKlondikeSequence(pile, startIndex) {
        if (!pile || startIndex < 0 || startIndex >= pile.length) return false;
        for (let i = startIndex; i < pile.length; i++) {
            if (!pile[i] || pile[i].hidden) return false;
        }
        for (let i = startIndex; i < pile.length - 1; i++) {
            if (!canPlaceOnTableau(pile[i + 1], pile[i])) return false;
        }
        return true;
    }

    function listKlondikeTableauMoves(state, allowAnyCardOnEmpty, config) {
        const opts = config || {};
        const requireRevealHidden = opts.requireRevealHidden !== false;
        const prioritizeRevealHidden = opts.prioritizeRevealHidden !== false;
        const allowSequences = !!opts.allowSequences;
        const moves = [];
        for (let sourceCol = 0; sourceCol < 7; sourceCol++) {
            const source = state.tableau[sourceCol];
            if (!source || source.length === 0) continue;
            const startIndexes = allowSequences
                ? Array.from({ length: source.length }, function (_, idx) { return idx; })
                : [source.length - 1];
            for (let s = 0; s < startIndexes.length; s++) {
                const startIndex = startIndexes[s];
                if (!isMovableKlondikeSequence(source, startIndex)) continue;
                const moving = source[startIndex];
                const movingCount = source.length - startIndex;
                const revealsHidden = startIndex > 0 && source[startIndex - 1].hidden;
                if (requireRevealHidden && !revealsHidden) continue;
                for (let targetCol = 0; targetCol < 7; targetCol++) {
                    if (targetCol === sourceCol) continue;
                    const target = state.tableau[targetCol];
                    let valid = false;
                    if (!target || target.length === 0) {
                        valid = canMoveToEmptyKlondike(moving, allowAnyCardOnEmpty);
                    } else {
                        const top = target[target.length - 1];
                        if (!top.hidden) valid = canPlaceOnTableau(moving, top);
                    }
                    if (!valid) continue;
                    moves.push({
                        type: 'tableau-to-tableau',
                        sourceCol: sourceCol,
                        targetCol: targetCol,
                        startIndex: startIndex,
                        count: movingCount,
                        revealsHidden: revealsHidden
                    });
                }
            }
        }
        if (prioritizeRevealHidden) {
            moves.sort(function (a, b) { return Number(b.revealsHidden) - Number(a.revealsHidden); });
        }
        return moves;
    }

    function listKlondikeWasteToTableauMoves(state, allowAnyCardOnEmpty) {
        if (state.waste.length === 0) return [];
        const moving = state.waste[state.waste.length - 1];
        const moves = [];
        for (let targetCol = 0; targetCol < 7; targetCol++) {
            const target = state.tableau[targetCol];
            let valid = false;
            if (!target || target.length === 0) {
                valid = canMoveToEmptyKlondike(moving, allowAnyCardOnEmpty);
            } else {
                const top = target[target.length - 1];
                if (!top.hidden) valid = canPlaceOnTableau(moving, top);
            }
            if (!valid) continue;
            moves.push({ type: 'waste-to-tableau', targetCol: targetCol });
        }
        return moves;
    }

    function listKlondikeTableauToFoundationMoves(state) {
        const moves = [];
        for (let sourceCol = 0; sourceCol < 7; sourceCol++) {
            const source = state.tableau[sourceCol];
            if (!source || source.length === 0) continue;
            const card = source[source.length - 1];
            if (!card || card.hidden) continue;
            for (let foundationIndex = 0; foundationIndex < 4; foundationIndex++) {
                if (canPlaceOnFoundation(card, state.foundations[foundationIndex])) {
                    moves.push({ type: 'tableau-to-foundation', sourceCol: sourceCol, foundationIndex: foundationIndex });
                }
            }
        }
        return moves;
    }

    function listKlondikeWasteToFoundationMoves(state) {
        if (!state.waste || state.waste.length === 0) return [];
        const card = state.waste[state.waste.length - 1];
        const moves = [];
        for (let foundationIndex = 0; foundationIndex < 4; foundationIndex++) {
            if (canPlaceOnFoundation(card, state.foundations[foundationIndex])) {
                moves.push({ type: 'waste-to-foundation', foundationIndex: foundationIndex });
            }
        }
        return moves;
    }

    function listKlondikeFoundationToTableauMoves(state, allowAnyCardOnEmpty) {
        const moves = [];
        for (let foundationIndex = 0; foundationIndex < 4; foundationIndex++) {
            const foundation = state.foundations[foundationIndex];
            if (!foundation || foundation.length === 0) continue;
            const card = foundation[foundation.length - 1];
            for (let targetCol = 0; targetCol < 7; targetCol++) {
                const target = state.tableau[targetCol];
                let valid = false;
                if (!target || target.length === 0) {
                    valid = canMoveToEmptyKlondike(card, allowAnyCardOnEmpty);
                } else {
                    const top = target[target.length - 1];
                    if (!top.hidden) valid = canPlaceOnTableau(card, top);
                }
                if (!valid) continue;
                moves.push({ type: 'foundation-to-tableau', foundationIndex: foundationIndex, targetCol: targetCol });
            }
        }
        return moves;
    }

    function applyKlondikeTableauMoveBySpec(state, move) {
        const source = state.tableau[move.sourceCol];
        const target = state.tableau[move.targetCol];
        if (!source || !target || source.length === 0) return false;
        const startIndex = Number.isFinite(move.startIndex) ? move.startIndex : source.length - 1;
        const count = Number.isFinite(move.count) ? move.count : (source.length - startIndex);
        const moving = source.slice(startIndex);
        if (!moving || moving.length === 0 || moving.length !== count) return false;
        source.splice(startIndex, count);
        target.push.apply(target, moving);
        if (source.length > 0 && source[source.length - 1].hidden) {
            source[source.length - 1].hidden = false;
        }
        return true;
    }

    function applyKlondikeWasteToTableauMoveBySpec(state, move) {
        if (state.waste.length === 0) return false;
        const target = state.tableau[move.targetCol];
        if (!target) return false;
        target.push(state.waste.pop());
        return true;
    }

    function applyKlondikeMove(state, move, drawCount, allowAnyCardOnEmpty) {
        if (!move) return false;
        if (move.type === 'tableau-to-tableau') return applyKlondikeTableauMoveBySpec(state, move);
        if (move.type === 'tableau-to-foundation') {
            const source = state.tableau[move.sourceCol];
            if (!source || source.length === 0) return false;
            const card = source.pop();
            if (!card) return false;
            state.foundations[move.foundationIndex].push(card);
            if (source.length > 0 && source[source.length - 1].hidden) {
                source[source.length - 1].hidden = false;
            }
            return true;
        }
        if (move.type === 'waste-to-foundation') {
            if (!state.waste || state.waste.length === 0) return false;
            const card = state.waste.pop();
            if (!card) return false;
            state.foundations[move.foundationIndex].push(card);
            return true;
        }
        if (move.type === 'foundation-to-tableau') {
            const foundation = state.foundations[move.foundationIndex];
            const target = state.tableau[move.targetCol];
            if (!foundation || foundation.length === 0 || !target) return false;
            target.push(foundation.pop());
            return true;
        }
        if (move.type === 'waste-to-tableau') return applyKlondikeWasteToTableauMoveBySpec(state, move);
        if (move.type === 'draw-stock') {
            if (state.stock.length === 0) return false;
            drawFromStock(state, drawCount);
            return true;
        }
        if (move.type === 'recycle-waste') {
            if (state.waste.length === 0) return false;
            recycleWaste(state);
            return true;
        }
        if (move.type === 'auto-foundation') return applyKlondikeAutoMoves(state);
        return false;
    }

    function applyKlondikeTableauMove(state, allowAnyCardOnEmpty) {
        const moves = listKlondikeTableauMoves(state, allowAnyCardOnEmpty, {
            requireRevealHidden: true,
            prioritizeRevealHidden: true
        });
        if (moves.length === 0) return false;
        return applyKlondikeTableauMoveBySpec(state, moves[0]);
    }

    function applyKlondikeWasteToTableauMove(state, allowAnyCardOnEmpty) {
        const moves = listKlondikeWasteToTableauMoves(state, allowAnyCardOnEmpty);
        if (moves.length === 0) return false;
        return applyKlondikeWasteToTableauMoveBySpec(state, moves[0]);
    }

    function drawFromStock(state, drawCount) {
        const cardsToDraw = Math.min(drawCount, state.stock.length);
        for (let i = 0; i < cardsToDraw; i++) {
            const card = state.stock.pop();
            card.hidden = false;
            state.waste.push(card);
        }
    }

    function recycleWaste(state) {
        while (state.waste.length > 0) {
            const card = state.waste.pop();
            card.hidden = true;
            state.stock.push(card);
        }
    }

    function runKlondikeCheck(snapshot, limits) {
        if (limits && limits.relaxedSearch) {
            return runKlondikeRelaxedCheck(snapshot, limits);
        }
        const startedAt = Date.now();
        const maxStates = Number.isFinite(limits.maxStates) ? Math.max(1, limits.maxStates) : 50000;
        const maxDurationMs = Number.isFinite(limits.maxDurationMs) ? Math.max(1, limits.maxDurationMs) : 5000;
        const drawCount = Number.isFinite(snapshot.drawCount) ? snapshot.drawCount : 3;
        const allowAnyCardOnEmpty = !!snapshot.allowAnyCardOnEmpty;

        const state = cloneKlondikeState(snapshot);
        const initialHidden = countHidden(state.tableau);
        const initialFoundationCount = countFoundations(state.foundations);
        const startKey = normalizeKlondikeCheckState(state);
        const seenStates = new Set([startKey]);
        const solutionMoves = [];
        const solutionStateKeys = [startKey];
        let iterations = 0;
        let cycleDetected = false;

        while (iterations < maxStates) {
            if ((Date.now() - startedAt) >= maxDurationMs) {
                return { solved: false, reason: 'time-limit', statesExplored: iterations, prunedStates: 0, durationMs: Date.now() - startedAt, maxStates, maxDurationMs };
            }

            iterations++;
            const moved = applyKlondikeAutoMoves(state);
            if (isWon(state.foundations)) {
                return {
                    solved: true,
                    reason: 'solved',
                    statesExplored: iterations,
                    prunedStates: 0,
                    durationMs: Date.now() - startedAt,
                    maxStates,
                    maxDurationMs,
                    solutionMoves: solutionMoves.slice(),
                    solutionStateKeys: solutionStateKeys.slice()
                };
            }
            if (moved) {
                solutionMoves.push({ type: 'auto-foundation' });
                const key = normalizeKlondikeCheckState(state);
                if (seenStates.has(key)) {
                    cycleDetected = true;
                    break;
                }
                seenStates.add(key);
                solutionStateKeys.push(key);
                continue;
            }
            if (applyKlondikeTableauMove(state, allowAnyCardOnEmpty)) {
                solutionMoves.push({ type: 'tableau-to-tableau' });
                const key = normalizeKlondikeCheckState(state);
                if (seenStates.has(key)) {
                    cycleDetected = true;
                    break;
                }
                seenStates.add(key);
                solutionStateKeys.push(key);
                continue;
            }
            if (applyKlondikeWasteToTableauMove(state, allowAnyCardOnEmpty)) {
                solutionMoves.push({ type: 'waste-to-tableau' });
                const key = normalizeKlondikeCheckState(state);
                if (seenStates.has(key)) {
                    cycleDetected = true;
                    break;
                }
                seenStates.add(key);
                solutionStateKeys.push(key);
                continue;
            }
            if (state.stock.length > 0) {
                drawFromStock(state, drawCount);
                solutionMoves.push({ type: 'draw-stock', count: drawCount });
                const key = normalizeKlondikeCheckState(state);
                if (seenStates.has(key)) {
                    cycleDetected = true;
                    break;
                }
                seenStates.add(key);
                solutionStateKeys.push(key);
                continue;
            }
            if (state.waste.length > 0) {
                recycleWaste(state);
                solutionMoves.push({ type: 'recycle-waste' });
                const key = normalizeKlondikeCheckState(state);
                if (seenStates.has(key)) {
                    cycleDetected = true;
                    break;
                }
                seenStates.add(key);
                solutionStateKeys.push(key);
                continue;
            }
            break;
        }

        const hiddenRevealed = initialHidden - countHidden(state.tableau);
        const foundationProgress = countFoundations(state.foundations) - initialFoundationCount;
        const likely = hiddenRevealed >= 6 || foundationProgress >= 4 || (hiddenRevealed + foundationProgress) >= 8;
        return {
            solved: likely,
            reason: likely ? 'likely-solved' : (cycleDetected ? 'cycle-detected' : (iterations >= maxStates ? 'state-limit' : 'exhausted')),
            statesExplored: iterations,
            prunedStates: 0,
            durationMs: Date.now() - startedAt,
            maxStates,
            maxDurationMs
        };
    }

    function scoreKlondikeSearchState(state) {
        const foundationCards = countFoundations(state.foundations);
        const hiddenCards = countHidden(state.tableau);
        const emptyColumns = state.tableau.reduce(function (sum, pile) {
            return sum + ((pile && pile.length === 0) ? 1 : 0);
        }, 0);
        return (foundationCards * 100) + ((28 - hiddenCards) * 14) + (emptyColumns * 8) - (state.stock.length * 0.5);
    }

    function popBestKlondikeSearchNode(frontier) {
        let bestIndex = 0;
        let bestScore = frontier[0].score;
        for (let i = 1; i < frontier.length; i++) {
            if (frontier[i].score > bestScore) {
                bestScore = frontier[i].score;
                bestIndex = i;
            }
        }
        const selected = frontier[bestIndex];
        frontier.splice(bestIndex, 1);
        return selected;
    }

    function isReverseKlondikeSearchMove(previousMove, nextMove) {
        if (!previousMove || !nextMove) return false;
        if (previousMove.type === 'tableau-to-tableau' && nextMove.type === 'tableau-to-tableau') {
            return previousMove.sourceCol === nextMove.targetCol
                && previousMove.targetCol === nextMove.sourceCol;
        }
        if (previousMove.type === 'tableau-to-foundation' && nextMove.type === 'foundation-to-tableau') {
            return previousMove.sourceCol === nextMove.targetCol
                && previousMove.foundationIndex === nextMove.foundationIndex;
        }
        if (previousMove.type === 'foundation-to-tableau' && nextMove.type === 'tableau-to-foundation') {
            return previousMove.targetCol === nextMove.sourceCol
                && previousMove.foundationIndex === nextMove.foundationIndex;
        }
        return false;
    }

    function runKlondikeRelaxedCheck(snapshot, limits) {
        const startedAt = Date.now();
        const maxStates = Number.isFinite(limits.maxStates) ? Math.max(1, limits.maxStates) : 50000;
        const maxDurationMs = Number.isFinite(limits.maxDurationMs) ? Math.max(1, limits.maxDurationMs) : 60000;
        const drawCount = Number.isFinite(snapshot.drawCount) ? snapshot.drawCount : 3;
        const allowAnyCardOnEmpty = !!snapshot.allowAnyCardOnEmpty;
        const startState = cloneKlondikeState(snapshot);
        const initialHidden = countHidden(startState.tableau);
        const initialFoundationCount = countFoundations(startState.foundations);
        const startKey = normalizeKlondikeCheckState(startState);
        const frontier = [{
            state: startState,
            key: startKey,
            moves: [],
            stateKeys: [startKey],
            lastMove: null,
            depth: 0,
            score: scoreKlondikeSearchState(startState)
        }];
        const seenStateDepth = new Map([[startKey, 0]]);
        let iterations = 0;
        let bestHiddenRevealed = 0;
        let bestFoundationProgress = 0;

        while (frontier.length > 0 && iterations < maxStates) {
            if ((Date.now() - startedAt) >= maxDurationMs) {
                return { solved: false, reason: 'time-limit', statesExplored: iterations, prunedStates: 0, durationMs: Date.now() - startedAt, maxStates, maxDurationMs };
            }
            iterations++;
            const current = popBestKlondikeSearchNode(frontier);
            const knownCurrentDepth = seenStateDepth.get(current.key);
            if (knownCurrentDepth !== undefined && knownCurrentDepth < current.depth) {
                continue;
            }
            const state = cloneKlondikeState(current.state);
            const moves = current.moves.slice();
            const stateKeys = current.stateKeys.slice();
            const lastMove = current.lastMove;
            const depth = current.depth;

            if (isWon(state.foundations)) {
                return {
                    solved: true,
                    reason: 'solved',
                    statesExplored: iterations,
                    prunedStates: 0,
                    durationMs: Date.now() - startedAt,
                    maxStates,
                    maxDurationMs,
                    solutionMoves: moves,
                    solutionStateKeys: stateKeys
                };
            }

            const hiddenRevealed = initialHidden - countHidden(state.tableau);
            const foundationProgress = countFoundations(state.foundations) - initialFoundationCount;
            if (hiddenRevealed > bestHiddenRevealed) bestHiddenRevealed = hiddenRevealed;
            if (foundationProgress > bestFoundationProgress) bestFoundationProgress = foundationProgress;

            const candidateMoves = [];
            const tableauFoundationMoves = listKlondikeTableauToFoundationMoves(state);
            for (let i = 0; i < tableauFoundationMoves.length; i++) candidateMoves.push(tableauFoundationMoves[i]);
            const wasteFoundationMoves = listKlondikeWasteToFoundationMoves(state);
            for (let i = 0; i < wasteFoundationMoves.length; i++) candidateMoves.push(wasteFoundationMoves[i]);
            const tableauMoves = listKlondikeTableauMoves(state, allowAnyCardOnEmpty, {
                requireRevealHidden: false,
                prioritizeRevealHidden: true,
                allowSequences: true
            });
            for (let i = 0; i < tableauMoves.length; i++) candidateMoves.push(tableauMoves[i]);
            const wasteMoves = listKlondikeWasteToTableauMoves(state, allowAnyCardOnEmpty);
            for (let i = 0; i < wasteMoves.length; i++) candidateMoves.push(wasteMoves[i]);
            const foundationTableauMoves = listKlondikeFoundationToTableauMoves(state, allowAnyCardOnEmpty);
            for (let i = 0; i < foundationTableauMoves.length; i++) candidateMoves.push(foundationTableauMoves[i]);
            if (state.stock.length > 0) candidateMoves.push({ type: 'draw-stock', count: drawCount });
            if (state.waste.length > 0) candidateMoves.push({ type: 'recycle-waste' });

            for (let i = 0; i < candidateMoves.length; i++) {
                const move = candidateMoves[i];
                if (isReverseKlondikeSearchMove(lastMove, move)) continue;
                const nextState = cloneKlondikeState(state);
                if (!applyKlondikeMove(nextState, move, drawCount, allowAnyCardOnEmpty)) continue;
                const key = normalizeKlondikeCheckState(nextState);
                const nextDepth = depth + 1;
                const knownDepth = seenStateDepth.get(key);
                if (knownDepth !== undefined && knownDepth <= nextDepth) continue;
                seenStateDepth.set(key, nextDepth);
                frontier.push({
                    state: nextState,
                    key: key,
                    moves: moves.concat([move]),
                    stateKeys: stateKeys.concat([key]),
                    lastMove: move,
                    depth: nextDepth,
                    score: scoreKlondikeSearchState(nextState)
                });
            }
        }

        const likely = bestHiddenRevealed >= 6
            || bestFoundationProgress >= 4
            || (bestHiddenRevealed + bestFoundationProgress) >= 8;
        return {
            solved: likely,
            reason: likely ? 'likely-solved' : (iterations >= maxStates ? 'state-limit' : 'exhausted'),
            statesExplored: iterations,
            prunedStates: 0,
            durationMs: Date.now() - startedAt,
            maxStates,
            maxDurationMs
        };
    }

    function isPyramidSolvedState(pyramid) {
        return pyramid.every(function (row) {
            return row.every(function (card) { return !card; });
        });
    }

    function countPyramidCardsRemaining(pyramid) {
        var remaining = 0;
        for (var row = 0; row < pyramid.length; row++) {
            for (var col = 0; col < pyramid[row].length; col++) {
                if (pyramid[row][col]) remaining++;
            }
        }
        return remaining;
    }

    function isPyramidCardExposedForCheck(pyramid, row, col) {
        if (row >= pyramid.length - 1) return true;
        var belowLeft = pyramid[row + 1] ? pyramid[row + 1][col] : null;
        var belowRight = pyramid[row + 1] ? pyramid[row + 1][col + 1] : null;
        return !belowLeft && !belowRight;
    }

    function applyPyramidGreedyRemoval(state) {
        var exposed = [];
        for (var row = 0; row < state.pyramid.length; row++) {
            for (var col = 0; col < state.pyramid[row].length; col++) {
                var card = state.pyramid[row][col];
                if (!card) continue;
                if (!isPyramidCardExposedForCheck(state.pyramid, row, col)) continue;
                exposed.push({ row: row, col: col, card: card });
            }
        }
        var wasteTop = state.waste.length > 0 ? state.waste[state.waste.length - 1] : null;

        for (var i = 0; i < exposed.length; i++) {
            var a = exposed[i];
            if (a.card.rank === 13) {
                state.pyramid[a.row][a.col] = null;
                return true;
            }
            if (wasteTop && (a.card.rank + wasteTop.rank === 13)) {
                state.pyramid[a.row][a.col] = null;
                state.waste.pop();
                return true;
            }
            for (var j = i + 1; j < exposed.length; j++) {
                var b = exposed[j];
                if (a.card.rank + b.card.rank === 13) {
                    state.pyramid[a.row][a.col] = null;
                    state.pyramid[b.row][b.col] = null;
                    return true;
                }
            }
        }

        if (wasteTop && wasteTop.rank === 13) {
            state.waste.pop();
            return true;
        }
        return false;
    }

    function runPyramidCheck(snapshot, limits) {
        if (limits && limits.relaxedSearch) {
            return runPyramidRelaxedCheck(snapshot, limits);
        }
        var startedAt = Date.now();
        var maxStates = Number.isFinite(limits.maxStates) ? Math.max(1, limits.maxStates) : 50000;
        var maxDurationMs = Number.isFinite(limits.maxDurationMs) ? Math.max(1, limits.maxDurationMs) : 5000;
        var drawCount = snapshot.drawCount === 3 ? 3 : 1;
        var state = {
            pyramid: snapshot.pyramid.map(function (row) { return row.map(function (card) { return card ? Object.assign({}, card) : null; }); }),
            stock: snapshot.stock.map(function (card) { return Object.assign({}, card); }),
            waste: snapshot.waste.map(function (card) { return Object.assign({}, card); })
        };
        var initialRemaining = countPyramidCardsRemaining(state.pyramid);
        var startKey = normalizePyramidCheckState(state);
        var seenStates = new Set([startKey]);
        var solutionMoves = [];
        var solutionStateKeys = [startKey];
        var iterations = 0;
        var cycleDetected = false;

        while (iterations < maxStates) {
            if ((Date.now() - startedAt) >= maxDurationMs) {
                return { solved: false, reason: 'time-limit', statesExplored: iterations, prunedStates: 0, durationMs: Date.now() - startedAt, maxStates: maxStates, maxDurationMs: maxDurationMs };
            }
            if (isPyramidSolvedState(state.pyramid)) {
                return {
                    solved: true,
                    reason: 'solved',
                    statesExplored: iterations,
                    prunedStates: 0,
                    durationMs: Date.now() - startedAt,
                    maxStates: maxStates,
                    maxDurationMs: maxDurationMs,
                    solutionMoves: solutionMoves.slice(),
                    solutionStateKeys: solutionStateKeys.slice()
                };
            }

            iterations++;
            if (applyPyramidGreedyRemoval(state)) {
                solutionMoves.push({ type: 'remove-exposed' });
                var afterGreedy = normalizePyramidCheckState(state);
                if (seenStates.has(afterGreedy)) {
                    cycleDetected = true;
                    break;
                }
                seenStates.add(afterGreedy);
                solutionStateKeys.push(afterGreedy);
                continue;
            }
            if (state.stock.length > 0) {
                for (var i = 0; i < drawCount; i++) {
                    if (!state.stock.length) break;
                    state.waste.push(state.stock.pop());
                }
                solutionMoves.push({ type: 'draw-stock', count: drawCount });
                var afterDraw = normalizePyramidCheckState(state);
                if (seenStates.has(afterDraw)) {
                    cycleDetected = true;
                    break;
                }
                seenStates.add(afterDraw);
                solutionStateKeys.push(afterDraw);
                continue;
            }
            if (state.waste.length > 0) {
                while (state.waste.length > 0) {
                    state.stock.push(state.waste.pop());
                }
                solutionMoves.push({ type: 'recycle-waste' });
                var afterRecycle = normalizePyramidCheckState(state);
                if (seenStates.has(afterRecycle)) {
                    cycleDetected = true;
                    break;
                }
                seenStates.add(afterRecycle);
                solutionStateKeys.push(afterRecycle);
                continue;
            }
            break;
        }

        var remaining = countPyramidCardsRemaining(state.pyramid);
        var cleared = initialRemaining - remaining;
        var likely = cleared >= 20 || (remaining <= 8 && state.stock.length === 0);
        return {
            solved: likely,
            reason: likely ? 'likely-solved' : (cycleDetected ? 'cycle-detected' : (iterations >= maxStates ? 'state-limit' : 'exhausted')),
            statesExplored: iterations,
            prunedStates: 0,
            durationMs: Date.now() - startedAt,
            maxStates: maxStates,
            maxDurationMs: maxDurationMs
        };
    }

    function clonePyramidCheckState(state) {
        return {
            pyramid: state.pyramid.map(function (row) { return row.map(function (card) { return card ? Object.assign({}, card) : null; }); }),
            stock: state.stock.map(function (card) { return Object.assign({}, card); }),
            waste: state.waste.map(function (card) { return Object.assign({}, card); })
        };
    }

    function listPyramidCandidateMoves(state, drawCount) {
        var exposed = [];
        for (var row = 0; row < state.pyramid.length; row++) {
            for (var col = 0; col < state.pyramid[row].length; col++) {
                var card = state.pyramid[row][col];
                if (!card) continue;
                if (!isPyramidCardExposedForCheck(state.pyramid, row, col)) continue;
                exposed.push({ row: row, col: col, card: card });
            }
        }
        var wasteTop = state.waste.length > 0 ? state.waste[state.waste.length - 1] : null;
        var moves = [];
        for (var i = 0; i < exposed.length; i++) {
            var a = exposed[i];
            if (a.card.rank === 13) {
                moves.push({ type: 'remove-king', row: a.row, col: a.col, priority: 6 });
            }
            if (wasteTop && a.card.rank + wasteTop.rank === 13) {
                moves.push({ type: 'remove-with-waste', row: a.row, col: a.col, priority: 5 });
            }
            for (var j = i + 1; j < exposed.length; j++) {
                var b = exposed[j];
                if (a.card.rank + b.card.rank === 13) {
                    moves.push({ type: 'remove-pair', rowA: a.row, colA: a.col, rowB: b.row, colB: b.col, priority: 7 });
                }
            }
        }
        if (wasteTop && wasteTop.rank === 13) {
            moves.push({ type: 'remove-waste-king', priority: 4 });
        }
        if (state.stock.length > 0) {
            moves.push({ type: 'draw-stock', count: drawCount, priority: 2 });
        } else if (state.waste.length > 0) {
            moves.push({ type: 'recycle-waste', priority: 1 });
        }
        moves.sort(function (a, b) { return (b.priority || 0) - (a.priority || 0); });
        return moves;
    }

    function applyPyramidSimulationMove(state, move, drawCount) {
        if (!move) return false;
        if (move.type === 'remove-king') {
            if (!state.pyramid[move.row] || !state.pyramid[move.row][move.col]) return false;
            state.pyramid[move.row][move.col] = null;
            return true;
        }
        if (move.type === 'remove-with-waste') {
            if (!state.pyramid[move.row] || !state.pyramid[move.row][move.col]) return false;
            if (!state.waste.length) return false;
            state.pyramid[move.row][move.col] = null;
            state.waste.pop();
            return true;
        }
        if (move.type === 'remove-pair') {
            if (!state.pyramid[move.rowA] || !state.pyramid[move.rowB]) return false;
            if (!state.pyramid[move.rowA][move.colA] || !state.pyramid[move.rowB][move.colB]) return false;
            state.pyramid[move.rowA][move.colA] = null;
            state.pyramid[move.rowB][move.colB] = null;
            return true;
        }
        if (move.type === 'remove-waste-king') {
            if (!state.waste.length) return false;
            state.waste.pop();
            return true;
        }
        if (move.type === 'draw-stock') {
            if (!state.stock.length) return false;
            var count = Number.isFinite(move.count) ? move.count : drawCount;
            for (var i = 0; i < count; i++) {
                if (!state.stock.length) break;
                state.waste.push(state.stock.pop());
            }
            return true;
        }
        if (move.type === 'recycle-waste') {
            if (!state.waste.length) return false;
            while (state.waste.length > 0) {
                state.stock.push(state.waste.pop());
            }
            return true;
        }
        return false;
    }

    function runPyramidRelaxedCheck(snapshot, limits) {
        var startedAt = Date.now();
        var maxStates = Number.isFinite(limits.maxStates) ? Math.max(1, limits.maxStates) : 50000;
        var maxDurationMs = Number.isFinite(limits.maxDurationMs) ? Math.max(1, limits.maxDurationMs) : 60000;
        var drawCount = snapshot.drawCount === 3 ? 3 : 1;
        var startState = clonePyramidCheckState({
            pyramid: snapshot.pyramid,
            stock: snapshot.stock,
            waste: snapshot.waste
        });
        var initialRemaining = countPyramidCardsRemaining(startState.pyramid);
        var startKey = normalizePyramidCheckState(startState);
        var frontier = [{
            state: startState,
            key: startKey,
            moves: [],
            stateKeys: [startKey],
            depth: 0
        }];
        var seenStateDepth = new Map([[startKey, 0]]);
        var iterations = 0;
        var bestCleared = 0;

        while (frontier.length > 0 && iterations < maxStates) {
            if ((Date.now() - startedAt) >= maxDurationMs) {
                return { solved: false, reason: 'time-limit', statesExplored: iterations, prunedStates: 0, durationMs: Date.now() - startedAt, maxStates: maxStates, maxDurationMs: maxDurationMs };
            }
            iterations++;
            var current = frontier.pop();
            var knownCurrentDepth = seenStateDepth.get(current.key);
            if (knownCurrentDepth !== undefined && knownCurrentDepth < current.depth) {
                continue;
            }
            var state = clonePyramidCheckState(current.state);
            var moves = current.moves.slice();
            var stateKeys = current.stateKeys.slice();
            var depth = current.depth;

            if (isPyramidSolvedState(state.pyramid)) {
                return {
                    solved: true,
                    reason: 'solved',
                    statesExplored: iterations,
                    prunedStates: 0,
                    durationMs: Date.now() - startedAt,
                    maxStates: maxStates,
                    maxDurationMs: maxDurationMs,
                    solutionMoves: moves,
                    solutionStateKeys: stateKeys
                };
            }

            var remaining = countPyramidCardsRemaining(state.pyramid);
            var cleared = initialRemaining - remaining;
            if (cleared > bestCleared) bestCleared = cleared;

            var candidates = listPyramidCandidateMoves(state, drawCount);
            for (var i = candidates.length - 1; i >= 0; i--) {
                var move = candidates[i];
                var nextState = clonePyramidCheckState(state);
                if (!applyPyramidSimulationMove(nextState, move, drawCount)) continue;
                var key = normalizePyramidCheckState(nextState);
                var nextDepth = depth + 1;
                var knownDepth = seenStateDepth.get(key);
                if (knownDepth !== undefined && knownDepth <= nextDepth) continue;
                seenStateDepth.set(key, nextDepth);
                frontier.push({
                    state: nextState,
                    key: key,
                    moves: moves.concat([{ type: (move.type === 'draw-stock' || move.type === 'recycle-waste') ? move.type : 'remove-exposed' }]),
                    stateKeys: stateKeys.concat([key]),
                    depth: nextDepth
                });
            }
        }

        var likely = bestCleared >= 20;
        var exhausted = frontier.length === 0;
        return {
            solved: likely,
            reason: likely ? 'likely-solved' : (iterations >= maxStates ? 'state-limit' : 'exhausted'),
            statesExplored: iterations,
            prunedStates: 0,
            durationMs: Date.now() - startedAt,
            maxStates: maxStates,
            maxDurationMs: maxDurationMs,
            provenUnsolvable: exhausted && !likely
        };
    }

    function countSpiderHiddenCards(tableau) {
        return tableau.reduce(function (sum, column) {
            return sum + column.reduce(function (colSum, card) { return colSum + (card.hidden ? 1 : 0); }, 0);
        }, 0);
    }

    function completeSpiderSequences(state) {
        var completed = 0;
        for (var col = 0; col < state.tableau.length; col++) {
            while (true) {
                var column = state.tableau[col];
                if (!column || column.length < 13) break;
                var start = column.length - 13;
                var seq = column.slice(start);
                var first = seq[0];
                if (!first || first.hidden || first.rank !== 13) break;
                var valid = true;
                for (var i = 0; i < seq.length - 1; i++) {
                    var current = seq[i];
                    var next = seq[i + 1];
                    if (!current || !next || current.hidden || next.hidden || current.suit !== next.suit || current.rank !== next.rank + 1) {
                        valid = false;
                        break;
                    }
                }
                if (!valid) break;
                var removed = column.splice(start, 13);
                state.foundations.push(removed[0].suit);
                var newTop = column[column.length - 1];
                if (newTop && newTop.hidden) {
                    newTop.hidden = false;
                }
                completed++;
            }
        }
        return completed;
    }

    function isSpiderMovableSequence(sequence) {
        if (!sequence || sequence.length === 0) return false;
        for (var i = 0; i < sequence.length; i++) {
            if (!sequence[i] || sequence[i].hidden) return false;
        }
        for (var j = 0; j < sequence.length - 1; j++) {
            if (sequence[j].rank !== sequence[j + 1].rank + 1) return false;
        }
        return true;
    }

    function scoreSpiderMove(source, moving, ontoEmpty) {
        var score = moving.length * 10;
        if (ontoEmpty) score -= 5;
        var revealIndex = source.length - moving.length - 1;
        if (revealIndex >= 0) {
            var revealCard = source[revealIndex];
            if (revealCard && revealCard.hidden) score += 40;
        }
        var sameSuitRun = true;
        for (var i = 1; i < moving.length; i++) {
            if (moving[i].suit !== moving[i - 1].suit) {
                sameSuitRun = false;
                break;
            }
        }
        if (sameSuitRun) score += 25;
        return score;
    }

    function findSpiderHeuristicMove(state) {
        var moves = listSpiderHeuristicMoves(state, { maxMoves: 1 });
        return moves.length ? moves[0] : null;
    }

    function cloneSpiderCheckState(state) {
        return {
            tableau: state.tableau.map(function (column) { return column.map(function (card) { return Object.assign({}, card); }); }),
            stock: state.stock.map(function (card) { return Object.assign({}, card); }),
            foundations: state.foundations.slice()
        };
    }

    function scoreSpiderSearchState(state) {
        var hiddenCards = countSpiderHiddenCards(state.tableau);
        var completed = state.foundations.length;
        var emptyColumns = state.tableau.reduce(function (sum, pile) {
            return sum + ((pile && pile.length === 0) ? 1 : 0);
        }, 0);
        return (completed * 220) + ((54 - hiddenCards) * 10) + (emptyColumns * 8) - state.stock.length;
    }

    function popBestSpiderSearchNode(frontier) {
        var bestIndex = 0;
        var bestScore = frontier[0].score;
        for (var i = 1; i < frontier.length; i++) {
            if (frontier[i].score > bestScore) {
                bestScore = frontier[i].score;
                bestIndex = i;
            }
        }
        var selected = frontier[bestIndex];
        frontier.splice(bestIndex, 1);
        return selected;
    }

    function listSpiderHeuristicMoves(state, options) {
        var opts = options || {};
        var maxMoves = Number.isFinite(opts.maxMoves) ? Math.max(1, opts.maxMoves) : Infinity;
        var blockedReverse = opts.blockedReverse || null;
        var moves = [];
        for (var from = 0; from < state.tableau.length; from++) {
            var source = state.tableau[from];
            if (!source || source.length === 0) continue;
            for (var startIndex = source.length - 1; startIndex >= 0; startIndex--) {
                var moving = source.slice(startIndex);
                if (!isSpiderMovableSequence(moving)) continue;
                var lead = moving[0];
                for (var to = 0; to < state.tableau.length; to++) {
                    if (to === from) continue;
                    if (blockedReverse
                        && blockedReverse.type === 'tableau-to-tableau'
                        && blockedReverse.from === from
                        && blockedReverse.to === to) {
                        continue;
                    }
                    var target = state.tableau[to];
                    var ontoEmpty = !target || target.length === 0;
                    if (!ontoEmpty) {
                        var top = target[target.length - 1];
                        if (top.hidden || top.rank !== lead.rank + 1) continue;
                    }
                    var score = scoreSpiderMove(source, moving, ontoEmpty);
                    if (!ontoEmpty) {
                        var topCard = target[target.length - 1];
                        if (topCard && topCard.suit === lead.suit) {
                            score += 12;
                        } else {
                            score -= 3;
                        }
                    }
                    if (startIndex > 0 && source[startIndex - 1] && source[startIndex - 1].hidden) {
                        score += 20;
                    }
                    if (ontoEmpty && startIndex === 0 && source.length > 1) {
                        score -= 8;
                    }
                    moves.push({
                        type: 'tableau-to-tableau',
                        from: from,
                        to: to,
                        startIndex: startIndex,
                        count: moving.length,
                        score: score
                    });
                }
            }
        }
        moves.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
        if (moves.length > maxMoves) return moves.slice(0, maxMoves);
        return moves;
    }

    function applySpiderSimulationMove(state, move) {
        if (!move) return false;
        if (move.type === 'tableau-to-tableau') {
            var source = state.tableau[move.from];
            var target = state.tableau[move.to];
            if (!source || !target || source.length === 0) return false;
            var startIndex = Number.isFinite(move.startIndex) ? move.startIndex : source.length - 1;
            var moved = source.splice(startIndex);
            if (!moved.length) return false;
            target.push.apply(target, moved);
            var sourceTop = source[source.length - 1];
            if (sourceTop && sourceTop.hidden) sourceTop.hidden = false;
            return true;
        }
        if (move.type === 'deal-row') {
            if (state.stock.length < 10 || state.tableau.some(function (column) { return column.length === 0; })) return false;
            for (var col = 0; col < 10; col++) {
                var dealt = state.stock.pop();
                if (!dealt) return false;
                dealt.hidden = false;
                state.tableau[col].push(dealt);
            }
            return true;
        }
        return false;
    }

    function runSpiderRelaxedCheck(snapshot, limits) {
        var startedAt = Date.now();
        var maxStates = Number.isFinite(limits.maxStates) ? Math.max(1, limits.maxStates) : 50000;
        var maxDurationMs = Number.isFinite(limits.maxDurationMs) ? Math.max(1, limits.maxDurationMs) : 60000;
        var startState = cloneSpiderCheckState({
            tableau: snapshot.tableau,
            stock: snapshot.stock,
            foundations: snapshot.foundations
        });
        var initialHidden = countSpiderHiddenCards(startState.tableau);
        var initialFoundations = startState.foundations.length;
        var startKey = normalizeSpiderCheckState(startState);
        var frontier = [{
            state: startState,
            key: startKey,
            moves: [],
            stateKeys: [startKey],
            lastMove: null,
            depth: 0,
            score: scoreSpiderSearchState(startState)
        }];
        var seenStateDepth = new Map([[startKey, 0]]);
        var iterations = 0;
        var bestHiddenRevealed = 0;
        var bestFoundationProgress = 0;

        while (frontier.length > 0 && iterations < maxStates) {
            if ((Date.now() - startedAt) >= maxDurationMs) {
                return { solved: false, reason: 'time-limit', statesExplored: iterations, prunedStates: 0, durationMs: Date.now() - startedAt, maxStates: maxStates, maxDurationMs: maxDurationMs };
            }
            iterations++;
            var current = popBestSpiderSearchNode(frontier);
            var knownCurrentDepth = seenStateDepth.get(current.key);
            if (knownCurrentDepth !== undefined && knownCurrentDepth < current.depth) {
                continue;
            }
            var state = cloneSpiderCheckState(current.state);
            var moves = current.moves.slice();
            var stateKeys = current.stateKeys.slice();
            var lastMove = current.lastMove;
            var depth = current.depth;

            var completed = completeSpiderSequences(state);
            if (completed > 0) {
                var afterComplete = normalizeSpiderCheckState(state);
                var completedDepth = depth + 1;
                var knownCompletedDepth = seenStateDepth.get(afterComplete);
                if (knownCompletedDepth !== undefined && knownCompletedDepth <= completedDepth) {
                    continue;
                }
                seenStateDepth.set(afterComplete, completedDepth);
                moves.push({ type: 'complete-sequence' });
                stateKeys.push(afterComplete);
                depth = completedDepth;
                lastMove = { type: 'complete-sequence' };
            }

            if (state.foundations.length >= 8) {
                return {
                    solved: true,
                    reason: 'solved',
                    statesExplored: iterations,
                    prunedStates: 0,
                    durationMs: Date.now() - startedAt,
                    maxStates: maxStates,
                    maxDurationMs: maxDurationMs,
                    solutionMoves: moves,
                    solutionStateKeys: stateKeys
                };
            }

            var hiddenRevealed = initialHidden - countSpiderHiddenCards(state.tableau);
            var foundationProgress = state.foundations.length - initialFoundations;
            if (hiddenRevealed > bestHiddenRevealed) bestHiddenRevealed = hiddenRevealed;
            if (foundationProgress > bestFoundationProgress) bestFoundationProgress = foundationProgress;

            var candidateMoves = listSpiderHeuristicMoves(state, {
                maxMoves: 22,
                blockedReverse: lastMove
            });
            if (state.stock.length >= 10 && !state.tableau.some(function (column) { return column.length === 0; })) {
                candidateMoves.push({ type: 'deal-row' });
            }

            for (var i = 0; i < candidateMoves.length; i++) {
                var move = candidateMoves[i];
                var nextState = cloneSpiderCheckState(state);
                if (!applySpiderSimulationMove(nextState, move)) continue;
                var key = normalizeSpiderCheckState(nextState);
                var nextDepth = depth + 1;
                var knownDepth = seenStateDepth.get(key);
                if (knownDepth !== undefined && knownDepth <= nextDepth) continue;
                seenStateDepth.set(key, nextDepth);
                frontier.push({
                    state: nextState,
                    key: key,
                    moves: moves.concat([move]),
                    stateKeys: stateKeys.concat([key]),
                    lastMove: move,
                    depth: nextDepth,
                    score: scoreSpiderSearchState(nextState) + (Number.isFinite(move.score) ? move.score * 0.2 : 0)
                });
            }
        }

        var likely = bestFoundationProgress >= 2
            || bestHiddenRevealed >= 12
            || (bestFoundationProgress >= 1 && bestHiddenRevealed >= 8);
        return {
            solved: likely,
            reason: likely ? 'likely-solved' : (iterations >= maxStates ? 'state-limit' : 'exhausted'),
            statesExplored: iterations,
            prunedStates: 0,
            durationMs: Date.now() - startedAt,
            maxStates: maxStates,
            maxDurationMs: maxDurationMs
        };
    }

    function runSpiderCheck(snapshot, limits) {
        if (limits && limits.relaxedSearch) {
            return runSpiderRelaxedCheck(snapshot, limits);
        }
        var startedAt = Date.now();
        var maxStates = Number.isFinite(limits.maxStates) ? Math.max(1, limits.maxStates) : 50000;
        var maxDurationMs = Number.isFinite(limits.maxDurationMs) ? Math.max(1, limits.maxDurationMs) : 5000;
        var state = {
            tableau: snapshot.tableau.map(function (column) { return column.map(function (card) { return Object.assign({}, card); }); }),
            stock: snapshot.stock.map(function (card) { return Object.assign({}, card); }),
            foundations: snapshot.foundations.slice()
        };
        var initialHidden = countSpiderHiddenCards(state.tableau);
        var initialFoundations = state.foundations.length;
        var startKey = normalizeSpiderCheckState(state);
        var seenStates = new Set([startKey]);
        var solutionMoves = [];
        var solutionStateKeys = [startKey];
        var iterations = 0;
        var cycleDetected = false;

        while (iterations < maxStates) {
            if ((Date.now() - startedAt) >= maxDurationMs) {
                return { solved: false, reason: 'time-limit', statesExplored: iterations, prunedStates: 0, durationMs: Date.now() - startedAt, maxStates: maxStates, maxDurationMs: maxDurationMs };
            }
            iterations++;
            var completed = completeSpiderSequences(state);
            if (state.foundations.length >= 8) {
                return {
                    solved: true,
                    reason: 'solved',
                    statesExplored: iterations,
                    prunedStates: 0,
                    durationMs: Date.now() - startedAt,
                    maxStates: maxStates,
                    maxDurationMs: maxDurationMs,
                    solutionMoves: solutionMoves.slice(),
                    solutionStateKeys: solutionStateKeys.slice()
                };
            }
            if (completed > 0) {
                solutionMoves.push({ type: 'complete-sequence' });
                var afterComplete = normalizeSpiderCheckState(state);
                if (seenStates.has(afterComplete)) {
                    cycleDetected = true;
                    break;
                }
                seenStates.add(afterComplete);
                solutionStateKeys.push(afterComplete);
                continue;
            }

            var move = findSpiderHeuristicMove(state);
            if (move) {
                var moving = state.tableau[move.from].splice(move.startIndex);
                state.tableau[move.to].push.apply(state.tableau[move.to], moving);
                var sourceTop = state.tableau[move.from][state.tableau[move.from].length - 1];
                if (sourceTop && sourceTop.hidden) {
                    sourceTop.hidden = false;
                }
                solutionMoves.push({ type: 'tableau-to-tableau', from: move.from, to: move.to });
                var afterMove = normalizeSpiderCheckState(state);
                if (seenStates.has(afterMove)) {
                    cycleDetected = true;
                    break;
                }
                seenStates.add(afterMove);
                solutionStateKeys.push(afterMove);
                continue;
            }

            if (state.stock.length >= 10 && !state.tableau.some(function (column) { return column.length === 0; })) {
                for (var col = 0; col < 10; col++) {
                    var dealt = state.stock.pop();
                    if (!dealt) break;
                    dealt.hidden = false;
                    state.tableau[col].push(dealt);
                }
                solutionMoves.push({ type: 'deal-row' });
                var afterDeal = normalizeSpiderCheckState(state);
                if (seenStates.has(afterDeal)) {
                    cycleDetected = true;
                    break;
                }
                seenStates.add(afterDeal);
                solutionStateKeys.push(afterDeal);
                continue;
            }
            break;
        }

        var hiddenRevealed = initialHidden - countSpiderHiddenCards(state.tableau);
        var foundationProgress = state.foundations.length - initialFoundations;
        var likely = foundationProgress >= 2 || hiddenRevealed >= 12 || (foundationProgress >= 1 && hiddenRevealed >= 8);
        return {
            solved: likely,
            reason: likely ? 'likely-solved' : (cycleDetected ? 'cycle-detected' : (iterations >= maxStates ? 'state-limit' : 'exhausted')),
            statesExplored: iterations,
            prunedStates: 0,
            durationMs: Date.now() - startedAt,
            maxStates: maxStates,
            maxDurationMs: maxDurationMs
        };
    }

    self.addEventListener('message', function (event) {
        const data = event && event.data ? event.data : {};
        const requestId = data.requestId;
        try {
            let result;
            if (data.game === 'klondike') {
                result = runKlondikeCheck(data.snapshot, data.limits || {});
            } else if (data.game === 'pyramid') {
                result = runPyramidCheck(data.snapshot, data.limits || {});
            } else if (data.game === 'spider') {
                result = runSpiderCheck(data.snapshot, data.limits || {});
            } else {
                result = runFreecellCheck(data.snapshot, data.limits || {});
            }
            self.postMessage({ requestId, result });
        } catch (err) {
            self.postMessage({ requestId, error: (err && err.message) ? err.message : 'Worker check failed.' });
        }
    });
})();
