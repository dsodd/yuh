const { EmbedBuilder } = require("discord.js");
const dataManager = require("../utils/dataManager");
const config = require("../config");

// Get prefix from .env
const PREFIX = process.env.PREFIX || "!";

module.exports = {
  name: "inventory",
  aliases: ["inv", "i", "items"],
  description: "Manage your STALKER inventory",

  async execute(message, args) {
    const userId = message.author.id;

    // Get user data or create if not exists
    let user = dataManager.getUser(userId);
    if (!user) {
      user = dataManager.createUser(userId, message.author.username);
      const welcomeEmbed = embedCreator.createSuccessEmbed(
        "Profile Created",
        `Welcome to the Zone, Stalker! Your profile has been created.`,
      );
      await message.reply({ embeds: [welcomeEmbed] });
    }

    // Get all available items data
    const allItems = dataManager.getItems();

    // Check for subcommands or default to 'view'
    const subcommand = args.length > 0 ? args[0].toLowerCase() : "view";

    // Execute the appropriate subcommand
    if (subcommand === "view") {
      // Display the user's inventory
      if (user.inventory.length === 0) {
        const emptyInventoryEmbed = embedCreator.createEmbed(
          "Empty Inventory",
          `Your inventory is empty, Stalker. Try scouting for items with \`${PREFIX}travel scout\`.`,
          "primary",
        );
        await message.reply({ embeds: [emptyInventoryEmbed] });
        return;
      }

      // Group items by category
      const itemsByCategory = {};

      for (const itemId of user.inventory) {
        const item = allItems[itemId];
        if (!item) continue; // Skip if item doesn't exist

        if (!itemsByCategory[item.category]) {
          itemsByCategory[item.category] = [];
        }

        itemsByCategory[item.category].push(item);
      }

      // Create inventory embed
      const inventoryEmbed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`${user.name}'s Inventory`)
        .setDescription(
          `Weight: ${user.inventoryWeight}/${config.maxInventoryWeight} kg`,
        )
        .setFooter({ text: `Total Items: ${user.inventory.length}` })
        .setTimestamp();

      // Add fields for each category
      for (const [category, items] of Object.entries(itemsByCategory)) {
        let itemsList = "";

        items.forEach((item) => {
          const equipped =
            (user.equipped.weapon === item.id ? " (Equipped Weapon)" : "") ||
            (user.equipped.armor === item.id ? " (Equipped Armor)" : "") ||
            (user.equipped.artifacts.includes(item.id)
              ? " (Equipped Artifact)"
              : "");

          itemsList += `**${item.name}** - ${item.weight}kg - ${item.description}${equipped}\n`;
        });

        inventoryEmbed.addFields({
          name: category.toUpperCase(),
          value: itemsList || "None",
          inline: false,
        });
      }

      await message.reply({ embeds: [inventoryEmbed] });
    } else if (subcommand === "equip") {
      // Check if item name was provided
      if (args.length < 2) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Missing Item Name",
          `Please specify an item to equip. Usage: \`${PREFIX}inventory equip <item name>\``,
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }

      const itemName = args.slice(1).join(" ");

      // Find the item in user's inventory
      const itemMatch = Object.values(allItems).find(
        (item) =>
          item.name.toLowerCase() === itemName.toLowerCase() &&
          user.inventory.includes(item.id),
      );

      if (!itemMatch) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Item Not Found",
          `You don't have an item called "${itemName}" in your inventory.`,
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }

      // Check if item is equippable
      if (!["weapon", "armor", "artifact"].includes(itemMatch.category)) {
        const errorEmbed = embedCreator.createErrorEmbed(
          "Can't Equip Item",
          `${itemMatch.name} cannot be equipped. Only weapons, armor, and artifacts can be equipped.`,
        );
        await message.reply({ embeds: [errorEmbed] });
        return;
      }

      // Equip the item based on its category
      if (itemMatch.category === "weapon") {
        user.equipped.weapon = itemMatch.id;
      } else if (itemMatch.category === "armor") {
        user.equipped.armor = itemMatch.id;
      } else if (itemMatch.category === "artifact") {
        // Check if we've reached the artifact limit (typically 3-5)
        const maxArtifacts = 3;
        if (user.equipped.artifacts.length >= maxArtifacts) {
          await createEmbed(
            `Artifacts`,
            `You can only equip ${maxArtifacts} artifacts at once. Unequip one first.`,
          );
          return;
        }

        // Add artifact if not already equipped
        if (!user.equipped.artifacts.includes(itemMatch.id)) {
          user.equipped.artifacts.push(itemMatch.id);
        }
      }

      // Save the updated user data
      dataManager.saveUser(user);

      await createEmbed(
        `Equipped Item`,
        `You have equipped ${itemMatch.name}.`,
      );
    } else if (subcommand === "use") {
      // Check if item name was provided
      if (args.length < 2) {
        await createEmbed(
          `Specify Item`,
          `Please specify an item to use. Usage: \`${PREFIX}inventory use <item name>\``,
        );
        return;
      }

      const itemName = args.slice(1).join(" ");

      // Find the item in user's inventory
      const itemMatch = Object.values(allItems).find(
        (item) =>
          item.name.toLowerCase() === itemName.toLowerCase() &&
          user.inventory.includes(item.id),
      );

      if (!itemMatch) {
        await createErrorEmbed(
          `Missing Item`,
          `You don't have an item called "${itemName}" in your inventory.`,
        );
        return;
      }

      // Check if item is consumable
      if (itemMatch.category !== "consumable") {
        await createErrorEmbed(
          `Bad Item Usage`,
          `${itemMatch.name} cannot be consumed.`,
        );
        return;
      }

      // Apply item effects
      let effectsDescription = [];

      if (itemMatch.effects) {
        if (itemMatch.effects.health) {
          const previousHealth = user.health;
          user.health = Math.min(
            config.maxHealth,
            user.health + itemMatch.effects.health,
          );
          effectsDescription.push(`Health: ${previousHealth} → ${user.health}`);
        }

        if (itemMatch.effects.radiation) {
          const previousRadiation = user.radiation;
          user.radiation = Math.max(
            0,
            user.radiation + itemMatch.effects.radiation,
          );
          effectsDescription.push(
            `Radiation: ${previousRadiation}% → ${user.radiation}%`,
          );
        }

        if (itemMatch.effects.stamina) {
          const previousStamina = user.stamina;
          user.stamina = Math.min(
            config.maxStamina,
            user.stamina + itemMatch.effects.stamina,
          );
          effectsDescription.push(
            `Stamina: ${previousStamina} → ${user.stamina}`,
          );
        }
      }

      // Remove the item from inventory after use
      user.inventory = user.inventory.filter((id) => id !== itemMatch.id);

      // Recalculate inventory weight
      user.inventoryWeight = user.inventory.reduce((total, itemId) => {
        const item = allItems[itemId];
        return total + (item ? item.weight : 0);
      }, 0);

      // Save the updated user data
      dataManager.saveUser(user);

      const effectsText =
        effectsDescription.length > 0
          ? `\nEffects: ${effectsDescription.join(", ")}`
          : "";

      await createSuccessEmbed(
        `Item Consumed`,
        `You used ${itemMatch.name}.${effectsText}`,
      );
    } else if (subcommand === "drop") {
      // Check if item name was provided
      if (args.length < 2) {
        await createErrorEmbed(
          `Bad Command Usage`,
          `Please specify an item to drop. Usage: \`${PREFIX}inventory drop <item name>\``,
        );
        return;
      }

      const itemName = args.slice(1).join(" ");

      // Find the item in user's inventory
      const itemMatch = Object.values(allItems).find(
        (item) =>
          item.name.toLowerCase() === itemName.toLowerCase() &&
          user.inventory.includes(item.id),
      );

      if (!itemMatch) {
        await message.reply(
          `You don't have an item called "${itemName}" in your inventory.`,
        );
        return;
      }

      // Check if the item is equipped
      if (
        user.equipped.weapon === itemMatch.id ||
        user.equipped.armor === itemMatch.id ||
        user.equipped.artifacts.includes(itemMatch.id)
      ) {
        await message.reply(
          `You need to unequip ${itemMatch.name} before dropping it.`,
        );
        return;
      }

      // Remove the item from inventory
      user.inventory = user.inventory.filter((id) => id !== itemMatch.id);

      // Recalculate inventory weight
      user.inventoryWeight = user.inventory.reduce((total, itemId) => {
        const item = allItems[itemId];
        return total + (item ? item.weight : 0);
      }, 0);

      // Save the updated user data
      dataManager.saveUser(user);

      await message.reply(`You dropped ${itemMatch.name}.`);
    } else if (subcommand === "unequip") {
      // Check if item name was provided
      if (args.length < 2) {
        await message.reply(
          `Please specify an item to unequip. Usage: \`${PREFIX}inventory unequip <item name or slot>\``,
        );
        return;
      }

      const itemOrSlot = args.slice(1).join(" ").toLowerCase();

      // Check if it's a slot name (weapon, armor, artifacts)
      if (itemOrSlot === "weapon") {
        if (!user.equipped.weapon) {
          await message.reply("You don't have any weapon equipped.");
          return;
        }

        const weaponName =
          allItems[user.equipped.weapon]?.name || "Unknown weapon";
        user.equipped.weapon = null;
        dataManager.saveUser(user);
        await message.reply(`You have unequipped your ${weaponName}.`);
        return;
      } else if (itemOrSlot === "armor") {
        if (!user.equipped.armor) {
          await message.reply("You don't have any armor equipped.");
          return;
        }

        const armorName =
          allItems[user.equipped.armor]?.name || "Unknown armor";
        user.equipped.armor = null;
        dataManager.saveUser(user);
        await message.reply(`You have unequipped your ${armorName}.`);
        return;
      } else if (itemOrSlot === "artifacts" || itemOrSlot === "artifact") {
        if (user.equipped.artifacts.length === 0) {
          await message.reply("You don't have any artifacts equipped.");
          return;
        }

        const artifactNames = user.equipped.artifacts
          .map((id) => allItems[id]?.name || "Unknown artifact")
          .join(", ");
        user.equipped.artifacts = [];
        dataManager.saveUser(user);
        await message.reply(
          `You have unequipped all your artifacts: ${artifactNames}.`,
        );
        return;
      }

      // Otherwise, treat it as an item name
      const itemName = itemOrSlot;

      // Find the equipped item
      let equipped = false;
      let equipType = "";

      if (
        user.equipped.weapon &&
        allItems[user.equipped.weapon]?.name.toLowerCase() === itemName
      ) {
        user.equipped.weapon = null;
        equipped = true;
        equipType = "weapon";
      } else if (
        user.equipped.armor &&
        allItems[user.equipped.armor]?.name.toLowerCase() === itemName
      ) {
        user.equipped.armor = null;
        equipped = true;
        equipType = "armor";
      } else {
        // Check artifacts
        const artifactIndex = user.equipped.artifacts.findIndex(
          (id) => allItems[id]?.name.toLowerCase() === itemName,
        );

        if (artifactIndex !== -1) {
          user.equipped.artifacts.splice(artifactIndex, 1);
          equipped = true;
          equipType = "artifact";
        }
      }

      if (!equipped) {
        await message.reply(`You don't have "${itemName}" equipped.`);
        return;
      }

      // Save the updated user data
      dataManager.saveUser(user);

      await message.reply(
        `You have unequipped the ${itemName} (${equipType}).`,
      );
    } else {
      // Unknown subcommand
      await message.reply(
        `Unknown inventory command: "${subcommand}". Available commands: view, equip, unequip, use, drop.`,
      );
    }
  },
};
