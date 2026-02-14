(function initAppProfile(global) {
  const profile = Object.freeze({
    id: "solitaire",
    displayName: "Virtue Solitaire Collection",
    tagline: "Select your favourite Patience game, one of our originals or play in the experimental table top sandbox.",
    launcherGroups: ["solitaire", "sandbox", "educational"],
    storeGameFilter: ["klondike", "freecell", "spider", "pyramid", "tabletop"],
    storeEnabled: true,
    addonToggleAllowlist: null,
    themeDefaults: null,
    addonDefaults: null,
    autoClaimAllAddons: false,
    autoEnableHiddenAddons: false,
    temporaryEducationalInSolitaire: true
  });

  global.AppProfile = profile;
})(window);
