/**
 * Embed Creator Utility
 * Helper functions to create formatted Discord embeds for S.T.A.L.K.E.R-themed messages
 */

const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Creates a basic embed with S.T.A.L.K.E.R. styling
 * @param {string} title - The embed title
 * @param {string} description - The embed description
 * @param {string} color - Color key from config (default: primary)
 * @returns {EmbedBuilder} - The created embed
 */
function createEmbed(title, description, color = 'primary') {
  return new EmbedBuilder()
    .setColor(config.colors[color] || config.colors.primary)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'STALKERNet Terminal' })
    .setTimestamp();
}

/**
 * Creates an error embed
 * @param {string} title - The error title
 * @param {string} message - The error message
 * @returns {EmbedBuilder} - The created embed
 */
function createErrorEmbed(title, message) {
  return createEmbed(
    title || 'Error',
    message || 'An anomaly has disrupted the operation.',
    'error'
  );
}

/**
 * Creates a success embed
 * @param {string} title - The success title
 * @param {string} message - The success message
 * @returns {EmbedBuilder} - The created embed
 */
function createSuccessEmbed(title, message) {
  return createEmbed(title, message, 'success');
}

/**
 * Creates a combat embed
 * @param {string} title - The combat title
 * @param {string} description - The combat description
 * @param {boolean} victory - Whether combat was successful
 * @returns {EmbedBuilder} - The created embed
 */
function createCombatEmbed(title, description, victory = false) {
  return createEmbed(
    title,
    description,
    victory ? 'success' : 'error'
  );
}

/**
 * Creates a faction-colored embed
 * @param {string} title - The embed title
 * @param {string} description - The embed description
 * @param {string} faction - The faction name
 * @returns {EmbedBuilder} - The created embed
 */
function createFactionEmbed(title, description, faction) {
  const color = faction && config.colors.factions[faction] 
    ? config.colors.factions[faction]
    : config.colors.primary;
  
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: faction ? `${faction} Terminal` : 'STALKERNet Terminal' })
    .setTimestamp();
}

/**
 * Creates an inventory item embed
 * @param {Object} item - The item object
 * @returns {EmbedBuilder} - The created embed
 */
function createItemEmbed(item) {
  const embed = createEmbed(
    item.name,
    item.description,
    item.category === 'artifact' ? 'radiation' : 'primary'
  );
  
  // Add common fields
  embed.addFields(
    { name: 'Category', value: item.category.charAt(0).toUpperCase() + item.category.slice(1), inline: true },
    { name: 'Weight', value: `${item.weight} kg`, inline: true },
    { name: 'Value', value: `${item.value} RU`, inline: true }
  );
  
  // Add category-specific fields
  if (item.category === 'weapon') {
    embed.addFields(
      { name: 'Damage', value: item.damage.toString(), inline: true },
      { name: 'Accuracy', value: `${item.accuracy}%`, inline: true }
    );
  } else if (item.category === 'armor') {
    embed.addFields(
      { name: 'Protection', value: item.protection.toString(), inline: true }
    );
  } else if (item.category === 'consumable' && item.effects) {
    const effectsText = Object.entries(item.effects)
      .map(([type, value]) => `${type.charAt(0).toUpperCase() + type.slice(1)}: ${value > 0 ? '+' : ''}${value}`)
      .join('\n');
    
    embed.addFields({ name: 'Effects', value: effectsText, inline: false });
  }
  
  return embed;
}

/**
 * Creates a quest embed
 * @param {Object} quest - The quest object
 * @param {boolean} isComplete - Whether the quest is complete
 * @returns {EmbedBuilder} - The created embed
 */
function createQuestEmbed(quest, isComplete = false) {
  const embed = createEmbed(
    `${isComplete ? '[COMPLETED] ' : ''}${quest.name}`,
    quest.description,
    isComplete ? 'success' : 'primary'
  );
  
  embed.addFields(
    { name: 'Objective', value: quest.objective, inline: false },
    { name: 'Difficulty', value: `${quest.difficulty}/10`, inline: true },
    { name: 'Reward', value: `${quest.rewardRubles} RU, ${quest.rewardReputation} Rep`, inline: true },
    { name: 'Quest ID', value: quest.id, inline: true }
  );
  
  // Add item rewards if applicable
  if (quest.rewardItems && quest.rewardItems.length > 0) {
    const items = require('../data/items.json');
    const itemNames = quest.rewardItems
      .map(id => items[id] ? items[id].name : 'Unknown Item')
      .join(', ');
    
    embed.addFields({ name: 'Item Rewards', value: itemNames, inline: false });
  }
  
  if (!isComplete) {
    embed.setFooter({ text: `Use /quest complete ${quest.id} when you've completed this task` });
  } else {
    embed.setFooter({ text: 'Quest completed successfully' });
  }
  
  return embed;
}

/**
 * Creates a profile embed
 * @param {Object} user - The user profile object
 * @param {string} avatarUrl - URL to the user's avatar
 * @returns {EmbedBuilder} - The created embed
 */
function createProfileEmbed(user, avatarUrl) {
  const factionColor = user.faction && config.colors.factions[user.faction] 
    ? config.colors.factions[user.faction] 
    : config.colors.primary;
  
  const embed = new EmbedBuilder()
    .setColor(factionColor)
    .setTitle(`${user.name}'s Profile`)
    .setDescription(`*${user.faction || 'No Faction'}*`)
    .setThumbnail(avatarUrl)
    .addFields(
      { name: 'Rank', value: user.rank.toString(), inline: true },
      { name: 'Reputation', value: user.reputation.toString(), inline: true },
      { name: 'Zone Location', value: user.currentZone, inline: true },
      { name: 'Health', value: `${user.health}/${config.maxHealth}`, inline: true },
      { name: 'Radiation', value: `${user.radiation}%`, inline: true },
      { name: 'Rubles', value: user.rubles.toString(), inline: true },
      { name: 'Inventory', value: `${user.inventoryWeight}/${config.maxInventoryWeight} kg`, inline: true },
      { name: 'Items', value: user.inventory.length.toString(), inline: true },
      { name: 'Quests Completed', value: user.completedQuests.length.toString(), inline: true }
    )
    .setFooter({ text: 'STALKERNet Terminal' })
    .setTimestamp();
  
  return embed;
}

module.exports = {
  createEmbed,
  createErrorEmbed,
  createSuccessEmbed,
  createCombatEmbed,
  createFactionEmbed,
  createItemEmbed,
  createQuestEmbed,
  createProfileEmbed
};
