import { SlashCommandBuilder } from 'discord.js';
import { getPlayer, createPlayer, destroyPlayer } from './modules/MusicPlayer.js';

export default {
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('Music player controls')

        // /music play [query]
        .addSubcommand(sub =>
            sub.setName('play')
                .setDescription('Play a song by name or YouTube URL')
                .addStringOption(o =>
                    o.setName('query')
                        .setDescription('Song name or YouTube URL')
                        .setRequired(true)
                )
        )

        // /music playlist [url]
        .addSubcommand(sub =>
            sub.setName('playlist')
                .setDescription('Load a full YouTube playlist into the queue')
                .addStringOption(o =>
                    o.setName('url')
                        .setDescription('YouTube playlist URL')
                        .setRequired(true)
                )
        )

        // /music skip
        .addSubcommand(sub =>
            sub.setName('skip')
                .setDescription('Skip the current song')
        )

        // /music stop
        .addSubcommand(sub =>
            sub.setName('stop')
                .setDescription('Stop music and leave the voice channel')
        )

        // /music pause
        .addSubcommand(sub =>
            sub.setName('pause')
                .setDescription('Pause or resume the current song')
        )

        // /music nowplaying
        .addSubcommand(sub =>
            sub.setName('nowplaying')
                .setDescription('Show what is currently playing')
        )

        // /music queue
        .addSubcommand(sub =>
            sub.setName('queue')
                .setDescription('Show the current music queue')
        )

        // /music volume [level]
        .addSubcommand(sub =>
            sub.setName('volume')
                .setDescription('Set the playback volume')
                .addIntegerOption(o =>
                    o.setName('level')
                        .setDescription('Volume level (0-100)')
                        .setMinValue(0)
                        .setMaxValue(100)
                        .setRequired(true)
                )
        )

        // /music loop
        .addSubcommand(sub =>
            sub.setName('loop')
                .setDescription('Cycle loop mode: Off → Song → Queue → Off')
        )

        // /music shuffle
        .addSubcommand(sub =>
            sub.setName('shuffle')
                .setDescription('Shuffle the music queue')
        )

        // /music remove [position]
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a song from the queue by position')
                .addIntegerOption(o =>
                    o.setName('position')
                        .setDescription('Position in the queue (use /music queue to see positions)')
                        .setMinValue(1)
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        // ── Helper: require voice channel ─────────────────────────────────────
        const requireVoice = () => {
            const vc = interaction.member.voice.channel;
            if (!vc) {
                interaction.reply({ content: '❌ You need to be in a voice channel!', flags: 64 });
                return null;
            }
            return vc;
        };

        // ── Helper: require active player ─────────────────────────────────────
        const requirePlayer = () => {
            const p = getPlayer(interaction.guild.id);
            if (!p?.current) {
                interaction.reply({ content: '❌ Nothing is playing right now.', flags: 64 });
                return null;
            }
            return p;
        };

        // ── /music play ───────────────────────────────────────────────────────
        if (sub === 'play') {
            await interaction.deferReply({ flags: 64 });

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
                try {
                    await player.join(voiceChannel);
                } catch (err) {
                    destroyPlayer(interaction.guild.id);
                    return interaction.editReply(`❌ ${err.message}`);
                }
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
                const msg = err.message?.includes('429')
                    ? '⚠️ YouTube is rate limiting the bot. Please wait a minute and try again.'
                    : `❌ ${err.message}`;
                await interaction.editReply(msg);
            }
            return;
        }

        // ── /music playlist ───────────────────────────────────────────────────
        if (sub === 'playlist') {
            await interaction.deferReply({ flags: 64 });

            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) return interaction.editReply('❌ You need to be in a voice channel!');

            const url = interaction.options.getString('url');
            let player = getPlayer(interaction.guild.id);

            if (!player) {
                player = createPlayer(interaction.guild.id, interaction.guild);
                try {
                    await player.join(voiceChannel);
                } catch (err) {
                    destroyPlayer(interaction.guild.id);
                    return interaction.editReply(`❌ ${err.message}`);
                }
            }

            try {
                const result = await player.addPlaylist(url, interaction.user.id);
                const wasIdle = !player.current;
                if (wasIdle) await player.play(interaction.channel);
                await interaction.editReply(`✅ Loaded **${result.count} songs** from **${result.name}**!`);
            } catch (err) {
                await interaction.editReply(`❌ ${err.message}`);
            }
            return;
        }

        // ── /music skip ───────────────────────────────────────────────────────
        if (sub === 'skip') {
            const player = requirePlayer();
            if (!player) return;
            player.skip();
            return interaction.reply({ content: '⏭ Skipped!', flags: 64 });
        }

        // ── /music stop ───────────────────────────────────────────────────────
        if (sub === 'stop') {
            const player = getPlayer(interaction.guild.id);
            if (!player) return interaction.reply({ content: '❌ Nothing is playing right now.', flags: 64 });
            player.stop();
            destroyPlayer(interaction.guild.id);
            return interaction.reply({ content: '⏹ Stopped and left the voice channel.', flags: 64 });
        }

        // ── /music pause ──────────────────────────────────────────────────────
        if (sub === 'pause') {
            const player = requirePlayer();
            if (!player) return;
            player.togglePause();
            return interaction.reply({ content: player.paused ? '⏸ Paused.' : '▶️ Resumed.', flags: 64 });
        }

        // ── /music nowplaying ─────────────────────────────────────────────────
        if (sub === 'nowplaying') {
            const player = requirePlayer();
            if (!player) return;
            const embed = player._buildNowPlayingEmbed();
            return interaction.reply({ embeds: [embed], flags: 64 });
        }

        // ── /music queue ──────────────────────────────────────────────────────
        if (sub === 'queue') {
            const player = getPlayer(interaction.guild.id);
            if (!player) return interaction.reply({ content: '❌ Nothing is playing right now.', flags: 64 });
            const embed = player._buildQueueEmbed();
            return interaction.reply({ embeds: [embed], flags: 64 });
        }

        // ── /music volume ─────────────────────────────────────────────────────
        if (sub === 'volume') {
            const player = requirePlayer();
            if (!player) return;
            const level = interaction.options.getInteger('level');
            player.setVolume(level);
            return interaction.reply({ content: `🔊 Volume set to **${level}%**`, flags: 64 });
        }

        // ── /music loop ───────────────────────────────────────────────────────
        if (sub === 'loop') {
            const player = requirePlayer();
            if (!player) return;
            const mode = player.cycleLoop();
            const label = mode === 'none' ? '➡️ Off' : mode === 'song' ? '🔂 Song' : '🔁 Queue';
            return interaction.reply({ content: `Loop mode set to: **${label}**`, flags: 64 });
        }

        // ── /music shuffle ────────────────────────────────────────────────────
        if (sub === 'shuffle') {
            const player = getPlayer(interaction.guild.id);
            if (!player || !player.queue.length) {
                return interaction.reply({ content: '❌ The queue is empty.', flags: 64 });
            }
            player.shuffle();
            return interaction.reply({ content: '🔀 Queue shuffled!', flags: 64 });
        }

        // ── /music remove ─────────────────────────────────────────────────────
        if (sub === 'remove') {
            const player = getPlayer(interaction.guild.id);
            if (!player || !player.queue.length) {
                return interaction.reply({ content: '❌ The queue is empty.', flags: 64 });
            }
            const pos = interaction.options.getInteger('position');
            const removed = player.remove(pos);
            if (!removed) {
                return interaction.reply({ content: `❌ No song at position ${pos}.`, flags: 64 });
            }
            return interaction.reply({ content: `🗑️ Removed **${removed.title}** from the queue.`, flags: 64 });
        }
    }
};
