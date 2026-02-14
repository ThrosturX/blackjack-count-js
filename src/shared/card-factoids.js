/**
 * Card factoids and tips for educational break cards.
 * Extracted from learn-cards.js for future localization support.
 */

const CardFactoids = {
    common: [
        {
            text: "The Jack was called the Knave. It was later replaced by the Jack to better distinguish the Knave from the King.",
            get cards() {
                let num_jacks = Math.floor(Math.random() * 3) + 1;
                let num_kings = Math.floor(Math.random() + 0.5);
                let card_list = [];
                for (let i = 0; i < num_jacks; i++) {
                    card_list.push(new Card("R", "J"));
                }
                for (let i = 0; i < num_kings; i++) {
                    card_list.push(new Card("R", "K"));
                }
                let shuffled = EducationalUtils.shuffle(card_list);
                return shuffled.filter((card, index, self) =>
                    index === self.findIndex((c) => c.suit === card.suit)
                );
            }
        },
        {
            text: "Traditional French suits are Hearts, Spades, Diamonds, and Clubs.",
            cards: [new Card("♥", "A"), new Card("♠", "A"), new Card("♦", "A"), new Card("♣", "A")]
        },
        {
            text: "A standard deck has 52 cards: 13 per suit.",
            cards: [new Card("♥", "K"), new Card("♣", "K"), new Card("♦", "K"), new Card("♠", "K")]
        },
        {
            text: "The face cards are Jack, Queen, and King.",
            cards: [new Card("R", "J"), new Card("R", "Q"), new Card("R", "K")]
        },
        {
            text: "France solidified the standard trio of King, Queen, and Jack (previously named 'Knave')",
            cards: [new Card("R", "J"), new Card("R", "Q"), new Card("R", "K")]
        },
        {
            text: "Tip: You can count the pips to find the rank! Classic faces often feature art, but pips never lie.",
            cards: [new Card("♠", "7"), new Card("♥", "J")]
        }
    ],

    knight: [
        {
            text: "The Knight appeared in 56-card decks between Knave and Queen.",
            cards: [new Card("R", "J"), new Card("R", "C"), new Card("R", "Q")]
        },
        {
            text: "56-card decks originated in the 15th century and included an extra court card known as the Knight (or Viceroy). It was placed between the Jack and Queen.",
            cards: [new Card("R", "J"), new Card("R", "C"), new Card("R", "Q")]
        },
        {
            text: "The Knight was removed from decks to standardize the 52-card format around the 16th century.",
            cards: [new Card("R", "C"), new Card("R", "C"), new Card("R", "C")]
        },
        {
            text: "The Knight's letter 'C' comes from the French 'Cavalier' (Knight).",
            cards: [new Card("♥", "C"), new Card("♠", "C"), new Card("♦", "C"), new Card("♣", "C")]
        },
        {
            text: "The Knight appeared in 56-card decks between the Knave and Queen.",
            cards: [new Card("R", "J"), new Card("R", "C"), new Card("R", "Q"), new Card("R", "K")]
        },
    ],

    levelTips: {
        1: ["Hearts and Diamonds are red.", "Spades and Clubs are black.", "Each suit has 13 cards."],
        2: ["A then 2 to 10, then J-Q-K.", "Suits are shown by symbol.", "Cards can share rank across suits."],
        3: ["Same rank can have many suits.", "Colors are red or black.", "Higher means bigger rank value."],
        4: ["Tap higher or lower by rank.", "Ace is low in this mode.", "Practice makes rank comparison fast."],
        5: ["History breaks appear between drills.", "Knight sits between Knave and Queen in 56-card decks.", "Card symbols evolved over centuries."]
    }
};

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CardFactoids;
}
