/**
 * Test script to manually trigger public health stats
 * Run this to see what the Discord message will look like
 */

require('dotenv').config();
const axios = require('axios');
const keyPoolManager = require('./services/keyPoolManager');

async function testPublicHealthStats() {
    console.log('🧪 Testing public health stats Discord message...\n');

    try {
        const publicWebhookUrl = 'https://discord.com/api/webhooks/1437297954875510906/FUpUqWU0srzMDJ6Jtb0WK06apUOeLGCFIsKsrMohbm6_3SYgP46tNFQRFFkcUdSCru9c';
        
        // Get key pool stats
        const stats = await keyPoolManager.getStats();
        
        console.log('📊 Current Stats:');
        console.log(`   Total Keys: ${stats.total_keys}`);
        console.log(`   Active Keys: ${stats.active_keys}`);
        console.log(`   Paused Keys: ${stats.paused_keys}`);
        console.log(`   Average Health: ${parseFloat(stats.avg_health).toFixed(1)}%`);
        console.log(`   Total Quota Available: ${parseInt(stats.total_quota_available).toLocaleString()}`);
        console.log(`   Total Quota Used: ${parseInt(stats.total_quota_used).toLocaleString()}`);
        
        // Calculate leftover quota
        const totalQuota = parseInt(stats.total_quota_available) || 0;
        const usedQuota = parseInt(stats.total_quota_used) || 0;
        const leftoverQuota = totalQuota - usedQuota;
        const quotaPercentage = totalQuota > 0 ? ((leftoverQuota / totalQuota) * 100).toFixed(1) : 0;
        
        console.log(`   Leftover Quota: ${leftoverQuota.toLocaleString()} (${quotaPercentage}%)\n`);
        
        // Determine health emoji and color
        const avgHealth = parseFloat(stats.avg_health) || 0;
        let healthEmoji = '🟢';
        let embedColor = 5763719; // Green
        
        if (avgHealth < 50) {
            healthEmoji = '🔴';
            embedColor = 15158332; // Red
        } else if (avgHealth < 75) {
            healthEmoji = '🟡';
            embedColor = 16776960; // Yellow
        }
        
        const embed = {
            title: '📊 Colonist Voices - Daily Health Report',
            description: `Daily statistics for the ElevenLabs API key pool`,
            color: embedColor,
            timestamp: new Date().toISOString(),
            fields: [
                {
                    name: '🔑 Total Keys',
                    value: `**${stats.total_keys}** keys in pool\n${stats.active_keys} active, ${stats.paused_keys} paused`,
                    inline: true
                },
                {
                    name: `${healthEmoji} Average Health`,
                    value: `**${avgHealth.toFixed(1)}%**`,
                    inline: true
                },
                {
                    name: '📦 Leftover Quota',
                    value: `**${leftoverQuota.toLocaleString()}** characters\n(${quotaPercentage}% remaining)`,
                    inline: true
                }
            ],
            footer: {
                text: 'Stats update daily at midnight UTC'
            }
        };
        
        console.log('📤 Sending to Discord...');
        await axios.post(publicWebhookUrl, { embeds: [embed] });
        console.log('✅ Successfully sent public health stats to Discord!\n');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to send public health stats:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        process.exit(1);
    }
}

testPublicHealthStats();
