const { EmbedBuilder } = require("discord.js");
const dataManager = require("../utils/dataManager");
const config = require("../config");
const embedCreator = require("../utils/embedCreator");

// Get prefix from .env
const PREFIX = process.env.PREFIX || "!";

// Daily and weekly reset times (milliseconds)
const DAILY_RESET = 24 * 60 * 60 * 1000; // 24 hours
const WEEKLY_RESET = 7 * 24 * 60 * 60 * 1000; // 7 days

// Daily quest types
const DAILY_QUEST_TYPES = [
  {
    id: "mutant_hunt",
    name: "Mutant Hunt",
    description: "Hunt a specific number of mutants.",
    targets: ["bloodsucker", "boar", "flesh", "snork", "pseudodog"],
    countRange: [2, 5],
    rewardRubles: [200, 500],
    rewardReputation: [5, 15],
  },
  {
    id: "artifact_hunt",
    name: "Artifact Hunt",
    description: "Find a specific artifact type.",
    targets: ["medusa", "stone_flower", "soul", "crystal", "fireball"],
    countRange: [1, 2],
    rewardRubles: [500, 1000],
    rewardReputation: [10, 20],
  },
  {
    id: "scavenge",
    name: "Scavenge Run",
    description: "Collect a certain amount of rubles through exploration.",
    targets: ["rubles"],
    countRange: [500, 2000],
    rewardRubles: [250, 500],
    rewardReputation: [5, 15],
  },
  {
    id: "pvp_duels",
    name: "Zone Domination",
    description: "Win a certain number of PVP duels.",
    targets: ["duel_wins"],
    countRange: [1, 3],
    rewardRubles: [300, 800],
    rewardReputation: [10, 20],
  },
];

// Weekly quest types
const WEEKLY_QUEST_TYPES = [
  {
    id: "area_clear",
    name: "Area Clearing",
    description: "Clear a dangerous zone of all mutant presence.",
    targets: ["mutant_kills"],
    countRange: [15, 30],
    rewardRubles: [1000, 2500],
    rewardReputation: [30, 50],
    rewardItemChance: 0.7, // 70% chance for bonus item
    rewardItems: ["medkit_army", "antirad", "detector_advanced"],
  },
  {
    id: "artifact_collection",
    name: "Artifact Collection",
    description: "Gather a variety of artifacts for scientific research.",
    targets: ["artifact_finds"],
    countRange: [3, 7],
    rewardRubles: [2000, 4000],
    rewardReputation: [40, 60],
    rewardItemChance: 0.8,
    rewardItems: ["detector_veles", "ssp_suit"],
  },
  {
    id: "faction_warfare",
    name: "Faction Warfare",
    description: "Win multiple duels against members of rival factions.",
    targets: ["faction_duel_wins"],
    countRange: [5, 10],
    rewardRubles: [1500, 3000],
    rewardReputation: [35, 55],
    rewardItemChance: 0.6,
    rewardItems: ["abakan", "exo"],
  },
];

