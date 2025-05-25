const fs = require('fs');
const path = require('path');
const config = require('../config');

// Path to data directory
const dataDir = path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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
      const defaultData = file === 'users.json' ? { default: {} } : {};
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

// Create new user
const createUser = (userId, username) => {
  const users = loadData('users.json');
  
  // Create new user with default values
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

// Add a mutant part item to the items database
const addMutantPartItem = (itemId, name, description, value, weight = 0.5) => {
  const items = loadData('items.json');
  
  // Check if the item already exists
  if (!items[itemId]) {
    // Create the new item
    items[itemId] = {
      id: itemId,
      name: name,
      description: description,
      category: 'mutant_part',
      weight: weight,
      value: value
    };
    
    // Save the updated items data
    saveData('items.json', items);
    return true;
  }
  
  return false;
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
  addMutantPartItem
};
