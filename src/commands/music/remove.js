import { SlashCommandBuilder } from 'discord.js';
import { getPlayer } from '../../utils/MusicPlayer.js';

export default {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a song from the queue by its position')
        .addIntegerOption(o =>
            o.setName('position')
                .setDescription('Position in the queue (use /queue to see positions)')
                .setMinValue(1)
                .setRequired(true)
        ),

    async execute(interaction) {
        const player = getPlayer(interaction.guild.id);
        if (!player || !player.queue.length) {
            return interaction.reply({ content: '❌ The queue is empty.', ephemeral: true });
        }
        const pos = interaction.options.getInteger('position');
        const removed = player.remove(pos);
        if (!removed) {
            return interaction.reply({ content: `❌ No song at position ${pos}.`, ephemeral: true });
        }
        await interaction.reply({ content: `🗑️ Removed **${removed.title}** from the queue.`, ephemeral: true });
    }
};
