const { EmbedBuilder } = require('discord.js');
const dataManager = require('../utils/dataManager');
const config = require('../config');
const embedCreator = require('../utils/embedCreator');
const weather = require('./weather');

// Get prefix from .env
const PREFIX = process.env.PREFIX || '!';

// Anomaly types and their characteristics
const ANOMALY_TYPES = {
  thermal: {
    name: "Thermal Anomaly",
    description: "A field of intense heat that will burn anything that enters.",
    damageType: "burn",
    damageRange: [15, 30],
    warning: "You feel a wave of heat as you approach...",
    artifactChance: 0.4,
    emoji: "🔥",
    artifactTypes: ["thermal"]
  },
  electric: {
    name: "Electrical Anomaly",
    description: "A cluster of electrical discharges that arc between conductive materials.",
    damageType: "electric shock",
    damageRange: [20, 35],
    warning: "Your hair stands on end as electrical charges build up around you...",
    artifactChance: 0.35,
    emoji: "⚡",
    artifactTypes: ["electrical"]
  },
  gravitational: {
    name: "Gravitational Anomaly",
    description: "An invisible vortex that crushes and tears apart anything caught within.",
    damageType: "gravitational crush",
    damageRange: [25, 40],
    warning: "You feel an unseen force pulling at your equipment...",
    artifactChance: 0.3,
    emoji: "🌀",
    artifactTypes: ["gravitational"]
  },
  chemical: {
    name: "Chemical Anomaly",
    description: "A pocket of highly corrosive gas that dissolves organic matter.",
    damageType: "acid",
    damageRange: [10, 25],
    warning: "Your eyes water and your throat burns from acrid fumes...",
    artifactChance: 0.45,
    emoji: "☣️",
    artifactTypes: ["chemical"]
  },
  psychic: {
    name: "Psychic Anomaly",
    description: "A field of psionic energy that disrupts brain activity and causes hallucinations.",
    damageType: "psi-emissions",
    damageRange: [15, 30],
    warning: "You hear whispers and see movement from the corner of your eye...",
    artifactChance: 0.25,
    emoji: "🧠",
    artifactTypes: ["psychic"]
  }
};

// Get artifacts from data file instead of hardcoding
const getAvailableArtifacts = () => {
  return dataManager.getArtifacts();
};

