const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const fs = require('fs');
const path = require('path');
const dataManager = require("../utils/dataManager");
const config = require("../config");
const combatSystem = require("../utils/combatSystem");
const embedCreator = require("../utils/embedCreator");

const PREFIX = process.env.PREFIX || "!";

// Path to assets folder for mutant images
const assetsPath = path.join(__dirname, '../assets');

module.exports = {
  name: "combat",
  aliases: ["hunt", "fight", "c"],
  description: "Combat and hunting commands for STALKERNet",

  async execute(message, args) {
    const userId = message.author.id;

    let user = dataManager.getUser(userId);
    if (!user) {
      user = dataManager.createUser(userId, message.author.username);
      const welcomeEmbed = embedCreator.createSuccessEmbed(
        `Profile Created`,
        `Welcome to the Zone, Stalker! Your profile has been created.`
      );
      await message.reply({ embeds: [welcomeEmbed] });
    }

    // Initialize user status effects if not present
    if (!user.statusEffects) {
      user.statusEffects = [];
    }

    const subcommand = args.length > 0 ? args[0].toLowerCase() : "hunt";

    if (subcommand === "hunt" || subcommand === "stalk") {
      await handleHunt(message, user, subcommand === "stalk");
    } else if (subcommand === "status") {
      await showUserCombatStatus(message, user);
    } else if (subcommand === "info") {
      if (args.length < 2) {
        const helpEmbed = embedCreator.createEmbed(
          "Combat Info Help",
          `Use \`${PREFIX}combat info <type>\` to get information about different mutant types or combat tactics.\n\nAvailable topics: mutants, weapons, tactics`,
          "primary"
        );
        await message.reply({ embeds: [helpEmbed] });
        return;
      }
      
      const infoType = args[1].toLowerCase();
      await showCombatInfo(message, infoType);
    } else {
      const helpEmbed = embedCreator.createErrorEmbed(
        `Combat Command Help`,
        `Unknown combat command: "${subcommand}".\n\nAvailable commands:\n• \`${PREFIX}combat hunt\` - Hunt for mutants\n• \`${PREFIX}combat stalk\` - Carefully stalk (higher chance for rarer mutants)\n• \`${PREFIX}combat status\` - Check your combat status\n• \`${PREFIX}combat info <topic>\` - Get information about combat`
      );
      await message.reply({ embeds: [helpEmbed] });
    }
  },
};

/**
 * Handle the hunt/stalk command
 * @param {Object} message - Discord message object
 * @param {Object} user - User data
 * @param {boolean} isStalking - Whether user is stalking (more cautious approach)
 */