module.exports = {
  name: "dailyquest",
  aliases: ["dq", "daily", "weekly", "wq"],
  description: "Daily and weekly quest system",

  async execute(message, args) {
    const userId = message.author.id;

    // Get user data or create if not exists
    let user = dataManager.getUser(userId);
    if (!user) {
      user = dataManager.createUser(userId, message.author.username);
      await createSuccessEmbed(
        `Profile Created`,
        `Welcome to the Zone, Stalker! Your profile has been created.`,
      );
    }

    // Ensure user has daily/weekly quest data structure
    if (!user.timeQuests) {
      user.timeQuests = {
        daily: {
          quest: null,
          lastReset: 0,
          progress: 0,
          completed: false,
        },
        weekly: {
          quest: null,
          lastReset: 0,
          progress: 0,
          completed: false,
        },
      };
    }

    // Check for subcommands
    const subcommand = args.length > 0 ? args[0].toLowerCase() : "status";

    if (subcommand === "status") {
      // Check and update quest status
      checkAndUpdateQuests(user);

      // Create status embed
      const statusEmbed = embedCreator.createEmbed(
        "Daily & Weekly Quests",
        "Special time-limited missions with valuable rewards.",
        "primary",
      );

      // Add daily quest info
      if (user.timeQuests.daily.quest) {
        const daily = user.timeQuests.daily;
        const dailyQuest = daily.quest;

        // Determine completion status
        const dailyStatus = daily.completed
          ? "✅ COMPLETED"
          : `Progress: ${daily.progress}/${dailyQuest.targetCount}`;

        statusEmbed.addFields({
          name: `Daily Quest: ${dailyQuest.name}`,
          value: `${dailyQuest.description}\n**Target**: ${dailyQuest.targetDescription}\n**Status**: ${dailyStatus}\n**Rewards**: ${dailyQuest.rewardRubles} RU, ${dailyQuest.rewardReputation} Rep`,
          inline: false,
        });
      } else {
        statusEmbed.addFields({
          name: "Daily Quest",
          value:
            "No active daily quest. Use `!dailyquest get daily` to receive one.",
          inline: false,
        });
      }

      // Add weekly quest info
      if (user.timeQuests.weekly.quest) {
        const weekly = user.timeQuests.weekly;
        const weeklyQuest = weekly.quest;

        // Determine completion status
        const weeklyStatus = weekly.completed
          ? "✅ COMPLETED"
          : `Progress: ${weekly.progress}/${weeklyQuest.targetCount}`;

        let rewardsText = `${weeklyQuest.rewardRubles} RU, ${weeklyQuest.rewardReputation} Rep`;
        if (weeklyQuest.rewardItem) {
          const items = dataManager.getItems();
          const itemName =
            items[weeklyQuest.rewardItem]?.name || weeklyQuest.rewardItem;
          rewardsText += `, ${itemName}`;
        }

        statusEmbed.addFields({
          name: `Weekly Quest: ${weeklyQuest.name}`,
          value: `${weeklyQuest.description}\n**Target**: ${weeklyQuest.targetDescription}\n**Status**: ${weeklyStatus}\n**Rewards**: ${rewardsText}`,
          inline: false,
        });
      } else {
        statusEmbed.addFields({
          name: "Weekly Quest",
          value:
            "No active weekly quest. Use `!dailyquest get weekly` to receive one.",
          inline: false,
        });
      }

      // Add remaining time until reset
      const now = Date.now();
      let dailyResetTime = "No active quest";
      let weeklyResetTime = "No active quest";

      if (user.timeQuests.daily.lastReset > 0) {
        const nextDailyReset = user.timeQuests.daily.lastReset + DAILY_RESET;
        const dailyTimeLeft = nextDailyReset - now;

        if (dailyTimeLeft > 0) {
          const dailyHours = Math.floor(dailyTimeLeft / (60 * 60 * 1000));
          const dailyMinutes = Math.floor(
            (dailyTimeLeft % (60 * 60 * 1000)) / (60 * 1000),
          );
          dailyResetTime = `${dailyHours}h ${dailyMinutes}m`;
        } else {
          dailyResetTime = "Ready to reset";
        }
      }

      if (user.timeQuests.weekly.lastReset > 0) {
        const nextWeeklyReset = user.timeQuests.weekly.lastReset + WEEKLY_RESET;
        const weeklyTimeLeft = nextWeeklyReset - now;

        if (weeklyTimeLeft > 0) {
          const weeklyDays = Math.floor(weeklyTimeLeft / (24 * 60 * 60 * 1000));
          const weeklyHours = Math.floor(
            (weeklyTimeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
          );
          weeklyResetTime = `${weeklyDays}d ${weeklyHours}h`;
        } else {
          weeklyResetTime = "Ready to reset";
        }
      }

      statusEmbed.addFields({
        name: "Time Until Reset",
        value: `Daily: ${dailyResetTime}\nWeekly: ${weeklyResetTime}`,
        inline: false,
      });

      // Add footer with commands
      statusEmbed.setFooter({
        text: `${PREFIX}dailyquest get daily/weekly - ${PREFIX}dailyquest claim - ${PREFIX}dailyquest abandon`,
      });

      await message.reply({ embeds: [statusEmbed] });
    } else if (subcommand === "get") {
      // Check if quest type specified
      if (args.length < 2) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Missing Quest Type",
          `Please specify 'daily' or 'weekly'. Example: \`${PREFIX}dailyquest get daily\``,
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }

      const questType = args[1].toLowerCase();
      if (questType !== "daily" && questType !== "weekly") {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Invalid Quest Type",
          `Invalid quest type: "${questType}". Please use 'daily' or 'weekly'.`,
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }

      // Check and update status first
      checkAndUpdateQuests(user);

      // Check if already has active quest of this type
      if (
        user.timeQuests[questType].quest &&
        !user.timeQuests[questType].completed
      ) {
        const questEmbed = embedCreator.createEmbed(
          `Active ${questType.charAt(0).toUpperCase() + questType.slice(1)} Quest`,
          `You already have an active ${questType} quest. Complete it or abandon it before getting a new one.`,
          "primary",
        );

        const quest = user.timeQuests[questType].quest;
        const progress = user.timeQuests[questType].progress;

        questEmbed.addFields({
          name: quest.name,
          value: `${quest.description}\n**Target**: ${quest.targetDescription}\n**Progress**: ${progress}/${quest.targetCount}`,
          inline: false,
        });

        await message.reply({ embeds: [questEmbed] });
        return;
      }

      // Generate a new quest
      let newQuest;
      if (questType === "daily") {
        newQuest = generateDailyQuest(user);
      } else {
        // weekly
        newQuest = generateWeeklyQuest(user);
      }

      // Update user data
      user.timeQuests[questType] = {
        quest: newQuest,
        lastReset: Date.now(),
        progress: 0,
        completed: false,
      };

      // Save user data
      dataManager.saveUser(user);

      // Create quest received embed
      const questEmbed = embedCreator.createSuccessEmbed(
        `New ${questType.charAt(0).toUpperCase() + questType.slice(1)} Quest`,
        `You've received a new ${questType} quest!`,
      );

      // Add quest details
      questEmbed.addFields({
        name: newQuest.name,
        value: `${newQuest.description}\n**Target**: ${newQuest.targetDescription}`,
        inline: false,
      });

      // Add rewards
      let rewardsText = `${newQuest.rewardRubles} RU, ${newQuest.rewardReputation} Rep`;
      if (newQuest.rewardItem) {
        const items = dataManager.getItems();
        const itemName =
          items[newQuest.rewardItem]?.name || newQuest.rewardItem;
        rewardsText += `, ${itemName}`;
      }

      questEmbed.addFields({
        name: "Rewards",
        value: rewardsText,
        inline: false,
      });

      // Add footer
      questEmbed.setFooter({
        text: `Use ${PREFIX}dailyquest claim when you've completed the quest`,
      });

      await message.reply({ embeds: [questEmbed] });
    } else if (subcommand === "claim") {
      // Check and update quest status
      checkAndUpdateQuests(user);

      // Check if there's a completed quest
      const dailyCompleted =
        user.timeQuests.daily.quest && user.timeQuests.daily.completed;
      const weeklyCompleted =
        user.timeQuests.weekly.quest && user.timeQuests.weekly.completed;

      if (!dailyCompleted && !weeklyCompleted) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "No Completed Quests",
          "You don't have any completed quests to claim. Complete your active quests first.",
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }

      // Prepare reward summary
      let totalRubles = 0;
      let totalReputation = 0;
      const rewardItems = [];
      const claimedQuests = [];

      // Process daily quest if completed
      if (dailyCompleted) {
        const dailyQuest = user.timeQuests.daily.quest;
        totalRubles += dailyQuest.rewardRubles;
        totalReputation += dailyQuest.rewardReputation;
        claimedQuests.push(`Daily: ${dailyQuest.name}`);

        // Mark as claimed by setting to null
        user.timeQuests.daily.quest = null;
        user.timeQuests.daily.progress = 0;
        user.timeQuests.daily.completed = false;
      }

      // Process weekly quest if completed
      if (weeklyCompleted) {
        const weeklyQuest = user.timeQuests.weekly.quest;
        totalRubles += weeklyQuest.rewardRubles;
        totalReputation += weeklyQuest.rewardReputation;
        claimedQuests.push(`Weekly: ${weeklyQuest.name}`);

        // Add item reward if applicable
        if (weeklyQuest.rewardItem) {
          const items = dataManager.getItems();
          const item = items[weeklyQuest.rewardItem];
          if (item) {
            // Check inventory capacity
            if (
              user.inventoryWeight + item.weight <=
              config.maxInventoryWeight
            ) {
              user.inventory.push(weeklyQuest.rewardItem);
              user.inventoryWeight += item.weight;
              rewardItems.push(item.name);
            } else {
              // Convert to rubles if inventory full
              const itemValue = item.value || 500;
              totalRubles += itemValue;
              rewardItems.push(
                `${item.name} (converted to ${itemValue} RU - inventory full)`,
              );
            }
          }
        }

        // Mark as claimed by setting to null
        user.timeQuests.weekly.quest = null;
        user.timeQuests.weekly.progress = 0;
        user.timeQuests.weekly.completed = false;
      }

      // Award rewards
      user.rubles += totalRubles;
      user.reputation += totalReputation;

      // Check for rank up
      const oldRank = user.rank;
      user.rank = Math.floor(user.reputation / 100) + 1;
      const rankUp = user.rank > oldRank;

      // Save user data
      dataManager.saveUser(user);

      // Create reward embed
      const rewardEmbed = embedCreator.createSuccessEmbed(
        "Quest Rewards Claimed",
        `You've successfully claimed rewards for your completed time-limited quests!`,
      );

      // Add quest summary
      rewardEmbed.addFields({
        name: "Completed Quests",
        value: claimedQuests.join("\n"),
        inline: false,
      });

      // Add rewards
      let rewardsText = `• ${totalRubles} Rubles\n• ${totalReputation} Reputation`;
      if (rewardItems.length > 0) {
        rewardsText += `\n• Items: ${rewardItems.join(", ")}`;
      }

      rewardEmbed.addFields({
        name: "Rewards Received",
        value: rewardsText,
        inline: false,
      });

      // Add rank up information if applicable
      if (rankUp) {
        rewardEmbed.addFields({
          name: "🌟 Rank Up!",
          value: `You've been promoted to rank ${user.rank}!`,
          inline: false,
        });
      }

      await message.reply({ embeds: [rewardEmbed] });
    } else if (subcommand === "abandon") {
      // Check if quest type specified
      if (args.length < 2) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Missing Quest Type",
          `Please specify 'daily' or 'weekly'. Example: \`${PREFIX}dailyquest abandon daily\``,
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }

      const questType = args[1].toLowerCase();
      if (questType !== "daily" && questType !== "weekly") {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Invalid Quest Type",
          `Invalid quest type: "${questType}". Please use 'daily' or 'weekly'.`,
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }

      // Check if there's an active quest of this type
      if (!user.timeQuests[questType].quest) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "No Active Quest",
          `You don't have an active ${questType} quest to abandon.`,
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }

      // Get quest details for reference
      const questName = user.timeQuests[questType].quest.name;

      // Reset quest data
      user.timeQuests[questType].quest = null;
      user.timeQuests[questType].progress = 0;
      user.timeQuests[questType].completed = false;
      user.timeQuests[questType].lastReset = Date.now();

      // Save user data
      dataManager.saveUser(user);

      // Create abandon embed
      const abandonEmbed = embedCreator.createEmbed(
        "Quest Abandoned",
        `You've abandoned your ${questType} quest: ${questName}.\n\nYou can get a new ${questType} quest immediately.`,
        "primary",
      );

      await message.reply({ embeds: [abandonEmbed] });
    } else {
      // Unknown subcommand
      const errorEmbed = embedCreator.createErrorEmbed(
        "Unknown Command",
        `Unknown quest command: "${subcommand}". Available commands: status, get, claim, abandon.`,
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  },
};

