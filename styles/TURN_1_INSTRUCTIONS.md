# Turn 1: CSS Refactoring - Game-Specific Stylesheets

## What I Created

I've split your monolithic `style.css` (2314 lines!) into focused, maintainable stylesheets:

### Core Files (Shared)
- **`styles/core.css`** - Card rendering, animations, buttons, common components
- **`styles/layout.css`** - Page structure, header, navigation, addon system

### Game-Specific Files
- **`styles/blackjack.css`** - Dealer area, seats, betting, chips, shoe, count display
- **`styles/poker.css`** - Community cards, pot display, poker-specific UI
- **`styles/solitaire.css`** - Klondike, FreeCell, Spider layouts and mechanics
- **`styles/tabletop.css`** - Sandbox mode, draggable cards, tools

### What Moved Where

**Core.css includes:**
- CSS variables (`:root`)
- Card component styles (`.card`, `.face-up`, `.face-down`)
- All animations (`@keyframes`)
- Common button styles
- Stats displays
- Mobile card scaling

**Layout.css includes:**
- Body and header styles
- Game controls and control sections
- Addon toggle system
- Back navigation
- Common table container
- Responsive header

**Blackjack.css includes:**
- Dealer area and cards
- Player seats and betting
- Chip system (all chip colors)
- 3D shoe rendering
- Count display
- Strategy bar
- Mobile blackjack layout

**Solitaire.css includes:**
- All three solitaire variants (Klondike, FreeCell, Spider)
- Pile systems (stock, waste, foundation, tableau)
- Win message
- Game controls bar
- Layout stability fixes
- Responsive solitaire

**Poker.css includes:**
- Community cards area
- Pot display
- Player positioning (6-player table)
- Hand rankings display
- Betting controls
- Dealer button
- All-in and fold states

**Tabletop.css includes:**
- Free-form play area
- Draggable cards
- Card piles
- Tabletop tools
- Context menu
- Grid overlay
- Multi-select features

## Next Steps - What YOU Need to Do

### 1. Create a `styles/` directory in your repo
```bash
mkdir styles
```

### 2. Copy the new CSS files
Copy all files from the `styles/` folder I provided into your new `styles/` directory.

### 3. Update your HTML files
Each game HTML file needs to import only the CSS it needs. Here's the pattern:

**For `blackjack.html`:**
```html
<link rel="stylesheet" href="styles/core.css">
<link rel="stylesheet" href="styles/layout.css">
<link rel="stylesheet" href="styles/blackjack.css">
<link rel="stylesheet" href="themes.css">
```

**For `poker.html`:**
```html
<link rel="stylesheet" href="styles/core.css">
<link rel="stylesheet" href="styles/layout.css">
<link rel="stylesheet" href="styles/poker.css">
<link rel="stylesheet" href="themes.css">
```

**For `solitaire.html`, `freecell.html`, `spider.html`:**
```html
<link rel="stylesheet" href="styles/core.css">
<link rel="stylesheet" href="styles/layout.css">
<link rel="stylesheet" href="styles/solitaire.css">
<link rel="stylesheet" href="themes.css">
```

**For `tabletop.html`:**
```html
<link rel="stylesheet" href="styles/core.css">
<link rel="stylesheet" href="styles/layout.css">
<link rel="stylesheet" href="styles/tabletop.css">
<link rel="stylesheet" href="themes.css">
```

**For `index.html` (landing page):**
```html
<link rel="stylesheet" href="styles/core.css">
<link rel="stylesheet" href="styles/layout.css">
<link rel="stylesheet" href="themes.css">
```

### 4. Test each game
Load each game page and verify:
- ✅ Cards render correctly
- ✅ Layouts look right
- ✅ Animations work
- ✅ Mobile responsive behavior

### 5. Commit!
```bash
git add styles/
git add *.html
git commit -m "refactor(styles): split monolithic style.css into game-specific stylesheets

- Created styles/blackjack.css for blackjack-specific UI
- Created styles/poker.css for poker table and betting UI
- Created styles/solitaire.css for solitaire/freecell/spider layouts
- Created styles/tabletop.css for sandbox mode
- Created styles/core.css for shared card/animation components
- Created styles/layout.css for page structure and navigation
- Maintains all existing functionality, improves maintainability

Co-authored-by: Claude <claude@anthropic.com>"
```

## What This Fixes

✅ **File bloat solved** - Each game loads ~3-4 focused stylesheets instead of one 2314-line monster
✅ **Token efficiency** - If something breaks, you send me ~500 lines instead of 200K tokens
✅ **Maintainability** - Know exactly where to find poker pot styling vs solitaire pile styling
✅ **Loading performance** - Browsers can cache shared files (core.css, layout.css)
✅ **Addon pattern maintained** - Just like your addons, these are modular CSS files

## Notes

- I kept `themes.css` as-is since it's already isolated
- All your existing class names and IDs are preserved
- No functionality changes - this is a pure organizational refactor
- Mobile breakpoints are in the appropriate files (blackjack mobile → blackjack.css)

Ready for Turn 2 when you are! 🎯
