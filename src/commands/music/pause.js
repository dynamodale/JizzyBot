import { SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../../utils/MusicPlayer.js';

export default {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause or resume the current song'),

    async execute(interaction) {
        const player = getPlayer(interaction.guild.id);
        if (!player?.current) {
            return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
        }
        player.togglePause();
        await interaction.reply({ content: player.paused ? '⏸ Paused.' : '▶️ Resumed.', ephemeral: true });
    }
};