/**
 * Check if quests need to be reset and update completion status
 * @param {Object} user - User data object
 */
function checkAndUpdateQuests(user) {
  const now = Date.now();

  // Check daily reset
  if (user.timeQuests.daily.lastReset > 0) {
    const nextDailyReset = user.timeQuests.daily.lastReset + DAILY_RESET;
    if (now >= nextDailyReset && user.timeQuests.daily.quest) {
      // Auto-reset if expired and not claimed
      if (user.timeQuests.daily.completed) {
        // If completed but not claimed, keep it for a day
        user.timeQuests.daily.lastReset = now;
      } else {
        // If not completed, reset entirely
        user.timeQuests.daily.quest = null;
        user.timeQuests.daily.progress = 0;
        user.timeQuests.daily.completed = false;
        user.timeQuests.daily.lastReset = 0;
      }
    }
  }

  // Check weekly reset
  if (user.timeQuests.weekly.lastReset > 0) {
    const nextWeeklyReset = user.timeQuests.weekly.lastReset + WEEKLY_RESET;
    if (now >= nextWeeklyReset && user.timeQuests.weekly.quest) {
      // Auto-reset if expired and not claimed
      if (user.timeQuests.weekly.completed) {
        // If completed but not claimed, keep it for a day
        user.timeQuests.weekly.lastReset = now;
      } else {
        // If not completed, reset entirely
        user.timeQuests.weekly.quest = null;
        user.timeQuests.weekly.progress = 0;
        user.timeQuests.weekly.completed = false;
        user.timeQuests.weekly.lastReset = 0;
      }
    }
  }

  // Check completion status
  if (user.timeQuests.daily.quest && !user.timeQuests.daily.completed) {
    if (
      user.timeQuests.daily.progress >= user.timeQuests.daily.quest.targetCount
    ) {
      user.timeQuests.daily.completed = true;
    }
  }

  if (user.timeQuests.weekly.quest && !user.timeQuests.weekly.completed) {
    if (
      user.timeQuests.weekly.progress >=
      user.timeQuests.weekly.quest.targetCount
    ) {
      user.timeQuests.weekly.completed = true;
    }
  }
}

