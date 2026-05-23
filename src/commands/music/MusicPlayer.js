import {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection,
} from '@discordjs/voice';
import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} from 'discord.js';
import playdl from 'play-dl';

// Holds one MusicPlayer per guild
const players = new Map();

export function getPlayer(guildId) {
    return players.get(guildId);
}

export function createPlayer(guildId, guild) {
    const player = new MusicPlayer(guildId, guild);
    players.set(guildId, player);
    return player;
}

export function destroyPlayer(guildId) {
    const player = players.get(guildId);
    if (player) {
        player.cleanup();
        players.delete(guildId);
    }
}

// ─── Progress bar helper ────────────────────────────────────────────────────
function buildProgressBar(current, total, length = 20) {
    if (!total || total === 0) return '─'.repeat(length);
    const filled = Math.round((current / total) * length);
    const empty = length - filled;
    return '▬'.repeat(filled) + '🔘' + '─'.repeat(Math.max(0, empty - 1));
}

function formatDuration(seconds) {
    if (!seconds) return '◉ LIVE';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Button rows ─────────────────────────────────────────────────────────────
function buildButtons(paused, loopMode, volume) {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music_shuffle')
            .setEmoji('🔀')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('music_previous')
            .setEmoji('⏮')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('music_playpause')
            .setEmoji(paused ? '▶️' : '⏸')
            .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('music_skip')
            .setEmoji('⏭')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('music_loop')
            .setEmoji('🔁')
            .setStyle(
                loopMode === 'none' ? ButtonStyle.Secondary :
                loopMode === 'song' ? ButtonStyle.Success :
                ButtonStyle.Primary
            ),
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music_voldown')
            .setEmoji('🔉')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('music_stop')
            .setEmoji('⏹')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('music_volup')
            .setEmoji('🔊')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('music_queue')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Secondary),
    );

    return [row1, row2];
}

// ─── MusicPlayer class ───────────────────────────────────────────────────────
export class MusicPlayer {
    constructor(guildId, guild) {
        this.guildId = guildId;
        this.guild = guild;
        this.queue = [];
        this.history = [];
        this.current = null;
        this.paused = false;
        this.loopMode = 'none'; // 'none' | 'song' | 'queue'
        this.volume = 80;
        this.audioPlayer = createAudioPlayer();
        this.connection = null;
        this.nowPlayingMessage = null;
        this.textChannel = null;
        this.startedAt = null;
        this.pausedAt = null;
        this.pausedDuration = 0;
        this._progressInterval = null;

        this.audioPlayer.on(AudioPlayerStatus.Idle, () => this._onSongEnd());
        this.audioPlayer.on('error', err => {
            console.error(`[Music] Audio player error: ${err.message}`);
            this._onSongEnd();
        });
    }

