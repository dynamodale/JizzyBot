import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getPlayer, destroyPlayer } from '../../utils/MusicPlayer.js';

function noPlayer(interaction) {
    return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
}

// ── /skip ────────────────────────────────────────────────────────────────────
export const skipData = new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song');

export async function skipExecute(interaction) {
    const player = getPlayer(interaction.guild.id);
    if (!player?.current) return noPlayer(interaction);
    player.skip();
    await interaction.reply({ content: '⏭ Skipped!', ephemeral: true });
}

// ── /stop ────────────────────────────────────────────────────────────────────
export const stopData = new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop music and leave the voice channel');

export async function stopExecute(interaction) {
    const player = getPlayer(interaction.guild.id);
    if (!player) return noPlayer(interaction);
    player.stop();
    destroyPlayer(interaction.guild.id);
    await interaction.reply({ content: '⏹ Stopped and left the voice channel.', ephemeral: true });
}

// ── /pause ───────────────────────────────────────────────────────────────────
export const pauseData = new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause or resume the current song');

export async function pauseExecute(interaction) {
    const player = getPlayer(interaction.guild.id);
    if (!player?.current) return noPlayer(interaction);
    player.togglePause();
    await interaction.reply({ content: player.paused ? '⏸ Paused.' : '▶️ Resumed.', ephemeral: true });
}

// ── /nowplaying ───────────────────────────────────────────────────────────────
export const nowplayingData = new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the current song');

export async function nowplayingExecute(interaction) {
    const player = getPlayer(interaction.guild.id);
    if (!player?.current) return noPlayer(interaction);
    const embed = player._buildNowPlayingEmbed();
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ── /queue ────────────────────────────────────────────────────────────────────
export const queueData = new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current queue');

export async function queueExecute(interaction) {
    const player = getPlayer(interaction.guild.id);
    if (!player) return noPlayer(interaction);
    const embed = player._buildQueueEmbed();
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ── /volume ───────────────────────────────────────────────────────────────────
export const volumeData = new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the volume (0–100)')
    .addIntegerOption(o =>
        o.setName('level')
            .setDescription('Volume level (0–100)')
            .setMinValue(0)
            .setMaxValue(100)
            .setRequired(true)
    );

export async function volumeExecute(interaction) {
    const player = getPlayer(interaction.guild.id);
    if (!player?.current) return noPlayer(interaction);
    const level = interaction.options.getInteger('level');
    player.setVolume(level);
    await interaction.reply({ content: `🔊 Volume set to **${level}%**`, ephemeral: true });
}

// ── /loop ─────────────────────────────────────────────────────────────────────
export const loopData = new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Cycle loop mode: off → song → queue');

export async function loopExecute(interaction) {
    const player = getPlayer(interaction.guild.id);
    if (!player?.current) return noPlayer(interaction);
    const mode = player.cycleLoop();
    const label = mode === 'none' ? '➡️ Off' : mode === 'song' ? '🔂 Song' : '🔁 Queue';
    await interaction.reply({ content: `Loop mode: **${label}**`, ephemeral: true });
}

// ── /shuffle ──────────────────────────────────────────────────────────────────
export const shuffleData = new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the queue');

export async function shuffleExecute(interaction) {
    const player = getPlayer(interaction.guild.id);
    if (!player || !player.queue.length) {
        return interaction.reply({ content: '❌ The queue is empty.', ephemeral: true });
    }
    player.shuffle();
    await interaction.reply({ content: '🔀 Queue shuffled!', ephemeral: true });
}

// ── /remove ───────────────────────────────────────────────────────────────────
export const removeData = new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a song from the queue by position')
    .addIntegerOption(o =>
        o.setName('position')
            .setDescription('Position in the queue (use /queue to see positions)')
            .setMinValue(1)
            .setRequired(true)
    );

export async function removeExecute(interaction) {
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
