const { EmbedBuilder } = require('discord.js');
const dataManager = require('../utils/dataManager');
const config = require('../config');
const embedCreator = require('../utils/embedCreator');

const PREFIX = process.env.PREFIX || '!';

const CRAFTING_RECIPES = [
  {
    id: 'medkit_basic',
    name: 'Basic Medkit',
    description: 'A homemade medical kit with basic supplies.',
    ingredients: [
      { id: 'bandage', count: 2 },
      { id: 'alcohol', count: 1 }
    ],
    result: 'medkit',
    count: 1,
    skill: 'medical',
    skillLevel: 1
  },
  {
    id: 'ammo_9mm',
    name: '9mm Ammo Pack',
    description: 'A small batch of handmade 9mm ammunition.',
    ingredients: [
      { id: 'gunpowder', count: 1 },
      { id: 'metal_parts', count: 2 }
    ],
    result: 'ammo_9mm',
    count: 15,
    skill: 'weapons',
    skillLevel: 1
  },
  {
    id: 'detector_upgrade',
    name: 'Detector Upgrade',
    description: 'Upgrade a basic detector with scavenged parts.',
    ingredients: [
      { id: 'detector_basic', count: 1 },
      { id: 'electronic_parts', count: 3 },
      { id: 'battery', count: 1 }
    ],
    result: 'detector_advanced',
    count: 1,
    skill: 'technical',
    skillLevel: 2
  },
  {
    id: 'protective_suit',
    name: 'Stalker Suit',
    description: 'A reinforced leather jacket modified with anti-radiation materials.',
    ingredients: [
      { id: 'leather_jacket', count: 1 },
      { id: 'cloth', count: 3 },
      { id: 'kevlar_plates', count: 2 }
    ],
    result: 'stalker_suit',
    count: 1,
    skill: 'survival',
    skillLevel: 2
  },
  {
    id: 'healing_mixture',
    name: 'Healing Mixture',
    description: 'A mixture using mutant parts with healing properties.',
    ingredients: [
      { id: 'mutant_part_flesh', count: 1 },
      { id: 'herbs', count: 2 },
      { id: 'alcohol', count: 1 }
    ],
    result: 'healing_mixture',
    count: 1,
    skill: 'medical',
    skillLevel: 2
  },
  {
    id: 'anti_radiation',
    name: 'Anti-Radiation Drugs',
    description: 'Homemade anti-radiation medication.',
    ingredients: [
      { id: 'herbs', count: 3 },
      { id: 'chemical_components', count: 1 }
    ],
    result: 'antirad',
    count: 1,
    skill: 'medical',
    skillLevel: 2
  }
];

const CRAFTING_MATERIALS = [
  { id: 'bandage', name: 'Bandage', weight: 0.1, value: 50 },
  { id: 'alcohol', name: 'Medical Alcohol', weight: 0.2, value: 75 },
  { id: 'gunpowder', name: 'Gunpowder', weight: 0.2, value: 100 },
  { id: 'metal_parts', name: 'Metal Parts', weight: 0.3, value: 80 },
  { id: 'electronic_parts', name: 'Electronic Parts', weight: 0.2, value: 120 },
  { id: 'battery', name: 'Battery', weight: 0.3, value: 150 },
  { id: 'cloth', name: 'Cloth', weight: 0.2, value: 50 },
  { id: 'kevlar_plates', name: 'Kevlar Plates', weight: 0.5, value: 300 },
  { id: 'herbs', name: 'Medicinal Herbs', weight: 0.1, value: 60 },
  { id: 'chemical_components', name: 'Chemical Components', weight: 0.2, value: 90 }
];

