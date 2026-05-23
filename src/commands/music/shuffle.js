import { SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../../utils/MusicPlayer.js';

export default {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffle the music queue'),

    async execute(interaction) {
        const player = getPlayer(interaction.guild.id);
        if (!player || !player.queue.length) {
            return interaction.reply({ content: '❌ The queue is empty.', ephemeral: true });
        }
        player.shuffle();
        await interaction.reply({ content: '🔀 Queue shuffled!', ephemeral: true });
    }
};