/**
 * Generate a random daily quest
 * @param {Object} user - User data
 * @returns {Object} - Generated quest object
 */
function generateDailyQuest(user) {
  // Select a random quest type
  const questType =
    DAILY_QUEST_TYPES[Math.floor(Math.random() * DAILY_QUEST_TYPES.length)];

  // Select a random target from the type
  const targetIndex = Math.floor(Math.random() * questType.targets.length);
  const target = questType.targets[targetIndex];

  // Generate target count
  const minCount = questType.countRange[0];
  const maxCount = questType.countRange[1];
  const targetCount =
    Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;

  // Generate rewards
  const minRubles = questType.rewardRubles[0];
  const maxRubles = questType.rewardRubles[1];
  const rewardRubles =
    Math.floor(Math.random() * (maxRubles - minRubles + 1)) + minRubles;

  const minRep = questType.rewardReputation[0];
  const maxRep = questType.rewardReputation[1];
  const rewardReputation =
    Math.floor(Math.random() * (maxRep - minRep + 1)) + minRep;

  // Create target description based on type
  let targetDescription;

  if (questType.id === "mutant_hunt") {
    targetDescription = `Hunt ${targetCount} ${target}s`;
  } else if (questType.id === "artifact_hunt") {
    targetDescription = `Find ${targetCount} ${target} artifact${targetCount > 1 ? "s" : ""}`;
  } else if (questType.id === "scavenge") {
    targetDescription = `Collect ${targetCount} rubles from exploration or trading`;
  } else if (questType.id === "pvp_duels") {
    targetDescription = `Win ${targetCount} PVP duel${targetCount > 1 ? "s" : ""}`;
  }

  // Return quest object
  return {
    id: `${questType.id}_${target}`,
    name: questType.name,
    description: questType.description,
    target,
    targetCount,
    targetDescription,
    rewardRubles,
    rewardReputation,
    type: "daily",
  };
}

