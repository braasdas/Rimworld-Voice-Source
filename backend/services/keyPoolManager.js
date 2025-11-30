const db = require('./database');
const { v4: uuidv4 } = require('uuid');

/**
 * Intelligent ElevenLabs Key Pool Manager
 * Handles multiple ElevenLabs accounts with automatic failover and load balancing
 */
class KeyPoolManager {
    constructor() {
        this.cache = null;
        this.lastCacheUpdate = 0;
        this.CACHE_TTL = 60000; // 1 minute cache
        this.migrationComplete = false;
    }

    /**
     * One-time migration: Fix quota_reset_date to align with each key's creation date
     * This preserves existing keys without requiring manual re-entry
     */
    async migrateResetDates() {
        if (this.migrationComplete) return;

        try {
            // Check if migration is needed
            const checkResult = await db.query(`
                SELECT COUNT(*) as needs_migration
                FROM elevenlabs_keys
                WHERE quota_reset_date IS NULL 
                OR quota_reset_date = DATE_TRUNC('month', created_at + INTERVAL '1 month')
            `);

            if (parseInt(checkResult.rows[0].needs_migration) === 0) {
                this.migrationComplete = true;
                return;
            }

            console.log('🔄 Migrating quota reset dates to align with key creation dates...');

            // Update reset dates based on created_at day-of-month
            await db.query(`
                UPDATE elevenlabs_keys
                SET quota_reset_date = CASE
                    -- If key was created on day 29, 30, or 31, reset on last day of each month
                    WHEN EXTRACT(DAY FROM created_at) >= 29 THEN 
                        (DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day')::DATE
                    -- Otherwise, reset on the same day each month
                    ELSE 
                        (DATE_TRUNC('month', NOW()) + 
                         INTERVAL '1 month' + 
                         (EXTRACT(DAY FROM created_at) - 1 || ' days')::INTERVAL)::DATE
                END,
                updated_at = NOW()
                WHERE quota_reset_date IS NULL 
                OR quota_reset_date = DATE_TRUNC('month', created_at + INTERVAL '1 month')
            `);

            const result = await db.query(`SELECT COUNT(*) as updated FROM elevenlabs_keys`);
            console.log(`✅ Migration complete: ${result.rows[0].updated} keys updated`);
            
            this.migrationComplete = true;
            this.invalidateCache();
        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        }
    }

    /**
     * Calculate next reset date based on key creation date
     * @param {Date} createdAt - Key creation timestamp
     * @returns {Date} - Next reset date
     */
    calculateNextResetDate(createdAt) {
        const createdDate = new Date(createdAt);
        const creationDay = createdDate.getDate();
        const now = new Date();
        
        // Handle edge case: keys created on 29th, 30th, or 31st reset on last day of month
        if (creationDay >= 29) {
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const lastDayOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);
            return lastDayOfNextMonth;
        }
        
        // Normal case: reset on same day each month
        let nextReset = new Date(now.getFullYear(), now.getMonth() + 1, creationDay);
        
        // If next reset would be invalid (e.g., Feb 31), use last day of that month
        if (nextReset.getDate() !== creationDay) {
            nextReset = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        }
        