    // ── Join voice channel ───────────────────────────────────────────────────
    async join(voiceChannel) {
        this.connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: this.guildId,
            adapterCreator: this.guild.voiceAdapterCreator,
            selfDeaf: true,
        });

        try {
            await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
        } catch {
            this.connection.destroy();
            throw new Error('Could not connect to voice channel in time.');
        }

        this.connection.subscribe(this.audioPlayer);

        this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch {
                destroyPlayer(this.guildId);
            }
        });
    }

    // ── Add song to queue ────────────────────────────────────────────────────
    async addSong(query, requestedBy) {
        let songInfo;

        if (playdl.yt_validate(query) === 'video') {
            const info = await playdl.video_info(query);
            const d = info.video_details;
            songInfo = {
                title: d.title,
                url: d.url,
                thumbnail: d.thumbnails?.[0]?.url ?? null,
                duration: d.durationInSec,
                requestedBy,
            };
        } else if (playdl.yt_validate(query) === 'playlist') {
            throw new Error('Use /playlist to add playlists.');
        } else {
            const results = await playdl.search(query, { limit: 1, source: { youtube: 'video' } });
            if (!results.length) throw new Error('No results found.');
            const v = results[0];
            songInfo = {
                title: v.title,
                url: v.url,
                thumbnail: v.thumbnails?.[0]?.url ?? null,
                duration: v.durationInSec,
                requestedBy,
            };
        }

        this.queue.push(songInfo);
        return songInfo;
    }

    // ── Add YouTube playlist ─────────────────────────────────────────────────
    async addPlaylist(url, requestedBy) {
        const playlist = await playdl.playlist_info(url, { incomplete: true });
        if (!playlist) throw new Error('Could not fetch playlist.');
        const videos = await playlist.all_videos();
        for (const v of videos) {
            this.queue.push({
                title: v.title,
                url: v.url,
                thumbnail: v.thumbnails?.[0]?.url ?? null,
                duration: v.durationInSec,
                requestedBy,
            });
        }
        return { name: playlist.title, count: videos.length };
    }

    // ── Start playing ────────────────────────────────────────────────────────
    async play(textChannel) {
        if (textChannel) this.textChannel = textChannel;
        if (!this.queue.length) return;

        this.current = this.queue.shift();
        this.startedAt = Date.now();
        this.pausedAt = null;
        this.pausedDuration = 0;

        const stream = await playdl.stream(this.current.url, { quality: 2 });
        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
            inlineVolume: true,
        });
        resource.volume?.setVolume(this.volume / 100);
        this._resource = resource;

        this.audioPlayer.play(resource);
        await this._updateNowPlaying();
        this._startProgressUpdater();
    }

    // ── Song ended ───────────────────────────────────────────────────────────
    async _onSongEnd() {
        this._stopProgressUpdater();

        if (this.loopMode === 'song' && this.current) {
            this.queue.unshift(this.current);
        } else if (this.loopMode === 'queue' && this.current) {
            this.queue.push(this.current);
        }

        if (this.current) this.history.push(this.current);
        this.current = null;

        if (this.queue.length) {
            await this.play();
        } else {
            await this._showEndedEmbed();
            setTimeout(() => destroyPlayer(this.guildId), 300_000); // leave after 5 min
        }
    }

    // ── Skip ─────────────────────────────────────────────────────────────────
    skip() {
        if (this.loopMode === 'song') this.loopMode = 'none';
        this.audioPlayer.stop();
    }

    // ── Previous ─────────────────────────────────────────────────────────────
    async previous() {
        if (!this.history.length) return false;
        const prev = this.history.pop();
        if (this.current) this.queue.unshift(this.current);
        this.queue.unshift(prev);
        this.audioPlayer.stop(true);
        await this.play();
        return true;
    }

    // ── Pause / Resume ───────────────────────────────────────────────────────
    togglePause() {
        if (this.paused) {
            this.audioPlayer.unpause();
            if (this.pausedAt) this.pausedDuration += Date.now() - this.pausedAt;
            this.pausedAt = null;
            this.paused = false;
        } else {
            this.audioPlayer.pause();
            this.pausedAt = Date.now();
            this.paused = true;
        }
        this._updateNowPlaying();
    }

    // ── Volume ───────────────────────────────────────────────────────────────
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(100, vol));
        this._resource?.volume?.setVolume(this.volume / 100);
        this._updateNowPlaying();
    }

    // ── Loop ─────────────────────────────────────────────────────────────────
    cycleLoop() {
        const modes = ['none', 'song', 'queue'];
        const idx = modes.indexOf(this.loopMode);
        this.loopMode = modes[(idx + 1) % modes.length];
        this._updateNowPlaying();
        return this.loopMode;
    }

    // ── Shuffle ──────────────────────────────────────────────────────────────
    shuffle() {
        for (let i = this.queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
        }
        this._updateNowPlaying();
    }

    // ── Stop ─────────────────────────────────────────────────────────────────
    stop() {
        this._stopProgressUpdater();
        this.queue = [];
        this.loopMode = 'none';
        this.audioPlayer.stop(true);
        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
        }
    }

    // ── Remove from queue ────────────────────────────────────────────────────
    remove(index) {
        if (index < 1 || index > this.queue.length) return null;
        return this.queue.splice(index - 1, 1)[0];
    }

    // ── Elapsed time ─────────────────────────────────────────────────────────
    getElapsed() {
        if (!this.startedAt) return 0;
        const now = Date.now();
        const pausedExtra = this.pausedAt ? now - this.pausedAt : 0;
        return Math.floor((now - this.startedAt - this.pausedDuration - pausedExtra) / 1000);
    }

    // ── Build Now Playing embed ──────────────────────────────────────────────
    _buildNowPlayingEmbed() {
        if (!this.current) return null;

        const elapsed = this.getElapsed();
        const total = this.current.duration;
        const bar = buildProgressBar(elapsed, total);
        const loopLabel = this.loopMode === 'song' ? '🔂 Song' : this.loopMode === 'queue' ? '🔁 Queue' : '➡️ Off';

        const embed = new EmbedBuilder()
            .setColor('#7289DA')
            .setTitle('🎵 Now Playing')
            .setDescription(`**[${this.current.title}](${this.current.url})**`)
            .addFields(
                {
                    name: `${formatDuration(elapsed)} ${bar} ${formatDuration(total)}`,
                    value: `🔊 Volume: **${this.volume}%**  •  Loop: **${loopLabel}**  •  Queue: **${this.queue.length} song${this.queue.length !== 1 ? 's' : ''}**`,
                },
                { name: 'Requested by', value: `<@${this.current.requestedBy}>`, inline: true },
            )
            .setTimestamp();

        if (this.current.thumbnail) embed.setThumbnail(this.current.thumbnail);
        if (this.paused) embed.setFooter({ text: '⏸ Paused' });

        return embed;
    }

    // ── Send / update the Now Playing message ────────────────────────────────
    async _updateNowPlaying() {
        const embed = this._buildNowPlayingEmbed();
        if (!embed || !this.textChannel) return;

        const components = buildButtons(this.paused, this.loopMode, this.volume);

        try {
            if (this.nowPlayingMessage) {
                await this.nowPlayingMessage.edit({ embeds: [embed], components });
            } else {
                this.nowPlayingMessage = await this.textChannel.send({ embeds: [embed], components });
                this._listenToButtons();
            }
        } catch {
            this.nowPlayingMessage = null;
        }
    }

    async _showEndedEmbed() {
        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('⏹ Queue Ended')
            .setDescription('Nothing left to play. Use `/play` to add more songs!')
            .setTimestamp();

        try {
            if (this.nowPlayingMessage) {
                await this.nowPlayingMessage.edit({ embeds: [embed], components: [] });
            } else if (this.textChannel) {
                await this.textChannel.send({ embeds: [embed] });
            }
        } catch { /* ignore */ }
    }

    // ── Live progress updater (every 15s) ────────────────────────────────────
    _startProgressUpdater() {
        this._stopProgressUpdater();
        this._progressInterval = setInterval(() => {
            if (!this.paused) this._updateNowPlaying();
        }, 15_000);
    }

    _stopProgressUpdater() {
        if (this._progressInterval) {
            clearInterval(this._progressInterval);
            this._progressInterval = null;
        }
    }

    // ── Button interaction collector ─────────────────────────────────────────
    _listenToButtons() {
        if (!this.nowPlayingMessage) return;

        const collector = this.nowPlayingMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 24 * 60 * 60 * 1000, // 24 hours
        });

        collector.on('collect', async (interaction) => {
            await interaction.deferUpdate();

            switch (interaction.customId) {
                case 'music_playpause': this.togglePause(); break;
                case 'music_skip':      this.skip(); break;
                case 'music_stop':      this.stop(); destroyPlayer(this.guildId); break;
                case 'music_shuffle':   this.shuffle(); break;
                case 'music_loop':      this.cycleLoop(); break;
                case 'music_previous':  await this.previous(); break;
                case 'music_volup':     this.setVolume(this.volume + 10); break;
                case 'music_voldown':   this.setVolume(this.volume - 10); break;
                case 'music_queue': {
                    const queueEmbed = this._buildQueueEmbed();
                    await interaction.followUp({ embeds: [queueEmbed], ephemeral: true });
                    break;
                }
            }
        });

        collector.on('end', () => {
            // Collector expired — disable buttons
            if (this.nowPlayingMessage) {
                this.nowPlayingMessage.edit({ components: [] }).catch(() => {});
            }
        });
    }

    // ── Queue embed ──────────────────────────────────────────────────────────
    _buildQueueEmbed() {
        const embed = new EmbedBuilder()
            .setColor('#7289DA')
            .setTitle('📋 Queue');

        if (!this.queue.length) {
            embed.setDescription('The queue is empty.');
        } else {
            const display = this.queue.slice(0, 15).map((s, i) =>
                `**${i + 1}.** [${s.title}](${s.url}) — ${formatDuration(s.duration)} — <@${s.requestedBy}>`
            );
            if (this.queue.length > 15) display.push(`\n*...and ${this.queue.length - 15} more*`);
            embed.setDescription(display.join('\n'));
        }

        if (this.current) {
            embed.addFields({ name: 'Now Playing', value: `🎵 ${this.current.title}` });
        }

        return embed;
    }

    // ── Cleanup ──────────────────────────────────────────────────────────────
    cleanup() {
        this._stopProgressUpdater();
        if (this.connection) {
            try { this.connection.destroy(); } catch { /* ignore */ }
        }
        if (this.nowPlayingMessage) {
            this.nowPlayingMessage.edit({ components: [] }).catch(() => {});
        }
    }
}
