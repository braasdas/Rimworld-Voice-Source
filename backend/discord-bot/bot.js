require('dotenv').config({ path: '../.env' });

const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');
const db = require('../services/database');
const keyPoolManager = require('../services/keyPoolManager');

// Discord Bot Configuration
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!DISCORD_TOKEN) {
    console.error('❌ Error: DISCORD_BOT_TOKEN is missing in .env file');
    process.exit(1);
}
const CLIENT_ID = '1437411061560250430'; // Extract from token

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Command definitions
const commands = [
    new SlashCommandBuilder()
        .setName('redeem')
        .setDescription('Redeem an ElevenLabs API key')
        .addStringOption(option =>
            option.setName('key')
                .setDescription('Your ElevenLabs API key')
                .setRequired(true)
        )
        .toJSON(),
    
    new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View key pool statistics')
        .toJSON()
];

// Register slash commands
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔄 Registering slash commands...');
        
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        
        console.log('✅ Slash commands registered successfully!');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
})();

/**
 * Test if an ElevenLabs API key is valid
 * @param {string} apiKey - The API key to test
 * @returns {Promise<Object>} - Key info if valid, throws error if invalid
 */
async function testElevenLabsKey(apiKey) {
    try {
        const response = await axios.get('https://api.elevenlabs.io/v1/user/subscription', {
            headers: {
                'xi-api-key': apiKey
            },
            timeout: 10000
        });
        
        if (response.status === 200 && response.data) {
            return {
                valid: true,
                tier: response.data.tier || 'unknown',
                character_count: response.data.character_count || 0,
                character_limit: response.data.character_limit || 0,
                can_extend_character_limit: response.data.can_extend_character_limit || false,
                allowed_to_extend_character_limit: response.data.allowed_to_extend_character_limit || false,
                next_character_count_reset_unix: response.data.next_character_count_reset_unix || null
            };
        } else {
            throw new Error('Invalid API response');
        }
    } catch (error) {
        if (error.response) {
            // API returned an error response
            const status = error.response.status;
            const message = error.response.data?.detail?.message || error.response.data?.message || 'Unknown error';
            
            if (status === 401) {
                throw new Error('Invalid API key - authentication failed');
            } else if (status === 429) {
                throw new Error('Rate limit exceeded - key may be valid but temporarily blocked');
            } else {
                throw new Error(`API error (${status}): ${message}`);
            }
        } else if (error.code === 'ECONNABORTED') {
            throw new Error('Request timeout - ElevenLabs API is not responding');
        } else {
            throw new Error(`Network error: ${error.message}`);
        }
    }
}

/**
 * Add a new ElevenLabs key to the database
 * @param {string} apiKey - The API key
 * @param {Object} keyInfo - Information about the key from ElevenLabs
 * @param {string} submittedBy - Discord user who submitted it
 * @returns {Promise<Object>} - The created key record
 */
async function addKeyToDatabase(apiKey, keyInfo, submittedBy) {
    // Generate a unique key name
    const keyName = `discord_${submittedBy}_${Date.now()}`;
    
    // Determine tier and quota based on subscription info
    let tier = 'promo_starter';
    let monthly_quota = 30000;
    let cost_per_char = 0.00015;
    
    // Map ElevenLabs tier to our internal tier
    const tierMapping = {
        'free': { tier: 'promo_starter', quota: 10000, cost: 0.00000 },
        'starter': { tier: 'promo_starter', quota: 30000, cost: 0.00030 },
        'creator': { tier: 'creator', quota: 100000, cost: 0.00018 },
        'pro': { tier: 'pro', quota: 500000, cost: 0.00016 },
        'scale': { tier: 'scale', quota: 2000000, cost: 0.00011 },
        'business': { tier: 'business', quota: 11000000, cost: 0.00009 }
    };
    
    const tierLower = keyInfo.tier.toLowerCase();
    if (tierMapping[tierLower]) {
        tier = tierMapping[tierLower].tier;
        monthly_quota = keyInfo.character_limit || tierMapping[tierLower].quota;
        cost_per_char = tierMapping[tierLower].cost;
    }
    
    // Calculate quota reset date (when the key's subscription renews)
    let quota_reset_date = null;
    if (keyInfo.next_character_count_reset_unix) {
        quota_reset_date = new Date(keyInfo.next_character_count_reset_unix * 1000).toISOString().split('T')[0];
    } else {
        // Default to next month, same day as today
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        quota_reset_date = nextMonth.toISOString().split('T')[0];
    }
    
    // Calculate characters used this month
    const quota_used_this_month = Math.max(0, keyInfo.character_limit - keyInfo.character_count);
    
    try {
        const result = await db.query(`
            INSERT INTO elevenlabs_keys (
                key_name, 
                api_key, 
                tier, 
                cost_per_char, 
                monthly_quota, 
                quota_used_this_month,
                quota_reset_date,
                priority, 
                status, 
                health_score,
                notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, key_name, tier, monthly_quota, created_at
        `, [
            keyName,
            apiKey,
            tier,
            cost_per_char,
            monthly_quota,
            quota_used_this_month,
            quota_reset_date,
            5, // Default priority
            'active',
            100.0,
            `Added via Discord by ${submittedBy}. Original tier: ${keyInfo.tier}`
        ]);
        
        // Invalidate key pool cache
        keyPoolManager.invalidateCache();
        
        return result.rows[0];
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            throw new Error('This API key has already been added to the pool');
        }
        throw error;
    }
}

