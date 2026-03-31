const { SlashCommandBuilder } = require("discord.js");
const fetch = require("node-fetch");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ai")
    .setDescription("Query a local LLM")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Your prompt for the LLM")
        .setRequired(true),
    ),
  async execute(interaction) {
    const query = interaction.options.getString("query");

    // thinking indicator
    await interaction.deferReply();

    try {
      // Make request to your local LM Studio API
      // Default LM Studio runs on port 1234
      const response = await fetch("http://localhost:1234/api/v1/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "nemotron3-nano-4b-uncensored-hauhaucs-aggressive",
          system_prompt:
            "You are a discord bot. Keep in mind the 1900 character limit.",
          input: query,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      let llmResponse = "";

      // Handle different response structures from LM Studio
      if (data && data.output && Array.isArray(data.output)) {
        // Look for the message content in the output array
        const messageOutput = data.output.find(
          (item) => item.type === "message",
        );
        if (messageOutput && messageOutput.content) {
          llmResponse = messageOutput.content.trim();
        } else {
          // If no message type found, try to get the first content
          const firstContent = data.output.find((item) => item.content);
          if (firstContent && firstContent.content) {
            llmResponse = firstContent.content.trim();
          }
        }
      } else if (data && data.response) {
        // Alternative structure
        llmResponse = data.response.trim();
      } else if (
        data &&
        data.choices &&
        data.choices[0] &&
        data.choices[0].message
      ) {
        // For completion models
        llmResponse = data.choices[0].message.content.trim();
      } else {
        llmResponse = "No response received from the LLM.";
      }

      if (!llmResponse || llmResponse === "") {
        // Try to get any content that might be there
        const allKeys = Object.keys(data);
        for (const key of allKeys) {
          if (typeof data[key] === "string" && data[key].length > 10) {
            llmResponse = data[key];
            break;
          }
        }

        // If still no response, use default
        if (!llmResponse || llmResponse === "") {
          llmResponse = "No response received from the LLM.";
        }
      }

      // embed creation
      const embed = {
        title: "LLM Response",
        description: llmResponse,
        color: 0x00fff0,
        fields: [
          {
            name: "Query",
            value: query,
            inline: false,
          },
        ],
        timestamp: new Date(),
        footer: {
          text: "nemotron3-nano-4b-uncensored-hauhaucs-aggressive", // edit if different
        },
      };

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error communicating with LLM:", error);

      let errorMessage =
        "Sorry, I encountered an error while processing your request.";

      if (error.message.includes("ECONNREFUSED")) {
        errorMessage =
          "Could not connect to the local LLM. Please make sure LM Studio is running.";
      } else if (error.message.includes("HTTP error")) {
        errorMessage = `LLM returned an error: ${error.message}`;
      } else if (error.message.includes("fetch is not a function")) {
        errorMessage =
          "Failed to initialize fetch function. Please check your Node.js version and dependencies.";
      }

      const errorEmbed = {
        title: "Error",
        description: errorMessage,
        color: 0xff0000,
        timestamp: new Date(),
      };

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
