const { EmbedBuilder } = require("discord.js");
const dataManager = require("../utils/dataManager");
const config = require("../config");
const embedCreator = require("../utils/embedCreator");

// Get prefix from .env
const PREFIX = process.env.PREFIX || "!";

// Available factions
const AVAILABLE_FACTIONS = [
  "Loners",
  "Duty",
  "Freedom",
  "Bandits",
  "Clear Sky",
  "Ecologists",
  "Mercenaries",
];

module.exports = {
  name: "factions",
  aliases: ["faction", "f"],
  description: "Faction-related commands for STALKERNet",

  async execute(message, args) {
    const userId = message.author.id;

    // Get or create user
    let user = dataManager.getUser(userId);
    if (!user) {
      user = dataManager.createUser(userId, message.author.username);
      const welcomeEmbed = embedCreator.createSuccessEmbed(
        "Profile Created",
        `Welcome to the Zone, Stalker! Your profile has been created.`,
      );
      await message.reply({ embeds: [welcomeEmbed] });
    }

    // Check if a subcommand was provided
    if (!args.length) {
      const helpEmbed = embedCreator.createEmbed(
        "Faction Command Help",
        `Please provide a subcommand: \`${PREFIX}factions info\` or \`${PREFIX}factions join <faction>\``,
        "primary",
      );
      return message.reply({ embeds: [helpEmbed] });
    }

    const subcommand = args[0].toLowerCase();

    if (subcommand === "info") {
      // Create an embed with information about all factions
      const factionsEmbed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle("Factions of the Zone")
        .setDescription("Choose your allegiance carefully, Stalker.")
        .addFields(
          {
            name: "Loners",
            value:
              "Independent stalkers with no strong allegiance. Good for beginners, with balanced stats.",
            inline: false,
          },
          {
            name: "Duty",
            value:
              "Military-like organization determined to contain the Zone. Bonus to armor and combat.",
            inline: false,
          },
          {
            name: "Freedom",
            value:
              "Anarchists who want to free the Zone. Bonus to stamina and exploration.",
            inline: false,
          },
          {
            name: "Bandits",
            value: "Opportunistic criminals. Bonus to trading and scavenging.",
            inline: false,
          },
          {
            name: "Clear Sky",
            value:
              "Scientists and stalkers who research the Zone. Bonus to artifact handling.",
            inline: false,
          },
          {
            name: "Ecologists",
            value:
              "Scientific expedition. Bonus to research and radiation resistance.",
            inline: false,
          },
          {
            name: "Mercenaries",
            value: "Guns for hire. Bonus to weapon handling and combat.",
            inline: false,
          },
        )
        .setFooter({
          text: `Use ${PREFIX}factions join <faction> to select your faction`,
        })
        .setTimestamp();

      await message.reply({ embeds: [factionsEmbed] });
    } else if (subcommand === "join") {
      // Check if a faction was specified
      if (args.length < 2) {
        return createErrorEmbed(
          `Bad Command Usage`,
          `Please specify a faction to join: \`${PREFIX}factions join <faction>\`. Use \`${PREFIX}factions info\` to see available factions.`,
        );
      }

      // Get the faction name (might be multiple words)
      const selectedFactionInput = args.slice(1).join(" ");

      // Find the matching faction (case insensitive)
      const selectedFaction = AVAILABLE_FACTIONS.find(
        (faction) =>
          faction.toLowerCase() === selectedFactionInput.toLowerCase(),
      );

      if (!selectedFaction) {
        return createErrorEmbed(
          `Invalid Faction`,
          `"${selectedFactionInput}" is not a recognized faction. Use \`${PREFIX}factions info\` to see available factions.`,
        );
      }

      // Check if user already has a faction
      if (user.faction && user.faction !== selectedFaction) {
        return createFactionEmbed(
          `Faction Join`,
          `You're already a member of ${user.faction}. Changing factions will reset your reputation. Use \`${PREFIX}factions leave\` first if you want to change.`,
          `${user.faction}`,
        );
      }

      // Apply faction update
      user.faction = selectedFaction;

      // Apply faction-specific bonuses (can be expanded)
      switch (selectedFaction) {
        case "Duty":
          user.bonuses.armorBonus = 10;
          user.bonuses.combatBonus = 5;
          break;
        case "Freedom":
          user.bonuses.staminaBonus = 10;
          user.bonuses.explorationBonus = 5;
          break;
        case "Bandits":
          user.bonuses.tradingBonus = 10;
          user.bonuses.scavengingBonus = 5;
          break;
        case "Clear Sky":
          user.bonuses.artifactBonus = 10;
          user.bonuses.researchBonus = 5;
          break;
        case "Ecologists":
          user.bonuses.researchBonus = 10;
          user.bonuses.radiationResistance = 5;
          break;
        case "Mercenaries":
          user.bonuses.weaponBonus = 10;
          user.bonuses.combatBonus = 5;
          break;
        case "Loners":
        default:
          // Balanced stats for Loners
          user.bonuses.generalBonus = 5;
          break;
      }

      // Save updated user data
      dataManager.saveUser(user);

      // Send confirmation
      const factionEmbed = new EmbedBuilder()
        .setColor(config.colors.faction[selectedFaction])
        .setTitle(`Welcome to ${selectedFaction}`)
        .setDescription(
          `You have successfully joined the ${selectedFaction} faction.`,
        )
        .addFields({
          name: "Faction Bonuses",
          value:
            Object.entries(user.bonuses)
              .filter(([_, value]) => value > 0)
              .map(
                ([key, value]) =>
                  `${
                    key
                      .replace(/([A-Z])/g, " $1")
                      .charAt(0)
                      .toUpperCase() + key.replace(/([A-Z])/g, " $1").slice(1)
                  }: +${value}`,
              )
              .join("\n") || "No bonuses",
          inline: false,
        })
        .setFooter({
          text: "Your new faction will guide your path in the Zone",
        })
        .setTimestamp();

      await message.reply({ embeds: [factionEmbed] });
    } else if (subcommand === "leave") {
      // Check if user is in a faction
      if (!user.faction) {
        return createErrorEmbed(
          "Faction Status",
          "You aren't a member of any faction yet.",
        );
      }

      const oldFaction = user.faction;

      // Reset faction and bonuses
      user.faction = null;
      user.bonuses = {};

      // Save updated user data
      dataManager.saveUser(user);

      await createFactionEmbed(
        `Faction Leave`,
        `You have left the ${oldFaction} faction. Your reputation and bonuses have been reset.`,
        `${oldFaction}`,
      );
    } else {
      // Unknown subcommand
      return createErrorEmbed(
        "Bad Command Usage",
        `Unknown subcommand: "${subcommand}". Available subcommands: info, join, leave`,
      );
    }
  },
};
