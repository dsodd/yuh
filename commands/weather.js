const { EmbedBuilder } = require('discord.js');
const dataManager = require('../utils/dataManager');
const config = require('../config');
const embedCreator = require('../utils/embedCreator');

// Get prefix from .env
const PREFIX = process.env.PREFIX || '!';

// Weather types and their effects
const WEATHER_TYPES = {
  clear: {
    name: "Clear Sky",
    description: "Perfect visibility, minimal radioactive particles in the air.",
    effects: {
      travel: 0.8, // Faster travel (20% bonus)
      combat: 1.0, // Normal combat
      detection: 1.1, // Slightly better artifact detection
      anomalyDamage: 0.9, // Slightly less anomaly damage
    },
    emoji: "☀️",
    chance: 0.25 // 25% chance
  },
  cloudy: {
    name: "Cloudy",
    description: "Overcast sky with moderate visibility. Standard Zone conditions.",
    effects: {
      travel: 1.0, // Normal travel
      combat: 1.0, // Normal combat
      detection: 1.0, // Normal detection
      anomalyDamage: 1.0, // Normal anomaly damage
    },
    emoji: "☁️",
    chance: 0.3 // 30% chance
  },
  foggy: {
    name: "Foggy",
    description: "Dense fog reduces visibility, but also masks your movements from mutants.",
    effects: {
      travel: 1.2, // Slower travel
      combat: 0.9, // Easier combat (you're harder to spot)
      detection: 0.7, // Harder artifact detection
      anomalyDamage: 1.2, // Higher anomaly damage
    },
    emoji: "🌫️",
    chance: 0.15 // 15% chance
  },
  rainy: {
    name: "Rainy",
    description: "Radioactive rain falls across the Zone. Good for washing away radiation but dangerous in long exposure.",
    effects: {
      travel: 1.3, // Much slower travel
      combat: 1.0, // Normal combat
      detection: 0.9, // Slightly harder artifact detection
      anomalyDamage: 0.8, // Less anomaly damage
      radiation: 1.5 // Increased radiation
    },
    emoji: "🌧️",
    chance: 0.15 // 15% chance
  },
  stormy: {
    name: "Electrical Storm",
    description: "Violent anomalous storm with electrical discharges throughout the atmosphere. Dangerous but enhances artifact formation.",
    effects: {
      travel: 1.5, // Very slow travel
      combat: 1.2, // More difficult combat
      detection: 1.3, // Better artifact detection
      anomalyDamage: 1.4, // Higher anomaly damage
      radiation: 1.2 // Increased radiation
    },
    emoji: "⚡",
    chance: 0.1 // 10% chance
  },
  emission: {
    name: "Emission Warning",
    description: "Signs of an impending emission. Seek shelter immediately or risk certain death.",
    effects: {
      travel: 0.7, // Faster travel (emergency speed)
      combat: 1.5, // Much harder combat (everything is fleeing)
      detection: 1.5, // Much better artifact detection
      anomalyDamage: 2.0, // Double anomaly damage
      radiation: 3.0, // Triple radiation
      emissionWarning: true // Special flag for emission warning
    },
    emoji: "☢️",
    chance: 0.05 // 5% chance
  }
};

// Weather change interval (in ms)
const WEATHER_CHANGE_INTERVAL = 3 * 60 * 60 * 1000; // 3 hours

// Global zone weather state
const zoneWeather = {
  current: 'clear',
  lastChange: Date.now(),
  nextChange: Date.now() + WEATHER_CHANGE_INTERVAL
};