/**
 * Send a Discord notification about a new key
 * @param {Object} keyRecord - The database record of the new key
 * @param {Object} keyInfo - ElevenLabs subscription info
 * @param {string} submittedBy - Discord user who submitted it
 */
async function sendDiscordNotification(keyRecord, keyInfo, submittedBy) {
    try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (!webhookUrl) return;
        
        const charactersRemaining = keyInfo.character_count || 0;
        const percentUsed = keyInfo.character_limit > 0 
            ? ((keyInfo.character_limit - charactersRemaining) / keyInfo.character_limit * 100).toFixed(1)
            : 0;
        
        const embed = {
            title: '🎉 New ElevenLabs Key Added!',
            description: `A new API key has been successfully redeemed and added to the pool.`,
            color: 3066993, // Green
            timestamp: new Date().toISOString(),
            fields: [
                {
                    name: '👤 Submitted By',
                    value: submittedBy,
                    inline: true
                },
                {
                    name: '🏷️ Key Name',
                    value: keyRecord.key_name,
                    inline: true
                },
                {
                    name: '⭐ Tier',
                    value: keyInfo.tier.toUpperCase(),
                    inline: true
                },
                {
                    name: '📊 Monthly Quota',
                    value: keyRecord.monthly_quota.toLocaleString() + ' characters',
                    inline: true
                },
                {
                    name: '📈 Characters Remaining',
                    value: `${charactersRemaining.toLocaleString()} (${(100 - percentUsed).toFixed(1)}%)`,
                    inline: true
                },
                {
                    name: '🔄 Quota Resets',
                    value: keyInfo.next_character_count_reset_unix 
                        ? `<t:${keyInfo.next_character_count_reset_unix}:R>`
                        : 'Unknown',
                    inline: true
                }
            ],
            footer: {
                text: 'Thank you for contributing to Colonist Voices!'
            }
        };
        
        await axios.post(webhookUrl, { embeds: [embed] });
    } catch (error) {
        console.error('Failed to send Discord notification:', error.message);
    }
}

// Event: Bot is ready
client.once('ready', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🤖 ELEVENLABS KEY REDEMPTION BOT ONLINE 🤖           ║
║                                                            ║
║  Bot: ${client.user.tag.padEnd(48)}║
║  Commands:                                                 ║
║    /redeem <key> - Redeem an ElevenLabs API key           ║
║    /stats - View key pool statistics                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
    
    // Set bot status
    client.user.setActivity('for /redeem commands', { type: 'WATCHING' });
});

