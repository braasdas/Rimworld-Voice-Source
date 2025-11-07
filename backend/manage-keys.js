#!/usr/bin/env node

/**
 * Colonist Voices Backend - Key Management CLI
 * 
 * Usage:
 *   node manage-keys.js list              - List all keys
 *   node manage-keys.js add               - Add a new key (interactive)
 *   node manage-keys.js remove <id>       - Remove a key
 *   node manage-keys.js pause <id>        - Pause a key
 *   node manage-keys.js resume <id>       - Resume a key
 *   node manage-keys.js stats             - Show statistics
 *   node manage-keys.js health            - Show health report
 *   node manage-keys.js generate-codes N  - Generate N supporter codes
 *   node manage-keys.js list-codes        - List unused supporter codes
 *   node manage-keys.js user-stats        - Show user statistics
 */

require('dotenv').config();
const readline = require('readline');
const keyPoolManager = require('./services/keyPoolManager');
const userManager = require('./services/userManager');
const db = require('./services/database');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

async function listKeys() {
    console.log('\n📊 ElevenLabs Key Pool Status\n');
    
    const result = await db.query(`
        SELECT 
            id, key_name, tier, status, 
            cost_per_char, monthly_quota, quota_used_this_month,
            priority, health_score, consecutive_failures,
            last_success, last_failure,
            promo_expires_at
        FROM elevenlabs_keys
        ORDER BY priority ASC, status ASC
    `);

    if (result.rows.length === 0) {
        console.log('No keys in the pool. Add one with: node manage-keys.js add\n');
        return;
    }

    result.rows.forEach((key, index) => {
        const statusColor = key.status === 'active' ? colors.green : 
                           key.status === 'paused' ? colors.yellow : colors.red;
        
        const healthColor = key.health_score >= 80 ? colors.green :
                           key.health_score >= 50 ? colors.yellow : colors.red;

        const quotaPercent = key.monthly_quota > 0 ? 
            Math.round((key.quota_used_this_month / key.monthly_quota) * 100) : 0;
        
        console.log(`${colors.bright}${index + 1}. ${key.key_name}${colors.reset}`);
        console.log(`   ID: ${key.id}`);
        console.log(`   Status: ${statusColor}${key.status}${colors.reset}`);
        console.log(`   Tier: ${key.tier} | Priority: ${key.priority} | Cost: $${key.cost_per_char}/char`);
        console.log(`   Health: ${healthColor}${key.health_score}%${colors.reset} | Failures: ${key.consecutive_failures}`);
        console.log(`   Quota: ${key.quota_used_this_month.toLocaleString()}/${key.monthly_quota.toLocaleString()} (${quotaPercent}%)`);
        
        if (key.promo_expires_at) {
            const daysLeft = Math.ceil((new Date(key.promo_expires_at) - new Date()) / (1000 * 60 * 60 * 24));
            const expiryColor = daysLeft <= 7 ? colors.red : colors.yellow;
            console.log(`   ${expiryColor}⚠️  Promo expires: ${key.promo_expires_at} (${daysLeft} days)${colors.reset}`);
        }
        
        if (key.last_success) {
            console.log(`   Last success: ${new Date(key.last_success).toLocaleString()}`);
        }
        if (key.last_failure) {
            console.log(`   ${colors.red}Last failure: ${new Date(key.last_failure).toLocaleString()}${colors.reset}`);
        }
        
        console.log('');
    });
}

async function addKey() {
    console.log('\n🔑 Add New ElevenLabs Key\n');
    
    const key_name = await question('Key name (e.g., "promo_dec_2024"): ');
    const api_key = await question('API key (sk_...): ');
    const tier = await question('Tier (promo_starter/creator_trial/main/backup) [promo_starter]: ') || 'promo_starter';
    const cost_per_char = await question('Cost per character [0.00015]: ') || '0.00015';
    const monthly_quota = await question('Monthly quota in characters [30000]: ') || '30000';
    const priority = await question('Priority (1=highest, 10=lowest) [5]: ') || '5';
    
    const isPromo = await question('Is this a promotional account? (y/n) [n]: ');
    let promo_type = null;
    let promo_expires_at = null;
    
    if (isPromo.toLowerCase() === 'y') {
        promo_type = await question('Promo type (e.g., "first_month_50_off"): ');
        promo_expires_at = await question('Expiry date (YYYY-MM-DD): ');
    }
    
    const notes = await question('Notes (optional): ');
    
    console.log('\n📝 Summary:');
    console.log(`   Name: ${key_name}`);
    console.log(`   Tier: ${tier}`);
    console.log(`   Cost: $${cost_per_char}/char`);
    console.log(`   Quota: ${monthly_quota} chars/month`);
    console.log(`   Priority: ${priority}`);
    if (promo_type) console.log(`   Promo: ${promo_type} (expires ${promo_expires_at})`);
    
    const confirm = await question('\nAdd this key? (y/n): ');
    
    if (confirm.toLowerCase() === 'y') {
        const result = await keyPoolManager.addKey({
            key_name,
            api_key,
            tier,
            cost_per_char: parseFloat(cost_per_char),
            monthly_quota: parseInt(monthly_quota),
            priority: parseInt(priority),
            promo_type,
            promo_expires_at,
            notes
        });
        
        console.log(`\n${colors.green}✓ Key added successfully!${colors.reset}`);
        console.log(`Key ID: ${result.id}\n`);
    } else {
        console.log('\nCancelled.\n');
    }
}

