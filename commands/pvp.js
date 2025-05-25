const { EmbedBuilder } = require('discord.js');
const dataManager = require('../utils/dataManager');
const config = require('../config');
const combatSystem = require('../utils/combatSystem');
const embedCreator = require('../utils/embedCreator');

// Get prefix from .env
const PREFIX = process.env.PREFIX || '!';

// Store active duel requests
const activeDuels = new Map();

module.exports = {
  name: 'pvp',
  aliases: ['duel', 'challenge'],
  description: 'Challenge other stalkers to duels',
  
  async execute(message, args) {
    const userId = message.author.id;
    
    // Get user data or create if not exists
    let user = dataManager.getUser(userId);
    if (!user) {
      user = dataManager.createUser(userId, message.author.username);
      await message.reply(`Welcome to the Zone, Stalker! Your profile has been created.`);
    }
    
    // Check if user has a weapon equipped
    if (!user.equipped.weapon) {
      const errorEmbed = embedCreator.createErrorEmbed(
        "No Weapon Equipped", 
        `You need to equip a weapon before challenging someone to a duel. Use \`${PREFIX}inventory equip <weapon>\` to equip a weapon.`
      );
      await message.reply({ embeds: [errorEmbed] });
      return;
    }
    
    // Get subcommand
    if (!args.length) {
      const helpEmbed = embedCreator.createEmbed(
        "PVP Commands",
        `Use \`${PREFIX}pvp challenge @user\` to challenge someone to a duel.
         Use \`${PREFIX}pvp accept\` to accept an active challenge.
         Use \`${PREFIX}pvp decline\` to decline an active challenge.
         Use \`${PREFIX}pvp cancel\` to cancel your active challenge.`,
        "primary"
      );
      await message.reply({ embeds: [helpEmbed] });
      return;
    }
    
    const subcommand = args[0].toLowerCase();
    
    if (subcommand === 'challenge') {
      // Check if we have a mentioned user
      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Invalid Target",
          `You need to mention a user to challenge. Example: \`${PREFIX}pvp challenge @username\``
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      // Don't allow challenging yourself
      if (targetUser.id === userId) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Invalid Target",
          "You can't challenge yourself to a duel."
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      // Check if target is a bot
      if (targetUser.bot) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Invalid Target",
          "You can't challenge a bot to a duel."
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      // Check if already has an active challenge
      if (activeDuels.has(userId)) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Active Challenge",
          "You already have an active challenge. Cancel it first with `!pvp cancel`."
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      // Check if the target already has a duel invitation
      if (Array.from(activeDuels.values()).some(duel => duel.targetId === targetUser.id)) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Target Busy",
          "This stalker already has a pending duel challenge."
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      // Check if target user exists in the database
      const targetUserData = dataManager.getUser(targetUser.id);
      if (!targetUserData) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Target Not Found",
          "This stalker hasn't registered with STALKERNet yet."
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      // Check if target has a weapon equipped
      if (!targetUserData.equipped.weapon) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Target Unarmed",
          "This stalker doesn't have a weapon equipped. Challenge someone who's armed."
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      // Create the duel object
      const duel = {
        challengerId: userId,
        challengerName: user.name,
        targetId: targetUser.id,
        targetName: targetUserData.name,
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000, // 1 minute expiration
      };
      
      // Store the duel
      activeDuels.set(userId, duel);
      
      // Create duel challenge embed
      const challengeEmbed = embedCreator.createEmbed(
        "Duel Challenge",
        `${user.name} has challenged ${targetUserData.name} to a duel!\n\n${targetUserData.name} has 60 seconds to accept or decline this challenge using \`${PREFIX}pvp accept\` or \`${PREFIX}pvp decline\`.`,
        "error"
      );
      
      // Get items data for weapons
      const items = dataManager.getItems();
      const challengerWeapon = items[user.equipped.weapon];
      const targetWeapon = items[targetUserData.equipped.weapon];
      
      // Add weapon info
      challengeEmbed.addFields(
        { name: `${user.name}'s Weapon`, value: challengerWeapon.name, inline: true },
        { name: `${targetUserData.name}'s Weapon`, value: targetWeapon.name, inline: true }
      );
      
      // Send the challenge
      await message.reply({ embeds: [challengeEmbed] });
      
      // Set timeout to auto-expire the challenge
      setTimeout(() => {
        if (activeDuels.has(userId) && activeDuels.get(userId).timestamp === duel.timestamp) {
          activeDuels.delete(userId);
          // No need to send a message - challenge simply expires
        }
      }, 60000);
      
    } else if (subcommand === 'accept') {
      // Find an active duel where the current user is the target
      const duel = Array.from(activeDuels.values()).find(d => d.targetId === userId);
      
      if (!duel) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "No Active Challenge",
          "You don't have any pending duel challenges to accept."
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      // Get both users' data
      const challenger = dataManager.getUser(duel.challengerId);
      const target = dataManager.getUser(duel.targetId);
      
      // Check if users still have weapons equipped
      if (!challenger.equipped.weapon || !target.equipped.weapon) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Missing Weapon",
          "One of the duelists doesn't have a weapon equipped anymore. Challenge canceled."
        );
        await message.reply({ embeds: [errorEmbed] });
        activeDuels.delete(duel.challengerId);
        return;
      }
      
      // Remove the duel from active duels
      activeDuels.delete(duel.challengerId);
      
      // Get items data
      const items = dataManager.getItems();
      const challengerWeapon = items[challenger.equipped.weapon];
      const targetWeapon = items[target.equipped.weapon];
      
      // Announce the duel
      const duelBeginEmbed = embedCreator.createEmbed(
        "Duel Accepted!",
        `${target.name} has accepted ${challenger.name}'s challenge!\n\nThe duel begins in the heat of the Zone!`,
        "error"
      );
      await message.reply({ embeds: [duelBeginEmbed] });
      
      // Simulate PVP combat (modify combatSystem or create a simplified version here)
      const duelResult = simulatePvpCombat(challenger, target, challengerWeapon, targetWeapon);
      
      // Create result embed
      const resultEmbed = embedCreator.createEmbed(
        `Duel Results: ${duelResult.winner.name} wins!`,
        duelResult.combatLog.join('\n'),
        "primary"
      );
      
      // Add info about the damage dealt
      resultEmbed.addFields(
        { name: `${challenger.name}'s Health`, value: `${challenger.health} → ${challenger.health - duelResult.challengerDamageTaken}`, inline: true },
        { name: `${target.name}'s Health`, value: `${target.health} → ${target.health - duelResult.targetDamageTaken}`, inline: true }
      );
      
      // Update user health and save (with minimum health of 1)
      challenger.health = Math.max(1, challenger.health - duelResult.challengerDamageTaken);
      target.health = Math.max(1, target.health - duelResult.targetDamageTaken);
      
      // Update reputation based on duel outcome (winner gets a small boost)
      if (duelResult.winner.id === challenger.id) {
        challenger.reputation += 5;
        // Optional: Small penalty for loser
        // target.reputation = Math.max(0, target.reputation - 2);
      } else {
        target.reputation += 5;
        // Optional: Small penalty for loser
        // challenger.reputation = Math.max(0, challenger.reputation - 2);
      }
      
      // Save updated user data
      dataManager.saveUser(challenger);
      dataManager.saveUser(target);
      
      // Send the result
      await message.reply({ embeds: [resultEmbed] });
      
    } else if (subcommand === 'decline') {
      // Find an active duel where the current user is the target
      const duel = Array.from(activeDuels.values()).find(d => d.targetId === userId);
      
      if (!duel) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "No Active Challenge",
          "You don't have any pending duel challenges to decline."
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      // Remove the duel
      activeDuels.delete(duel.challengerId);
      
      // Notify about the declined challenge
      const declinedEmbed = embedCreator.createEmbed(
        "Challenge Declined",
        `${user.name} has declined ${duel.challengerName}'s duel challenge.`,
        "primary"
      );
      await message.reply({ embeds: [declinedEmbed] });
      
    } else if (subcommand === 'cancel') {
      // Check if user has an active challenge
      if (!activeDuels.has(userId)) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "No Active Challenge",
          "You don't have any active challenges to cancel."
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      // Get the duel data
      const duel = activeDuels.get(userId);
      
      // Remove the duel
      activeDuels.delete(userId);
      
      // Notify about the canceled challenge
      const cancelEmbed = embedCreator.createEmbed(
        "Challenge Canceled",
        `${user.name} has canceled their duel challenge to ${duel.targetName}.`,
        "primary"
      );
      await message.reply({ embeds: [cancelEmbed] });
      
    } else {
      // Unknown subcommand
      const errorEmbed = embedCreator.createErrorEmbed(
        "Unknown Command",
        `Unknown PVP command: "${subcommand}". Available commands: challenge, accept, decline, cancel.`
      );
      await message.reply({ embeds: [errorEmbed] });
    }
  },
};

