
const { EmbedBuilder } = require('discord.js');
const embedCreator = require('../utils/embedCreator');

// Get prefix from .env
const PREFIX = process.env.PREFIX || '!';

module.exports = {
  name: 'help',
  aliases: ['commands', 'guide'],
  description: 'Display all available commands and their usage',

  async execute(message, args) {
    // If a specific command is requested
    if (args.length > 0) {
      const commandName = args[0].toLowerCase();
      return await showSpecificHelp(message, commandName);
    }

    // Main help embed
    const helpEmbed = embedCreator.createEmbed(
      "STALKERNet Command Guide",
      "Welcome to the Zone, Stalker! Here are all available commands organized by category:",
      "primary"
    );

    // Basic Commands
    helpEmbed.addFields({
      name: "🎮 Basic Commands",
      value: [
        `\`${PREFIX}profile\` - View your stalker profile and stats`,
        `\`${PREFIX}inventory [page]\` - Check your equipment and items`,
        `\`${PREFIX}help [command]\` - Show this help or specific command info`
      ].join('\n'),
      inline: false
    });

    // Zone & Travel
    helpEmbed.addFields({
      name: "🗺️ Zone & Travel",
      value: [
        `\`${PREFIX}travel <zone>\` - Travel to different zones`,
        `\`${PREFIX}weather\` - Check current weather conditions`,
        `\`${PREFIX}explore\` - Explore your current zone for items and encounters`
      ].join('\n'),
      inline: false
    });

    // Anomaly & Artifacts
    helpEmbed.addFields({
      name: "🔬 Anomaly & Artifacts",
      value: [
        `\`${PREFIX}anomaly scan\` - Search for anomaly fields`,
        `\`${PREFIX}anomaly enter\` - Enter an anomaly to find artifacts`,
        `\`${PREFIX}anomaly info\` - Learn about anomaly types`,
        `\`${PREFIX}artifacts\` - View information about artifacts`
      ].join('\n'),
      inline: false
    });

    // Combat & Hunting
    helpEmbed.addFields({
      name: "⚔️ Combat & Hunting",
      value: [
        `\`${PREFIX}combat hunt\` - Hunt mutants for loot and experience`,
        `\`${PREFIX}combat encounter\` - Face random Zone encounters`,
        `\`${PREFIX}pvp challenge <user>\` - Challenge another stalker to combat`
      ].join('\n'),
      inline: false
    });

    // Equipment & Maintenance
    helpEmbed.addFields({
      name: "🔧 Equipment & Maintenance",
      value: [
        `\`${PREFIX}maintain\` - Check equipment condition`,
        `\`${PREFIX}maintain repair <item>\` - Repair damaged equipment`,
        `\`${PREFIX}craft list\` - View available crafting recipes`,
        `\`${PREFIX}craft <item>\` - Craft items from materials`
      ].join('\n'),
      inline: false
    });

    // Trading & Economy
    helpEmbed.addFields({
      name: "💰 Trading & Economy",
      value: [
        `\`${PREFIX}trade vendor\` - Browse vendor items in settlements`,
        `\`${PREFIX}trade buy <item>\` - Purchase items from vendors`,
        `\`${PREFIX}trade sell <item>\` - Sell items to vendors`
      ].join('\n'),
      inline: false
    });

    // Faction & Quests
    helpEmbed.addFields({
      name: "🏴 Faction & Quests",
      value: [
        `\`${PREFIX}factions\` - View faction information and standings`,
        `\`${PREFIX}quest list\` - View available quests`,
        `\`${PREFIX}quest accept <id>\` - Accept a quest`,
        `\`${PREFIX}dailyquest\` - Check daily quest availability`
      ].join('\n'),
      inline: false
    });

    helpEmbed.setFooter({ 
      text: `Use ${PREFIX}help <command> for detailed information about a specific command`
    });

    await message.reply({ embeds: [helpEmbed] });
  },
};

