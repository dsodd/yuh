const { AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dataManager = require('../utils/dataManager');
const config = require('../config');
const combatSystem = require('../utils/combatSystem');
const embedCreator = require('../utils/embedCreator');

// Get prefix from .env
const PREFIX = process.env.PREFIX || '!';

// Path to assets folder
const assetsPath = path.join(__dirname, '../assets');

module.exports = {
  name: 'explore',
  aliases: ['exp', 'expedition', 'encounter'],
  description: 'Explore the current zone for mutant encounters',
  
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
    
    // Get all zones data and encounters data
    const zones = dataManager.getZones();
    const encounters = dataManager.getEncounters();
    const items = dataManager.getItems();
    
    // Check if user has a weapon equipped
    if (!user.equipped.weapon) {
      const errorEmbed = embedCreator.createErrorEmbed(
        "No Weapon Equipped", 
        `You need to equip a weapon before exploring. The Zone is dangerous. Use \`${PREFIX}inventory equip <weapon>\` to equip a weapon.`
      );
      await message.reply({ embeds: [errorEmbed] });
      return;
    }
    
    // Check cooldowns
    const now = Date.now();
    
    // Check explore cooldown
    if (user.cooldowns.explore && now < user.cooldowns.explore) {
      const timeLeft = Math.ceil((user.cooldowns.explore - now) / 1000 / 60); // minutes left
      const cooldownEmbed = embedCreator.createErrorEmbed(
        "Exploration Cooldown", 
        `You're still recovering from your last exploration. Try again in ${timeLeft} minute(s).`
      );
      await message.reply({ embeds: [cooldownEmbed] });
      return;
    }
    
    // Get current zone
    const currentZone = zones[user.currentZone];
    
    // Determine if user encounters anything (based on zone danger level)
    const encounterChance = 0.7 * (currentZone.dangerLevel / 10); // Higher danger = higher chance
    const foundEncounter = Math.random() < encounterChance;
    
    if (!foundEncounter) {
      // Set explore cooldown (shorter since no encounter)
      user.cooldowns.explore = now + (5 * 60 * 1000); // 5 minute cooldown
      dataManager.saveUser(user);
      
      const explorationEmbed = embedCreator.createEmbed(
        `Exploration: ${currentZone.name}`,
        `You explored ${currentZone.name} but didn't encounter any mutants. The area seems quiet... for now.`,
        'primary'
      );
      await message.reply({ embeds: [explorationEmbed] });
      return;
    }
    
    // Filter mutants by zone's difficulty
    const zoneDifficulty = currentZone.dangerLevel;
    const potentialMutants = Object.values(encounters).filter(
      mutant => Math.abs(mutant.difficulty - zoneDifficulty) <= 3 // Within 3 difficulty levels
    );
    
    if (potentialMutants.length === 0) {
      // Fallback to any mutant if none match the zone difficulty
      const anyMutant = Object.values(encounters)[Math.floor(Math.random() * Object.values(encounters).length)];
      potentialMutants.push(anyMutant);
    }
    
    // Select a random mutant
    const selectedMutant = potentialMutants[Math.floor(Math.random() * potentialMutants.length)];
    
    // Check if the mutant image exists
    const mutantImagePath = path.join(assetsPath, selectedMutant.image);
    const hasImage = fs.existsSync(mutantImagePath);
    
    // Create the encounter message
    const mutantEmbed = embedCreator.createEmbed(
      `Mutant Encounter: ${selectedMutant.name}`,
      `While exploring ${currentZone.name}, you've encountered a ${selectedMutant.name}!`,
      'error'
    );
    
    mutantEmbed.addFields(
      { name: 'Type', value: selectedMutant.type, inline: true },
      { name: 'Danger', value: selectedMutant.danger, inline: true },
      { name: 'Health', value: `${selectedMutant.health}`, inline: true },
      { name: 'Behavior', value: selectedMutant.behavior },
      { name: 'Attack', value: selectedMutant.attack }
    )
    .setFooter({ text: 'React or respond to engage the mutant or attempt to flee' });
    
    // Add the mutant image if available
    let messageOptions = {};
    if (hasImage) {
      const attachment = new AttachmentBuilder(mutantImagePath, { name: selectedMutant.image });
      mutantEmbed.setImage(`attachment://${selectedMutant.image}`);
      messageOptions.files = [attachment];
    }
    
    // Send the encounter message
    messageOptions.embeds = [mutantEmbed];
    const encounterMsg = await message.reply(messageOptions);
    
    // Create a filter for the message collector
    const filter = m => m.author.id === message.author.id && 
                      (m.content.toLowerCase().includes('attack') || 
                       m.content.toLowerCase().includes('fight') || 
                       m.content.toLowerCase().includes('flee') || 
                       m.content.toLowerCase().includes('run'));
    
    // Create a message collector
    const collector = message.channel.createMessageCollector({ filter, time: 30000 }); // 30 seconds to respond
    
    collector.on('collect', async m => {
      // Check the player's response
      const content = m.content.toLowerCase();
      const isFleeing = content.includes('flee') || content.includes('run');
      
      if (isFleeing) {
        // Player is trying to flee
        const fleeChance = selectedMutant.escape_chance;
        const fleeSuccess = Math.random() < fleeChance;
        
        if (fleeSuccess) {
          // Successfully fled
          const fleeEmbed = embedCreator.createSuccessEmbed(
            "Escaped!", 
            `You managed to escape from the ${selectedMutant.name}. That was close!`
          );
          await message.reply({ embeds: [fleeEmbed] });
          
          // Set a shorter cooldown for fleeing
          user.cooldowns.explore = now + (3 * 60 * 1000); // 3 minute cooldown
          dataManager.saveUser(user);
        } else {
          // Failed to flee, forced to combat
          const failedFleeEmbed = embedCreator.createErrorEmbed(
            "Failed to Escape", 
            `You tried to escape from the ${selectedMutant.name}, but it caught up to you! You have no choice but to fight!`
          );
          await message.reply({ embeds: [failedFleeEmbed] });
          
          // Proceed with combat (with a penalty for failing to flee)
          await handleCombat(message, user, selectedMutant, true);
        }
        
        collector.stop();
      } else {
        // Player is attacking/fighting
        const engageEmbed = embedCreator.createEmbed(
          "Combat Engaged", 
          `You prepare your ${getWeaponName(user, items)} and engage the ${selectedMutant.name}!`,
          "error"
        );
        await message.reply({ embeds: [engageEmbed] });
        await handleCombat(message, user, selectedMutant);
        collector.stop();
      }
    });
    
    collector.on('end', async (collected, reason) => {
      if (reason === 'time' && collected.size === 0) {
        // Player didn't respond in time
        const surpriseEmbed = embedCreator.createErrorEmbed(
          "Surprise Attack!", 
          `You froze in fear as the ${selectedMutant.name} approached. The creature attacks!`
        );
        await message.reply({ embeds: [surpriseEmbed] });
        
        // Proceed with combat with a surprise penalty
        await handleCombat(message, user, selectedMutant, true);
      }
    });
  },
};

