(function initAppProfile(global) {
  const profile = Object.freeze({
    id: "solitaire",
    displayName: "Virtue Solitaire Collection",
    tagline: "Focused solitaire lineup with classic variants, plus an experimental sandbox.",
    launcherGroups: ["solitaire", "sandbox"],
    storeGameFilter: ["klondike", "freecell", "spider", "pyramid", "tabletop"],
    storeEnabled: true
  });

  global.AppProfile = profile;
})(window);