async function removeKey(keyId) {
    if (!keyId) {
        console.log('Usage: node manage-keys.js remove <key-id>');
        return;
    }
    
    const confirm = await question(`Remove key ${keyId}? This cannot be undone. (y/n): `);
    
    if (confirm.toLowerCase() === 'y') {
        await db.query('DELETE FROM elevenlabs_keys WHERE id = $1', [keyId]);
        console.log(`${colors.green}✓ Key removed${colors.reset}\n`);
    } else {
        console.log('Cancelled.\n');
    }
}

async function pauseKey(keyId) {
    if (!keyId) {
        console.log('Usage: node manage-keys.js pause <key-id>');
        return;
    }
    
    await keyPoolManager.pauseKey(keyId, 'Manual pause via CLI');
    console.log(`${colors.green}✓ Key paused${colors.reset}\n`);
}

async function resumeKey(keyId) {
    if (!keyId) {
        console.log('Usage: node manage-keys.js resume <key-id>');
        return;
    }
    
    await keyPoolManager.resumeKey(keyId);
    console.log(`${colors.green}✓ Key resumed${colors.reset}\n`);
}

async function showStats() {
    console.log('\n📊 Backend Statistics\n');
    
    const keyStats = await keyPoolManager.getStats();
    const userStats = await userManager.getStats();
    
    console.log('ElevenLabs Key Pool:');
    console.log(`  Total Keys: ${keyStats.total_keys}`);
    console.log(`  Active: ${colors.green}${keyStats.active_keys}${colors.reset}`);
    console.log(`  Paused: ${colors.yellow}${keyStats.paused_keys}${colors.reset}`);
    console.log(`  Average Health: ${keyStats.avg_health ? Math.round(keyStats.avg_health) : 0}%`);
    console.log(`  Quota Used: ${parseInt(keyStats.total_quota_used).toLocaleString()}/${parseInt(keyStats.total_quota_available).toLocaleString()} chars`);
    
    console.log('\nUsers:');
    console.log(`  Total Users: ${userStats.total_users}`);
    console.log(`  Free: ${userStats.free_users}`);
    console.log(`  Supporters: ${colors.green}${userStats.supporter_users}${colors.reset}`);
    console.log(`  Premium: ${colors.cyan}${userStats.premium_users}${colors.reset}`);
    
    console.log('\nSpeeches Generated:');
    console.log(`  Total: ${parseInt(userStats.total_speeches).toLocaleString()}`);
    console.log(`  Free Tier: ${parseInt(userStats.free_speeches || 0).toLocaleString()}`);
    console.log(`  Paid Tiers: ${parseInt(userStats.paid_speeches || 0).toLocaleString()}`);
    
    // Calculate costs
    const avgCostPerSpeech = 0.00011 * 75; // Assume 75 chars per speech
    const estimatedCost = parseInt(userStats.total_speeches) * avgCostPerSpeech;
    const breakEvenSupporters = Math.ceil(estimatedCost / 2); // $2/month
    
    console.log('\nCost Estimate:');
    console.log(`  Estimated ElevenLabs cost: $${estimatedCost.toFixed(2)}/month`);
    console.log(`  Break-even supporters needed: ${breakEvenSupporters}`);
    console.log(`  Current supporters: ${userStats.supporter_users}`);
    
    if (userStats.supporter_users >= breakEvenSupporters) {
        console.log(`  ${colors.green}✓ Profitable!${colors.reset}`);
    } else {
        const deficit = (breakEvenSupporters - userStats.supporter_users) * 2;
        console.log(`  ${colors.yellow}⚠️  Need ${breakEvenSupporters - userStats.supporter_users} more supporters ($${deficit}/mo)${colors.reset}`);
    }
    
    console.log('');
}

async function showHealth() {
    console.log('\n🏥 Health Report\n');
    
    const result = await db.query(`
        SELECT key_name, health_score, consecutive_failures, status,
               last_failure, last_failure_reason
        FROM elevenlabs_keys
        ORDER BY health_score ASC
    `);
    
    let unhealthy = 0;
    
    result.rows.forEach(key => {
        const healthColor = key.health_score >= 80 ? colors.green :
                           key.health_score >= 50 ? colors.yellow : colors.red;
        
        console.log(`${key.key_name}: ${healthColor}${key.health_score}%${colors.reset} (${key.status})`);
        
        if (key.health_score < 70) {
            unhealthy++;
            console.log(`  ${colors.yellow}⚠️  Consecutive failures: ${key.consecutive_failures}${colors.reset}`);
            if (key.last_failure_reason) {
                console.log(`  Last error: ${key.last_failure_reason.substring(0, 100)}`);
            }
        }
    });
    
    console.log('');
    if (unhealthy === 0) {
        console.log(`${colors.green}✓ All keys healthy!${colors.reset}\n`);
    } else {
        console.log(`${colors.yellow}⚠️  ${unhealthy} key(s) need attention${colors.reset}\n`);
    }
}