async function handleCombat(message, user, mutant, surprisePenalty = false) {
  // Get all items data
  const items = dataManager.getItems();
  
  // Get weapon details
  const weapon = items[user.equipped.weapon];
  
  // Apply surprise penalty if needed (reduces player's effectiveness)
  const penaltyMultiplier = surprisePenalty ? 0.75 : 1.0;
  
  // Initialize user status effects if not present
  if (!user.statusEffects) {
    user.statusEffects = [];
  }
  
  // Create combat-ready mutant object
  const mutantForCombat = {
    name: mutant.name,
    health: mutant.health,
    damage: mutant.damage || Math.floor(10 + (mutant.rarity * 2)), // Default damage if not specified
    accuracy: mutant.accuracy || 65, // Default accuracy
    type: mutant.type || 'generic'
  };
  
  // Copy user to avoid modifying original during combat calculation
  const userForCombat = {...user};
  
  // Apply surprise penalty to user's weapon if needed
  if (surprisePenalty && weapon) {
    // Create a temporary copy of the weapon to avoid modifying the original
    const tempWeapon = {...weapon};
    tempWeapon.damage = Math.floor(weapon.damage * penaltyMultiplier);
    tempWeapon.accuracy = Math.floor(weapon.accuracy * penaltyMultiplier);
    
    // Use the modified weapon copy for combat
    const combatResult = combatSystem.simulateCombat(userForCombat, mutantForCombat, tempWeapon);
    processCombatResults(message, user, mutant, combatResult);
  } else {
    // Normal combat with unmodified weapon
    const combatResult = combatSystem.simulateCombat(userForCombat, mutantForCombat, weapon);
    processCombatResults(message, user, mutant, combatResult);
  }
}

/**
 * Process combat results and apply rewards/penalties
 * @param {Object} message - Discord message object
 * @param {Object} user - User data object
 * @param {Object} mutant - Mutant data
 * @param {Object} combatResult - Results from combat simulation
 */
