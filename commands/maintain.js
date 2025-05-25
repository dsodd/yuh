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
      const items = dataManager.getItems();

      if (!args[1]) {
        // Show equipment durability status
        let statusMsg = `🔧 **Equipment Durability Status**\n\n`;

        if (user.equipped.weapon) {
          const weaponDurability = user.equipmentDurability?.weapon || 100;
          const weaponName = items[user.equipped.weapon]?.name || 'Unknown Weapon';
          statusMsg += `**Weapon:** ${weaponName} - ${weaponDurability}%\n`;
        }

        if (user.equipped.armor) {
          const armorDurability = user.equipmentDurability?.armor || 100;
          const armorName = items[user.equipped.armor]?.name || 'Unknown Armor';
          statusMsg += `**Armor:** ${armorName} - ${armorDurability}%\n`;
        }

        if (!user.equipped.weapon && !user.equipped.armor) {
          statusMsg += `No equipment currently equipped.\n`;
        }

        statusMsg += `\nUse \`${PREFIX}maintain repair weapon\` or \`${PREFIX}maintain repair armor\` to repair equipment.`;
        statusMsg += `\nRepair costs: **50 rubles per durability point**`;

        await message.reply(statusMsg);
        return;
      }

      const equipmentType = args[1].toLowerCase();

      if (equipmentType !== 'weapon' && equipmentType !== 'armor') {
        await message.reply(`Please specify 'weapon' or 'armor' to repair.`);
        return;
      }

      if (!user.equipped[equipmentType]) {
        await message.reply(`You don't have any ${equipmentType} equipped.`);
        return;
      }

      // Initialize durability if missing
      if (!user.equipmentDurability) {
        user.equipmentDurability = { weapon: 100, armor: 100 };
      }

      const currentDurability = user.equipmentDurability[equipmentType] || 100;

      if (currentDurability >= 100) {
        await message.reply(`Your ${equipmentType} is already in perfect condition!`);
        return;
      }

      const repairCost = Math.floor((100 - currentDurability) * 50);

      if (user.rubles < repairCost) {
        await message.reply(`You need **${repairCost} rubles** to fully repair your ${equipmentType}. You only have **${user.rubles} rubles**.`);
        return;
      }

      // Perform repair
      user.rubles -= repairCost;
      user.equipmentDurability[equipmentType] = 100;

      const equipmentName = items[user.equipped[equipmentType]]?.name || `Unknown ${equipmentType}`;

      dataManager.saveUser(user);

      await message.reply(`🔧 Successfully repaired your **${equipmentName}** for **${repairCost} rubles**!\nDurability restored to 100%.`);
      return;
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