async function generateCodes(count) {
    if (!count || count < 1) {
        console.log('Usage: node manage-keys.js generate-codes <count>');
        return;
    }
    
    console.log(`\n🎟️  Generating ${count} supporter codes...\n`);
    
    const codes = await userManager.generateSupporterCodes(parseInt(count), 'supporter', 'admin-cli');
    
    codes.forEach((code, index) => {
        console.log(`${index + 1}. ${colors.bright}${code.code}${colors.reset}`);
    });
    
    console.log(`\n${colors.green}✓ ${count} codes generated${colors.reset}`);
    console.log('These codes grant unlimited speeches.\n');
}

async function listCodes() {
    console.log('\n🎟️  Unused Supporter Codes\n');
    
    const result = await db.query(`
        SELECT code, tier, created_at
        FROM supporter_codes
        WHERE used_by IS NULL
        ORDER BY created_at DESC
    `);
    
    if (result.rows.length === 0) {
        console.log('No unused codes. Generate some with: node manage-keys.js generate-codes 10\n');
        return;
    }
    
    result.rows.forEach((code, index) => {
        console.log(`${index + 1}. ${colors.bright}${code.code}${colors.reset} (${code.tier})`);
        console.log(`   Created: ${new Date(code.created_at).toLocaleString()}\n`);
    });
}

async function userStats() {
    console.log('\n👥 User Statistics\n');
    
    const stats = await userManager.getStats();
    
    console.log('Overview:');
    console.log(`  Total Users: ${stats.total_users}`);
    console.log(`  Free: ${stats.free_users} (${Math.round(stats.free_users/stats.total_users*100)}%)`);
    console.log(`  Supporter: ${colors.green}${stats.supporter_users}${colors.reset} (${Math.round(stats.supporter_users/stats.total_users*100)}%)`);
    console.log(`  Premium: ${colors.cyan}${stats.premium_users}${colors.reset} (${Math.round(stats.premium_users/stats.total_users*100)}%)`);
    
    // Recent users
    const recentUsers = await db.query(`
        SELECT tier, total_speeches_generated, created_at, last_used
        FROM users
        ORDER BY created_at DESC
        LIMIT 10
    `);
    
    console.log('\nRecent Users:');
    recentUsers.rows.forEach((user, index) => {
        const tierColor = user.tier === 'supporter' ? colors.green :
                         user.tier === 'premium' ? colors.cyan : colors.reset;
        console.log(`  ${index + 1}. ${tierColor}${user.tier}${colors.reset} - ${user.total_speeches_generated} speeches - Joined ${new Date(user.created_at).toLocaleDateString()}`);
    });
    
    // Top users
    const topUsers = await db.query(`
        SELECT tier, total_speeches_generated
        FROM users
        ORDER BY total_speeches_generated DESC
        LIMIT 5
    `);
    
    console.log('\nTop Users (by speeches):');
    topUsers.rows.forEach((user, index) => {
        const tierColor = user.tier === 'supporter' ? colors.green :
                         user.tier === 'premium' ? colors.cyan : colors.reset;
        console.log(`  ${index + 1}. ${tierColor}${user.tier}${colors.reset} - ${user.total_speeches_generated} speeches`);
    });
    
    console.log('');
}

async function main() {
    const command = process.argv[2];
    const arg = process.argv[3];
    
    try {
        switch(command) {
            case 'list':
                await listKeys();
                break;
            case 'add':
                await addKey();
                break;
            case 'remove':
                await removeKey(arg);
                break;
            case 'pause':
                await pauseKey(arg);
                break;
            case 'resume':
                await resumeKey(arg);
                break;
            case 'stats':
                await showStats();
                break;
            case 'health':
                await showHealth();
                break;
            case 'generate-codes':
                await generateCodes(arg);
                break;
            case 'list-codes':
                await listCodes();
                break;
            case 'user-stats':
                await userStats();
                break;
            default:
                console.log('\n🔑 Colonist Voices Backend - Key Management\n');
                console.log('Commands:');
                console.log('  list              - List all ElevenLabs keys');
                console.log('  add               - Add a new key (interactive)');
                console.log('  remove <id>       - Remove a key');
                console.log('  pause <id>        - Pause a key');
                console.log('  resume <id>       - Resume a key');
                console.log('  stats             - Show statistics');
                console.log('  health            - Show health report');
                console.log('  generate-codes N  - Generate N supporter codes');
                console.log('  list-codes        - List unused supporter codes');
                console.log('  user-stats        - Show user statistics');
                console.log('');
        }
    } catch (error) {
        console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    } finally {
        rl.close();
        process.exit(0);
    }
}

main();
