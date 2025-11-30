const db = require('./database');
const { HttpsProxyAgent } = require('https-proxy-agent');

class ProxyPoolManager {
    constructor() {
        this.healthThresholds = {
            pauseThreshold: 30,
            failureIncrement: -10,
            successIncrement: 5
        };

        // Oxylabs Residential Proxy Configuration
        // Format: http://customer-{username}-cc-{country}:{password}@pr.oxylabs.io:7777
        this.oxylabs = {
            host: 'pr.oxylabs.io',
            port: 7777,
            username: process.env.OXYLABS_USERNAME,
            password: process.env.OXYLABS_PASSWORD
        };
    }

    /**
     * Build Oxylabs residential proxy URL for a specific country
     * @param {string} countryCode - ISO 3166-1 alpha-2 country code (e.g., 'us', 'gb', 'de')
     * @returns {string} - Full proxy URL with authentication
     */
    buildOxylabsProxyUrl(countryCode = 'us') {
        const cc = countryCode.toLowerCase();
        const fullUsername = `customer-${this.oxylabs.username}-cc-${cc}`;
        return `http://${fullUsername}:${this.oxylabs.password}@${this.oxylabs.host}:${this.oxylabs.port}`;
    }

    /**
     * Get axios config with HttpsProxyAgent for Oxylabs residential proxy
     * @param {string} countryCode - ISO 3166-1 alpha-2 country code
     * @returns {Object} - Axios configuration with httpsAgent
     */
    getOxylabsProxyConfig(countryCode = 'us') {
        const proxyUrl = this.buildOxylabsProxyUrl(countryCode);
        const agent = new HttpsProxyAgent(proxyUrl);

        return {
            httpsAgent: agent,
            proxy: false  // Disable axios built-in proxy handling, use agent instead
        };
    }

    /**
     * Select the best available proxy based on health, priority, and status
     */
    async selectProxy() {
        const result = await db.query(`
            SELECT * FROM proxies
            WHERE status = 'active'
            AND health_score > $1
            ORDER BY priority ASC, health_score DESC, last_success DESC NULLS LAST
            LIMIT 1
        `, [this.healthThresholds.pauseThreshold]);

        if (result.rows.length === 0) {
            // No healthy proxies available, return null to use direct connection
            console.warn('[ProxyPool] No healthy proxies available, using direct connection');
            return null;
        }

        return result.rows[0];
    }

    /**
     * Record a successful request through a proxy
     */
    async recordSuccess(proxyId) {
        if (!proxyId) return; // Direct connection, no proxy used

        const newHealth = Math.min(100, await this.getCurrentHealth(proxyId) + this.healthThresholds.successIncrement);
        
        await db.query(`
            UPDATE proxies
            SET 
                health_score = $1,
                consecutive_failures = 0,
                total_requests = total_requests + 1,
                successful_requests = successful_requests + 1,
                last_success = NOW(),
                updated_at = NOW()
            WHERE id = $2
        `, [newHealth, proxyId]);

        console.log(`[ProxyPool] Success recorded for proxy ${proxyId}, health: ${newHealth}%`);
    }

    /**
     * Record a failed request through a proxy
     */
    async recordFailure(proxyId, reason = 'Unknown error') {
        if (!proxyId) return; // Direct connection, no proxy used

        const currentHealth = await this.getCurrentHealth(proxyId);
        const newHealth = Math.max(0, currentHealth + this.healthThresholds.failureIncrement);
        
        await db.query(`
            UPDATE proxies
            SET 
                health_score = $1,
                consecutive_failures = consecutive_failures + 1,
                total_requests = total_requests + 1,
                last_failure = NOW(),
                last_failure_reason = $2,
                updated_at = NOW()
            WHERE id = $3
        `, [newHealth, reason, proxyId]);

        console.log(`[ProxyPool] Failure recorded for proxy ${proxyId}, health: ${newHealth}%`);

        // Auto-pause if health drops below threshold
        if (newHealth <= this.healthThresholds.pauseThreshold) {
            await this.pauseProxy(proxyId, `Auto-paused: health dropped to ${newHealth}%`);
        }
    }

