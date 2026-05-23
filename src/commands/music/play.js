import { SlashCommandBuilder } from 'discord.js';
import { getPlayer, createPlayer } from '../../utils/MusicPlayer.js';

export default {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song or YouTube URL')
        .addStringOption(o =>
            o.setName('query')
                .setDescription('Song name or YouTube URL')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.editReply('❌ You need to be in a voice channel!');
        }

        const perms = voiceChannel.permissionsFor(interaction.client.user);
        if (!perms.has('Connect') || !perms.has('Speak')) {
            return interaction.editReply('❌ I need Connect and Speak permissions in that channel.');
        }

        const query = interaction.options.getString('query');

        let player = getPlayer(interaction.guild.id);
        if (!player) {
            player = createPlayer(interaction.guild.id, interaction.guild);
            await player.join(voiceChannel);
        }

        try {
            const song = await player.addSong(query, interaction.user.id);
            const wasIdle = !player.current;

            if (wasIdle) {
                await player.play(interaction.channel);
                await interaction.editReply(`✅ Now playing **${song.title}**`);
            } else {
                await interaction.editReply(`✅ Added **${song.title}** to the queue (position #${player.queue.length})`);
            }
        } catch (err) {
            await interaction.editReply(`❌ ${err.message}`);
        }
    }
};
