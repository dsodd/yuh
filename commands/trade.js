const { EmbedBuilder } = require('discord.js');
const dataManager = require('../utils/dataManager');
const config = require('../config');

// Get prefix from .env
const PREFIX = process.env.PREFIX || '!';

module.exports = {
  name: 'trade',
  aliases: ['shop', 'vendor', 'store'],
  description: 'Trade and economy commands for STALKERNet',
  
  async execute(message, args) {
    const userId = message.author.id;
    
    // Get user data or create if not exists
    let user = dataManager.getUser(userId);
    if (!user) {
      user = dataManager.createUser(userId, message.author.username);
      await message.reply(`Welcome to the Zone, Stalker! Your profile has been created.`);
    }
    
    // Get zones data
    const zones = dataManager.getZones();
    const currentZone = zones[user.currentZone];
    
    // Get items data
    const allItems = dataManager.getItems();
    
    // Check for subcommands
    if (!args.length) {
      return message.reply(`Please provide a subcommand: \`${PREFIX}trade vendor\`, \`${PREFIX}trade sell <item>\`, or \`${PREFIX}trade buy <item>\``);
    }
    
    const subcommand = args[0].toLowerCase();
    
    if (subcommand === 'vendor') {
      // Check if the current zone has a vendor
      if (!currentZone.hasVendor) {
        await message.reply(`There is no vendor in ${currentZone.name}. Travel to a different zone to find one.`);
        return;
      }
      
      // Generate vendor inventory based on zone
      // Each zone vendor has different stock specialties
      let vendorInventory = [];
      
      // Base items available everywhere
      const baseItems = ['medkit', 'bread', 'vodka', 'antirad', 'detector_basic'];
      
      // Add base items
      for (const itemId of baseItems) {
        if (allItems[itemId]) {
          vendorInventory.push(allItems[itemId]);
        }
      }
      
      // Add zone-specific items
      if (currentZone.vendorItems && currentZone.vendorItems.length > 0) {
        for (const itemId of currentZone.vendorItems) {
          if (allItems[itemId] && !vendorInventory.some(item => item.id === itemId)) {
            vendorInventory.push(allItems[itemId]);
          }
        }
      }
      
      // Add random items based on zone type
      const zoneTypeItems = Object.values(allItems).filter(item => 
        item.availableIn === currentZone.type && !vendorInventory.some(vendorItem => vendorItem.id === item.id)
      );
      
      // Add some random zone-type items
      const numRandomItems = Math.floor(Math.random() * 3) + 2; // 2-4 random items
      for (let i = 0; i < numRandomItems && i < zoneTypeItems.length; i++) {
        const randomIndex = Math.floor(Math.random() * zoneTypeItems.length);
        vendorInventory.push(zoneTypeItems[randomIndex]);
        zoneTypeItems.splice(randomIndex, 1); // Remove item to avoid duplicates
      }
      
      // Create vendor embed
      const vendorEmbed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`Vendor in ${currentZone.name}`)
        .setDescription(`"Welcome, stalker. Take a look at my wares."\n\nYour Rubles: ${user.rubles} RU`)
        .setFooter({ text: `Use ${PREFIX}trade buy <item> to purchase items, or ${PREFIX}trade sell <item> to sell` })
        .setTimestamp();
      
      // Group items by category
      const itemsByCategory = {};
      
      for (const item of vendorInventory) {
        if (!itemsByCategory[item.category]) {
          itemsByCategory[item.category] = [];
        }
        
        itemsByCategory[item.category].push(item);
      }
      
      // Add fields for each category
      for (const [category, items] of Object.entries(itemsByCategory)) {
        let itemsList = '';
        
        items.forEach(item => {
          itemsList += `**${item.name}** - ${item.value} RU - ${item.description}\n`;
        });
        
        vendorEmbed.addFields({ 
          name: category.toUpperCase(), 
          value: itemsList || 'None', 
          inline: false 
        });
      }
      
      await message.reply({ embeds: [vendorEmbed] });
      
    } else if (subcommand === 'sell') {
      // Check if the current zone has a vendor
      if (!currentZone.hasVendor) {
        await message.reply(`There is no vendor in ${currentZone.name}. Travel to a different zone to find one.`);
        return;
      }
      
      // Check if item name was provided
      if (args.length < 2) {
        await message.reply(`Please specify an item to sell. Usage: \`${PREFIX}trade sell <item name>\``);
        return;
      }
      
      const itemName = args.slice(1).join(' ');
      
      // Find the item in user's inventory
      const itemMatch = Object.values(allItems).find(item => 
        item.name.toLowerCase() === itemName.toLowerCase() && 
        user.inventory.includes(item.id)
      );
      
      if (!itemMatch) {
        await message.reply(`You don't have an item called "${itemName}" in your inventory.`);
        return;
      }
      
      // Check if the item is equipped
      if (user.equipped.weapon === itemMatch.id || 
          user.equipped.armor === itemMatch.id || 
          user.equipped.artifacts.includes(itemMatch.id)) {
        await message.reply(`You need to unequip ${itemMatch.name} before selling it.`);
        return;
      }
      
      // Calculate sell price (add faction trading bonus if applicable)
      let sellPrice = Math.floor(itemMatch.value * config.sellModifier);
      
      // Apply trading bonus if user has one
      if (user.bonuses && user.bonuses.tradingBonus) {
        const bonusMultiplier = 1 + (user.bonuses.tradingBonus / 100);
        sellPrice = Math.floor(sellPrice * bonusMultiplier);
      }
      
      // Remove the item from inventory
      user.inventory = user.inventory.filter(id => id !== itemMatch.id);
      
      // Update inventory weight
      user.inventoryWeight = user.inventory.reduce((total, itemId) => {
        const item = allItems[itemId];
        return total + (item ? item.weight : 0);
      }, 0);
      
      // Add rubles to user
      user.rubles += sellPrice;
      
      // Save the updated user data
      dataManager.saveUser(user);
      
      // Create embed for sell result
      const sellEmbed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('Item Sold')
        .setDescription(`You sold **${itemMatch.name}** for **${sellPrice} rubles**.`)
        .addFields(
          { name: 'Your Rubles', value: `${user.rubles} RU`, inline: true },
          { name: 'Inventory Weight', value: `${user.inventoryWeight}/${config.maxInventoryWeight} kg`, inline: true }
        )
        .setFooter({ text: 'Thanks for your business, stalker.' })
        .setTimestamp();
      
      await message.reply({ embeds: [sellEmbed] });
      
    } else if (subcommand === 'buy') {
      // Check if the current zone has a vendor
      if (!currentZone.hasVendor) {
        await message.reply(`There is no vendor in ${currentZone.name}. Travel to a different zone to find one.`);
        return;
      }
      
      // Check if item name was provided
      if (args.length < 2) {
        await message.reply(`Please specify an item to buy. Usage: \`${PREFIX}trade buy <item name>\``);
        return;
      }
      
      const itemName = args.slice(1).join(' ');
      
      // Find the item in all items
      const itemMatch = Object.values(allItems).find(item => 
        item.name.toLowerCase() === itemName.toLowerCase()
      );
      
      if (!itemMatch) {
        await message.reply(`Item "${itemName}" not found.`);
        return;
      }
      
      // Check if the item is available at this vendor
      const isBasicItem = ['medkit', 'bread', 'vodka', 'antirad', 'detector_basic'].includes(itemMatch.id);
      const isZoneItem = currentZone.vendorItems && currentZone.vendorItems.includes(itemMatch.id);
      const isZoneTypeItem = itemMatch.availableIn === currentZone.type;
      
      if (!isBasicItem && !isZoneItem && !isZoneTypeItem) {
        await message.reply(`"${itemMatch.name}" is not available from this vendor. Try a different zone.`);
        return;
      }
      
      // Check if user has enough rubles
      if (user.rubles < itemMatch.value) {
        await message.reply(`You don't have enough rubles to buy ${itemMatch.name}. It costs ${itemMatch.value} RU, but you only have ${user.rubles} RU.`);
        return;
      }
      
      // Check if user has space in inventory
      if (user.inventoryWeight + itemMatch.weight > config.maxInventoryWeight) {
        await message.reply(`Your inventory is too full to carry ${itemMatch.name}. It weighs ${itemMatch.weight} kg and you only have ${config.maxInventoryWeight - user.inventoryWeight} kg available.`);
        return;
      }
      
      // Add item to inventory
      user.inventory.push(itemMatch.id);
      user.inventoryWeight += itemMatch.weight;
      
      // Subtract rubles from user
      user.rubles -= itemMatch.value;
      
      // Save the updated user data
      dataManager.saveUser(user);
      
      // Create embed for buy result
      const buyEmbed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('Item Purchased')
        .setDescription(`You bought **${itemMatch.name}** for **${itemMatch.value} rubles**.`)
        .addFields(
          { name: 'Your Rubles', value: `${user.rubles} RU`, inline: true },
          { name: 'Inventory Weight', value: `${user.inventoryWeight}/${config.maxInventoryWeight} kg`, inline: true }
        )
        .setFooter({ text: 'Good hunting, stalker.' })
        .setTimestamp();
      
      await message.reply({ embeds: [buyEmbed] });
    } else {
      await message.reply(`Unknown trade command: "${subcommand}". Available commands: vendor, sell, buy.`);
    }
  },
};