module.exports = {
  name: 'weather',
  aliases: ['conditions', 'sky'],
  description: 'Check the current weather conditions in the Zone',
  
  async execute(message, args) {
    const userId = message.author.id;
    
    // Get user data or create if not exists
    let user = dataManager.getUser(userId);
    if (!user) {
      user = dataManager.createUser(userId, message.author.username);
      await message.reply(`Welcome to the Zone, Stalker! Your profile has been created.`);
    }
    
    // Check if we need to update the weather
    updateZoneWeather();
    
    // Get current weather data
    const currentWeather = WEATHER_TYPES[zoneWeather.current];
    
    // Get user's current zone
    const zones = dataManager.getZones();
    const currentZone = zones[user.currentZone];
    
    // Create weather embed
    const weatherEmbed = embedCreator.createEmbed(
      `Weather in the Zone: ${currentWeather.emoji} ${currentWeather.name}`,
      `Current conditions in ${currentZone.name}: ${currentWeather.description}`,
      currentWeather.name === "Emission Warning" ? "error" : "primary"
    );
    
    // Add effects details
    let effectsDescription = "";
    
    if (currentWeather.effects.travel > 1) {
      effectsDescription += `• Travel time increased by ${Math.round((currentWeather.effects.travel - 1) * 100)}%\n`;
    } else if (currentWeather.effects.travel < 1) {
      effectsDescription += `• Travel time reduced by ${Math.round((1 - currentWeather.effects.travel) * 100)}%\n`;
    }
    
    if (currentWeather.effects.combat > 1) {
      effectsDescription += `• Combat difficulty increased by ${Math.round((currentWeather.effects.combat - 1) * 100)}%\n`;
    } else if (currentWeather.effects.combat < 1) {
      effectsDescription += `• Combat difficulty reduced by ${Math.round((1 - currentWeather.effects.combat) * 100)}%\n`;
    }
    
    if (currentWeather.effects.detection > 1) {
      effectsDescription += `• Artifact detection improved by ${Math.round((currentWeather.effects.detection - 1) * 100)}%\n`;
    } else if (currentWeather.effects.detection < 1) {
      effectsDescription += `• Artifact detection reduced by ${Math.round((1 - currentWeather.effects.detection) * 100)}%\n`;
    }
    
    if (currentWeather.effects.anomalyDamage > 1) {
      effectsDescription += `• Anomaly damage increased by ${Math.round((currentWeather.effects.anomalyDamage - 1) * 100)}%\n`;
    } else if (currentWeather.effects.anomalyDamage < 1) {
      effectsDescription += `• Anomaly damage reduced by ${Math.round((1 - currentWeather.effects.anomalyDamage) * 100)}%\n`;
    }
    
    if (currentWeather.effects.radiation && currentWeather.effects.radiation > 1) {
      effectsDescription += `• Radiation exposure increased by ${Math.round((currentWeather.effects.radiation - 1) * 100)}%\n`;
    }
    
    if (currentWeather.effects.emissionWarning) {
      effectsDescription += `• **EMISSION WARNING**: Head to shelter immediately!\n`;
    }
    
    weatherEmbed.addFields({
      name: "Current Effects",
      value: effectsDescription || "No special effects",
      inline: false
    });
    
    // Calculate time until next weather change
    const timeUntilChange = zoneWeather.nextChange - Date.now();
    const hoursUntilChange = Math.floor(timeUntilChange / (60 * 60 * 1000));
    const minutesUntilChange = Math.floor((timeUntilChange % (60 * 60 * 1000)) / (60 * 1000));
    
    weatherEmbed.addFields({
      name: "Weather Forecast",
      value: `Weather conditions are expected to change in approximately ${hoursUntilChange}h ${minutesUntilChange}m.`,
      inline: false
    });
    
    // Add shelter information if emission warning
    if (currentWeather.effects.emissionWarning) {
      weatherEmbed.addFields({
        name: "⚠️ EMERGENCY ALERT ⚠️",
        value: `An emission is approaching! Use \`${PREFIX}shelter\` to find cover in your current zone or risk death!`,
        inline: false
      });
    }
    
    await message.reply({ embeds: [weatherEmbed] });
  },
};

/**
 * Check if weather should change and update it if needed
 */
function updateZoneWeather() {
  const now = Date.now();
  
  // Check if it's time for a weather change
  if (now >= zoneWeather.nextChange) {
    // Select a new weather type based on chances
    const weatherTypes = Object.keys(WEATHER_TYPES);
    const totalChance = weatherTypes.reduce((sum, type) => sum + WEATHER_TYPES[type].chance, 0);
    
    let randomVal = Math.random() * totalChance;
    let cumulativeChance = 0;
    let newWeather = 'clear'; // Default
    
    for (const type of weatherTypes) {
      cumulativeChance += WEATHER_TYPES[type].chance;
      if (randomVal <= cumulativeChance) {
        newWeather = type;
        break;
      }
    }
    
    // Update weather
    zoneWeather.current = newWeather;
    zoneWeather.lastChange = now;
    zoneWeather.nextChange = now + WEATHER_CHANGE_INTERVAL;
  }
}

/**
 * Get current weather modifier for a specific effect
 * @param {string} effectType - Type of effect to get modifier for ('travel', 'combat', etc.)
 * @returns {number} - The effect modifier
 */
function getWeatherModifier(effectType) {
  updateZoneWeather(); // Make sure weather is up to date
  const currentWeather = WEATHER_TYPES[zoneWeather.current];
  return currentWeather.effects[effectType] || 1.0;
}

// Export the getWeatherModifier function for use in other commands
module.exports.getWeatherModifier = getWeatherModifier;