const { EmbedBuilder } = require('discord.js');
const dataManager = require('../utils/dataManager');
const config = require('../config');

// Get prefix from .env
const PREFIX = process.env.PREFIX || '!';

module.exports = {
  name: 'quest',
  aliases: ['q', 'mission', 'quests'],
  description: 'Quest and mission commands for STALKERNet',
  
  async execute(message, args) {
    const userId = message.author.id;
    
    // Get user data or create if not exists
    let user = dataManager.getUser(userId);
    if (!user) {
      user = dataManager.createUser(userId, message.author.username);
      await message.reply(`Welcome to the Zone, Stalker! Your profile has been created.`);
    }
    
    // Get all quest data
    const quests = dataManager.getQuests();
    
    // Check if a subcommand was provided
    if (!args.length) {
      await message.reply(`Please provide a subcommand: \`${PREFIX}quest get\`, \`${PREFIX}quest list\`, or \`${PREFIX}quest complete <id>\``);
      return;
    }
    
    const subcommand = args[0].toLowerCase();
    
    if (subcommand === 'get') {
      // Check if user has max quests already (limit to 3 active quests)
      if (user.activeQuests.length >= 3) {
        await message.reply(`You already have ${user.activeQuests.length} active quests. Complete some before taking more.`);
        return;
      }
      
      // Get available quests for current zone and faction
      const zones = dataManager.getZones();
      const currentZone = zones[user.currentZone];
      
      // Filter quests by:
      // 1. Available in current zone
      // 2. Appropriate for user's rank
      // 3. Not already active or completed
      // 4. Matches user's faction or is faction-neutral
      const availableQuests = Object.values(quests).filter(quest => 
        (quest.availableZones.includes(currentZone.name) || quest.availableZones.includes('all')) &&
        quest.minRank <= user.rank &&
        !user.activeQuests.includes(quest.id) &&
        !user.completedQuests.includes(quest.id) &&
        (quest.faction === 'neutral' || quest.faction === user.faction)
      );
      
      if (availableQuests.length === 0) {
        await message.reply(`There are no quests available in ${currentZone.name} for you right now. Try another zone or complete your current quests.`);
        return;
      }
      
      // Select a random quest
      const selectedQuest = availableQuests[Math.floor(Math.random() * availableQuests.length)];
      
      // Add to user's active quests
      user.activeQuests.push(selectedQuest.id);
      
      // Save the updated user data
      dataManager.saveUser(user);
      
      // Create embed for the new quest
      const questEmbed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`New Quest: ${selectedQuest.name}`)
        .setDescription(selectedQuest.description)
        .addFields(
          { name: 'Objective', value: selectedQuest.objective, inline: false },
          { name: 'Reward', value: `${selectedQuest.rewardRubles} Rubles, ${selectedQuest.rewardReputation} Reputation`, inline: true },
          { name: 'Difficulty', value: `${selectedQuest.difficulty}/10`, inline: true },
          { name: 'Quest ID', value: selectedQuest.id, inline: true }
        )
        .setFooter({ text: `Type ${PREFIX}quest complete ${selectedQuest.id} when finished` })
        .setTimestamp();
      
      // Add item rewards if any
      if (selectedQuest.rewardItems && selectedQuest.rewardItems.length > 0) {
        const items = dataManager.getItems();
        const itemNames = selectedQuest.rewardItems.map(itemId => items[itemId] ? items[itemId].name : 'Unknown Item').join(', ');
        questEmbed.addFields({ name: 'Item Rewards', value: itemNames, inline: false });
      }
      
      await message.reply({ embeds: [questEmbed] });
      
    } else if (subcommand === 'list') {
      // Display all active quests
      if (user.activeQuests.length === 0) {
        await message.reply(`You have no active quests. Use \`${PREFIX}quest get\` to receive a new quest.`);
        return;
      }
      
      // Create embed for the quest list
      const questListEmbed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`${user.name}'s Active Quests`)
        .setDescription(`You have ${user.activeQuests.length} active quests.`)
        .setFooter({ text: `Use ${PREFIX}quest complete <id> to complete a quest` })
        .setTimestamp();
      
      // Add each quest to the embed
      for (const questId of user.activeQuests) {
        const quest = quests[questId];
        if (quest) {
          questListEmbed.addFields({
            name: `${quest.name} (ID: ${quest.id})`,
            value: `**Objective**: ${quest.objective}\n**Reward**: ${quest.rewardRubles} RU, ${quest.rewardReputation} Rep`,
            inline: false
          });
        }
      }
      
      await message.reply({ embeds: [questListEmbed] });
      
    } else if (subcommand === 'complete') {
      // Check if an ID was provided
      if (args.length < 2) {
        await message.reply(`Please specify a quest ID to complete. Usage: \`${PREFIX}quest complete <id>\``);
        return;
      }
      
      const questId = args[1];
      
      // Check if the quest is in user's active quests
      if (!user.activeQuests.includes(questId)) {
        await message.reply(`You don't have an active quest with ID "${questId}". Use \`${PREFIX}quest list\` to see your active quests.`);
        return;
      }
      
      // Get the quest data
      const quest = quests[questId];
      if (!quest) {
        await message.reply(`Error: Quest with ID "${questId}" not found in database.`);
        return;
      }
      
      // For now, we'll auto-complete the quest without checking requirements
      // In a more complex implementation, we would check if the user has met all requirements
      
      // Remove from active quests and add to completed quests
      user.activeQuests = user.activeQuests.filter(id => id !== questId);
      user.completedQuests.push(questId);
      
      // Award quest rewards
      user.rubles += quest.rewardRubles;
      user.reputation += quest.rewardReputation;
      
      // Add item rewards if any
      let itemRewardText = '';
      if (quest.rewardItems && quest.rewardItems.length > 0) {
        const items = dataManager.getItems();
        const rewardItemNames = [];
        
        for (const itemId of quest.rewardItems) {
          const item = items[itemId];
          if (item) {
            // Check inventory space
            if (user.inventoryWeight + item.weight <= config.maxInventoryWeight) {
              user.inventory.push(itemId);
              user.inventoryWeight += item.weight;
              rewardItemNames.push(item.name);
            } else {
              // If inventory is full, give extra rubles instead
              const extraRubles = Math.floor(item.value * 0.8); // 80% of item value
              user.rubles += extraRubles;
              rewardItemNames.push(`${item.name} (converted to ${extraRubles} RU due to full inventory)`);
            }
          }
        }
        
        if (rewardItemNames.length > 0) {
          itemRewardText = `\nItems: ${rewardItemNames.join(', ')}`;
        }
      }
      
      // Check for rank up
      const oldRank = user.rank;
      // Simple rank formula: rank up every 100 reputation points
      user.rank = Math.floor(user.reputation / 100) + 1;
      const rankUp = user.rank > oldRank;
      
      // Save the updated user data
      dataManager.saveUser(user);
      
      // Create embed for quest completion
      const completeEmbed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle(`Quest Completed: ${quest.name}`)
        .setDescription(`You have successfully completed the quest!`)
        .addFields(
          { name: 'Rewards', value: `Rubles: ${quest.rewardRubles}\nReputation: ${quest.rewardReputation}${itemRewardText}`, inline: false },
          { name: 'Quests Remaining', value: `${user.activeQuests.length}`, inline: true },
          { name: 'Total Completed', value: `${user.completedQuests.length}`, inline: true }
        )
        .setFooter({ text: 'Good job, stalker. The Zone rewards those who work.' })
        .setTimestamp();
      
      // Add rank up information if applicable
      if (rankUp) {
        completeEmbed.addFields({
          name: '🌟 Rank Up!',
          value: `You've been promoted to rank ${user.rank}! Your reputation in the Zone is growing.`,
          inline: false
        });
      }
      
      await message.reply({ embeds: [completeEmbed] });
    } else {
      await message.reply(`Unknown quest command: "${subcommand}". Available commands: get, list, complete.`);
    }
  },
};
