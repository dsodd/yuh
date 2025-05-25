
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Path to data directory
const dataDir = path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Default data for each file type
const getDefaultData = (filename) => {
  switch (filename) {
    case 'users.json':
      return { default: {} };
    
    case 'items.json':
      return {
        "junk_bolt": {
          "id": "junk_bolt",
          "name": "Bolt",
          "description": "A common bolt used to detect anomalies. Every stalker carries some.",
          "category": "junk",
          "weight": 0.1,
          "value": 5
        },
        "medkit": {
          "id": "medkit",
          "name": "Medkit",
          "description": "Basic medical supplies to treat wounds and restore health.",
          "category": "medical",
          "weight": 0.5,
          "value": 200,
          "effect": {
            "health": 50
          }
        },
        "detector_basic": {
          "id": "detector_basic",
          "name": "Echo Detector",
          "description": "Basic anomaly and artifact detector. Low range but reliable.",
          "category": "detector",
          "weight": 0.5,
          "value": 800
        },
        "pm_pistol": {
          "id": "pm_pistol",
          "name": "PM Pistol",
          "description": "A reliable 9mm pistol commonly used by stalkers.",
          "category": "weapon",
          "weight": 0.8,
          "value": 1200,
          "damage": 25,
          "accuracy": 75,
          "durability": 100
        },
        "leather_jacket": {
          "id": "leather_jacket",
          "name": "Leather Jacket",
          "description": "A simple leather jacket that provides minimal protection.",
          "category": "armor",
          "weight": 2.0,
          "value": 500,
          "protection": {
            "physical": 10,
            "radiation": 5
          },
          "durability": 100
        },
        "antirad": {
          "id": "antirad",
          "name": "Anti-radiation drugs",
          "description": "Reduces radiation exposure.",
          "category": "medical",
          "weight": 0.3,
          "value": 300,
          "effect": {
            "radiation": -40
          }
        },
        "vodka": {
          "id": "vodka",
          "name": "Vodka",
          "description": "A bottle of vodka. Reduces radiation but impairs coordination.",
          "category": "consumable",
          "weight": 0.5,
          "value": 100,
          "effect": {
            "radiation": -10,
            "stamina": -20
          }
        },
        "bread": {
          "id": "bread",
          "name": "Bread",
          "description": "A loaf of bread. Restores some stamina.",
          "category": "consumable",
          "weight": 0.4,
          "value": 50,
          "effect": {
            "stamina": 30
          }
        }
      };
    
    case 'zones.json':
      return {
        "rookie_village": {
          "id": "rookie_village",
          "name": "Rookie Village",
          "description": "The first settlement newcomers encounter in the Zone.",
          "dangerLevel": 1,
          "anomalyLevel": 1,
          "type": "settlement",
          "hasVendor": true,
          "vendorItems": ["pm_pistol", "leather_jacket", "detector_basic"],
          "travelCost": 0,
          "adjacentZones": ["garbage", "swamps"],
          "factionControl": "loners"
        },
        "garbage": {
          "id": "garbage",
          "name": "Garbage",
          "description": "A sprawling junkyard filled with industrial waste and mild anomalies.",
          "dangerLevel": 2,
          "anomalyLevel": 3,
          "type": "industrial",
          "hasVendor": false,
          "travelCost": 50,
          "adjacentZones": ["rookie_village", "agroprom", "dark_valley"],
          "factionControl": "neutral"
        },
        "agroprom": {
          "id": "agroprom",
          "name": "Agroprom",
          "description": "An abandoned agricultural facility with underground tunnels.",
          "dangerLevel": 3,
          "anomalyLevel": 4,
          "type": "industrial",
          "hasVendor": false,
          "travelCost": 75,
          "adjacentZones": ["garbage", "yantar", "dark_valley"],
          "factionControl": "duty"
        },
        "dark_valley": {
          "id": "dark_valley",
          "name": "Dark Valley",
          "description": "A dangerous valley shrouded in perpetual twilight.",
          "dangerLevel": 5,
          "anomalyLevel": 6,
          "type": "forest",
          "hasVendor": false,
          "travelCost": 100,
          "adjacentZones": ["garbage", "agroprom", "red_forest"],
          "factionControl": "bandits"
        },
        "yantar": {
          "id": "yantar",
          "name": "Yantar",
          "description": "A research facility studying the Zone's anomalous properties.",
          "dangerLevel": 4,
          "anomalyLevel": 5,
          "type": "urban",
          "hasVendor": true,
          "vendorItems": ["detector_advanced", "antirad", "medkit"],
          "travelCost": 80,
          "adjacentZones": ["agroprom", "red_forest"],
          "factionControl": "scientists"
        },
        "red_forest": {
          "id": "red_forest",
          "name": "Red Forest",
          "description": "A highly irradiated forest with deadly anomalies and mutants.",
          "dangerLevel": 7,
          "anomalyLevel": 8,
          "type": "forest",
          "hasVendor": false,
          "travelCost": 150,
          "adjacentZones": ["dark_valley", "yantar", "pripyat"],
          "factionControl": "neutral"
        },
        "pripyat": {
          "id": "pripyat",
          "name": "Pripyat",
          "description": "The abandoned city near the center of the Zone.",
          "dangerLevel": 8,
          "anomalyLevel": 9,
          "type": "urban",
          "hasVendor": false,
          "travelCost": 200,
          "adjacentZones": ["red_forest", "cnpp"],
          "factionControl": "monolith"
        },
        "cnpp": {
          "id": "cnpp",
          "name": "CNPP",
          "description": "The Chernobyl Nuclear Power Plant - the heart of the Zone.",
          "dangerLevel": 10,
          "anomalyLevel": 10,
          "type": "center",
          "hasVendor": false,
          "travelCost": 250,
          "adjacentZones": ["pripyat"],
          "factionControl": "monolith"
        }
      };
    
    case 'quests.json':
      return {
        "q001": {
          "id": "q001",
          "name": "First Steps",
          "description": "A simple reconnaissance mission to help you get familiar with the Zone.",
          "objective": "Travel to the Garbage and scout for items.",
          "availableZones": ["Cordon"],
          "faction": "neutral",
          "minRank": 1,
          "difficulty": 1,
          "rewardRubles": 500,
          "rewardReputation": 10
        }
      };
    
    case 'factions.json':
      return {
        "Loners": {
          "name": "Loners",
          "description": "Independent stalkers with no strong allegiance.",
          "leader": "Sidorovich",
          "baseZone": "Cordon",
          "bonuses": {
            "generalBonus": 5
          },
          "relations": {
            "Duty": "neutral",
            "Freedom": "neutral",
            "Bandits": "hostile"
          }
        }
      };
    
    case 'mutants.json':
      return {
        "flesh": {
          "id": "flesh",
          "name": "Flesh",
          "description": "Mutated boars with deformed bodies and distinctive snouts.",
          "health": 70,
          "damage": 15,
          "accuracy": 50,
          "rarity": 3,
          "zones": ["Cordon", "Garbage", "Swamps"],
          "reputation": 8,
          "minRubles": 100,
          "maxRubles": 200,
          "drops": [
            { "itemId": "junk_parts", "chance": 0.5 },
            { "itemId": "medkit", "chance": 0.1 }
          ]
        }
      };
    
    case 'artifacts.json':
      return {
        "medusa": {
          "id": "medusa",
          "name": "Medusa",
          "description": "A common electrical artifact formed in electro anomalies.",
          "rarity": 3,
          "weight": 0.5,
          "itemId": "artifact_medusa",
          "zones": ["Swamps", "Garbage", "Yantar"],
          "effects": [
            "+10% Electrical resistance",
            "-5 Health/minute while equipped"
          ]
        }
      };
    
    case 'encounters.json':
      return {
        "flesh": {
          "id": "flesh",
          "name": "Flesh",
          "type": "Mutated pig",
          "traits": "Passive until provoked; fleshy, malformed body.",
          "attack": "Short-range charge or bite.",
          "behavior": "Grazing in herds; runs if threatened.",
          "location": "Open fields and farmlands.",
          "image": "flesh.png",
          "difficulty": 3,
          "danger": "Low",
          "xp": 30,
          "loot": [
            { "itemId": "mutant_part_flesh", "name": "Flesh Eye", "value": 300, "chance": 0.8 }
          ],
          "rubles": {
            "min": 100,
            "max": 200
          },
          "health": 80,
          "damage": 15,
          "escape_chance": 0.6
        }
      };
    
    default:
      return {};
  }
};