module.exports = {
  name: 'craft',
  aliases: ['crafting', 'make', 'create'],
  description: 'Craft items from components you\'ve scavenged',
  
  async execute(message, args) {
    const userId = message.author.id;
    
    let user = dataManager.getUser(userId);
    if (!user) {
      user = dataManager.createUser(userId, message.author.username);
      const welcomeEmbed = embedCreator.createSuccessEmbed(
        "Profile Created",
        `Welcome to the Zone, Stalker! Your profile has been created.`
      );
      await message.reply({ embeds: [welcomeEmbed] });
    }
    
    if (!user.skills) {
      user.skills = {
        medical: 1,
        weapons: 1,
        technical: 1,
        survival: 1
      };
    }
    
    const items = dataManager.getItems();
    
    ensureCraftingMaterialsExist(items);
    
    if (!args.length || args[0].toLowerCase() === 'list') {
      const craftingEmbed = embedCreator.createEmbed(
        "Crafting Recipes",
        "Items you can craft with scavenged components:",
        "primary"
      );
      
      const availableRecipes = CRAFTING_RECIPES.filter(recipe => 
        user.skills[recipe.skill] >= recipe.skillLevel
      );
      
      if (availableRecipes.length === 0) {
        craftingEmbed.setDescription("You don't have the skills to craft any items yet. Explore the Zone to improve your abilities.");
      } else {
        const recipesBySkill = {};
        
        for (const recipe of availableRecipes) {
          if (!recipesBySkill[recipe.skill]) {
            recipesBySkill[recipe.skill] = [];
          }
          recipesBySkill[recipe.skill].push(recipe);
        }
        
        for (const [skill, recipes] of Object.entries(recipesBySkill)) {
          let recipesList = '';
          
          recipes.forEach(recipe => {
            recipesList += `**${recipe.name}**: ${recipe.description}\n`;
            
            const ingredientsList = recipe.ingredients.map(ing => {
              const item = items[ing.id] || { name: ing.id };
              return `${ing.count}x ${item.name}`;
            }).join(', ');
            
            recipesList += `*Requires: ${ingredientsList}*\n\n`;
          });
          
          craftingEmbed.addFields({
            name: `${skill.charAt(0).toUpperCase() + skill.slice(1)} (Skill Level: ${user.skills[skill]})`,
            value: recipesList,
            inline: false
          });
        }
      }
      
      craftingEmbed.setFooter({ text: `Use ${PREFIX}craft <item name> to craft an item` });
      await message.reply({ embeds: [craftingEmbed] });
      
    } else if (args[0].toLowerCase() === 'materials') {
      const materialsEmbed = embedCreator.createEmbed(
        "Crafting Materials",
        "Components in your inventory that can be used for crafting:",
        "primary"
      );
      
      const materialIds = CRAFTING_MATERIALS.map(material => material.id);
      
      const materials = new Map();
      
      for (const itemId of user.inventory) {
        if (materialIds.includes(itemId)) {
          materials.set(itemId, (materials.get(itemId) || 0) + 1);
        }
      }
      
      for (const itemId of user.inventory) {
        if (itemId.startsWith('mutant_part_')) {
          materials.set(itemId, (materials.get(itemId) || 0) + 1);
        }
      }
      
      if (materials.size === 0) {
        materialsEmbed.setDescription("You don't have any crafting materials in your inventory. Explore the Zone to find components.");
      } else {
        let materialsList = '';
        
        const sortedMaterials = Array.from(materials.entries()).sort((a, b) => {
          const itemA = items[a[0]];
          const itemB = items[b[0]];
          return (itemA?.name || a[0]).localeCompare(itemB?.name || b[0]);
        });
        
        for (const [itemId, count] of sortedMaterials) {
          const item = items[itemId];
          if (item) {
            materialsList += `**${item.name}**: ${count}x\n`;
          }
        }
        
        materialsEmbed.setDescription("Components in your inventory that can be used for crafting:");
        materialsEmbed.addFields({
          name: "Available Materials",
          value: materialsList,
          inline: false
        });
      }
      
      materialsEmbed.setFooter({ text: `Use ${PREFIX}craft list to see what you can make` });
      await message.reply({ embeds: [materialsEmbed] });
      
    } else {
      const recipeName = args.join(' ');
      
      const recipe = CRAFTING_RECIPES.find(r => 
        r.name.toLowerCase() === recipeName.toLowerCase()
      );
      
      if (!recipe) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Recipe Not Found",
          `No crafting recipe found for "${recipeName}". Use \`${PREFIX}craft list\` to see available recipes.`
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      if (user.skills[recipe.skill] < recipe.skillLevel) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Insufficient Skill",
          `You need ${recipe.skill} skill level ${recipe.skillLevel} to craft this item. Your current level is ${user.skills[recipe.skill]}.`
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      const missingIngredients = [];
      
      for (const ingredient of recipe.ingredients) {
        const ingredientCount = user.inventory.filter(id => id === ingredient.id).length;
        
        if (ingredientCount < ingredient.count) {
          const item = items[ingredient.id] || { name: ingredient.id };
          missingIngredients.push({
            name: item.name,
            required: ingredient.count,
            have: ingredientCount
          });
        }
      }
      
      if (missingIngredients.length > 0) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Missing Ingredients",
          `You don't have all the required ingredients to craft ${recipe.name}.`
        );
        
        let missingList = '';
        missingIngredients.forEach(ing => {
          missingList += `**${ing.name}**: Need ${ing.required}, have ${ing.have}\n`;
        });
        
        errorEmbed.addFields({
          name: "Missing Components",
          value: missingList,
          inline: false
        });
        
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      if (!items[recipe.result]) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Item Not Found",
          `Error: The crafted item "${recipe.result}" doesn't exist in the database.`
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      const resultItem = items[recipe.result];
      const craftedWeight = resultItem.weight * recipe.count;
      
      if (user.inventoryWeight + craftedWeight > config.maxInventoryWeight) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Inventory Full",
          `You don't have enough space in your inventory to hold the crafted item. Free up at least ${craftedWeight} kg.`
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }
      
      for (const ingredient of recipe.ingredients) {
        for (let i = 0; i < ingredient.count; i++) {
          const index = user.inventory.indexOf(ingredient.id);
          if (index !== -1) {
            user.inventory.splice(index, 1);
          }
        }
      }
      
      user.inventoryWeight = user.inventory.reduce((total, itemId) => {
        const item = items[itemId];
        return total + (item ? item.weight : 0);
      }, 0);
      
      for (let i = 0; i < recipe.count; i++) {
        user.inventory.push(recipe.result);
      }
      user.inventoryWeight += craftedWeight;
      
      const skillUpChance = 0.1 + (0.1 * (recipe.skillLevel / 5)); // recipes give better chance
      if (Math.random() < skillUpChance) {
        user.skills[recipe.skill]++;
        if (user.skills[recipe.skill] > 5) {
          user.skills[recipe.skill] = 5;
        }
      }
      
      dataManager.saveUser(user);
      
      const successEmbed = embedCreator.createSuccessEmbed(
        "Item Crafted",
        `You've successfully crafted ${recipe.count}x ${recipe.name}!`
      );
      
      successEmbed.addFields({
        name: "Description",
        value: recipe.description,
        inline: false
      });
      
      successEmbed.addFields({
        name: `${recipe.skill.charAt(0).toUpperCase() + recipe.skill.slice(1)} Skill`,
        value: `Current Level: ${user.skills[recipe.skill]}`,
        inline: true
      });
      
      successEmbed.addFields({
        name: "Item Details",
        value: `Weight: ${resultItem.weight} kg\nValue: ${resultItem.value} RU`,
        inline: true
      });
      
      await message.reply({ embeds: [successEmbed] });
    }
  },
};

/**
 * Ensure all crafting materials exist in the item database
 * @param {Object} items - The items database
 */
function ensureCraftingMaterialsExist() {
  for (const material of CRAFTING_MATERIALS) {
    dataManager.addCraftingMaterialItem(
      material.id,
      material.name,
      `A crafting material used in various recipes.`,
      material.value,
      material.weight
    );
  }
  
  // Add healing mixture recipe result
  dataManager.createItem('healing_mixture', {
    name: 'Healing Mixture',
    description: 'A mixture of herbs and mutant parts with healing properties.',
    category: 'medical',
    weight: 0.3,
    value: 250,
    effect: {
      health: 40
    }
  });
}