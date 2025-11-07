const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * User API Key Manager
 * Manages user keys for accessing the backend
 */
class UserManager {
    /**
     * Register new user
     * @param {string} hardwareId - Optional hardware ID for abuse prevention
     * @returns {Promise<Object>} - User data with new key
     */
    async registerUser(hardwareId = null) {
        // Check hardware ID limit (max 3 accounts per device)
        if (hardwareId) {
            const existingUsers = await db.query(`
                SELECT COUNT(*) as count
                FROM users
                WHERE hardware_id = $1
            `, [hardwareId]);

            if (parseInt(existingUsers.rows[0].count) >= 3) {
                throw new Error('Maximum number of accounts reached for this device');
            }
        }

        // Generate unique user key
        const userKey = this.generateUserKey();

        const result = await db.query(`
            INSERT INTO users (user_key, hardware_id, tier, free_speeches_remaining)
            VALUES ($1, $2, 'free', $3)
            RETURNING id, user_key, tier, free_speeches_remaining, created_at
        `, [userKey, hardwareId, parseInt(process.env.FREE_TIER_SPEECHES || 10)]);

        return result.rows[0];
    }

    /**
     * Validate user key and check quota
     * @param {string} userKey
     * @returns {Promise<Object>} - User data
     */
    async validateUser(userKey) {
        const result = await db.query(`
            SELECT id, user_key, tier, free_speeches_remaining, total_speeches_generated
            FROM users
            WHERE user_key = $1
        `, [userKey]);

        if (result.rows.length === 0) {
            return null;
        }

        const user = result.rows[0];

        // Check if free user has speeches remaining
        if (user.tier === 'free' && user.free_speeches_remaining <= 0) {
            throw new Error('Free speech limit reached. Please support the mod or use your own API keys.');
        }

        return user;
    }

    /**
     * Consume a speech from user's quota
     * @param {string} userId
     */
    async consumeSpeech(userId) {
        await db.query(`
            UPDATE users
            SET 
                free_speeches_remaining = CASE 
                    WHEN tier = 'free' THEN GREATEST(0, free_speeches_remaining - 1)
                    ELSE free_speeches_remaining
                END,
                total_speeches_generated = total_speeches_generated + 1,
                last_used = NOW()
            WHERE id = $1
        `, [userId]);
    }

    /**
     * Redeem supporter code
     * @param {string} userKey
     * @param {string} code
     * @returns {Promise<Object>} - Updated user data
     */
    async redeemCode(userKey, code) {
        // Check if code exists and is unused
        const codeResult = await db.query(`
            SELECT id, tier, used_by
            FROM supporter_codes
            WHERE code = $1
        `, [code]);

        if (codeResult.rows.length === 0) {
            throw new Error('Invalid supporter code');
        }

        const supporterCode = codeResult.rows[0];

        if (supporterCode.used_by) {
            throw new Error('This code has already been used');
        }

        // Get user
        const userResult = await db.query(`
            SELECT id, tier
            FROM users
            WHERE user_key = $1
        `, [userKey]);

        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }

        const user = userResult.rows[0];

        // Update user tier
        await db.query(`
            UPDATE users
            SET 
                tier = $1,
                free_speeches_remaining = -1,
                supporter_code_used = $2
            WHERE id = $3
        `, [supporterCode.tier, code, user.id]);

        // Mark code as used
        await db.query(`
            UPDATE supporter_codes
            SET 
                used_by = $1,
                redeemed_at = NOW()
            WHERE id = $2
        `, [user.id, supporterCode.id]);

        return {
            tier: supporterCode.tier,
            free_speeches_remaining: -1
        };
    }

    /**
     * Generate supporter codes
     * @param {number} count - Number of codes to generate
     * @param {string} tier - Tier for the codes
     * @param {string} createdBy - Who created these codes
     * @returns {Promise<Array>} - Array of generated codes
     */
    async generateSupporterCodes(count, tier = 'supporter', createdBy = 'admin') {
        const codes = [];

        for (let i = 0; i < count; i++) {
            const code = this.generateSupporterCode();
            const result = await db.query(`
                INSERT INTO supporter_codes (code, tier, created_by)
                VALUES ($1, $2, $3)
                RETURNING code, tier, created_at
            `, [code, tier, createdBy]);

            codes.push(result.rows[0]);
        }

        return codes;
    }

    /**
     * Get user status
     * @param {string} userKey
     * @returns {Promise<Object>}
     */
    async getUserStatus(userKey) {
        const result = await db.query(`
            SELECT 
                tier,
                free_speeches_remaining,
                total_speeches_generated,
                created_at,
                last_used
            FROM users
            WHERE user_key = $1
        `, [userKey]);

        if (result.rows.length === 0) {
            throw new Error('User not found');
        }

        return result.rows[0];
    }

    /**
     * Get usage statistics
     */
    async getStats() {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN tier = 'free' THEN 1 END) as free_users,
                COUNT(CASE WHEN tier = 'supporter' THEN 1 END) as supporter_users,
                COUNT(CASE WHEN tier = 'premium' THEN 1 END) as premium_users,
                SUM(total_speeches_generated) as total_speeches,
                SUM(CASE WHEN tier = 'free' THEN total_speeches_generated END) as free_speeches,
                SUM(CASE WHEN tier != 'free' THEN total_speeches_generated END) as paid_speeches
            FROM users
        `);

        return result.rows[0];
    }

    /**
     * Generate a unique user key
     * Format: CV-XXXX-XXXX-XXXX-XXXX
     */
    generateUserKey() {
        const uuid = uuidv4().replace(/-/g, '').toUpperCase();
        return `CV-${uuid.substr(0, 4)}-${uuid.substr(4, 4)}-${uuid.substr(8, 4)}-${uuid.substr(12, 4)}`;
    }

    /**
     * Generate a supporter code
     * Format: COLONIST-XXXX-XXXX-XXXX
     */
    generateSupporterCode() {
        const random = crypto.randomBytes(6).toString('hex').toUpperCase();
        return `COLONIST-${random.substr(0, 4)}-${random.substr(4, 4)}-${random.substr(8, 4)}`;
    }
}

// Singleton instance
const userManager = new UserManager();

module.exports = userManager;
