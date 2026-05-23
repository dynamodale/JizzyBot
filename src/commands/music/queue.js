import { SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../../utils/MusicPlayer.js';

export default {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current music queue'),

    async execute(interaction) {
        const player = getPlayer(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
        }
        const embed = player._buildQueueEmbed();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