async function handleHunt(message, user, isStalking = false) {
  const now = Date.now();
  if (user.cooldowns.hunt && now < user.cooldowns.hunt) {
    const timeLeft = Math.ceil((user.cooldowns.hunt - now) / 1000 / 60);
    const cooldownEmbed = embedCreator.createErrorEmbed(
      `Hunt Cooldown`,
      `You're still recovering from your last hunt. Try again in ${timeLeft} minute(s).`
    );
    await message.reply({ embeds: [cooldownEmbed] });
    return;
  }

  if (!user.equipped.weapon) {
    const errorEmbed = embedCreator.createErrorEmbed(
      `Improper Gear`,
      `You need to equip a weapon before hunting. Use \`${PREFIX}inventory equip <weapon>\` to equip a weapon.`
    );
    await message.reply({ embeds: [errorEmbed] });
    return;
  }

  // Get zone and mutant data
  const zones = dataManager.getZones();
  const currentZone = zones[user.currentZone];
  const mutants = dataManager.getMutants();
  const encounters = dataManager.getEncounters();

  // Prefer encounters data if available, otherwise use mutants
  const zoneMutants = encounters ? 
    Object.values(encounters).filter(
      (mutant) => mutant.zones && (mutant.zones.includes(currentZone.name) || mutant.zones.includes("all"))
    ) : 
    Object.values(mutants).filter(
      (mutant) => mutant.zones && (mutant.zones.includes(currentZone.name) || mutant.zones.includes("all"))
    );

  if (zoneMutants.length === 0) {
    user.cooldowns.hunt = now + config.cooldowns.hunt * 30 * 1000;
    dataManager.saveUser(user);

    const noMutantsEmbed = embedCreator.createEmbed(
      `Hunt Results: ${currentZone.name}`,
      `You searched for mutants in ${currentZone.name}, but found nothing to hunt. The area seems quiet... for now.`,
      "primary"
    );
    await message.reply({ embeds: [noMutantsEmbed] });
    return;
  }

  // For stalking, we modify the rarity distribution to favor rare mutants
  const stalkBonus = isStalking ? 2 : 0;
  
  // Calculate mutant distribution based on rarity
  const totalRarity = zoneMutants.reduce(
    (sum, mutant) => sum + (10 - mutant.rarity + stalkBonus),
    0
  );
  
  let randomValue = Math.random() * totalRarity;
  let selectedMutant = null;
  let cumulativeRarity = 0;

  for (const mutant of zoneMutants) {
    // When stalking, give more weight to rare mutants
    const effectiveRarity = mutant.rarity - stalkBonus;
    cumulativeRarity += 10 - effectiveRarity;
    if (randomValue <= cumulativeRarity) {
      selectedMutant = mutant;
      break;
    }
  }

  if (!selectedMutant) {
    selectedMutant = zoneMutants[0];
  }

  // Check if the mutant image exists
  const mutantImagePath = path.join(assetsPath, selectedMutant.image || 'default_mutant.png');
  const hasImage = selectedMutant.image && fs.existsSync(mutantImagePath);

  // Create encounter message
  const encounterEmbed = embedCreator.createEmbed(
    `Mutant Encounter: ${selectedMutant.name}`,
    isStalking ? 
      `While carefully stalking through ${currentZone.name}, you've encountered a ${selectedMutant.name}!` :
      `While hunting in ${currentZone.name}, you've spotted a ${selectedMutant.name}!`,
    "error"
  );

  encounterEmbed.addFields(
    { name: 'Type', value: selectedMutant.type || 'Unknown', inline: true },
    { name: 'Danger', value: selectedMutant.danger || selectedMutant.rarity.toString(), inline: true },
    { name: 'Health', value: `${selectedMutant.health}`, inline: true }
  );

  if (selectedMutant.behavior) {
    encounterEmbed.addFields({ name: 'Behavior', value: selectedMutant.behavior });
  }
  
  if (selectedMutant.attack) {
    encounterEmbed.addFields({ name: 'Attack', value: selectedMutant.attack });
  }

  // Add combat options
  encounterEmbed.setFooter({ text: `Use "${PREFIX}combat fight" to engage or respond with "run" to flee` });

  // Add the mutant image if available
  let messageOptions = { embeds: [encounterEmbed] };
  if (hasImage) {
    const attachment = new AttachmentBuilder(mutantImagePath, { name: selectedMutant.image });
    encounterEmbed.setImage(`attachment://${selectedMutant.image}`);
    messageOptions.files = [attachment];
  }

  // Send encounter message
  const encounterMsg = await message.reply(messageOptions);

  // Create a filter for the message collector
  const filter = m => m.author.id === message.author.id && 
                    (m.content.toLowerCase().includes('fight') || 
                     m.content.toLowerCase().includes('attack') || 
                     m.content.toLowerCase().includes('run') || 
                     m.content.toLowerCase().includes('flee'));

  // Create a message collector
  const collector = message.channel.createMessageCollector({ filter, time: 20000 }); // 20 seconds to respond

  // Track whether combat started
  let combatStarted = false;

  collector.on('collect', async m => {
    combatStarted = true;
    collector.stop();
    
    const content = m.content.toLowerCase();
    const isFleeing = content.includes('run') || content.includes('flee');
    
    if (isFleeing) {
      // Determine flee chance based on mutant and stalking bonus
      const baseFleeChance = selectedMutant.escape_chance || 0.5;
      const stalkingBonus = isStalking ? 0.2 : 0; // Stalking gives better chance to flee
      const fleeChance = Math.min(0.9, baseFleeChance + stalkingBonus);
      
      const fleeSuccess = Math.random() < fleeChance;
      
      if (fleeSuccess) {
        // Successfully fled
        const fleeEmbed = embedCreator.createSuccessEmbed(
          "Escaped!", 
          `You managed to escape from the ${selectedMutant.name} unharmed. That was close!`
        );
        await message.reply({ embeds: [fleeEmbed] });
        
        // Set a shorter cooldown for fleeing
        user.cooldowns.hunt = now + (2 * 60 * 1000); // 2 minute cooldown
        dataManager.saveUser(user);
      } else {
        // Failed to flee, forced to combat
        const failedFleeEmbed = embedCreator.createErrorEmbed(
          "Failed to Escape", 
          `You tried to escape from the ${selectedMutant.name}, but it was too fast! You have no choice but to fight!`
        );
        await message.reply({ embeds: [failedFleeEmbed] });
        
        // Start combat with surprise penalty
        await executeCombat(message, user, selectedMutant, true);
      }
    } else {
      // Start combat
      const engageEmbed = embedCreator.createEmbed(
        "Combat Engaged", 
        `You ready your weapon and engage the ${selectedMutant.name}!`,
        "error"
      );
      await message.reply({ embeds: [engageEmbed] });
      await executeCombat(message, user, selectedMutant, false);
    }
  });

  collector.on('end', async collected => {
    if (!combatStarted) {
      // Player didn't respond in time
      const surpriseEmbed = embedCreator.createErrorEmbed(
        "Surprise Attack!", 
        `You hesitated too long! The ${selectedMutant.name} lunges at you!`
      );
      await message.reply({ embeds: [surpriseEmbed] });
      
      // Start combat with surprise penalty
      await executeCombat(message, user, selectedMutant, true);
    }
  });
}

