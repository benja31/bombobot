const { SlashCommandBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Kokoro-FastAPI runs on port 8880 with the /v1/audio/speech endpoint
const KOKORO_HOST = 'localhost';
const KOKORO_PORT = 8880;

/**
 * Generates an MP3 from text using Kokoro-FastAPI.
 * @param {string} text - The text to synthesize
 * @param {string} outputPath - Where to save the MP3
 */

async function generateTTS(text, outputPath) {
  const payload = JSON.stringify({
    model: 'kokoro',
    input: text,
    voice: 'bm_george', // change to any Kokoro voice you prefer
    response_format: 'mp3',
    speed: 1.0,
  });
  
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: KOKORO_HOST,
        port: KOKORO_PORT,
        path: '/v1/audio/speech',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Context-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () =>
            reject(new Error(`Kokoro returned ${res.statusCode}: ${body}`))
          );
          return;
        }
        const fileStream = fs.createWriteStream(outputPath);
        res.pipe(fileStream);
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('speak')
    .setDescription('generate tts from local llm and play it in vc')
    .addStringOption((option) =>
      option
        .setName('text')
        .setDescription('the text to speak')
        .setRequired(true)
    ),
  
  async execute(interaction) {
    const voiceChannel = interaction.member?.voice?.channel;
    
    if (!voiceChannel) {
      return interaction.reply({
        content: 'you are not in a voice channel',
        ephemeral: true,
      });
    }
    
    const text = interaction.options.getString('text');
    
    // defer reply to make time forr tts gen
    await interaction.deferReply({ ephemeral: true });
    
    const tmpFile = path.join(__dirname, `../tts_${Date.now()}.mp3`);
    
    try {
      await generateTTS(text, tmpFile);
      
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      });
      
      await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
      
      const player = createAudioPlayer();
      const resource = createAudioResource(tmpFile);
      
      connection.subscribe(player);
      player.play(resource);
      
      await new Promise((resolve, reject) => {
        player.on(AudioPlayerStatus.Idle, resolve);
        player.on('error', reject);
      });
      
      connection.destroy();
      await interaction.editReply({ content: '✅ Done!' });
    } catch (err) {
      console.error('Voice error:', err);
      await interaction.editReply({
        content: '❌ Something went wrong with voice playback.',
      });
    } finally {
      fs.unlink(tmpFile, (err) => {
        if (err) console.error('Failed to delete TTS file:', err);
      });
    }
  },
};