/**
 * Generate a random weekly quest
 * @param {Object} user - User data
 * @returns {Object} - Generated quest object
 */
function generateWeeklyQuest(user) {
  // Select a random quest type
  const questType =
    WEEKLY_QUEST_TYPES[Math.floor(Math.random() * WEEKLY_QUEST_TYPES.length)];

  // Select a random target from the type
  const targetIndex = Math.floor(Math.random() * questType.targets.length);
  const target = questType.targets[targetIndex];

  // Generate target count
  const minCount = questType.countRange[0];
  const maxCount = questType.countRange[1];
  const targetCount =
    Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;

  // Generate rewards
  const minRubles = questType.rewardRubles[0];
  const maxRubles = questType.rewardRubles[1];
  const rewardRubles =
    Math.floor(Math.random() * (maxRubles - minRubles + 1)) + minRubles;

  const minRep = questType.rewardReputation[0];
  const maxRep = questType.rewardReputation[1];
  const rewardReputation =
    Math.floor(Math.random() * (maxRep - minRep + 1)) + minRep;

  // Determine if there's an item reward
  let rewardItem = null;
  if (Math.random() < questType.rewardItemChance) {
    const itemIndex = Math.floor(Math.random() * questType.rewardItems.length);
    rewardItem = questType.rewardItems[itemIndex];
  }

  // Create target description based on type
  let targetDescription;

  if (questType.id === "area_clear") {
    targetDescription = `Kill ${targetCount} mutants in any zone`;
  } else if (questType.id === "artifact_collection") {
    targetDescription = `Find ${targetCount} artifacts of any type`;
  } else if (questType.id === "faction_warfare") {
    targetDescription = `Win ${targetCount} PVP duels against other stalkers`;
  }

  // Return quest object
  return {
    id: `${questType.id}_${target}`,
    name: questType.name,
    description: questType.description,
    target,
    targetCount,
    targetDescription,
    rewardRubles,
    rewardReputation,
    rewardItem,
    type: "weekly",
  };
}