/**
 * Execute combat between user and mutant
 * @param {Object} message - Discord message object
 * @param {Object} user - User data
 * @param {Object} mutant - Mutant data
 * @param {boolean} surprisePenalty - Whether user has surprise penalty
 */
async function executeCombat(message, user, mutant, surprisePenalty = false) {
  // Get items data for weapons
  const items = dataManager.getItems();
  const weapon = items[user.equipped.weapon];
  
  // Apply surprise penalty (reduced effectiveness)
  const penaltyMultiplier = surprisePenalty ? 0.75 : 1.0;
  
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
    weapon.damage = Math.floor(weapon.damage * penaltyMultiplier);
    weapon.accuracy = Math.floor(weapon.accuracy * penaltyMultiplier);
  }
  
  // Simulate combat
  const combatResult = combatSystem.simulateCombat(userForCombat, mutantForCombat, weapon);
  
  // Apply damage to user
  user.health = Math.max(1, user.health - combatResult.damageTaken);
  
  // Apply radiation gained
  if (combatResult.radiationGained > 0) {
    user.radiation = Math.min(100, (user.radiation || 0) + combatResult.radiationGained);
  }
  
  // If user has persistent status effects, update them
  user.statusEffects = combatResult.statusEffects;
  
  // Process rewards if victory
  if (combatResult.victory) {
    // Add reputation
    const reputationGain = mutant.reputation || Math.floor(mutant.rarity * 2);
    user.reputation += reputationGain;
    
    // Process loot drops
    const lootResults = [];
    
    // Use mutant.drops or compute defaults
    const drops = mutant.drops || mutant.loot || [
      {
        itemId: `mutant_part_${mutant.type || 'generic'}`,
        name: `${mutant.name} part`,
        chance: 0.6,
        value: mutant.rarity * 50
      }
    ];
    
    for (const drop of drops) {
      if (Math.random() < (drop.chance || 0.3)) {
        const dropItem = items[drop.itemId];
        if (dropItem) {
          if (user.inventoryWeight + dropItem.weight <= config.maxInventoryWeight) {
            user.inventory.push(drop.itemId);
            user.inventoryWeight += dropItem.weight;
            combatResult.loot.push(dropItem);
            lootResults.push(dropItem.name);
          }
        }
      }
    }
    
    // Generate rubles reward
    const minRubles = mutant.minRubles || (mutant.rubles ? mutant.rubles.min : 10);
    const maxRubles = mutant.maxRubles || (mutant.rubles ? mutant.rubles.max : 20 + (mutant.rarity * 10));
    const rubleReward = Math.floor(Math.random() * (maxRubles - minRubles + 1)) + minRubles;
    user.rubles += rubleReward;
    combatResult.rubles = rubleReward;
    
    // Generate combat log with rewards
    let combatLog = combatResult.combatLog.join("\n");
    
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
    
    // Create the combat result embed
    const combatEmbed = embedCreator.createCombatEmbed(
      `Combat: ${mutant.name}`,
      combatLog,
      true // Victory
    );
    
    combatEmbed.addFields(
      { name: 'Your Health', value: `${user.health}/${config.maxHealth}`, inline: true },
      { name: 'Radiation', value: `${user.radiation || 0}%`, inline: true },
      { name: 'Status', value: 'Victory', inline: true }
    );
    
    if (user.statusEffects && user.statusEffects.length > 0) {
      const effectNames = user.statusEffects.map(e => `${e.icon} ${e.name} (${e.duration} rounds)`).join("\n");
      combatEmbed.addFields({ name: 'Status Effects', value: effectNames, inline: false });
    }
    
    // Set hunt cooldown (shorter for victory)
    user.cooldowns.hunt = now + (config.cooldowns.hunt * 45 * 1000); // 3/4 of normal cooldown
    
    // Save user data
    dataManager.saveUser(user);
    
    // Send combat results
    await message.reply({ embeds: [combatEmbed] });
  } 
  else {
    // User escaped or was defeated
    let combatLog = combatResult.combatLog.join("\n");
    
    if (combatResult.radiationGained > 0) {
      combatLog += `\n\n☢️ Radiation: +${combatResult.radiationGained}%`;
    }
    
    // Create the combat result embed
    const combatEmbed = embedCreator.createCombatEmbed(
      `Combat: ${mutant.name}`,
      combatLog,
      false // Not victory
    );
    
    combatEmbed.addFields(
      { name: 'Your Health', value: `${user.health}/${config.maxHealth}`, inline: true },
      { name: 'Radiation', value: `${user.radiation || 0}%`, inline: true },
      { name: 'Status', value: combatResult.damageTaken > 0 ? 'Wounded' : 'Escaped', inline: true }
    );
    
    if (user.statusEffects && user.statusEffects.length > 0) {
      const effectNames = user.statusEffects.map(e => `${e.icon} ${e.name} (${e.duration} rounds)`).join("\n");
      combatEmbed.addFields({ name: 'Status Effects', value: effectNames, inline: false });
    }
    
    // Set hunt cooldown (longer for defeat/escape)
    user.cooldowns.hunt = now + (config.cooldowns.hunt * 60 * 1000); // full cooldown
    
    // Save user data
    dataManager.saveUser(user);
    
    // Send combat results
    await message.reply({ embeds: [combatEmbed] });
  }
}

