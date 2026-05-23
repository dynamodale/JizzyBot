import { SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../../utils/MusicPlayer.js';

export default {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set the playback volume')
        .addIntegerOption(o =>
            o.setName('level')
                .setDescription('Volume level (0-100)')
                .setMinValue(0)
                .setMaxValue(100)
                .setRequired(true)
        ),

    async execute(interaction) {
        const player = getPlayer(interaction.guild.id);
        if (!player?.current) {
            return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
        }
        const level = interaction.options.getInteger('level');
        player.setVolume(level);
        await interaction.reply({ content: `🔊 Volume set to **${level}%**`, ephemeral: true });
    }
};