// Create default data files if they don't exist
const initializeDataFiles = () => {
  const defaultFiles = [
    'users.json',
    'items.json',
    'zones.json',
    'quests.json',
    'factions.json',
    'mutants.json',
    'artifacts.json',
    'encounters.json'
  ];

  for (const file of defaultFiles) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) {
      const defaultData = getDefaultData(file);
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
      console.log(`Created default ${file}`);
    }
  }
};

// Load data from JSON file
const loadData = (filename) => {
  try {
    const filePath = path.join(dataDir, filename);
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return {};
  }
};

// Save data to JSON file
const saveData = (filename, data) => {
  try {
    const filePath = path.join(dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error saving ${filename}:`, error);
    return false;
  }
};

// Get user data
const getUser = (userId) => {
  const users = loadData('users.json');
  return users[userId];
};

// Create new user with durability system
const createUser = (userId, username) => {
  const users = loadData('users.json');
  
  // Create new user with default values including durability
  const newUser = {
    id: userId,
    name: username,
    faction: null,
    rank: 1,
    reputation: 0,
    health: config.startingHealth,
    radiation: 0,
    stamina: config.maxStamina,
    rubles: config.startingRubles,
    inventory: ['junk_bolt', 'medkit'], // Start with some basic items
    inventoryWeight: 0.6, // Weight of starting items
    currentZone: config.startZone,
    equipped: {
      weapon: null,
      armor: null,
      artifacts: []
    },
    bonuses: {},
    activeQuests: [],
    completedQuests: [],
    cooldowns: {
      hunt: 0,
      travel: 0,
      scout: 0,
      camp: 0,
      detect: 0,
      explore: 0
    },
    // Add durability tracking for individual items
    durability: {},
    // Legacy equipment durability (keep for compatibility)
    equipmentDurability: {
      weapon: 100,
      armor: 100
    }
  };
  
  users[userId] = newUser;
  saveData('users.json', users);
  
  return newUser;
};

// Save user data
const saveUser = (userData) => {
  const users = loadData('users.json');
  users[userData.id] = userData;
  return saveData('users.json', users);
};

// Get items data
const getItems = () => {
  return loadData('items.json');
};

// Save item data
const saveItem = (itemId, itemData) => {
  const items = loadData('items.json');
  items[itemId] = itemData;
  return saveData('items.json', items);
};

// Get zones data
const getZones = () => {
  return loadData('zones.json');
};

// Get quests data
const getQuests = () => {
  return loadData('quests.json');
};

// Get factions data
const getFactions = () => {
  return loadData('factions.json');
};

// Get mutants data
const getMutants = () => {
  return loadData('mutants.json');
};

// Get artifacts data
const getArtifacts = () => {
  return loadData('artifacts.json');
};

// Get encounters data
const getEncounters = () => {
  return loadData('encounters.json');
};

// Centralized item creation system
const createItem = (itemId, itemData) => {
  const items = loadData('items.json');
  
  // Check if the item already exists
  if (!items[itemId]) {
    items[itemId] = {
      id: itemId,
      ...itemData
    };
    
    saveData('items.json', items);
    return true;
  }
  
  return false;
};

// Add artifact to items database (replaces scattered artifact creation)
const addArtifactItem = (artifactId, artifactData) => {
  return createItem(artifactId, {
    name: artifactData.name,
    description: artifactData.description,
    category: 'artifact',
    weight: artifactData.weight,
    value: artifactData.value || 1000,
    rarity: artifactData.rarity,
    effects: artifactData.effects
  });
};

// Add crafting material item (replaces scattered crafting material creation)
const addCraftingMaterialItem = (itemId, name, description, value, weight = 0.5) => {
  return createItem(itemId, {
    name: name,
    description: description,
    category: 'crafting_material',
    weight: weight,
    value: value
  });
};

// Add a mutant part item to the items database
const addMutantPartItem = (itemId, name, description, value, weight = 0.5) => {
  return createItem(itemId, {
    name: name,
    description: description,
    category: 'mutant_part',
    weight: weight,
    value: value
  });
};

// Initialize all base game items
const initializeBaseItems = () => {
  const artifacts = getArtifacts();
  const items = getItems();
  
  // Add all artifacts to items database
  for (const [artifactId, artifactData] of Object.entries(artifacts)) {
    addArtifactItem(artifactId, artifactData);
  }
  
  console.log('Base game items initialized');
};

module.exports = {
  initializeDataFiles,
  getUser,
  createUser,
  saveUser,
  getItems,
  saveItem,
  getZones,
  getQuests,
  getFactions,
  getMutants,
  getArtifacts,
  getEncounters,
  createItem,
  addArtifactItem,
  addCraftingMaterialItem,
  addMutantPartItem,
  initializeBaseItems
};
