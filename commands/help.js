
// Get prefix from .env
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const config = require('../config');
const embedCreator = require('../utils/embedCreator');

const PREFIX = process.env.PREFIX || '!';

module.exports = {
  name: 'help',
  aliases: ['h', 'commands'],
  description: 'Show help information for STALKERNet commands',
  
  async execute(message, args) {
    // Command pages for pagination
    const pages = [
      {
        title: 'STALKERNet - Basic Commands',
        description: 'Welcome to the Zone, Stalker. Here are the basic commands that will help you survive.',
        fields: [
          { 
            name: '📋 Profile & Faction Commands',
            value: `\`${PREFIX}profile\`\n└ View your STALKERNet profile\n\n\`${PREFIX}factions [join|leave|info] [faction]\`\n└ View, join, or leave factions\n\n\`${PREFIX}inventory\`\n└ Manage your items (Aliases: inv)\n\n\`${PREFIX}help\`\n└ Show this help menu (Aliases: h, commands)` 
          },
          {
            name: '🗺️ Travel & Exploration',
            value: `\`${PREFIX}travel [zone|scout] [zone_name]\`\n└ Move between zones or scout areas\n\n\`${PREFIX}explore\`\n└ Explore the current area for items\n\n\`${PREFIX}weather\`\n└ Check weather conditions (Aliases: conditions, sky)`
          }
        ],
        footer: 'Page 1/3 | Basic Commands'
      },
      {
        title: 'STALKERNet - Combat & Anomalies',
        description: 'Combat, anomaly interactions, and dangerous zone activities.',
        fields: [
          {
            name: '🔫 Combat Commands',
            value: `\`${PREFIX}combat\`\n└ Hunt mutants in the zone\n\n\`${PREFIX}pvp [@user]\`\n└ Challenge another stalker to combat`
          },
          {
            name: '🌀 Anomaly Commands',
            value: `\`${PREFIX}anomaly scan\`\n└ Search for anomaly fields in your zone\n\n\`${PREFIX}anomaly enter\`\n└ Enter a detected anomaly to search for artifacts\n\n\`${PREFIX}anomaly avoid\`\n└ Avoid a detected anomaly safely\n\n\`${PREFIX}anomaly info\`\n└ View information about anomaly types`
          },
          {
            name: '💎 Artifact Commands',
            value: `\`${PREFIX}artifacts search\`\n└ Search for artifacts in your current zone\n\n\`${PREFIX}artifacts use [artifact]\`\n└ Use an artifact from your inventory\n\n\`${PREFIX}artifacts info [artifact]\`\n└ Get information about an artifact`
          }
        ],
        footer: 'Page 2/3 | Combat & Anomalies'
      },
      {
        title: 'STALKERNet - Economy & Progression',
        description: 'Trading, crafting, quests, and character progression.',
        fields: [
          {
            name: '💰 Trade & Economy',
            value: `\`${PREFIX}trade list\`\n└ View vendor inventory\n\n\`${PREFIX}trade buy [item]\`\n└ Purchase items from vendors\n\n\`${PREFIX}trade sell [item]\`\n└ Sell items to vendors`
          },
          {
            name: '🔧 Crafting & Maintenance',
            value: `\`${PREFIX}craft [item]\`\n└ Craft items from materials\n\n\`${PREFIX}craft list\`\n└ View available crafting recipes\n\n\`${PREFIX}craft materials\`\n└ View your crafting materials\n\n\`${PREFIX}maintain [item]\`\n└ Repair and maintain equipment`
          },
          {
            name: '📜 Quest System',
            value: `\`${PREFIX}quest get [id]\`\n└ Accept a new quest (Aliases: q, mission)\n\n\`${PREFIX}quest list\`\n└ View your active quests\n\n\`${PREFIX}quest complete [id]\`\n└ Complete an active quest\n\n\`${PREFIX}dailyquest status\`\n└ Check daily quest status\n\n\`${PREFIX}dailyquest claim\`\n└ Claim daily quest rewards`
          }
        ],
        footer: 'Page 3/3 | Economy & Progression'
      }
    ];
    
    let currentPage = 0;
    
    // Create the initial embed
    const createHelpEmbed = (pageIndex) => {
      const page = pages[pageIndex];
      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(page.title)
        .setDescription(page.description)
        .setFooter({ text: page.footer })
        .setTimestamp();
        
      // Add all fields from the page
      page.fields.forEach(field => {
        embed.addFields(field);
      });
      
      // Add note for all pages
      embed.addFields({ 
        name: '🚀 Getting Started', 
        value: `Create a profile with \`${PREFIX}profile\`, join a faction with \`${PREFIX}factions join [faction]\`, then start exploring with \`${PREFIX}travel\`. Good hunting, Stalker!` 
      });
      
      return embed;
    };
    
    // Create navigation buttons
    const createButtons = () => {
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('previous')
            .setLabel('◀️ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === pages.length - 1)
        );
        
      return row;
    };
    
    // Send the initial embed with buttons
    const helpMessage = await message.reply({
      embeds: [createHelpEmbed(currentPage)],
      components: [createButtons()]
    });
    
    // Create collector for button interactions
    const collector = helpMessage.createMessageComponentCollector({ 
      componentType: ComponentType.Button, 
      time: 120000 // Collector active for 2 minutes
    });
    
    // Handle button interactions
    collector.on('collect', async interaction => {
      // Ensure the interaction is from the original command user
      if (interaction.user.id !== message.author.id) {
        await interaction.reply({ 
          content: 'These buttons are not for you!', 
          ephemeral: true 
        });
        return;
      }
      
      // Update the page based on the button clicked
      if (interaction.customId === 'previous') {
        if (currentPage > 0) {
          currentPage--;
        }
      } else if (interaction.customId === 'next') {
        if (currentPage < pages.length - 1) {
          currentPage++;
        }
      }
      
      // Update the message
      await interaction.update({
        embeds: [createHelpEmbed(currentPage)],
        components: [createButtons()]
      });
    });
    
    // Handle collector end (timeout)
    collector.on('end', () => {
      helpMessage.edit({ components: [] }).catch(console.error);
    });
  },
};