// Event: Handle slash command interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName, user } = interaction;
    
    if (commandName === 'redeem') {
        // Defer reply since this might take a while
        await interaction.deferReply({ ephemeral: true });
        
        const apiKey = interaction.options.getString('key');
        const submittedBy = `${user.username}#${user.discriminator}`;
        
        try {
            // Step 1: Test the key with ElevenLabs API
            await interaction.editReply({
                content: '🔍 Testing API key validity...'
            });
            
            const keyInfo = await testElevenLabsKey(apiKey);
            
            if (!keyInfo.valid) {
                await interaction.editReply({
                    content: '❌ **Invalid API Key**\n\nThe key you provided is not valid. Please check and try again.'
                });
                return;
            }
            
            // Step 2: Add to database
            await interaction.editReply({
                content: '✅ **Key Valid!**\n🔄 Adding to database...'
            });
            
            const keyRecord = await addKeyToDatabase(apiKey, keyInfo, submittedBy);
            
            // Step 3: Send notification
            await sendDiscordNotification(keyRecord, keyInfo, submittedBy);
            
            // Step 4: Success message
            const charactersRemaining = keyInfo.character_count || 0;
            const percentRemaining = keyInfo.character_limit > 0
                ? ((charactersRemaining / keyInfo.character_limit) * 100).toFixed(1)
                : 0;
            
            await interaction.editReply({
                content: `✅ **Success!** Your ElevenLabs key has been added to the pool!\n\n` +
                        `**Key Details:**\n` +
                        `• **Tier:** ${keyInfo.tier.toUpperCase()}\n` +
                        `• **Monthly Quota:** ${keyRecord.monthly_quota.toLocaleString()} characters\n` +
                        `• **Characters Remaining:** ${charactersRemaining.toLocaleString()} (${percentRemaining}%)\n` +
                        `• **Database Name:** \`${keyRecord.key_name}\`\n\n` +
                        `Thank you for contributing! Your key will now be used to serve Colonist Voices users. 🎉`
            });
            
            console.log(`✅ New key added by ${submittedBy}: ${keyRecord.key_name} (${keyInfo.tier})`);
            
        } catch (error) {
            console.error('Error processing redemption:', error);
            
            await interaction.editReply({
                content: `❌ **Error:** ${error.message}\n\n` +
                        `If this key is valid and you believe this is a mistake, please contact an administrator.`
            });
        }
    }
    
    else if (commandName === 'stats') {
        await interaction.deferReply();
        
        try {
            const stats = await keyPoolManager.getStats();
            
            const totalQuota = parseInt(stats.total_quota_available) || 0;
            const usedQuota = parseInt(stats.total_quota_used) || 0;
            const remainingQuota = totalQuota - usedQuota;
            const quotaPercentage = totalQuota > 0 ? ((remainingQuota / totalQuota) * 100).toFixed(1) : 0;
            
            const avgHealth = parseFloat(stats.avg_health) || 0;
            let healthEmoji = '🟢';
            if (avgHealth < 50) healthEmoji = '🔴';
            else if (avgHealth < 75) healthEmoji = '🟡';
            
            await interaction.editReply({
                content: `📊 **ElevenLabs Key Pool Statistics**\n\n` +
                        `🔑 **Total Keys:** ${stats.total_keys}\n` +
                        `   • Active: ${stats.active_keys}\n` +
                        `   • Paused: ${stats.paused_keys}\n\n` +
                        `${healthEmoji} **Average Health:** ${avgHealth.toFixed(1)}%\n\n` +
                        `📦 **Quota This Month:**\n` +
                        `   • Total Available: ${totalQuota.toLocaleString()} characters\n` +
                        `   • Used: ${usedQuota.toLocaleString()} characters\n` +
                        `   • Remaining: ${remainingQuota.toLocaleString()} characters (${quotaPercentage}%)\n\n` +
                        `Use \`/redeem <key>\` to add a new ElevenLabs API key!`
            });
            
        } catch (error) {
            console.error('Error fetching stats:', error);
            await interaction.editReply({
                content: '❌ Failed to fetch key pool statistics. Please try again later.'
            });
        }
    }
});

// Event: Log all errors
client.on('error', error => {
    console.error('Discord client error:', error);
});

// Login to Discord
client.login(DISCORD_TOKEN)
    .then(() => {
        console.log('✓ Discord bot logged in successfully');
    })
    .catch(error => {
        console.error('Failed to login to Discord:', error);
        process.exit(1);
    });

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down bot...');
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down bot...');
    client.destroy();
    process.exit(0);
});
