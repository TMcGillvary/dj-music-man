"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const discord_js_1 = (0, tslib_1.__importStar)(require("discord.js"));
const voice_1 = require("@discordjs/voice");
const track_1 = require("./music/track");
const subscription_1 = require("./music/subscription");
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const { token } = require('../auth.json');
const client = new discord_js_1.default.Client({ intents: ['GUILD_VOICE_STATES', 'GUILD_MESSAGES', 'GUILDS'] });
client.on('ready', () => console.log('Ready!'));
// This contains the setup code for creating slash commands in a guild. The owner of the bot can send "!deploy" to create them.
client.on('messageCreate', async (message) => {
    if (!message.guild)
        return;
    if (!client.application?.owner)
        await client.application?.fetch();
    if (message.content.toLowerCase() === '!deploy' && message.author.id === client.application?.owner?.id) {
        await message.guild.commands.set([
            {
                name: 'play',
                description: 'Plays a song',
                options: [
                    {
                        name: 'song',
                        type: 'STRING',
                        description: 'The URL of the song to play',
                        required: true,
                    },
                ],
            },
            {
                name: 'skip',
                description: 'Skip to the next song in the queue',
            },
            {
                name: 'queue',
                description: 'See the music queue',
            },
            {
                name: 'pause',
                description: 'Pauses the song that is currently playing',
            },
            {
                name: 'resume',
                description: 'Resume playback of the current song',
            },
            {
                name: 'leave',
                description: 'Leave the voice channel',
            },
        ]);
        await message.reply('Deployed!');
    }
});
/**
 * Maps guild IDs to music subscriptions, which exist if the bot has an active VoiceConnection to the guild.
 */
const subscriptions = new Map();
// Handles slash command interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand() || !interaction.guildId)
        return;
    let subscription = subscriptions.get(interaction.guildId);
    if (interaction.commandName === 'play') {
        await interaction.deferReply();
        // Extract the video URL from the command
        const url = interaction.options.get('song').value;
        // If a connection to the guild doesn't already exist and the user is in a voice channel, join that channel
        // and create a subscription.
        if (!subscription) {
            if (interaction.member instanceof discord_js_1.GuildMember && interaction.member.voice.channel) {
                const channel = interaction.member.voice.channel;
                subscription = new subscription_1.MusicSubscription((0, voice_1.joinVoiceChannel)({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                }));
                subscription.voiceConnection.on('error', console.warn);
                subscriptions.set(interaction.guildId, subscription);
            }
        }
        // If there is no subscription, tell the user they need to join a channel.
        if (!subscription) {
            await interaction.followUp('Join a voice channel and then try that again!');
            return;
        }
        // Make sure the connection is ready before processing the user's request
        try {
            await (0, voice_1.entersState)(subscription.voiceConnection, voice_1.VoiceConnectionStatus.Ready, 20e3);
        }
        catch (error) {
            console.warn(error);
            await interaction.followUp('Failed to join voice channel within 20 seconds, please try again later!');
            return;
        }
        try {
            // Attempt to create a Track from the user's video URL
            const track = await track_1.Track.from(url, {
                onStart() {
                    console.log("Successfully playing next song");
                    interaction.followUp({ content: 'Now playing!', ephemeral: true }).catch(console.warn);
                },
                onFinish() {
                    interaction.followUp({ content: 'Now finished!', ephemeral: true }).catch(console.warn);
                },
                onError(error) {
                    console.warn(error);
                    interaction.followUp({ content: `Error: ${error.message}`, ephemeral: true }).catch(console.warn);
                },
            });
            // Enqueue the track and reply a success message to the user
            subscription.enqueue(track);
            console.log("Successfully added next track to queue");
            await interaction.followUp(`Enqueued **${track.title}**`);
        }
        catch (error) {
            console.warn(error);
            await interaction.followUp('Failed to play track, please try again later!');
        }
    }
    else if (interaction.commandName === 'skip') {
        if (subscription) {
            // Calling .stop() on an AudioPlayer causes it to transition into the Idle state. Because of a state transition
            // listener defined in music/subscription.ts, transitions into the Idle state mean the next track from the queue
            // will be loaded and played.
            subscription.audioPlayer.stop();
            console.log("Skipping song...");
            await interaction.reply('Skipped song!');
        }
        else {
            await interaction.reply('Not playing in this server!');
        }
    }
    else if (interaction.commandName === 'queue') {
        // Print out the current queue, including up to the next 5 tracks to be played.
        if (subscription) {
            const current = subscription.audioPlayer.state.status === voice_1.AudioPlayerStatus.Idle
                ? `Nothing is currently playing!`
                : `Playing **${subscription.audioPlayer.state.resource.metadata.title}**`;
            const queue = subscription.queue
                .slice(0, 5)
                .map((track, index) => `${index + 1}) ${track.title}`)
                .join('\n');
            await interaction.reply(`${current}\n\n${queue}`);
        }
        else {
            await interaction.reply('Not playing in this server!');
        }
    }
    else if (interaction.commandName === 'pause') {
        if (subscription) {
            subscription.audioPlayer.pause();
            await interaction.reply({ content: `Paused!`, ephemeral: true });
        }
        else {
            await interaction.reply('Not playing in this server!');
        }
    }
    else if (interaction.commandName === 'resume') {
        if (subscription) {
            subscription.audioPlayer.unpause();
            await interaction.reply({ content: `Unpaused!`, ephemeral: true });
        }
        else {
            await interaction.reply('Not playing in this server!');
        }
    }
    else if (interaction.commandName === 'leave') {
        if (subscription) {
            subscription.voiceConnection.destroy();
            subscriptions.delete(interaction.guildId);
            await interaction.reply({ content: `Left channel!`, ephemeral: true });
        }
        else {
            await interaction.reply('Not playing in this server!');
        }
    }
    else {
        await interaction.reply('Unknown command');
    }
});
client.on('error', console.warn);
void client.login(token);
//# sourceMappingURL=bot.js.map