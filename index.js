const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  // Check ob command richtig gemacht ist
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
    console.log(`Loaded command: ${command.data.name}`);
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
    );
  }
}

client.on("clientReady", async () => {
  console.log(`Successfully logged in as ${client.user.tag}!`);

  // Register slash commands with Discord
  try {
    console.log(
      `Started refreshing ${client.commands.size} application (/) commands.`,
    );

    // Bulk update to register all commands
    await client.application.commands.set(
      Array.from(client.commands.values()).map((cmd) => cmd.data.toJSON()),
    );

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error("Error registering commands:", error);
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