module.exports = {
  name: 'anomaly',
  aliases: ['anomalies', 'field', 'zone'],
  description: 'Interact with anomaly fields to find artifacts',

  async execute(message, args) {
    const userId = message.author.id;

    // Get user data or create if not exists
    let user = dataManager.getUser(userId);
    if (!user) {
      user = dataManager.createUser(userId, message.author.username);
      const welcomeEmbed = embedCreator.createSuccessEmbed(
        "Profile Created",
        `Welcome to the Zone, Stalker! Your profile has been created.`
      );
      await message.reply({ embeds: [welcomeEmbed] });
    }

    // Get items data
    const items = dataManager.getItems();

    // Ensure all artifacts exist in the item database
    ensureArtifactsExist();

    // Get zones data
    const zones = dataManager.getZones();
    const currentZone = zones[user.currentZone];

    // Check for subcommands
    const subcommand = args.length > 0 ? args[0].toLowerCase() : 'scan';

    if (subcommand === 'scan') {
      // Check if the current zone has anomalies
      if (currentZone.anomalyLevel <= 0) {
        const noAnomalyEmbed = embedCreator.createEmbed(
          "No Anomalies Detected",
          `${currentZone.name} appears to be free of anomalous activity. Try exploring a more dangerous area.`,
          "primary"
        );
        await message.reply({ embeds: [noAnomalyEmbed] });
        return;
      }

      // Check if user has a detector
      const hasDetector = user.inventory.some(itemId => 
        items[itemId] && items[itemId].category === 'detector'
      );

      if (!hasDetector) {
        const noDetectorEmbed = embedCreator.createErrorEmbed(
          "No Detector Found",
          `You need an artifact detector to safely locate anomalies. Purchase one from a vendor.`
        );
        await message.reply({ embeds: [noDetectorEmbed] });
        return;
      }

      // Check scan cooldown
      const now = Date.now();
      if (user.cooldowns.anomalyScan && now < user.cooldowns.anomalyScan) {
        const timeLeft = Math.ceil((user.cooldowns.anomalyScan - now) / 1000 / 60); // minutes left
        const cooldownEmbed = embedCreator.createErrorEmbed(
          "Detector Cooldown",
          `Your detector is still calibrating. Try again in ${timeLeft} minute(s).`
        );
        await message.reply({ embeds: [cooldownEmbed] });
        return;
      }

      // Calculate anomaly chance based on zone's anomaly level
      const anomalyChance = 0.4 + (currentZone.anomalyLevel * 0.05); // 40% base chance + 5% per anomaly level
      const foundAnomaly = Math.random() < anomalyChance;

      if (!foundAnomaly) {
        // Set a short cooldown
        user.cooldowns.anomalyScan = now + (2 * 60 * 1000); // 2 minute cooldown
        dataManager.saveUser(user);

        const noFindEmbed = embedCreator.createEmbed(
          "Scan Complete",
          `Your detector sweeps the area but finds no significant anomaly fields nearby. Try a different location.`,
          "primary"
        );
        await message.reply({ embeds: [noFindEmbed] });
        return;
      }

      // Determine anomaly type based on zone
      const anomalyTypes = Object.keys(ANOMALY_TYPES);
      const weightedTypes = [];

      // Add weights based on zone type
      if (currentZone.type === 'forest') {
        weightedTypes.push('gravitational', 'gravitational', 'thermal', 'electric');
      } else if (currentZone.type === 'urban') {
        weightedTypes.push('electric', 'electric', 'gravitational', 'psychic');
      } else if (currentZone.type === 'marshland') {
        weightedTypes.push('chemical', 'chemical', 'psychic', 'thermal');
      } else if (currentZone.type === 'industrial') {
        weightedTypes.push('electric', 'thermal', 'thermal', 'chemical');
      } else if (currentZone.type === 'center') {
        weightedTypes.push('psychic', 'psychic', 'gravitational', 'electric', 'thermal');
      } else {
        // Default - equal chances
        weightedTypes.push(...anomalyTypes);
      }

      // Select random anomaly type
      const anomalyType = weightedTypes[Math.floor(Math.random() * weightedTypes.length)];
      const anomaly = ANOMALY_TYPES[anomalyType];

      // Store the anomaly in user data
      if (!user.activeAnomaly) {
        user.activeAnomaly = {};
      }

      user.activeAnomaly = {
        type: anomalyType,
        name: anomaly.name,
        detectedAt: now,
        expires: now + (30 * 60 * 1000) // 30 minutes until anomaly shifts
      };

      // Set the scan cooldown
      user.cooldowns.anomalyScan = now + (5 * 60 * 1000); // 5 minute cooldown
      dataManager.saveUser(user);

      // Create anomaly detection embed
      const anomalyEmbed = embedCreator.createEmbed(
        `Anomaly Detected: ${anomaly.emoji} ${anomaly.name}`,
        `Your detector has located a ${anomaly.name} nearby in ${currentZone.name}.\n\n${anomaly.warning}`,
        "warning"
      );

      anomalyEmbed.addFields(
        { name: 'Description', value: anomaly.description, inline: false },
        { name: 'Danger Type', value: `${anomaly.damageType} damage`, inline: true },
        { name: 'Risk Level', value: `${currentZone.anomalyLevel}/10`, inline: true }
      );

      // Determine detector quality for hints
      let detectorQuality = 1; // Basic detector
      for (const itemId of user.inventory) {
        const item = items[itemId];
        if (item && item.category === 'detector') {
          if (item.id === 'detector_advanced') detectorQuality = 2;
          if (item.id === 'detector_veles') detectorQuality = 3;
        }
      }

      // Add artifacts hint based on detector quality
      if (detectorQuality >= 2) {
        const possibleArtifacts = anomaly.artifacts.join(', ');
        anomalyEmbed.addFields({
          name: 'Possible Artifacts',
          value: `This anomaly may contain: ${possibleArtifacts}`,
          inline: false
        });
      }

      anomalyEmbed.setFooter({ text: `Use "${PREFIX}anomaly enter" to search for artifacts or "${PREFIX}anomaly avoid" to move away` });

      await message.reply({ embeds: [anomalyEmbed] });

    } else if (subcommand === 'enter' || subcommand === 'search') {
      // Check if user has an active anomaly
      if (!user.activeAnomaly) {
        const noAnomalyEmbed = embedCreator.createErrorEmbed(
          "No Anomaly Located",
          `You haven't located an anomaly field yet. Use \`${PREFIX}anomaly scan\` first.`
        );
        await message.reply({ embeds: [noAnomalyEmbed] });
        return;
      }

      // Check if anomaly has expired
      const now = Date.now();
      if (now > user.activeAnomaly.expires) {
        const expiredEmbed = embedCreator.createErrorEmbed(
          "Anomaly Shifted",
          `The anomaly field has shifted and is no longer where you detected it. Use \`${PREFIX}anomaly scan\` to find a new one.`
        );

        // Clear the active anomaly
        user.activeAnomaly = null;
        dataManager.saveUser(user);

        await message.reply({ embeds: [expiredEmbed] });
        return;
      }

      // Check enter cooldown
      if (user.cooldowns.anomalyEnter && now < user.cooldowns.anomalyEnter) {
        const timeLeft = Math.ceil((user.cooldowns.anomalyEnter - now) / 1000 / 60); // minutes left
        const cooldownEmbed = embedCreator.createErrorEmbed(
          "Recovery Needed",
          `You need time to recover before entering another anomaly. Try again in ${timeLeft} minute(s).`
        );
        await message.reply({ embeds: [cooldownEmbed] });
        return;
      }

      // Get the anomaly data
      const anomalyType = user.activeAnomaly.type;
      const anomaly = ANOMALY_TYPES[anomalyType];

      // Apply weather effects to anomaly damage
      const weatherModifier = weather.getWeatherModifier('anomalyDamage') || 1.0;

      // Calculate damage from the anomaly
      const minDamage = anomaly.damageRange[0];
      const maxDamage = anomaly.damageRange[1];
      let damage = Math.floor(Math.random() * (maxDamage - minDamage + 1) + minDamage);

      // Apply weather modifier
      damage = Math.round(damage * weatherModifier);

      // Check if user has protection
      if (user.equipped.armor) {
        const armor = items[user.equipped.armor];
        if (armor && armor.protection) {
          // Reduce damage based on armor protection
          const damageReduction = armor.protection[anomalyType] || 0;
          const reductionPercent = damageReduction / 100;
          damage = Math.round(damage * (1 - reductionPercent));
        }
      }

      // Apply damage to user
      user.health = Math.max(1, user.health - damage);

      // Determine if user finds an artifact
      const artifactFound = Math.random() < (anomaly.artifactChance * (1 + (currentZone.anomalyLevel * 0.03)));

      // Set cooldown for entering anomalies
      user.cooldowns.anomalyEnter = now + (15 * 60 * 1000); // 15 minute cooldown

      // Clear the active anomaly
      user.activeAnomaly = null;

      // Create the result embed
      let resultEmbed;

      // Get available artifacts from data
      const availableArtifacts = getAvailableArtifacts();

      // Determine which artifacts can be found based on rarity, zone, and anomaly type
      const possibleArtifacts = Object.keys(availableArtifacts).filter(artifactId => {
        const artifact = availableArtifacts[artifactId];
        // Higher level zones can find rarer artifacts
        const maxRarity = Math.min(currentZone.anomalyLevel + 2, 9);

        // Check if artifact can be found in current zone
        if (artifact.zones && !artifact.zones.includes(currentZone.name)) {
          return false;
        }

        // Check if artifact matches anomaly type (if artifact has type specified)
        if (artifact.anomalyType && !anomaly.artifactTypes.includes(artifact.anomalyType)) {
          return false;
        }

        return artifact.rarity <= maxRarity;
      });
      
      if (artifactFound) {
        // Select a random artifact from this anomaly type
        const foundArtifactId = possibleArtifacts[Math.floor(Math.random() * possibleArtifacts.length)];
        
        if(foundArtifactId){
        const foundArtifact = availableArtifacts[foundArtifactId];

        // Ensure the artifact exists in the items database
        ensureArtifactsExist();

        // Add artifact to user's inventory
        user.inventory.push(foundArtifactId);
        user.inventoryWeight += foundArtifact.weight;

          // Create success embed
          resultEmbed = embedCreator.createSuccessEmbed(
            "Artifact Found!",
            `You've braved the ${anomaly.name} and discovered a rare ${foundArtifact.name}!`
          );

          resultEmbed.addFields(
            { name: 'Artifact Description', value: foundArtifact.description, inline: false },
            { name: 'Effects', value: foundArtifact.effects.join('\n'), inline: false },
            { name: 'Value', value: `${foundArtifact.value} RU`, inline: true },
            { name: 'Rarity', value: `${foundArtifact.rarity}/5`, inline: true },
            { name: 'Weight', value: `${foundArtifact.weight} kg`, inline: true },
            { name: 'Damage Taken', value: `${damage} (Health: ${user.health}/${config.maxHealth})`, inline: false }
          );
        } else {
          // Inventory full - can't pick up artifact
          resultEmbed = embedCreator.createEmbed(
            "Artifact Lost",
            `You found a ${artifact.name}, but your inventory is too full to carry it. The artifact slips from your grasp and is lost in the anomaly.`,
            "warning"
          );

          resultEmbed.addFields({
            name: 'Damage Taken',
            value: `${damage} (Health: ${user.health}/${config.maxHealth})`,
            inline: false
          });
        }
      } else {
        // No artifact found
        resultEmbed = embedCreator.createEmbed(
          "Search Failed",
          `You carefully navigate the ${anomaly.name}, but find no artifacts. The anomaly shifts and dissipates as you exit.`,
          "error"
        );

        resultEmbed.addFields({
          name: 'Damage Taken',
          value: `${damage} (Health: ${user.health}/${config.maxHealth})`,
          inline: false
        });
      }

      // If health is critically low, add warning
      if (user.health < 25) {
        resultEmbed.addFields({
          name: '⚠️ WARNING',
          value: 'Your health is critically low! Use a medkit immediately.',
          inline: false
        });
      }

      // If user's health is extremely low (< 10), give them a small health boost to prevent frustration
      if (user.health < 10) {
        user.health = 10;
        resultEmbed.addFields({
          name: 'Emergency Stimulant',
          value: 'You inject an emergency stimulant to keep yourself from losing consciousness.',
          inline: false
        });
      }

      // Save user data
      dataManager.saveUser(user);

      await message.reply({ embeds: [resultEmbed] });

    } else if (subcommand === 'avoid' || subcommand === 'leave') {
      // Check if user has an active anomaly
      if (!user.activeAnomaly) {
        const noAnomalyEmbed = embedCreator.createEmbed(
          "No Anomaly To Avoid",
          `You aren't currently near any anomaly fields.`,
          "primary"
        );
        await message.reply({ embeds: [noAnomalyEmbed] });
        return;
      }

      // Clear the active anomaly
      const anomalyName = user.activeAnomaly.name;
      user.activeAnomaly = null;

      // Save the updated user data
      dataManager.saveUser(user);

      // Create success embed
      const avoidEmbed = embedCreator.createSuccessEmbed(
        "Anomaly Avoided",
        `You carefully back away from the ${anomalyName} and find a safer path.`
      );

      await message.reply({ embeds: [avoidEmbed] });

    } else if (subcommand === 'info') {
      // Show information about anomaly types
      const infoEmbed = embedCreator.createEmbed(
        "Anomaly Field Guide",
        "Information about the various anomaly types found in the Zone:",
        "primary"
      );

      // Add each anomaly type to the embed
      for (const [type, data] of Object.entries(ANOMALY_TYPES)) {
        infoEmbed.addFields({
          name: `${data.emoji} ${data.name}`,
          value: `${data.description}\n**Danger**: ${data.damageType} damage`,
          inline: false
        });
      }

      infoEmbed.setFooter({ text: `Use "${PREFIX}anomaly scan" to search for anomalies in your current zone` });

      await message.reply({ embeds: [infoEmbed] });

    } else {
      // Unknown subcommand
      const helpEmbed = embedCreator.createEmbed(
        "Anomaly Commands",
        "Available commands for interacting with anomaly fields:",
        "primary"
      );

      helpEmbed.addFields(
        { name: `${PREFIX}anomaly scan`, value: 'Search for anomaly fields in your current zone', inline: false },
        { name: `${PREFIX}anomaly enter`, value: 'Enter a detected anomaly to search for artifacts', inline: false },
        { name: `${PREFIX}anomaly avoid`, value: 'Avoid a detected anomaly and find a safer path', inline: false },
        { name: `${PREFIX}anomaly info`, value: 'View information about different anomaly types', inline: false }
      );

      await message.reply({ embeds: [helpEmbed] });
    }
  },
};

/**
 * Initialize artifacts in items database from artifacts.json
 */
function ensureArtifactsExist() {
  dataManager.initializeBaseItems();
}