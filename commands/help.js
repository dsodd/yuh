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
            name: '📋 Profile Commands',
            value: `\`${PREFIX}profile\`\n└ View your STALKERNet profile\n\n\`${PREFIX}factions [join|leave|info]\`\n└ View or join factions\n\n\`${PREFIX}inventory\`\n└ Manage your items (Aliases: inv)\n\n\`${PREFIX}help\`\n└ Show this help menu (Aliases: h, commands)` 
          },
          {
            name: '🔫 Combat & Exploration',
            value: `\`${PREFIX}travel [zone|scout]\`\n└ Move between zones or scout\n\n\`${PREFIX}combat\`\n└ Hunt mutants in the zone\n\n\`${PREFIX}explore\`\n└ Explore the current area\n\n\`${PREFIX}pvp [@user]\`\n└ Challenge another stalker to combat`
          }
        ],
        footer: 'Page 1/2 | Basic Commands'
      },
      {
        title: 'STALKERNet - Advanced Commands',
        description: 'More specialized commands for experienced stalkers.',
        fields: [
          {
            name: '💰 Trade & Economy',
            value: `\`${PREFIX}trade [buy|sell|list]\`\n└ Buy and sell items\n\n\`${PREFIX}craft [item]\`\n└ Craft items from materials\n\n\`${PREFIX}maintain [item]\`\n└ Repair and maintain equipment`
          },
          {
            name: '📜 Quest & Activities',
            value: `\`${PREFIX}quest [get|list|complete]\`\n└ Get and complete quests (Aliases: q, mission)\n\n\`${PREFIX}artifacts [search|use]\`\n└ Find and use artifacts\n\n\`${PREFIX}dailyquest [status|claim]\`\n└ Daily and weekly quests\n\n\`${PREFIX}weather\`\n└ Check weather conditions (Aliases: conditions, sky)\n\n\`${PREFIX}anomaly [scan|interact]\`\n└ Interact with zone anomalies`
          }
        ],
        footer: 'Page 2/2 | Advanced Commands'
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
        name: 'Getting Started', 
        value: `Create a profile with \`${PREFIX}profile\`, join a faction with \`${PREFIX}factions join\`, then start exploring with \`${PREFIX}travel\`. Good hunting, Stalker!` 
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
