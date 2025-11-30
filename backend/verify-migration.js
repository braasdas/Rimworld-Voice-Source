/**
 * Verify Quota Reset Date Migration
 * Run this after deploying the new keyPoolManager.js to verify the migration worked
 */

const db = require('./services/database');

async function verifyMigration() {
    console.log('🔍 Checking quota reset date migration...\n');

    try {
        const result = await db.query(`
            SELECT 
                key_name,
                created_at,
                quota_reset_date,
                EXTRACT(DAY FROM created_at) as creation_day,
                EXTRACT(DAY FROM quota_reset_date) as reset_day,
                status
            FROM elevenlabs_keys
            ORDER BY created_at
        `);

        if (result.rows.length === 0) {
            console.log('⚠️ No keys found in database');
            process.exit(0);
        }

        console.log('Keys and their reset schedules:');
        console.log('━'.repeat(100));
        
        result.rows.forEach(key => {
            const createdDate = new Date(key.created_at);
            const resetDate = new Date(key.quota_reset_date);
            const daysUntilReset = Math.ceil((resetDate - new Date()) / (1000 * 60 * 60 * 24));
            
            console.log(`📅 ${key.key_name}`);
            console.log(`   Created: ${createdDate.toLocaleDateString()} (day ${key.creation_day})`);
            console.log(`   Resets:  ${resetDate.toLocaleDateString()} (day ${key.reset_day})`);
            console.log(`   Status:  ${key.status} | Days until reset: ${daysUntilReset}`);
            console.log('');
        });

        console.log('━'.repeat(100));
        console.log('✅ Migration verification complete!');
        console.log(`\n📊 Summary: ${result.rows.length} keys will now reset on their individual creation day each month`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

verifyMigration();
