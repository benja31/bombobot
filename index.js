const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

/*
* bombobot (nichtskönner v2) by bnJ
* log levels => "DEBUG", "LOG", "WARN", "ERROR", "IPC"
*/

// ipc support (for the launcher)
let isChildProcess = false;
if (process.send) {
  isChildProcess = true;
  
  // handles input from ipc via launcher
  process.on('message', async (msg) => {
    console.log(`[IPC] Received: ${JSON.stringify(msg)}`);
    
    switch (msg.type) {
      case 'PING':
        process.send({ type: 'PONG', timestamp: Date.now() });
        break;
      
      case 'RELOAD_COMMANDS':
        await loadCommands();
        await registerCommands();
        process.send({ type: 'COMMANDS_RELOADED', count: client.commands.size });
        break;
      
      default:
        console.log(`[IPC] Unknown message type: ${msg.type}`);
    }
  });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();

// also enables dynamic command reloads via ipc
async function loadCommands() {
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
    
  client.commands.clear();
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    // Delete from require cache to force reload
    delete require.cache[require.resolve(filePath)];
    const command = require(filePath);

    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
      console.log(`[OK] Loaded command: ${command.data.name}`);
    } else {
      console.log(
        `[WARN] The command at ${filePath} is missing a required "data" or "execute" property.`,
      );
    }
  }
  
  return client.commands.size;
}

// register commands with discord
async function registerCommands() {
  try {
    console.log(
      `[LOG] Started refreshing ${client.commands.size} application (/) commands.`,
    );
    
    await client.application.commands.set(
      Array.from(client.commands.values()).map((cmd) => cmd.data.toJSON()),
    );
    console.log("Successfully registered application (/) commands.");
  } catch (error) {
    console.error("Error registering commands:", error);
  }
}

loadCommands();

client.on("clientReady", async () => {
  console.log(`[OK] Successfully logged in as ${client.user.tag}!`);
  
  await registerCommands();
  
  if (process.send) {
    process.send({ type: 'BOT_READY', username: client.user.tag });
  }
});

// slash command handler
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const message = "There was an error while executing this command!";
    await interaction.reply({ content: message, ephemeral: true });
  }
});

client.login(process.env.TOKEN);
