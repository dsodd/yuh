// STALKERNet Discord Bot - Main Entry Point
// A S.T.A.L.K.E.R. themed RPG bot for Discord
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const dataManager = require('./utils/dataManager');

// Get command prefix from .env file
const PREFIX = process.env.PREFIX || '!';

// Initialize Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Create collections for commands
client.commands = new Collection();
client.aliases = new Collection();

// Load command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  // Set a new item in the Collection with the command name as the key and the exported module as the value
  if ('name' in command && 'execute' in command) {
    client.commands.set(command.name, command);
    console.log(`Loaded command: ${command.name}`);
    
    // Set up aliases if they exist
    if (command.aliases && Array.isArray(command.aliases)) {
      command.aliases.forEach(alias => {
        client.aliases.set(alias, command.name);
      });
    }
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "name" or "execute" property.`);
  }
}

// Initialize the data directories if they don't exist
dataManager.initializeDataFiles();

// Initialize base game items
dataManager.initializeBaseItems();

// Event: Client Ready
client.once(Events.ClientReady, (readyClient) => {
  console.log(`STALKERNet is online! Logged in as ${readyClient.user.tag}`);
  client.user.setActivity(`${PREFIX}help | S.T.A.L.K.E.R.`);
});

// Event: Message Create (handle prefix commands)
client.on(Events.MessageCreate, async message => {
  // Ignore messages from bots or that don't start with the prefix
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;
  
  // Extract command name and arguments
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  
  // Find the command or its alias
  const command = client.commands.get(commandName) || 
                  client.commands.get(client.aliases.get(commandName));
  
  if (!command) return;
  
  try {
    // Execute the command
    await command.execute(message, args);
  } catch (error) {
    console.error(error);
    message.reply('There was an error while executing this command. The anomaly has disrupted the connection.');
  }
});

// Login to Discord with the bot token
client.login(process.env.TOKEN);
