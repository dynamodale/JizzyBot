import { SlashCommandBuilder } from 'discord.js';
import { getPlayer, destroyPlayer } from '../../utils/MusicPlayer.js';

export default {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop music and leave the voice channel'),

    async execute(interaction) {
        const player = getPlayer(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
        }
        player.stop();
        destroyPlayer(interaction.guild.id);
        await interaction.reply({ content: '⏹ Stopped and left the voice channel.', ephemeral: true });
    }
};
