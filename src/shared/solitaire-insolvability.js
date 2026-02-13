/**
 * Shared rapid insolvability detection for solitaire variants.
 *
 * This focuses on static dependency motifs (forbidden subgraphs) that can be
 * evaluated in O(n) over the dealt layout and reused across variants.
 */
(function (globalScope) {
    class SolitaireInsolvabilityDetector {
        constructor(options = {}) {
            this.variantId = options.variantId || 'generic';
            this.tableauKey = options.tableauKey || 'tableau';
            this.matchers = Array.isArray(options.matchers) ? options.matchers : [];
            this.minMatchedRules = Number.isFinite(options.minMatchedRules)
                ? Math.max(1, options.minMatchedRules)
                : 1;
        }

        evaluate(state, options = {}) {
            const graph = this.buildDependencyGraph(state, options);
            const matches = [];

            for (const matcher of this.matchers) {
                if (typeof matcher !== 'function') continue;
                const result = matcher({ graph, state, options }) || null;
                if (!result || result.matched !== true) continue;
                matches.push({
                    ruleId: result.ruleId || 'unnamed-rule',
                    reason: result.reason || 'Matched forbidden dependency motif.',
                    evidence: Array.isArray(result.evidence) ? result.evidence : [],
                    score: Number.isFinite(result.score) ? result.score : 1
                });
            }

            return {
                variantId: this.variantId,
                isLikelyInsolvable: matches.length >= this.minMatchedRules,
                matchedRules: matches,
                graphSummary: {
                    nodes: graph.nodes.length,
                    edges: graph.edges.length
                }
            };
        }

        buildDependencyGraph(state, options = {}) {
            const tableau = state && Array.isArray(state[this.tableauKey])
                ? state[this.tableauKey]
                : [];
            const cardNodes = [];
            const bySuitAndRank = new Map();
            const byColumnAndRow = new Map();

            for (let col = 0; col < tableau.length; col++) {
                const column = Array.isArray(tableau[col]) ? tableau[col] : [];
                for (let row = 0; row < column.length; row++) {
                    const card = column[row];
                    if (!card) continue;
                    const node = {
                        id: `c${col}r${row}`,
                        column: col,
                        row,
                        suit: card.suit,
                        val: card.val,
                        rank: Number.isFinite(card.rank)
                            ? card.rank
                            : SolitaireInsolvabilityDetector.rankFromValue(card.val),
                        hidden: card.hidden === true,
                        color: card.color || SolitaireInsolvabilityDetector.colorFromSuit(card.suit)
                    };
                    cardNodes.push(node);
                    bySuitAndRank.set(`${node.suit}:${node.rank}`, node);
                    byColumnAndRow.set(`${node.column}:${node.row}`, node);
                }
            }

            const edges = [];
            const edgesByType = new Map();

            const addEdge = (from, to, type) => {
                const edge = { from: from.id, to: to.id, type };
                edges.push(edge);
                if (!edgesByType.has(type)) edgesByType.set(type, []);
                edgesByType.get(type).push(edge);
            };

            // Tableau cover dependency: upper card blocks card directly below it.
            for (const node of cardNodes) {
                const below = byColumnAndRow.get(`${node.column}:${node.row - 1}`);
                if (below) addEdge(node, below, 'covers');
            }

            // Foundation dependency: higher rank card requires previous rank of same suit.
            for (const node of cardNodes) {
                if (!Number.isFinite(node.rank) || node.rank <= 1) continue;
                const prerequisite = bySuitAndRank.get(`${node.suit}:${node.rank - 1}`);
                if (prerequisite) addEdge(node, prerequisite, 'foundation-prerequisite');
            }

            return {
                nodes: cardNodes,
                edges,
                edgesByType
            };
        }

        static createKlondikePreset() {
            return new SolitaireInsolvabilityDetector({
                variantId: 'klondike',
                matchers: [
                    SolitaireInsolvabilityDetector.matchers.foundationOrderInversion({
                        ruleId: 'klondike.foundation-order-inversion',
                        minPairs: 3,
                        requireHiddenCover: true
                    }),
                    SolitaireInsolvabilityDetector.matchers.entombedAces({
                        ruleId: 'klondike.entombed-aces',
                        minAces: 2,
                        minCardsAbove: 4,
                        requireHiddenAbove: true
                    })
                ],
                minMatchedRules: 1
            });
        }

        static createFreeCellPreset() {
            return new SolitaireInsolvabilityDetector({
                variantId: 'freecell',
                matchers: [
                    SolitaireInsolvabilityDetector.matchers.foundationOrderInversion({
                        ruleId: 'freecell.foundation-order-inversion',
                        minPairs: 7,
                        requireHiddenCover: false
                    })
                ],
                minMatchedRules: 1
            });
        }

        static rankFromValue(value) {
            if (value === 'A') return 1;
            if (value === 'J') return 11;
            if (value === 'Q') return 12;
            if (value === 'K') return 13;
            const parsed = parseInt(value, 10);
            return Number.isFinite(parsed) ? parsed : NaN;
        }

        static colorFromSuit(suit) {
            if (suit === '♥' || suit === '♦') return 'red';
            if (suit === '♣' || suit === '♠') return 'black';
            return '';
        }
    }

    SolitaireInsolvabilityDetector.matchers = {
        foundationOrderInversion: function (config = {}) {
            const minPairs = Number.isFinite(config.minPairs) ? Math.max(1, config.minPairs) : 2;
            const requireHiddenCover = config.requireHiddenCover === true;
            const ruleId = config.ruleId || 'foundation-order-inversion';

            return ({ graph }) => {
                const covers = graph.edgesByType.get('covers') || [];
                const nodeById = new Map(graph.nodes.map(node => [node.id, node]));
                const evidence = [];

                for (const coverEdge of covers) {
                    const upper = nodeById.get(coverEdge.from);
                    const lower = nodeById.get(coverEdge.to);
                    if (!upper || !lower) continue;
                    if (upper.suit !== lower.suit) continue;
                    if (upper.rank !== lower.rank + 1) continue;
                    if (requireHiddenCover && !upper.hidden) continue;

                    evidence.push({
                        upper: upper.id,
                        lower: lower.id,
                        suit: upper.suit,
                        ranks: [upper.rank, lower.rank],
                        hiddenUpper: upper.hidden
                    });
                }

                if (evidence.length < minPairs) {
                    return {
                        matched: false,
                        ruleId
                    };
                }

                return {
                    matched: true,
                    ruleId,
                    reason: `Detected ${evidence.length} same-suit foundation-order inversions in cover dependencies.`,
                    evidence,
                    score: evidence.length
                };
            };
        },

        entombedAces: function (config = {}) {
            const minAces = Number.isFinite(config.minAces) ? Math.max(1, config.minAces) : 2;
            const minCardsAbove = Number.isFinite(config.minCardsAbove) ? Math.max(1, config.minCardsAbove) : 4;
            const requireHiddenAbove = config.requireHiddenAbove !== false;
            const ruleId = config.ruleId || 'entombed-aces';

            return ({ graph }) => {
                const byColumn = new Map();
                for (const node of graph.nodes) {
                    if (!byColumn.has(node.column)) byColumn.set(node.column, []);
                    byColumn.get(node.column).push(node);
                }
                for (const nodes of byColumn.values()) {
                    nodes.sort((a, b) => a.row - b.row);
                }

                const entombed = [];
                for (const node of graph.nodes) {
                    if (node.rank !== 1) continue;
                    const columnNodes = byColumn.get(node.column) || [];
                    const above = columnNodes.filter(candidate => candidate.row > node.row);
                    if (above.length < minCardsAbove) continue;
                    if (requireHiddenAbove && !above.every(candidate => candidate.hidden)) continue;
                    entombed.push({ ace: node.id, cardsAbove: above.length });
                }

                if (entombed.length < minAces) {
                    return {
                        matched: false,
                        ruleId
                    };
                }

                return {
                    matched: true,
                    ruleId,
                    reason: `Detected ${entombed.length} entombed aces with deep blockers.`,
                    evidence: entombed,
                    score: entombed.length
                };
            };
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SolitaireInsolvabilityDetector;
    }
    if (globalScope) {
        globalScope.SolitaireInsolvabilityDetector = SolitaireInsolvabilityDetector;
    }
})(typeof window !== 'undefined' ? window : globalThis);
