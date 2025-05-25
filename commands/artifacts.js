const { EmbedBuilder } = require('discord.js');
const dataManager = require('../utils/dataManager');
const config = require('../config');

// Get prefix from .env
const PREFIX = process.env.PREFIX || '!';

module.exports = {
  name: 'artifacts',
  aliases: ['artifact', 'art', 'a'],
  description: 'Artifact-related commands for STALKERNet',
  
  async execute(message, args) {
    const userId = message.author.id;
    
    // Get user data or create if not exists
    let user = dataManager.getUser(userId);
    if (!user) {
      user = dataManager.createUser(userId, message.author.username);
      await message.reply(`Welcome to the Zone, Stalker! Your profile has been created.`);
    }
    
    // Get artifacts and zones data
    const artifacts = dataManager.getArtifacts();
    const zones = dataManager.getZones();
    const items = dataManager.getItems();
    
    // Check for subcommands
    if (!args.length) {
      await message.reply(`Please provide a subcommand: \`${PREFIX}artifacts detect\` or \`${PREFIX}artifacts info\``);
      return;
    }
    
    const subcommand = args[0].toLowerCase();
    
    if (subcommand === 'detect') {
      // Check if user has a detector
      const hasDetector = user.inventory.some(itemId => 
        items[itemId] && items[itemId].category === 'detector'
      );
      
      if (!hasDetector) {
        await message.reply(`You need an artifact detector to search for artifacts. Buy one from a vendor.`);
        return;
      }
      
      // Check detect cooldown
      const now = Date.now();
      if (user.cooldowns.detect && now < user.cooldowns.detect) {
        const timeLeft = Math.ceil((user.cooldowns.detect - now) / 1000 / 60); // minutes left
        await message.reply(`Your detector needs time to recharge. Try again in ${timeLeft} minute(s).`);
        return;
      }
      
      // Get current zone
      const currentZone = zones[user.currentZone];
      
      // Determine if the zone has anomalies
      if (currentZone.anomalyLevel === 0) {
        // Set detect cooldown (shorter since no anomalies)
        user.cooldowns.detect = now + (config.cooldowns.detect * 30 * 1000); // 30% of normal time
        dataManager.saveUser(user);
        
        await message.reply(`Your detector doesn't pick up any anomalies in ${currentZone.name}.`);
        return;
      }
      
      // Filter artifacts by zone
      const zoneArtifacts = Object.values(artifacts).filter(artifact => 
        artifact.zones.includes(currentZone.name) || artifact.zones.includes('all')
      );
      
      if (zoneArtifacts.length === 0) {
        // Set detect cooldown (shorter since no artifacts)
        user.cooldowns.detect = now + (config.cooldowns.detect * 30 * 1000); // 30% of normal time
        dataManager.saveUser(user);
        
        await message.reply(`Your detector picked up some anomalies, but no artifacts were found in ${currentZone.name}.`);
        return;
      }
      
      // Determine detector quality 
      let detectorQuality = 1; // Basic detector
      
      // Find the best detector in inventory
      for (const itemId of user.inventory) {
        const item = items[itemId];
        if (item && item.category === 'detector') {
          if (item.id === 'detector_advanced') detectorQuality = 2;
          if (item.id === 'detector_veles') detectorQuality = 3;
        }
      }
      
      // Chance to find artifacts based on detector quality and zone anomaly level
      const baseChance = 0.3 * detectorQuality * (currentZone.anomalyLevel / 10);
      const findArtifact = Math.random() < baseChance;
      
      if (!findArtifact) {
        // Set detect cooldown
        user.cooldowns.detect = now + (config.cooldowns.detect * 60 * 1000);
        dataManager.saveUser(user);
        
        await message.reply(`Your detector picked up anomaly activity in ${currentZone.name}, but you couldn't locate any artifacts.`);
        return;
      }
      
      // Select artifact based on rarity (weighted by detector quality)
      const weightedArtifacts = zoneArtifacts.filter(artifact => 
        artifact.rarity <= 5 + detectorQuality // Better detectors can find rarer artifacts
      );
      
      // If no artifacts match the rarity criteria
      if (weightedArtifacts.length === 0) {
        // Set detect cooldown
        user.cooldowns.detect = now + (config.cooldowns.detect * 60 * 1000);
        dataManager.saveUser(user);
        
        await message.reply(`Your detector picked up faint readings, but you need a better detector to identify artifacts in ${currentZone.name}.`);
        return;
      }
      
      // Calculate total weight based on artifact rarity (inverted, so lower rarity = higher chance)
      const totalWeight = weightedArtifacts.reduce((sum, artifact) => sum + (10 - artifact.rarity), 0);
      let randomValue = Math.random() * totalWeight;
      let selectedArtifact = null;
      let cumulativeWeight = 0;
      
      for (const artifact of weightedArtifacts) {
        cumulativeWeight += (10 - artifact.rarity);
        if (randomValue <= cumulativeWeight) {
          selectedArtifact = artifact;
          break;
        }
      }
      
      if (!selectedArtifact) {
        selectedArtifact = weightedArtifacts[0]; // Fallback
      }
      
      // Check if user has space in inventory
      if (user.inventoryWeight + selectedArtifact.weight > config.maxInventoryWeight) {
        // Set detect cooldown
        user.cooldowns.detect = now + (config.cooldowns.detect * 60 * 1000);
        dataManager.saveUser(user);
        
        await message.reply(`You found a ${selectedArtifact.name}, but your inventory is too full to carry it! Drop some items first.`);
        return;
      }
      
      // Add artifact to inventory
      const artifactItem = items[selectedArtifact.itemId];
      user.inventory.push(selectedArtifact.itemId);
      user.inventoryWeight += artifactItem.weight;
      
      // Chance to take radiation damage from artifact handling
      const radiationChance = 0.5 - (detectorQuality * 0.1); // Better detectors reduce radiation chance
      if (Math.random() < radiationChance) {
        const radiationAmount = Math.floor(Math.random() * 10) + 5; // 5-15 radiation
        user.radiation += radiationAmount;
        
        // If radiation hits 100%, reduce health
        if (user.radiation >= 100) {
          const healthDamage = Math.floor((user.radiation - 100) / 10) + 5;
          user.health = Math.max(1, user.health - healthDamage);
          user.radiation = 100;
        }
      }
      
      // Set detect cooldown
      user.cooldowns.detect = now + (config.cooldowns.detect * 60 * 1000);
      
      // Save the updated user data
      dataManager.saveUser(user);
      
      // Create artifact found embed
      let description = `You discovered a ${selectedArtifact.name} in an anomaly field!\n\n${selectedArtifact.description}`;
      
      // Add radiation warning if applicable
      if (user.radiation > 80) {
        description += '\n\n⚠️ **WARNING**: Your radiation level is critical! Use anti-rad medication immediately.';
      } else if (user.radiation > 50) {
        description += '\n\n⚠️ Your radiation level is getting high. Consider using anti-rad medication.';
      }
      
      const artifactEmbed = new EmbedBuilder()
        .setColor(config.colors.radiation)
        .setTitle(`Artifact Found: ${selectedArtifact.name}`)
        .setDescription(description)
        .addFields(
          { name: 'Effects', value: selectedArtifact.effects.join('\n'), inline: false },
          { name: 'Rarity', value: `${selectedArtifact.rarity}/10`, inline: true },
          { name: 'Value', value: `${artifactItem.value} RU`, inline: true },
          { name: 'Weight', value: `${artifactItem.weight} kg`, inline: true },
          { name: 'Radiation', value: `Your level: ${user.radiation}%`, inline: true }
        )
        .setFooter({ text: `Cooldown: ${config.cooldowns.detect} minutes` })
        .setTimestamp();
      
      await message.reply({ embeds: [artifactEmbed] });
      
    } else if (subcommand === 'info') {
      // Show information about artifacts in user's inventory
      
      // Find artifacts in inventory
      const userArtifacts = user.inventory.filter(itemId => 
        items[itemId] && items[itemId].category === 'artifact'
      );
      
      if (userArtifacts.length === 0) {
        await message.reply(`You don't have any artifacts in your inventory. Use \`${PREFIX}artifacts detect\` to search for some.`);
        return;
      }
      
      // Create artifact info embed
      const artifactInfoEmbed = new EmbedBuilder()
        .setColor(config.colors.radiation)
        .setTitle(`${user.name}'s Artifacts`)
        .setDescription(`You have ${userArtifacts.length} artifacts in your inventory.`)
        .setFooter({ text: 'Artifacts can be equipped, sold, or combined for various effects' })
        .setTimestamp();
      
      // Add each artifact to the embed
      for (const itemId of userArtifacts) {
        const item = items[itemId];
        const artifactData = Object.values(artifacts).find(a => a.itemId === itemId);
        
        if (item && artifactData) {
          const isEquipped = user.equipped.artifacts.includes(itemId) ? ' (Equipped)' : '';
          
          artifactInfoEmbed.addFields({
            name: `${item.name}${isEquipped}`,
            value: `**Description**: ${artifactData.description}\n**Effects**: ${artifactData.effects.join(', ')}\n**Value**: ${item.value} RU`,
            inline: false
          });
        }
      }
      
      await message.reply({ embeds: [artifactInfoEmbed] });
    } else {
      await message.reply(`Unknown artifacts command: "${subcommand}". Available commands: detect, info.`);
    }
  },
};
