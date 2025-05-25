// STALKERNet Discord Bot - Configuration
// Contains global settings and constants for the bot
module.exports = {
  // User stats limits
  maxHealth: 100,
  maxStamina: 100,
  maxInventoryWeight: 50,

  // Starting values for new users
  startingHealth: 100,
  startingRubles: 500,
  startZone: "rookie_village",

  // Cooldown times (in minutes)
  cooldowns: {
    hunt: 10,
    travel: 5,
    scout: 15,
    camp: 30,
    detect: 10,
    explore: 10
  },

  // Item modifiers
  sellModifier: 0.7, // Players get 70% of item value when selling to vendors

  // Colors for embeds
  colors: {
    primary: "#4287f5",
    secondary: "#a63ee5",
    success: "#43cc47",
    error: "#cc4343",
    warning: "#e5ca3e",
    radiation: "#85bb65",
    factions: {
      loners: "#d9a83e",
      duty: "#cc4343",
      freedom: "#43cc47",
      clear_sky: "#4287f5", 
      ecologists: "#f0e68c",
      monolith: "#ffffff",
      bandits: "#5a5a5a",
      military: "#2f4f4f",
      mercenaries: "#0066cc"
    }
  }
};