/**
 * Show user's current combat status and active effects
 * @param {Object} message - Discord message object
 * @param {Object} user - User data
 */
async function showUserCombatStatus(message, user) {
  const items = dataManager.getItems();
  let weaponName = "unarmed";
  
  if (user.equipped.weapon) {
    const weapon = items[user.equipped.weapon];
    if (weapon) {
      weaponName = weapon.name;
    }
  }
  
  let armorName = "unarmored";
  let armorProtection = 0;
  
  if (user.equipped.armor) {
    const armor = items[user.equipped.armor];
    if (armor) {
      armorName = armor.name;
      armorProtection = armor.protection || 0;
    }
  }
  
  const statusEmbed = embedCreator.createEmbed(
    `Combat Status: ${user.name}`,
    `Your current combat readiness and status effects`,
    "primary"
  );
  
  statusEmbed.addFields(
    { name: 'Health', value: `${user.health}/${config.maxHealth}`, inline: true },
    { name: 'Radiation', value: `${user.radiation || 0}%`, inline: true },
    { name: 'Weapon', value: weaponName, inline: true },
    { name: 'Armor', value: `${armorName} (${armorProtection}% protection)`, inline: true }
  );
  
  // Add active status effects if any
  if (user.statusEffects && user.statusEffects.length > 0) {
    const effectsList = user.statusEffects
      .map(effect => `${effect.icon} ${effect.name} (${effect.duration} rounds): ${effect.description}`)
      .join('\n');
    
    statusEmbed.addFields({ name: 'Active Status Effects', value: effectsList });
  } else {
    statusEmbed.addFields({ name: 'Active Status Effects', value: 'None' });
  }
  
  await message.reply({ embeds: [statusEmbed] });
}

