const { EmbedBuilder } = require('discord.js');
const dataManager = require('../utils/dataManager');
const config = require('../config');
const embedCreator = require('../utils/embedCreator');

// Get prefix from .env
const PREFIX = process.env.PREFIX || '!';

module.exports = {
  name: 'profile',
  aliases: ['p', 'me'],
  description: 'View your STALKER profile or create a new one.',
  
  async execute(message, args) {
    // Check if user exists, if not create a new profile
    const userId = message.author.id;
    let user = dataManager.getUser(userId);
    
    if (!user) {
      // Create a creating profile embed
      const creatingEmbed = embedCreator.createEmbed(
        "Profile Creation",
        "You don't have a profile yet. Creating one for you...",
        "primary"
      );
      const creatingMsg = await message.reply({ embeds: [creatingEmbed] });
      
      // Create a new user profile
      user = dataManager.createUser(userId, message.author.username);
      
      // Create welcome embed
      const welcomeEmbed = embedCreator.createSuccessEmbed(
        "Profile Created",
        `Welcome to the Zone, Stalker! Your profile has been created. Use \`${PREFIX}factions join\` to choose a faction.`
      );
      await message.channel.send({ embeds: [welcomeEmbed] });
    }
    
    // Create the profile embed using embedCreator
    const profileEmbed = embedCreator.createProfileEmbed(user, message.author.displayAvatarURL())
      .setColor(user.faction ? config.colors.faction[user.faction] : config.colors.primary)
      .setTitle(`${user.name}'s Profile`)
      .setDescription(`*${user.faction || 'No Faction'}*`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Rank', value: user.rank.toString(), inline: true },
        { name: 'Reputation', value: user.reputation.toString(), inline: true },
        { name: 'Zone Location', value: user.currentZone, inline: true },
        { name: 'Health', value: `${user.health}/${config.maxHealth}`, inline: true },
        { name: 'Radiation', value: `${user.radiation}%`, inline: true },
        { name: 'Rubles', value: user.rubles.toString(), inline: true },
        { name: 'Inventory', value: `${user.inventoryWeight}/${config.maxInventoryWeight} kg`, inline: true },
        { name: 'Items', value: user.inventory.length.toString(), inline: true },
        { name: 'Quests Completed', value: user.completedQuests.length.toString(), inline: true }
      )
      .setFooter({ text: 'STALKERNet Terminal' })
      .setTimestamp();
    
    // Add equipment information if the user has items equipped
    const equippedWeapon = user.equipped.weapon ? `Weapon: ${user.equipped.weapon}` : 'No weapon equipped';
    const equippedArmor = user.equipped.armor ? `Armor: ${user.equipped.armor}` : 'No armor equipped';
    const equippedArtifacts = user.equipped.artifacts.length > 0 
      ? `Artifacts: ${user.equipped.artifacts.join(', ')}` 
      : 'No artifacts equipped';
    
    profileEmbed.addFields({ 
      name: 'Equipment', 
      value: `${equippedWeapon}\n${equippedArmor}\n${equippedArtifacts}` 
    });

    await message.reply({ embeds: [profileEmbed] });
  },
};