        return nextReset;
    }

    /**
     * Select the best available ElevenLabs API key
     * @param {string} userTier - 'free', 'supporter', or 'premium'
     * @returns {Promise<Object>} - Selected key object
     */
    async selectKey(userTier = 'free') {
        // Ensure migration has run
        await this.migrateResetDates();

        let keys = await this.getHealthyKeys();

        // Filter out keys that have exhausted their quota (defensive check)
        keys = keys.filter(k => {
            if (k.monthly_quota === -1) return true; // Unlimited quota
            return k.quota_used_this_month < k.monthly_quota;
        });

        if (keys.length === 0) {
            throw new Error('No healthy ElevenLabs keys available with remaining quota');
        }

        // Filter by tier suitability
        let suitableKeys = keys;
        if (userTier === 'free') {
            // Free users get cheapest keys (promos near expiry)
            suitableKeys = keys.filter(k => k.priority >= 5 || k.promo_expires_at);
        } else if (userTier === 'supporter') {
            // Supporters get mid-tier keys
            suitableKeys = keys.filter(k => k.priority <= 7 && k.health_score >= 80);
        } else if (userTier === 'premium') {
            // Premium gets best keys
            suitableKeys = keys.filter(k => k.priority <= 3 && k.health_score >= 90);
        }

        // Fall back to any healthy key if no tier-specific keys available
        if (suitableKeys.length === 0) {
            suitableKeys = keys;
        }

        // Sort by priority, then cost, then health
        suitableKeys.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            if (a.cost_per_char !== b.cost_per_char) return parseFloat(a.cost_per_char) - parseFloat(b.cost_per_char);
            return parseFloat(b.health_score) - parseFloat(a.health_score);
        });

        // Load balance: rotate through similar-priority keys
        const topKeys = suitableKeys.filter(k => k.priority === suitableKeys[0].priority);
        const selectedKey = topKeys[Math.floor(Math.random() * topKeys.length)];

        return selectedKey;
    }

    /**
     * Get all healthy keys with available quota
     * @returns {Promise<Array>}
     */
    async getHealthyKeys() {
        // Check cache first
        if (this.cache && (Date.now() - this.lastCacheUpdate) < this.CACHE_TTL) {
            return this.cache;
        }

        const result = await db.query(`
            SELECT * FROM elevenlabs_keys
            WHERE status = 'active'
            AND health_score >= 80
            AND (quota_used_this_month < monthly_quota OR monthly_quota = -1)
            ORDER BY priority ASC, cost_per_char ASC
        `);

        this.cache = result.rows;
        this.lastCacheUpdate = Date.now();

        return result.rows;
    }

    /**
     * Record successful API call
     * @param {string} keyId - Key UUID
     * @param {number} characters - Characters used
     */
    async recordSuccess(keyId, characters) {
        await db.query(`
            UPDATE elevenlabs_keys
            SET 
                total_requests = total_requests + 1,
                successful_requests = successful_requests + 1,
                quota_used_this_month = quota_used_this_month + $2,
                consecutive_failures = 0,
                health_score = LEAST(100, health_score + 2),
                last_success = NOW(),
                updated_at = NOW()
            WHERE id = $1
        `, [keyId, characters]);

        this.invalidateCache();
    }

    /**
     * Record failed API call
     * @param {string} keyId - Key UUID
     * @param {string} reason - Failure reason
     */
    async recordFailure(keyId, reason) {
        const result = await db.query(`
            UPDATE elevenlabs_keys
            SET 
                total_requests = total_requests + 1,
                consecutive_failures = consecutive_failures + 1,
                health_score = GREATEST(0, health_score - 10),
                last_failure = NOW(),
                last_failure_reason = $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING consecutive_failures, health_score, key_name
        `, [keyId, reason]);

        const key = result.rows[0];

        // Auto-pause key if health drops below 80% or too many consecutive failures
        if (key.health_score < 80 || key.consecutive_failures >= 5) {
            const pauseReason = key.health_score < 80 
                ? `Health score dropped below 80% (${key.health_score}%)`
                : '5 consecutive failures';
            await this.pauseKey(keyId, pauseReason);
            console.error(`⚠️ Key ${key.key_name} auto-paused: ${pauseReason}`);
        }

        this.invalidateCache();
    }

    /**
     * Pause a key temporarily
     * @param {string} keyId - Key UUID
     * @param {string} reason - Reason for pausing
     */
    async pauseKey(keyId, reason) {
        await db.query(`
            UPDATE elevenlabs_keys
            SET 
                status = 'paused',
                notes = 'Auto-paused: ' || $2 || ' at ' || NOW() || '. ' || COALESCE(notes, ''),
                updated_at = NOW()
            WHERE id = $1
        `, [keyId, reason]);

        this.invalidateCache();
    }

    /**
     * Resume a paused key
     * @param {string} keyId - Key UUID
     */
    async resumeKey(keyId) {
        await db.query(`
            UPDATE elevenlabs_keys
            SET 
                status = 'active',
                consecutive_failures = 0,
                health_score = 100,
                updated_at = NOW()
            WHERE id = $1
        `, [keyId]);

        this.invalidateCache();
    }

    /**
     * Reset key health to 100
     * @param {string} keyId - Key UUID
     */
    async resetHealth(keyId) {
        await db.query(`
            UPDATE elevenlabs_keys
            SET 
                health_score = 100,
                consecutive_failures = 0,
                updated_at = NOW()
            WHERE id = $1
        `, [keyId]);

        this.invalidateCache();
    }

    /**
     * Reset monthly quotas for keys whose reset date has passed
     * Now checks individual key reset dates instead of universal "1st of month"
     * Also resumes keys that were auto-paused due to low health
     */
    async resetMonthlyQuotas() {
        const result = await db.query(`
            UPDATE elevenlabs_keys
            SET 
                quota_used_this_month = 0,
                quota_reset_date = CASE
                    -- Keys created on days 29-31 reset on last day of next month
                    WHEN EXTRACT(DAY FROM created_at) >= 29 THEN 
                        (DATE_TRUNC('month', NOW()) + INTERVAL '2 months' - INTERVAL '1 day')::DATE
                    -- Otherwise reset on same day next month
                    ELSE 
                        (DATE_TRUNC('month', NOW()) + 
                         INTERVAL '2 months' + 
                         (EXTRACT(DAY FROM created_at) - 1 || ' days')::INTERVAL)::DATE
                END,
                status = CASE 
                    -- Resume paused keys whose notes indicate they were auto-paused for health/quota reasons
                    WHEN status = 'paused' AND (notes LIKE '%Auto-paused: Health score%' OR notes LIKE '%quota%') THEN 'active'
                    -- Resume exhausted keys
                    WHEN status = 'exhausted' THEN 'active'
                    ELSE status
                END,
                health_score = CASE
                    -- Reset health to 100 for keys that are being resumed
                    WHEN status = 'paused' AND (notes LIKE '%Auto-paused: Health score%' OR notes LIKE '%quota%') THEN 100
                    ELSE health_score
                END,
                consecutive_failures = CASE
                    -- Reset consecutive failures for resumed keys
                    WHEN status = 'paused' AND (notes LIKE '%Auto-paused: Health score%' OR notes LIKE '%quota%') THEN 0
                    ELSE consecutive_failures
                END,
                updated_at = NOW()
            WHERE quota_reset_date <= CURRENT_DATE
            RETURNING key_name, quota_reset_date, status
        `);

        if (result.rows.length > 0) {
            console.log(`✓ Reset quotas for ${result.rows.length} keys:`);
            result.rows.forEach(key => {
                console.log(`  - ${key.key_name} (status: ${key.status}, next reset: ${key.quota_reset_date})`);
            });
            this.invalidateCache();
        }
    }

    /**
     * Get pool statistics
     */
    async getStats() {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total_keys,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_keys,
                COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_keys,
                AVG(health_score) as avg_health,
                SUM(quota_used_this_month) as total_quota_used,
                SUM(monthly_quota) as total_quota_available
            FROM elevenlabs_keys
        `);

        return result.rows[0];
    }

    /**
     * Add new key to pool
     * Now sets reset date based on creation day-of-month
     * Includes country_code for Oxylabs residential proxy routing
     */
    async addKey(keyData) {
        const {
            key_name,
            api_key,
            tier = 'promo_starter',
            cost_per_char = 0.00015,
            monthly_quota = 30000,
            priority = 5,
            promo_type = null,
            promo_expires_at = null,
            notes = null,
            country_code = 'us'  // Default to US proxy
        } = keyData;

        // Calculate reset date: next month on the same day as creation
        const now = new Date();
        const creationDay = now.getDate();

        let resetDate;
        if (creationDay >= 29) {
            // Edge case: reset on last day of next month
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
            resetDate = nextMonth.toISOString().split('T')[0];
        } else {
            // Normal case: same day next month
            let nextReset = new Date(now.getFullYear(), now.getMonth() + 1, creationDay);
            if (nextReset.getDate() !== creationDay) {
                // Handle invalid dates (e.g., Feb 31 -> Feb 28/29)
                nextReset = new Date(now.getFullYear(), now.getMonth() + 2, 0);
            }
            resetDate = nextReset.toISOString().split('T')[0];
        }

        const result = await db.query(`
            INSERT INTO elevenlabs_keys (
                key_name, api_key, tier, cost_per_char, monthly_quota, priority,
                promo_type, promo_expires_at, notes, quota_reset_date, country_code
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, key_name, created_at, quota_reset_date, country_code
        `, [key_name, api_key, tier, cost_per_char, monthly_quota, priority, promo_type, promo_expires_at, notes, resetDate, country_code.toLowerCase()]);

        const newKey = result.rows[0];
        console.log(`✓ Added key ${newKey.key_name} (created: ${newKey.created_at}, resets: ${newKey.quota_reset_date}, country: ${newKey.country_code})`);

        this.invalidateCache();
        return newKey;
    }

    /**
     * Check for expiring promos
     */
    async checkExpiringPromos() {
        const result = await db.query(`
            SELECT key_name, promo_expires_at, api_key
            FROM elevenlabs_keys
            WHERE promo_expires_at IS NOT NULL
            AND promo_expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
            AND status = 'active'
        `);

        return result.rows;
    }

    invalidateCache() {
        this.cache = null;
    }
}

// Singleton instance
const keyPoolManager = new KeyPoolManager();

// Check for quota resets every hour (checks individual key reset dates)
setInterval(async () => {
    try {
        await keyPoolManager.resetMonthlyQuotas();
    } catch (error) {
        console.error('❌ Error checking quota resets:', error);
    }
}, 3600000); // Check every hour

// Check for expiring promos daily
setInterval(async () => {
    const expiringPromos = await keyPoolManager.checkExpiringPromos();
    if (expiringPromos.length > 0) {
        console.log(`⚠️ ${expiringPromos.length} promo keys expiring soon:`);
        expiringPromos.forEach(key => {
            console.log(`   - ${key.key_name} expires ${key.promo_expires_at}`);
        });
    }
}, 86400000); // Check daily

module.exports = keyPoolManager;