/**
 * Show information about combat system
 * @param {Object} message - Discord message object
 * @param {string} infoType - Type of info to show
 */
async function showCombatInfo(message, infoType) {
  if (infoType === 'mutants') {
    const mutantInfoEmbed = embedCreator.createEmbed(
      "S.T.A.L.K.E.R. Mutants Guide",
      "Information about the various mutants you'll encounter in the Zone",
      "primary"
    );
    
    mutantInfoEmbed.addFields(
      { 
        name: 'Bloodsucker', 
        value: 'Stealthy predators that can turn invisible. Watch for their reappearance and be ready to strike.',
        inline: false 
      },
      { 
        name: 'Boar', 
        value: 'Aggressive and territorial mutated boars. They charge with surprising speed.',
        inline: false 
      },
      { 
        name: 'Pseudogiant', 
        value: 'Massive creatures with incredible strength. They can enter a frenzied state with multiple attacks.',
        inline: false 
      },
      { 
        name: 'Controller', 
        value: 'Psychic mutants that can confuse your mind and reduce accuracy. Keep your distance.',
        inline: false 
      },
      { 
        name: 'Chimera', 
        value: 'Fast and agile predators with deadly attacks. Extremely dangerous in close combat.',
        inline: false 
      }
    );
    
    await message.reply({ embeds: [mutantInfoEmbed] });
  } 
  else if (infoType === 'weapons') {
    const weaponInfoEmbed = embedCreator.createEmbed(
      "S.T.A.L.K.E.R. Weapons Guide",
      "Information about weapon types and their special effects",
      "primary"
    );
    
    weaponInfoEmbed.addFields(
      { 
        name: 'Rifles', 
        value: 'Balanced weapons with good accuracy. Chance to cause bleeding damage to mutants.',
        inline: false 
      },
      { 
        name: 'Shotguns', 
        value: 'High damage at close range with a chance to stun enemies. Highest critical hit damage.',
        inline: false 
      },
      { 
        name: 'Pistols', 
        value: 'Fast, reliable sidearms with quick follow-up shots. Lower damage but rapid fire.',
        inline: false 
      },
      { 
        name: 'SMGs', 
        value: 'Rapid fire weapons with burst damage. Can hit multiple times in a single attack.',
        inline: false 
      },
      { 
        name: 'Sniper Rifles', 
        value: 'Highest critical hit chance, but lower base accuracy. Devastating when they hit.',
        inline: false 
      }
    );
    
    await message.reply({ embeds: [weaponInfoEmbed] });
  }
  else if (infoType === 'tactics') {
    const tacticsEmbed = embedCreator.createEmbed(
      "S.T.A.L.K.E.R. Combat Tactics",
      "Strategic advice for surviving encounters in the Zone",
      "primary"
    );
    
    tacticsEmbed.addFields(
      { 
        name: 'Stalking vs Hunting', 
        value: `Use \`${PREFIX}combat stalk\` for a more cautious approach with higher chance to find rare mutants and better escape chances.`,
        inline: false 
      },
      { 
        name: 'Choosing Weapons', 
        value: 'Match your weapon to your playstyle. Shotguns for close encounters, rifles for versatility, snipers for rare mutants.',
        inline: false 
      },
      { 
        name: 'Status Effects', 
        value: 'Bleeding, radiation, and stunning can turn the tide of battle. Use weapons with status effects.',
        inline: false 
      },
      { 
        name: 'When to Flee', 
        value: 'Escaping is not cowardice - it\'s survival. Run from high-tier mutants when low on health.',
        inline: false 
      },
      { 
        name: 'Armor Choice', 
        value: 'Higher protection reduces damage, but may slow you down. Balance protection with mobility.',
        inline: false 
      }
    );
    
    await message.reply({ embeds: [tacticsEmbed] });
  }
  else {
    const unknownEmbed = embedCreator.createErrorEmbed(
      "Unknown Topic",
      `Topic "${infoType}" not found. Available topics: mutants, weapons, tactics`
    );
    await message.reply({ embeds: [unknownEmbed] });
  }
}
