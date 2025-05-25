const { EmbedBuilder } = require('discord.js');
const dataManager = require('../utils/dataManager');
const config = require('../config');
const embedCreator = require('../utils/embedCreator');

// Get prefix from .env
const PREFIX = process.env.PREFIX || '!';

module.exports = {
  name: 'maintain',
  aliases: ['repair', 'fix', 'maintenance'],
  description: 'Maintain and repair your equipment',
  
  async execute(message, args) {
    const userId = message.author.id;
    
    // Get user data or create if not exists
    let user = dataManager.getUser(userId);
    if (!user) {
      user = dataManager.createUser(userId, message.author.username);
      await message.reply(`Welcome to the Zone, Stalker! Your profile has been created.`);
    }
    
    // Get items data
    const items = dataManager.getItems();
    
    // If no args, show maintenance status of equipped items
    if (!args.length) {
      // Get equipped items
      const equippedItems = [];
      
      if (user.equipped.weapon) {
        const weapon = items[user.equipped.weapon];
        if (weapon) {
          equippedItems.push({
            id: user.equipped.weapon,
            item: weapon,
            durability: user.durability?.[user.equipped.weapon] || 100,
            type: 'weapon'
          });
        }
      }
      
      if (user.equipped.armor) {
        const armor = items[user.equipped.armor];
        if (armor) {
          equippedItems.push({
            id: user.equipped.armor,
            item: armor,
            durability: user.durability?.[user.equipped.armor] || 100,
            type: 'armor'
          });
        }
      }
      
      // If no equipped items
      if (equippedItems.length === 0) {
        const noItemsEmbed = embedCreator.createEmbed(
          "Equipment Status",
          "You don't have any equipment that requires maintenance.",
          "primary"
        );
        await message.reply({ embeds: [noItemsEmbed] });
        return;
      }
      
      // Create status embed
      const statusEmbed = embedCreator.createEmbed(
        "Equipment Status",
        "Current condition of your equipment:",
        "primary"
      );
      
      // Add each item
      for (const equipped of equippedItems) {
        // Determine condition text and color
        let condition;
        let conditionColor;
        
        if (equipped.durability >= 90) {
          condition = "Excellent";
          conditionColor = "🟢";
        } else if (equipped.durability >= 70) {
          condition = "Good";
          conditionColor = "🟢";
        } else if (equipped.durability >= 50) {
          condition = "Fair";
          conditionColor = "🟡";
        } else if (equipped.durability >= 30) {
          condition = "Poor";
          conditionColor = "🟠";
        } else if (equipped.durability >= 10) {
          condition = "Very Poor";
          conditionColor = "🔴";
        } else {
          condition = "Critical";
          conditionColor = "⚠️";
        }
        
        statusEmbed.addFields({ 
          name: `${equipped.item.name} (${equipped.type})`, 
          value: `${conditionColor} Condition: ${condition} (${equipped.durability}%)\nRepair cost: ${calculateRepairCost(equipped.item, equipped.durability)} RU`, 
          inline: false 
        });
      }
      
      statusEmbed.setFooter({ text: `Use ${PREFIX}maintain repair <item name> to repair an item` });
      await message.reply({ embeds: [statusEmbed] });
      return;
    }
    
    // Handle subcommands
    const subcommand = args[0].toLowerCase();
    
    if (subcommand === 'repair') {
      // Check if item name is provided
      if (args.length < 2) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Missing Item",
          `Please specify an item to repair. Usage: \`${PREFIX}maintain repair <item name>\``
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      // Get the item name
      const itemName = args.slice(1).join(' ');
      
      // Find equipped item matching the name
      let itemToRepair = null;
      let itemId = null;
      let itemType = null;
      
      if (user.equipped.weapon) {
        const weapon = items[user.equipped.weapon];
        if (weapon && weapon.name.toLowerCase() === itemName.toLowerCase()) {
          itemToRepair = weapon;
          itemId = user.equipped.weapon;
          itemType = 'weapon';
        }
      }
      
      if (!itemToRepair && user.equipped.armor) {
        const armor = items[user.equipped.armor];
        if (armor && armor.name.toLowerCase() === itemName.toLowerCase()) {
          itemToRepair = armor;
          itemId = user.equipped.armor;
          itemType = 'armor';
        }
      }
      
      // If item not found
      if (!itemToRepair) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Item Not Found",
          `You don't have an equipped item called "${itemName}". Check your spelling or equip the item first.`
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      // Initialize durability object if not exists
      if (!user.durability) {
        user.durability = {};
      }
      
      // Get current durability
      const currentDurability = user.durability[itemId] || 100;
      
      // If already at 100%
      if (currentDurability >= 100) {
        const fullRepairEmbed = embedCreator.createEmbed(
          "Repair Not Needed",
          `Your ${itemToRepair.name} is already in perfect condition.`,
          "primary"
        );
        await message.reply({ embeds: [fullRepairEmbed] });
        return;
      }
      
      // Calculate repair cost
      const repairCost = calculateRepairCost(itemToRepair, currentDurability);
      
      // Check if user has enough rubles
      if (user.rubles < repairCost) {
        const notEnoughRublesEmbed = embedCreator.createErrorEmbed(
          "Insufficient Funds",
          `You need ${repairCost} rubles to repair your ${itemToRepair.name}, but you only have ${user.rubles} rubles.`
        );
        await message.reply({ embeds: [notEnoughRublesEmbed] });
        return;
      }
      
      // Update durability and deduct cost
      user.durability[itemId] = 100;
      user.rubles -= repairCost;
      
      // Save user data
      dataManager.saveUser(user);
      
      // Create success embed
      const repairEmbed = embedCreator.createSuccessEmbed(
        "Repair Complete",
        `Your ${itemToRepair.name} has been repaired to perfect condition for ${repairCost} rubles.`
      );
      
      repairEmbed.addFields(
        { name: "Current Condition", value: "Excellent (100%)", inline: true },
        { name: "Rubles Remaining", value: `${user.rubles}`, inline: true }
      );
      
      await message.reply({ embeds: [repairEmbed] });
    } else {
      // Unknown subcommand
      const errorEmbed = embedCreator.createErrorEmbed(
        "Unknown Command",
        `Unknown maintenance command: "${subcommand}". Available commands: repair.`
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  },
};

/**
 * Calculate the cost to repair an item based on its value and current durability
 * @param {Object} item - The item to repair
 * @param {number} currentDurability - The current durability percentage
 * @returns {number} - The repair cost in rubles
 */
function calculateRepairCost(item, currentDurability) {
  // Base formula: Higher value items cost more to repair
  // Lower durability means higher repair costs
  const percentageDamaged = 100 - currentDurability;
  const baseCost = Math.round((item.value * 0.01) * percentageDamaged);
  
  // Minimum repair cost
  return Math.max(25, baseCost);
}