async function showSpecificHelp(message, commandName) {
  const commands = {
    'profile': {
      description: "View your stalker profile including health, faction, equipment, and Zone statistics",
      usage: `${PREFIX}profile`,
      aliases: "stats, status, info"
    },
    'inventory': {
      description: "View your current inventory with pagination support. Shows all items, their weights, and values",
      usage: `${PREFIX}inventory [page number]`,
      aliases: "inv, items, bag"
    },
    'travel': {
      description: "Travel between different zones in the Exclusion Zone. Costs rubles and time",
      usage: `${PREFIX}travel <zone name>`,
      aliases: "go, move",
      examples: `${PREFIX}travel garbage\n${PREFIX}travel rookie village`
    },
    'anomaly': {
      description: "Interact with anomaly fields to find valuable artifacts",
      usage: [
        `${PREFIX}anomaly scan - Search for anomalies`,
        `${PREFIX}anomaly enter - Enter detected anomaly`,
        `${PREFIX}anomaly avoid - Avoid detected anomaly`,
        `${PREFIX}anomaly info - Learn about anomaly types`
      ].join('\n'),
      aliases: "anomalies, field, zone"
    },
    'combat': {
      description: "Engage in combat with Zone mutants and other dangers",
      usage: [
        `${PREFIX}combat hunt - Hunt for mutants`,
        `${PREFIX}combat encounter - Random Zone encounter`
      ].join('\n'),
      aliases: "fight, battle, hunt"
    },
    'craft': {
      description: "Craft items from scavenged materials and components",
      usage: [
        `${PREFIX}craft list - View available recipes`,
        `${PREFIX}craft materials - Check crafting materials`,
        `${PREFIX}craft <item name> - Craft specific item`
      ].join('\n'),
      aliases: "crafting, make, create"
    },
    'maintain': {
      description: "Maintain and repair your equipment to keep it in working condition",
      usage: [
        `${PREFIX}maintain - Check equipment status`,
        `${PREFIX}maintain repair weapon - Repair equipped weapon`,
        `${PREFIX}maintain repair armor - Repair equipped armor`
      ].join('\n'),
      aliases: "repair, fix, maintenance"
    },
    'trade': {
      description: "Buy and sell items with Zone vendors in settlements",
      usage: [
        `${PREFIX}trade vendor - Browse vendor inventory`,
        `${PREFIX}trade buy <item> - Purchase item`,
        `${PREFIX}trade sell <item> - Sell item`
      ].join('\n'),
      aliases: "shop, vendor, buy, sell"
    },
    'factions': {
      description: "View information about Zone factions and your standing with them",
      usage: `${PREFIX}factions`,
      aliases: "faction, rep, reputation"
    },
    'quest': {
      description: "Manage quests and missions in the Zone",
      usage: [
        `${PREFIX}quest list - View available quests`,
        `${PREFIX}quest accept <id> - Accept a quest`,
        `${PREFIX}quest progress - Check quest progress`,
        `${PREFIX}quest complete <id> - Complete a quest`
      ].join('\n'),
      aliases: "quests, mission, missions"
    },
    'weather': {
      description: "Check current weather conditions affecting Zone activities",
      usage: `${PREFIX}weather`,
      aliases: "forecast, conditions"
    },
    'artifacts': {
      description: "View information about Zone artifacts and their properties",
      usage: `${PREFIX}artifacts`,
      aliases: "artifact"
    },
    'pvp': {
      description: "Challenge other stalkers to player vs player combat",
      usage: [
        `${PREFIX}pvp challenge <user> - Challenge another player`,
        `${PREFIX}pvp accept - Accept PvP challenge`,
        `${PREFIX}pvp decline - Decline PvP challenge`
      ].join('\n'),
      aliases: "duel, fight"
    },
    'explore': {
      description: "Explore your current zone to find items, encounters, and hidden locations",
      usage: `${PREFIX}explore`,
      aliases: "scout, search"
    },
    'dailyquest': {
      description: "Check and accept daily quests for bonus rewards",
      usage: `${PREFIX}dailyquest`,
      aliases: "daily, dailies"
    }
  };

  const cmd = commands[commandName];
  if (!cmd) {
    const errorEmbed = embedCreator.createErrorEmbed(
      "Command Not Found",
      `No help available for command "${commandName}". Use \`${PREFIX}help\` to see all commands.`
    );
    return await message.reply({ embeds: [errorEmbed] });
  }

  const helpEmbed = embedCreator.createEmbed(
    `Command: ${PREFIX}${commandName}`,
    cmd.description,
    "primary"
  );

  helpEmbed.addFields({ name: "Usage", value: `\`\`\`${cmd.usage}\`\`\``, inline: false });

  if (cmd.aliases) {
    helpEmbed.addFields({ name: "Aliases", value: cmd.aliases, inline: true });
  }

  if (cmd.examples) {
    helpEmbed.addFields({ name: "Examples", value: `\`\`\`${cmd.examples}\`\`\``, inline: false });
  }

  await message.reply({ embeds: [helpEmbed] });
}