async function processCombatResults(message, user, mutant, combatResult) {
  const items = dataManager.getItems();
  const now = Date.now();
  
  // Apply damage to user
  user.health = Math.max(1, user.health - combatResult.damageTaken);
  
  // Apply radiation gained
  if (combatResult.radiationGained > 0) {
    user.radiation = Math.min(100, (user.radiation || 0) + combatResult.radiationGained);
  }
  
  // If user has persistent status effects, update them
  user.statusEffects = combatResult.statusEffects;
  
  // Generate combat log text
  let combatLog = combatResult.combatLog.join('\n');
  
  // Process rewards if victory
  if (combatResult.victory) {
    // Add reputation based on mutant rarity/difficulty
    const reputationGain = mutant.xp || mutant.reputation || Math.floor(mutant.rarity * 2);
    user.reputation += reputationGain;
    
    // Process loot drops
    const lootResults = [];
    
    // Use mutant.drops or compute defaults
    const drops = mutant.loot || mutant.drops || [
      {
        itemId: `mutant_part_${mutant.type || 'generic'}`,
        name: `${mutant.name} part`,
        chance: 0.6,
        value: mutant.rarity * 50
      }
    ];
    
    for (const lootItem of drops) {
      if (Math.random() < (lootItem.chance || 0.3)) {
        // Get existing item or create a new one if needed
        let dropItem = items[lootItem.itemId];
        
        if (!dropItem) {
          // Create a default item entry for non-existent items
          dropItem = {
            id: lootItem.itemId,
            name: lootItem.name || `${mutant.name} part`,
            description: `A valuable part harvested from a ${mutant.name}.`,
            category: 'mutant_part',
            weight: lootItem.weight || 0.5,
            value: lootItem.value || (mutant.rarity * 50)
          };
        }
        
        // Check inventory weight
        if (user.inventoryWeight + dropItem.weight <= config.maxInventoryWeight) {
          user.inventory.push(lootItem.itemId);
          user.inventoryWeight += dropItem.weight;
          lootResults.push(dropItem.name);
          combatResult.loot.push(dropItem);
        }
      }
    }
    
    // Generate rubles reward
    const minRubles = mutant.rubles ? mutant.rubles.min : 10;
    const maxRubles = mutant.rubles ? mutant.rubles.max : 20 + (mutant.rarity * 10);
    const rubleReward = Math.floor(Math.random() * (maxRubles - minRubles + 1)) + minRubles;
    user.rubles += rubleReward;
    combatResult.rubles = rubleReward;
    
    // Add rewards to combat log
    if (lootResults.length > 0) {
      combatLog += `\n\n📦 Loot: ${lootResults.join(", ")}`;
    }
    
    combatLog += `\n💰 Rubles: +${rubleReward}`;
    combatLog += `\n🌟 Reputation: +${reputationGain}`;
    
    // Check for rank up
    const oldRank = user.rank;
    const newRank = Math.floor(user.reputation / 100) + 1;
    if (newRank > oldRank) {
      user.rank = newRank;
      combatLog += `\n\n🎖️ You've been promoted to rank ${newRank}!`;
    }
    
    // Set cooldown (shorter for victory)
    user.cooldowns.explore = now + (8 * 60 * 1000); // 8 minute cooldown for victory
  } else {
    // Add radiation information if applicable
    if (combatResult.radiationGained > 0) {
      combatLog += `\n\n☢️ Radiation: +${combatResult.radiationGained}%`;
    }
    
    // Set longer cooldown for defeat/escape
    user.cooldowns.explore = now + (10 * 60 * 1000); // 10 minute cooldown for defeat/escape
  }
  
  // Save the updated user data
  dataManager.saveUser(user);
  
  // Create embed for combat result
  const combatEmbed = embedCreator.createCombatEmbed(
    `Exploration Encounter: ${mutant.name}`,
    combatLog,
    combatResult.victory
  );
  
  // Add health and status fields
  combatEmbed.addFields(
    { name: 'Your Health', value: `${user.health}/${config.maxHealth}`, inline: true },
    { name: 'Radiation', value: `${user.radiation || 0}%`, inline: true },
    { name: 'Status', value: combatResult.victory ? 'Victory' : (combatResult.damageTaken > 0 ? 'Wounded' : 'Escaped'), inline: true }
  );
  
  // Add status effects if present
  if (user.statusEffects && user.statusEffects.length > 0) {
    const effectNames = user.statusEffects.map(e => `${e.icon} ${e.name} (${e.duration} rounds)`).join('\n');
    combatEmbed.addFields({ name: 'Status Effects', value: effectNames, inline: false });
  }
  
  // Set footer with cooldown
  combatEmbed.setFooter({ 
    text: `Cooldown: ${combatResult.victory ? 8 : 10} minutes`
  });
  
  // Send the result
  await message.reply({ embeds: [combatEmbed] });
}

function getWeaponName(user, items) {
  if (!user.equipped.weapon) return 'bare hands';
  
  const weapon = items[user.equipped.weapon];
  return weapon ? weapon.name : 'weapon';
}