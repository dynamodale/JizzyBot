import { SlashCommandBuilder } from 'discord.js';
import { getPlayer, createPlayer } from '../../utils/MusicPlayer.js';

export default {
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('Load a YouTube playlist into the queue')
        .addStringOption(o =>
            o.setName('url')
                .setDescription('YouTube playlist URL')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) return interaction.editReply('❌ You need to be in a voice channel!');

        const url = interaction.options.getString('url');

        let player = getPlayer(interaction.guild.id);
        if (!player) {
            player = createPlayer(interaction.guild.id, interaction.guild);
            await player.join(voiceChannel);
        }

        try {
            const result = await player.addPlaylist(url, interaction.user.id);
            const wasIdle = !player.current;
            if (wasIdle) await player.play(interaction.channel);
            await interaction.editReply(`✅ Loaded **${result.count} songs** from **${result.name}**!`);
        } catch (err) {
            await interaction.editReply(`❌ ${err.message}`);
        }
    }
};
