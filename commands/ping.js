const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("see server latency"),
  async execute(interaction) {
    await interaction.deferReply();

    const ping = Date.now() - interaction.createdTimestamp;

    await interaction.editReply(
      `Latency: ${ping}ms. API Latency: ${Math.round(interaction.client.ws.ping)}ms`,
    );
  },
};