    /**
     * Get current health score of a proxy
     */
    async getCurrentHealth(proxyId) {
        const result = await db.query('SELECT health_score FROM proxies WHERE id = $1', [proxyId]);
        return result.rows.length > 0 ? parseFloat(result.rows[0].health_score) : 100;
    }

    /**
     * Pause a proxy
     */
    async pauseProxy(proxyId, reason = 'Manual pause') {
        await db.query(`
            UPDATE proxies
            SET status = 'paused', notes = $1, updated_at = NOW()
            WHERE id = $2
        `, [reason, proxyId]);

        console.log(`[ProxyPool] Proxy ${proxyId} paused: ${reason}`);
    }

    /**
     * Resume a proxy
     */
    async resumeProxy(proxyId) {
        await db.query(`
            UPDATE proxies
            SET status = 'active', updated_at = NOW()
            WHERE id = $1
        `, [proxyId]);

        console.log(`[ProxyPool] Proxy ${proxyId} resumed`);
    }

    /**
     * Reset health score of a proxy
     */
    async resetHealth(proxyId) {
        await db.query(`
            UPDATE proxies
            SET 
                health_score = 100.0,
                consecutive_failures = 0,
                status = 'active',
                updated_at = NOW()
            WHERE id = $1
        `, [proxyId]);

        console.log(`[ProxyPool] Proxy ${proxyId} health reset to 100%`);
    }

    /**
     * Add a new proxy to the pool
     */
    async addProxy(proxyData) {
        const {
            proxy_name,
            proxy_url,
            proxy_type = 'http',
            priority = 5,
            notes = ''
        } = proxyData;

        if (!proxy_name || !proxy_url) {
            throw new Error('proxy_name and proxy_url are required');
        }

        const result = await db.query(`
            INSERT INTO proxies (proxy_name, proxy_url, proxy_type, priority, notes)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [proxy_name, proxy_url, proxy_type, priority, notes]);

        console.log(`[ProxyPool] Added new proxy: ${proxy_name}`);
        return result.rows[0];
    }

    /**
     * Get statistics about the proxy pool
     */
    async getStats() {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total_proxies,
                COUNT(*) FILTER (WHERE status = 'active') as active_proxies,
                COUNT(*) FILTER (WHERE status = 'paused') as paused_proxies,
                COALESCE(AVG(health_score), 0) as avg_health,
                COALESCE(SUM(total_requests), 0) as total_requests,
                COALESCE(SUM(successful_requests), 0) as successful_requests
            FROM proxies
        `);

        const stats = result.rows[0];
        
        // Calculate success rate
        const totalReqs = parseInt(stats.total_requests) || 0;
        const successReqs = parseInt(stats.successful_requests) || 0;
        stats.success_rate = totalReqs > 0 ? ((successReqs / totalReqs) * 100).toFixed(2) : 0;

        return stats;
    }

    /**
     * Get axios config for a proxy
     */
    getProxyConfig(proxy) {
        if (!proxy) return {}; // No proxy, use direct connection

        try {
            const url = new URL(proxy.proxy_url);
            
            const proxyConfig = {
                proxy: {
                    protocol: url.protocol.replace(':', ''),
                    host: url.hostname,
                    port: parseInt(url.port)
                }
            };

            // Add authentication if present in URL (username:password format)
            // If not present, proxy is IP-authenticated (already whitelisted)
            if (url.username && url.password) {
                proxyConfig.proxy.auth = {
                    username: url.username,
                    password: url.password
                };
            }

            return proxyConfig;
        } catch (error) {
            console.error(`[ProxyPool] Failed to parse proxy URL: ${error.message}`);
            return {};
        }
    }
}

module.exports = new ProxyPoolManager();
