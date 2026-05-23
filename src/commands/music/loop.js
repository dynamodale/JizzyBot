import { SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../../utils/MusicPlayer.js';

export default {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Cycle loop mode: Off → Song → Queue → Off'),

    async execute(interaction) {
        const player = getPlayer(interaction.guild.id);
        if (!player?.current) {
            return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
        }
        const mode = player.cycleLoop();
        const label = mode === 'none' ? '➡️ Off' : mode === 'song' ? '🔂 Song' : '🔁 Queue';
        await interaction.reply({ content: `Loop mode set to: **${label}**`, ephemeral: true });
    }
};