/**
 * Simulates PVP combat between two players
 * @param {Object} challenger - The challenger user data
 * @param {Object} target - The target user data
 * @param {Object} challengerWeapon - The challenger's weapon
 * @param {Object} targetWeapon - The target's weapon
 * @returns {Object} Combat results
 */
function simulatePvpCombat(challenger, target, challengerWeapon, targetWeapon) {
  // Combat log to track what happens
  const combatLog = [];
  
  // Initial message
  combatLog.push(`${challenger.name} faces off against ${target.name} in a tense duel.`);
  
  // Track damage
  let challengerDamageTaken = 0;
  let targetDamageTaken = 0;
  
  // Factor in weapon stats
  const challengerDamage = challengerWeapon.damage;
  const challengerAccuracy = challengerWeapon.accuracy;
  const targetDamage = targetWeapon.damage;
  const targetAccuracy = targetWeapon.accuracy;
  
  // First shot advantage (50/50 chance)
  const challengerGoesFirst = Math.random() < 0.5;
  
  if (challengerGoesFirst) {
    combatLog.push(`${challenger.name} reacts quickly and gets the first shot!`);
  } else {
    combatLog.push(`${target.name} has quicker reflexes and fires first!`);
  }
  
  // Simulate 5 rounds of combat (or until someone drops below 20% health)
  let round = 1;
  let winner = null;
  
  while (round <= 5 && 
         challengerDamageTaken < (challenger.health * 0.8) && 
         targetDamageTaken < (target.health * 0.8)) {
    
    combatLog.push(`\n**Round ${round}:**`);
    
    // Challenger's turn
    const challengerHits = Math.random() * 100 < challengerAccuracy;
    
    if (challengerHits) {
      // Calculate damage with some randomness (±20%)
      const damageMultiplier = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
      const damage = Math.round(challengerDamage * damageMultiplier);
      
      targetDamageTaken += damage;
      
      // Critical hit? (10% chance)
      const criticalHit = Math.random() < 0.1;
      if (criticalHit) {
        const critDamage = Math.round(damage * 0.5); // 50% extra damage
        targetDamageTaken += critDamage;
        combatLog.push(`${challenger.name} lands a critical hit with their ${challengerWeapon.name} for ${damage + critDamage} damage!`);
      } else {
        combatLog.push(`${challenger.name} hits ${target.name} with their ${challengerWeapon.name} for ${damage} damage.`);
      }
    } else {
      combatLog.push(`${challenger.name} misses their shot with the ${challengerWeapon.name}.`);
    }
    
    // Check if target is effectively defeated
    if (targetDamageTaken >= (target.health * 0.8)) {
      winner = challenger;
      break;
    }
    
    // Target's turn
    const targetHits = Math.random() * 100 < targetAccuracy;
    
    if (targetHits) {
      // Calculate damage with some randomness (±20%)
      const damageMultiplier = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
      const damage = Math.round(targetDamage * damageMultiplier);
      
      challengerDamageTaken += damage;
      
      // Critical hit? (10% chance)
      const criticalHit = Math.random() < 0.1;
      if (criticalHit) {
        const critDamage = Math.round(damage * 0.5); // 50% extra damage
        challengerDamageTaken += critDamage;
        combatLog.push(`${target.name} lands a critical hit with their ${targetWeapon.name} for ${damage + critDamage} damage!`);
      } else {
        combatLog.push(`${target.name} hits ${challenger.name} with their ${targetWeapon.name} for ${damage} damage.`);
      }
    } else {
      combatLog.push(`${target.name} misses their shot with the ${targetWeapon.name}.`);
    }
    
    // Check if challenger is effectively defeated
    if (challengerDamageTaken >= (challenger.health * 0.8)) {
      winner = target;
      break;
    }
    
    round++;
  }
  
  // Determine winner if not already set
  if (!winner) {
    if (targetDamageTaken > challengerDamageTaken) {
      winner = challenger;
      combatLog.push(`\nAfter ${round - 1} rounds, ${challenger.name} stands victorious!`);
    } else if (challengerDamageTaken > targetDamageTaken) {
      winner = target;
      combatLog.push(`\nAfter ${round - 1} rounds, ${target.name} stands victorious!`);
    } else {
      // Tie - give victory to whoever went second as a balance
      winner = challengerGoesFirst ? target : challenger;
      combatLog.push(`\nAfter ${round - 1} brutal rounds, ${winner.name} narrowly claims victory in this evenly matched duel!`);
    }
  } else {
    combatLog.push(`\n${winner.name} wins the duel with a decisive display of combat prowess!`);
  }
  
  return {
    winner,
    challengerDamageTaken,
    targetDamageTaken,
    rounds: round - 1,
    combatLog
  };
}