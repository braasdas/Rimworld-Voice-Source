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
    }

    /**
     * Select the best available ElevenLabs API key
     * @param {string} userTier - 'free', 'supporter', or 'premium'
     * @returns {Promise<Object>} - Selected key object
     */
    async selectKey(userTier = 'free') {
        const keys = await this.getHealthyKeys();

        if (keys.length === 0) {
            throw new Error('No healthy ElevenLabs keys available');
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
     * Get all healthy keys
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
            AND health_score >= 70
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

        // Auto-pause key if too many failures
        if (key.consecutive_failures >= 5) {
            await this.pauseKey(keyId, '5 consecutive failures');
            console.error(`⚠️ Key ${key.key_name} auto-paused after 5 failures`);
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
                notes = CONCAT('Auto-paused: ', $2, ' at ', NOW(), '. ', COALESCE(notes, '')),
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
     * Reset monthly quotas (run on 1st of each month)
     */
    async resetMonthlyQuotas() {
        await db.query(`
            UPDATE elevenlabs_keys
            SET 
                quota_used_this_month = 0,
                quota_reset_date = DATE_TRUNC('month', NOW() + INTERVAL '1 month'),
                status = CASE 
                    WHEN status = 'exhausted' THEN 'active'
                    ELSE status
                END,
                updated_at = NOW()
            WHERE quota_reset_date <= NOW()
        `);

        this.invalidateCache();
        console.log('✓ Monthly quotas reset');
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
            notes = null
        } = keyData;

        const result = await db.query(`
            INSERT INTO elevenlabs_keys (
                key_name, api_key, tier, cost_per_char, monthly_quota, priority,
                promo_type, promo_expires_at, notes, quota_reset_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, DATE_TRUNC('month', NOW() + INTERVAL '1 month'))
            RETURNING id, key_name
        `, [key_name, api_key, tier, cost_per_char, monthly_quota, priority, promo_type, promo_expires_at, notes]);

        this.invalidateCache();
        return result.rows[0];
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

// Schedule monthly quota reset (runs at midnight on 1st of each month)
setInterval(async () => {
    const now = new Date();
    if (now.getDate() === 1 && now.getHours() === 0) {
        await keyPoolManager.resetMonthlyQuotas();
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
