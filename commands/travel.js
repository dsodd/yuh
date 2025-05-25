const { EmbedBuilder } = require('discord.js');
const dataManager = require('../utils/dataManager');
const config = require('../config');

// Get prefix from .env
const PREFIX = process.env.PREFIX || '!';

module.exports = {
  name: 'travel',
  aliases: ['t', 'move', 'go'],
  description: 'Travel between zones, scout for items, or set up camp',
  
  async execute(message, args) {
    const userId = message.author.id;
    
    // Get user data or create if not exists
    let user = dataManager.getUser(userId);
    if (!user) {
      user = dataManager.createUser(userId, message.author.username);
      await message.reply(`Welcome to the Zone, Stalker! Your profile has been created.`);
    }
    
    // Get all zones data
    const zones = dataManager.getZones();
    
    // Check cooldowns
    const now = Date.now();

    // Check if any subcommand was provided, default to help message
    if (!args.length) {
      await message.reply(
        `Please provide a subcommand: \`${PREFIX}travel to <zone>\`, \`${PREFIX}travel scout\`, or \`${PREFIX}travel camp\`.`
      );
      return;
    }
    
    const subcommand = args[0].toLowerCase();
    
    // Execute the appropriate subcommand
    if (subcommand === 'to') {
      // Check travel cooldown
      if (user.cooldowns.travel && now < user.cooldowns.travel) {
        const timeLeft = Math.ceil((user.cooldowns.travel - now) / 1000 / 60); // minutes left
        await message.reply(`You are too exhausted to travel. Rest for ${timeLeft} more minute(s).`);
        return;
      }
      
      // Check if destination was provided
      if (args.length < 2) {
        await message.reply(`Please specify a destination. Usage: \`${PREFIX}travel to <zone>\``);
        return;
      }
      
      const destinationName = args.slice(1).join(' ');
      
      // Find the destination zone
      const destinationZone = Object.values(zones).find(zone => 
        zone.name.toLowerCase() === destinationName.toLowerCase()
      );
      
      if (!destinationZone) {
        await message.reply(`Zone "${destinationName}" not found. Check available zones with \`${PREFIX}zones list\`.`);
        return;
      }
      
      // Get current zone
      const currentZone = zones[user.currentZone];
      
      // Check if destination is connected to current zone
      if (!currentZone.connections.includes(destinationZone.name)) {
        await message.reply(
          `You cannot travel directly from ${currentZone.name} to ${destinationZone.name}. Check connected zones with \`${PREFIX}zones info\`.`
        );
        return;
      }
      
      // Random encounter chance (30%)
      let encounterText = '';
      if (Math.random() < 0.3) {
        // Generate a random encounter
        const encounters = [
          'encountered a small pack of blind dogs, but managed to avoid them.',
          'had to hide from a military patrol.',
          'found a corpse of another stalker. You said a short prayer and continued.',
          'saw strange anomaly activity in the distance.',
          'heard the distant sound of gunfire, but steered clear of the conflict.',
          'noticed signs of a recent emission, proceeding cautiously.'
        ];
        encounterText = `\n\nDuring your journey, you ${encounters[Math.floor(Math.random() * encounters.length)]}`;
      }
      
      // Update user location
      user.currentZone = destinationZone.name;
      
      // Set travel cooldown
      user.cooldowns.travel = now + (config.cooldowns.travel * 60 * 1000);
      
      // Save the updated user data
      dataManager.saveUser(user);
      
      // Create embed for travel result
      const travelEmbed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`Travel to ${destinationZone.name}`)
        .setDescription(`You have arrived at ${destinationZone.name}.\n${destinationZone.description}${encounterText}`)
        .addFields(
          { name: 'Danger Level', value: `${destinationZone.dangerLevel}/10`, inline: true },
          { name: 'Radiation Level', value: `${destinationZone.radiationLevel}/10`, inline: true },
          { name: 'Connected Zones', value: destinationZone.connections.join(', '), inline: false }
        )
        .setFooter({ text: `Cooldown: ${config.cooldowns.travel} minutes` })
        .setTimestamp();
      
      await message.reply({ embeds: [travelEmbed] });
      
    } else if (subcommand === 'scout') {
      // Check scout cooldown
      if (user.cooldowns.scout && now < user.cooldowns.scout) {
        const timeLeft = Math.ceil((user.cooldowns.scout - now) / 1000 / 60); // minutes left
        await message.reply(`You're still catching your breath from your last scouting run. Try again in ${timeLeft} minute(s).`);
        return;
      }
      
      // Get current zone
      const currentZone = zones[user.currentZone];
      
      // Get all items data
      const allItems = dataManager.getItems();
      
      // Determine loot table based on zone
      const zoneLootTable = currentZone.lootTable || [
        { category: 'junk', chance: 0.5 },
        { category: 'consumable', chance: 0.3 },
        { category: 'weapon', chance: 0.1 },
        { category: 'armor', chance: 0.1 },
        { category: 'artifact', chance: 0.05 }
      ];
      
      // Calculate total chance
      const totalChance = zoneLootTable.reduce((sum, entry) => sum + entry.chance, 0);
      
      // Determine if user finds anything (80% base chance, modified by zone danger)
      const findChance = 0.8 * (1 + (currentZone.dangerLevel * 0.05));
      const foundAnything = Math.random() < findChance;
      
      if (!foundAnything) {
        // Set scout cooldown
        user.cooldowns.scout = now + (config.cooldowns.scout * 60 * 1000);
        dataManager.saveUser(user);
        
        await message.reply(`You searched ${currentZone.name} but found nothing of value.`);
        return;
      }
      
      // Determine what category of item is found
      const randomValue = Math.random() * totalChance;
      let cumulativeChance = 0;
      let selectedCategory = null;
      
      for (const entry of zoneLootTable) {
        cumulativeChance += entry.chance;
        if (randomValue <= cumulativeChance) {
          selectedCategory = entry.category;
          break;
        }
      }
      
      if (!selectedCategory) {
        selectedCategory = 'junk'; // Fallback to junk if something went wrong
      }
      
      // Filter items by selected category
      const categoryItems = Object.values(allItems).filter(item => item.category === selectedCategory);
      
      if (categoryItems.length === 0) {
        // Set scout cooldown
        user.cooldowns.scout = now + (config.cooldowns.scout * 60 * 1000);
        dataManager.saveUser(user);
        
        await message.reply(`You searched ${currentZone.name} but found nothing of value.`);
        return;
      }
      
      // Select a random item from the category
      const foundItem = categoryItems[Math.floor(Math.random() * categoryItems.length)];
      
      // Check if user has space in inventory
      if (user.inventoryWeight + foundItem.weight > config.maxInventoryWeight) {
        // Set scout cooldown
        user.cooldowns.scout = now + (config.cooldowns.scout * 60 * 1000);
        dataManager.saveUser(user);
        
        await message.reply(`You found a ${foundItem.name}, but your inventory is too full to carry it! Drop some items first.`);
        return;
      }
      
      // Add item to inventory
      user.inventory.push(foundItem.id);
      user.inventoryWeight += foundItem.weight;
      
      // Set scout cooldown
      user.cooldowns.scout = now + (config.cooldowns.scout * 60 * 1000);
      
      // Save the updated user data
      dataManager.saveUser(user);
      
      // Create embed for scouting result
      const scoutEmbed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle(`Scouting in ${currentZone.name}`)
        .setDescription(`You searched the area and found: **${foundItem.name}**!`)
        .addFields(
          { name: 'Description', value: foundItem.description, inline: false },
          { name: 'Category', value: foundItem.category.charAt(0).toUpperCase() + foundItem.category.slice(1), inline: true },
          { name: 'Weight', value: `${foundItem.weight} kg`, inline: true },
          { name: 'Value', value: `${foundItem.value} RU`, inline: true }
        )
        .setFooter({ text: `Cooldown: ${config.cooldowns.scout} minutes | Inventory: ${user.inventoryWeight}/${config.maxInventoryWeight} kg` })
        .setTimestamp();
      
      await message.reply({ embeds: [scoutEmbed] });
      
    } else if (subcommand === 'camp') {
      // Check camp cooldown
      if (user.cooldowns.camp && now < user.cooldowns.camp) {
        const timeLeft = Math.ceil((user.cooldowns.camp - now) / 1000 / 60); // minutes left
        await message.reply(`You've recently set up camp. You can camp again in ${timeLeft} minute(s).`);
        return;
      }
      
      // Get current zone
      const currentZone = zones[user.currentZone];
      
      // Determine if camping is dangerous based on zone danger level
      const dangerRoll = Math.random() * 10;
      const encounterChance = currentZone.dangerLevel / 10;
      const dangerousEncounter = dangerRoll < currentZone.dangerLevel && Math.random() < encounterChance;
      
      if (dangerousEncounter) {
        // Something bad happens during camping
        const encounters = [
          'A pack of mutants attacked your camp during the night. You escaped, but not unscathed.',
          'Someone tried to rob you while you slept. You fought them off, but got injured.',
          'The ground beneath your campsite turned out to be mildly radioactive.',
          'You were woken by gunfire nearby and had to relocate quickly, getting little rest.'
        ];
        
        const encounter = encounters[Math.floor(Math.random() * encounters.length)];
        
        // Apply negative effects
        const healthLoss = Math.floor(Math.random() * 15) + 5;
        user.health = Math.max(1, user.health - healthLoss);
        
        // Create embed for bad camping result
        const campEmbedBad = new EmbedBuilder()
          .setColor(config.colors.error)
          .setTitle(`Camping in ${currentZone.name}`)
          .setDescription(`You set up camp to rest, but...\n\n${encounter}`)
          .addFields(
            { name: 'Health', value: `${user.health}/${config.maxHealth} (-${healthLoss})`, inline: true }
          )
          .setFooter({ text: `Cooldown: ${config.cooldowns.camp} minutes` })
          .setTimestamp();
        
        // Set camp cooldown
        user.cooldowns.camp = now + (config.cooldowns.camp * 60 * 1000);
        
        // Save the updated user data
        dataManager.saveUser(user);
        
        await message.reply({ embeds: [campEmbedBad] });
        
      } else {
        // Safe camping, recover health and reset other cooldowns
        const previousHealth = user.health;
        user.health = Math.min(config.maxHealth, user.health + 30);
        
        // Reset other cooldowns
        user.cooldowns.scout = 0;
        user.cooldowns.travel = 0;
        
        // Set camp cooldown
        user.cooldowns.camp = now + (config.cooldowns.camp * 60 * 1000);
        
        // Save the updated user data
        dataManager.saveUser(user);
        
        // Create embed for successful camping result
        const campEmbedGood = new EmbedBuilder()
          .setColor(config.colors.success)
          .setTitle(`Camping in ${currentZone.name}`)
          .setDescription(`You set up camp and rested peacefully. You feel refreshed and ready for new adventures.`)
          .addFields(
            { name: 'Health', value: `${previousHealth} → ${user.health}`, inline: true },
            { name: 'Cooldowns Reset', value: `Travel and Scout`, inline: true }
          )
          .setFooter({ text: `Cooldown: ${config.cooldowns.camp} minutes` })
          .setTimestamp();
        
        await message.reply({ embeds: [campEmbedGood] });
      }
    } else if (subcommand === 'zones' || subcommand === 'list') {
      // List all zones in the game
      const zonesEmbed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle('Zones of the S.T.A.L.K.E.R. World')
        .setDescription('These are the known areas of the Zone. Travel carefully, stalker.')
        .setFooter({ text: `Use ${PREFIX}travel to <zone> to move to a connected zone` })
        .setTimestamp();
      
      // Current zone info
      const currentZone = zones[user.currentZone];
      zonesEmbed.addFields({ 
        name: `📍 Current Location: ${currentZone.name}`, 
        value: `**Danger**: ${currentZone.dangerLevel}/10 | **Radiation**: ${currentZone.radiationLevel}/10\n**Connected to**: ${currentZone.connections.join(', ')}`,
        inline: false
      });
      
      // Add other zones
      Object.values(zones).forEach(zone => {
        if (zone.name !== user.currentZone) {
          zonesEmbed.addFields({
            name: zone.name,
            value: `**Type**: ${zone.type} | **Danger**: ${zone.dangerLevel}/10 | **Radiation**: ${zone.radiationLevel}/10`,
            inline: true
          });
        }
      });
      
      await message.reply({ embeds: [zonesEmbed] });
    } else {
      // Unknown subcommand
      await message.reply(`Unknown travel command: "${subcommand}". Available commands: to, scout, camp, zones.`);
    }
  },
};
