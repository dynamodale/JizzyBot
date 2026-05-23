import { SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../../utils/MusicPlayer.js';

export default {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show what is currently playing'),

    async execute(interaction) {
        const player = getPlayer(interaction.guild.id);
        if (!player?.current) {
            return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
        }
        const embed = player._buildNowPlayingEmbed();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
