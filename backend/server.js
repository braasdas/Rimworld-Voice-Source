require('dotenv').config();

const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const session = require('express-session');
const crypto = require('crypto');
const keyPoolManager = require('./services/keyPoolManager');
const userManager = require('./services/userManager');
const proxyPoolManager = require('./services/proxyPoolManager');
const db = require('./services/database');

// Load environment variables
const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const USE_HTTPS = process.env.USE_HTTPS === 'true';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Session middleware for admin authentication
app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: USE_HTTPS,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// IP-based usage tracking for headless mode
const ipUsageCache = new Map(); // { ip: { count: 0, resetDate: Date } }

// Helper function to determine the correct token parameter and limit for OpenAI models
function getModelTokenConfig(model) {
    const modelLower = model.toLowerCase();
    
    // GPT-5 series - ALL variants use max_completion_tokens
    if (modelLower.includes('gpt-5')) {
        // Context: 400k input, 128k output max
        return {
            paramName: 'max_completion_tokens',
            defaultLimit: 150,    // Good for short speech
            maxLimit: 128000      // GPT-5 series max output tokens
        };
    }
    
    // O1/O3/O4 series uses max_completion_tokens
    if (modelLower.includes('o1') || modelLower.includes('o3') || modelLower.includes('o4')) {
        return {
            paramName: 'max_completion_tokens',
            defaultLimit: 2000,   // O-series often needs more for reasoning
            maxLimit: 100000      // O-series models have higher limits
        };
    }
    
    // GPT-4o variants - use max_tokens
    if (modelLower.includes('gpt-4o')) {
        return {
            paramName: 'max_tokens',
            defaultLimit: 150,    // Good for short speech
            maxLimit: 4096        // Standard GPT-4o limit (some versions go to 16k)
        };
    }
    
    // GPT-4 and GPT-3.5-Turbo - use max_tokens
    return {
        paramName: 'max_tokens',
        defaultLimit: 100,        // Conservative default
        maxLimit: 4096           // Standard limit
    };
}

// Discord webhook for notifications
async function sendDiscordNotification(title, message, color = 3447003, fields = []) {
    try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (!webhookUrl) return;

        const embed = {
            title: title,
            description: message,
            color: color,
            timestamp: new Date().toISOString(),
            fields: fields
        };

        await axios.post(webhookUrl, { embeds: [embed] });
    } catch (e) {
        console.error('Failed to send Discord notification:', e.message);
    }
}

// Discord alert for errors (PRIVATE - admin only)
async function sendDiscordAlert(message, error = null) {
    try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (!webhookUrl) return;

        const embed = {
            title: '🚨 Colonist Voices Backend Error',
            description: message,
            color: 15158332,
            timestamp: new Date().toISOString(),
            fields: []
        };

        if (error) {
            // Add basic error message
            embed.fields.push({
                name: 'Error Message',
                value: '```' + (error.message || error.toString()).substring(0, 500) + '```'
            });

            // Add HTTP response details if available (API errors)
            if (error.response) {
                embed.fields.push({
                    name: 'HTTP Status',
                    value: `${error.response.status} ${error.response.statusText || ''}`,
                    inline: true
                });

                // Try to extract API error body
                if (error.response.data) {
                    let apiError = '';
                    try {
                        if (Buffer.isBuffer(error.response.data)) {
                            apiError = error.response.data.toString('utf-8');
                        } else if (typeof error.response.data === 'object') {
                            apiError = JSON.stringify(error.response.data, null, 2);
                        } else {
                            apiError = String(error.response.data);
                        }
                    } catch (e) {
                        apiError = 'Could not parse response body';
                    }

                    embed.fields.push({
                        name: 'API Response',
                        value: '```json\n' + apiError.substring(0, 800) + '```'
                    });
                }
            }

            // Add error code if present
            if (error.code) {
                embed.fields.push({
                    name: 'Error Code',
                    value: error.code,
                    inline: true
                });
            }
        }

        await axios.post(webhookUrl, { embeds: [embed] });
    } catch (e) {
        console.error('Failed to send Discord alert:', e.message);
    }
}

// Send daily health stats to PUBLIC Discord webhook
async function sendPublicHealthStats() {
    try {
        const publicWebhookUrl = 'https://discord.com/api/webhooks/1437297954875510906/FUpUqWU0srzMDJ6Jtb0WK06apUOeLGCFIsKsrMohbm6_3SYgP46tNFQRFFkcUdSCru9c';
        
        // Get key pool stats
        const stats = await keyPoolManager.getStats();
        
        // Calculate leftover quota
        const totalQuota = parseInt(stats.total_quota_available) || 0;
        const usedQuota = parseInt(stats.total_quota_used) || 0;
        const leftoverQuota = totalQuota - usedQuota;
        const quotaPercentage = totalQuota > 0 ? ((leftoverQuota / totalQuota) * 100).toFixed(1) : 0;
        
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
        
        await axios.post(publicWebhookUrl, { embeds: [embed] });
        console.log('✓ Public health stats sent to Discord');
    } catch (error) {
        console.error('Failed to send public health stats:', error.message);
    }
}

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        protocol: USE_HTTPS ? 'https' : 'http'
    });
});

// User registration endpoint
app.post('/api/auth/register', async (req, res) => {
    try {
        const { hardware_id } = req.body;
        
        const user = await userManager.registerUser(hardware_id);
        
        console.log(`[Registration] New user: ${user.user_key}`);
        
        res.json({
            success: true,
            user_key: user.user_key,
            tier: user.tier,
            free_speeches_remaining: user.free_speeches_remaining
        });
    } catch (error) {
        console.error('Registration error:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Code redemption endpoint
app.post('/api/auth/redeem-code', async (req, res) => {
    try {
        const { user_key, code } = req.body;
        
        if (!user_key || !code) {
            return res.status(400).json({
                success: false,
                error: 'Missing user_key or code'
            });
        }
        
        const result = await userManager.redeemCode(user_key, code);
        
        await sendDiscordNotification(
            '🎉 New Supporter!',
            `Code redeemed: ${code}`,
            3066993
        );
        
        res.json({
            success: true,
            tier: result.tier,
            free_speeches_remaining: result.free_speeches_remaining
        });
    } catch (error) {
        console.error('Code redemption error:', error.message);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// User status endpoint
app.get('/api/user/status', async (req, res) => {
    try {
        const { user_key } = req.query;
        
        if (!user_key) {
            return res.status(400).json({
                success: false,
                error: 'Missing user_key'
            });
        }
        
        const status = await userManager.getUserStatus(user_key);
        
        res.json({
            success: true,
            ...status
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Check IP-based rate limit (for headless mode)
async function checkIPRateLimit(ip) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Check database for this IP's usage this month
    const result = await db.query(`
        SELECT COUNT(*) as count
        FROM usage_logs
        WHERE user_id IS NULL
        AND created_at >= DATE_TRUNC('month', NOW())
        AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
    `);
    
    const usageThisMonth = parseInt(result.rows[0].count);
    const limit = 10;
    
    if (usageThisMonth >= limit) {
        return {
            allowed: false,
            remaining: 0,
            limit: limit,
            resetDate: new Date(currentYear, currentMonth + 1, 1)
        };
    }
    
    return {
        allowed: true,
        remaining: limit - usageThisMonth,
        limit: limit,
        resetDate: new Date(currentYear, currentMonth + 1, 1)
    };
}

// Main speech generation endpoint
app.post('/api/speech/generate', async (req, res) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    try {
        console.log(`\n[${requestId}] === New Speech Request ===`);
        
        const {
            user_key, // OPTIONAL now for headless mode
            context,
            system_prompt,
            model,
            voice_id,
            voice_settings
        } = req.body;

        // Validate required fields
        if (!context) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: context'
            });
        }

        if (!system_prompt) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: system_prompt'
            });
        }

        if (!voice_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: voice_id'
            });
        }

        if (!model) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: model'
            });
        }

        let user = null;
        let userTier = 'free';
        let isHeadless = false;

        // HEADLESS MODE: No user_key provided
        if (!user_key) {
            console.log(`[${requestId}] Headless mode - IP: ${clientIP}`);
            
            const rateLimit = await checkIPRateLimit(clientIP);
            
            if (!rateLimit.allowed) {
                return res.status(429).json({
                    success: false,
                    error: 'IP rate limit exceeded. 10 speeches per month without an API key. Register for a free account or support the mod for unlimited usage.',
                    speeches_remaining: 0,
                    limit: rateLimit.limit,
                    reset_date: rateLimit.resetDate
                });
            }
            
            isHeadless = true;
            console.log(`[${requestId}] IP rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
        } 
        // AUTHENTICATED MODE: user_key provided
        else {
            user = await userManager.validateUser(user_key);
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid user_key. Register at /api/auth/register'
                });
            }
            
            userTier = user.tier;
            console.log(`[${requestId}] User: ${user.user_key} (${userTier})`);
        }

        const stability = voice_settings?.stability ?? 0.0;
        const similarity_boost = voice_settings?.similarity_boost ?? 0.75;

        console.log(`[${requestId}] Voice ID: ${voice_id}`);
        console.log(`[${requestId}] Model: ${model}`);

        // Select best ElevenLabs key from pool
        let selectedKey;
        try {
            selectedKey = await keyPoolManager.selectKey(userTier);
            console.log(`[${requestId}] Selected key: ${selectedKey.key_name} (priority ${selectedKey.priority})`);
        } catch (error) {
            console.error(`[${requestId}] Key pool error:`, error.message);
            await sendDiscordAlert(`[${requestId}] No healthy keys available!`, error);
            
            return res.status(503).json({
                success: false,
                error: 'Service temporarily unavailable. No healthy API keys in pool.'
            });
        }

        // Step 1: Call OpenAI
        console.log(`[${requestId}] [1/2] Calling OpenAI...`);
        let speechText;
        let openaiTime;
        
        try {
            const openaiStart = Date.now();
            
            // Get model-specific token configuration
            const tokenConfig = getModelTokenConfig(model);
            
            // Build request body dynamically
            const requestBody = {
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: system_prompt
                    },
                    {
                        role: 'user',
                        content: `Context:\n${context}\n\nGenerate a short spoken line for this colonist:`
                    }
                ]
            };
            
            // Only add temperature for models that support it
            // GPT-5 series and O-series (o1, o3, o4) only support default temperature of 1
            const modelLower = model.toLowerCase();
            const supportsCustomTemperature = !modelLower.includes('gpt-5') && 
                                             !modelLower.includes('o1') && 
                                             !modelLower.includes('o3') && 
                                             !modelLower.includes('o4');
            
            if (supportsCustomTemperature) {
                requestBody.temperature = 0.8;
                console.log(`[${requestId}] Using temperature: 0.8`);
            } else {
                console.log(`[${requestId}] Using default temperature (1) for ${model}`);
            }
            
            // Add the correct token parameter based on model
            requestBody[tokenConfig.paramName] = tokenConfig.defaultLimit;
            
            console.log(`[${requestId}] Using ${tokenConfig.paramName}: ${tokenConfig.defaultLimit} for model: ${model}`);
            
            const openaiResponse = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                requestBody,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                    },
                    timeout: 30000
                }
            );

            openaiTime = Date.now() - openaiStart;
            speechText = openaiResponse.data.choices[0].message.content.trim();
            
            // Validate that we got actual text back
            if (!speechText || speechText.length === 0) {
                console.error(`[${requestId}] ✗ OpenAI returned empty text!`);
                console.error(`[${requestId}] Full response:`, JSON.stringify(openaiResponse.data, null, 2));
                return res.status(500).json({
                    success: false,
                    error: 'OpenAI returned empty text. This may be due to model restrictions or invalid prompts.'
                });
            }
            
            console.log(`[${requestId}] ✓ OpenAI Success (${openaiTime}ms): "${speechText}"`);
            
        } catch (error) {
            console.error(`[${requestId}] ✗ OpenAI Error:`, error.response?.data || error.message);
            await sendDiscordAlert(`[${requestId}] OpenAI API call failed`, error);
            
            return res.status(500).json({
                success: false,
                error: 'OpenAI API call failed: ' + (error.response?.data?.error?.message || error.message)
            });
        }

        // Step 2: Call ElevenLabs with selected key and Oxylabs residential proxy
        console.log(`[${requestId}] [2/2] Calling ElevenLabs with key: ${selectedKey.key_name}...`);
        console.log(`[${requestId}] Voice ID: ${voice_id}`);
        console.log(`[${requestId}] Voice settings - stability: ${stability}, similarity_boost: ${similarity_boost}`);

        // Use Oxylabs residential proxy based on the key's country_code
        const keyCountryCode = selectedKey.country_code || 'us';
        console.log(`[${requestId}] Using Oxylabs residential proxy for country: ${keyCountryCode.toUpperCase()}`);

        let audioData;
        let elevenLabsTime;

        try {
            const elevenLabsStart = Date.now();

            const requestBody = {
                text: speechText,
                model_id: 'eleven_v3',
                voice_settings: {
                    stability: stability,
                    similarity_boost: similarity_boost
                }
            };

            console.log(`[${requestId}] Request body:`, JSON.stringify(requestBody, null, 2));

            // Build axios config with Oxylabs residential proxy
            const axiosConfig = {
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': selectedKey.api_key
                },
                responseType: 'arraybuffer',
                timeout: 30000,
                decompress: true,
                validateStatus: function (status) {
                    return status >= 200 && status < 300;
                }
            };

            // Add Oxylabs residential proxy configuration based on key's country code
            const proxyConfig = proxyPoolManager.getOxylabsProxyConfig(keyCountryCode);
            Object.assign(axiosConfig, proxyConfig);
            console.log(`[${requestId}] Proxy configured: pr.oxylabs.io:7777 (${keyCountryCode.toUpperCase()})`);
            
            const elevenLabsResponse = await axios.post(
                `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`,
                requestBody,
                axiosConfig
            );

            elevenLabsTime = Date.now() - elevenLabsStart;
            audioData = Buffer.from(elevenLabsResponse.data).toString('base64');
            console.log(`[${requestId}] ✓ ElevenLabs Success (${elevenLabsTime}ms): ${audioData.length} chars (base64)`);
            console.log(`[${requestId}] ✓ Oxylabs proxy (${keyCountryCode.toUpperCase()}) worked successfully`);

            // Record success for key pool health tracking
            await keyPoolManager.recordSuccess(selectedKey.id, speechText.length);

        } catch (error) {
            console.error(`[${requestId}] ✗ ElevenLabs Error:`, error.message);
            console.error(`[${requestId}] ✗ Proxy used: Oxylabs (${keyCountryCode.toUpperCase()})`);

            let errorDetail = error.message;
            if (error.response) {
                console.error(`[${requestId}] Response status:`, error.response.status);
                console.error(`[${requestId}] Response headers:`, error.response.headers);

                if (error.response.data) {
                    try {
                        const errorBody = Buffer.isBuffer(error.response.data)
                            ? error.response.data.toString('utf-8')
                            : JSON.stringify(error.response.data);

                        console.error(`[${requestId}] Response body:`, errorBody);

                        const errorJson = JSON.parse(errorBody);
                        errorDetail = errorJson.detail?.message || errorJson.message || errorBody;
                    } catch (parseErr) {
                        console.error(`[${requestId}] Could not parse error:`, parseErr.message);
                    }
                }
            }

            await keyPoolManager.recordFailure(selectedKey.id, errorDetail);

            await sendDiscordAlert(
                `[${requestId}] ElevenLabs API call failed with key: ${selectedKey.key_name} via Oxylabs proxy (${keyCountryCode.toUpperCase()})`,
                error
            );
            
            return res.status(500).json({
                success: false,
                error: 'ElevenLabs API call failed: ' + errorDetail
            });
        }

        const totalTime = Date.now() - startTime;
        console.log(`[${requestId}] ✓ Complete! Total time: ${totalTime}ms`);

        // Update usage
        if (isHeadless) {
            // Log headless usage with NULL user_id
            await db.query(`
                INSERT INTO usage_logs (user_id, elevenlabs_key_id, speech_text, voice_id, model_used, characters_used, success)
                VALUES (NULL, $1, $2, $3, $4, $5, true)
            `, [selectedKey.id, speechText, voice_id, model, speechText.length]);
        } else {
            // Consume speech from user quota
            await userManager.consumeSpeech(user.id);

            // Log usage
            await db.query(`
                INSERT INTO usage_logs (user_id, elevenlabs_key_id, speech_text, voice_id, model_used, characters_used, success)
                VALUES ($1, $2, $3, $4, $5, $6, true)
            `, [user.id, selectedKey.id, speechText, voice_id, model, speechText.length]);
        }

        // Get updated speech count
        let speechesRemaining = null;
        if (isHeadless) {
            const rateLimit = await checkIPRateLimit(clientIP);
            speechesRemaining = rateLimit.remaining;
        } else if (user.tier === 'free') {
            const updated = await db.query('SELECT free_speeches_remaining FROM users WHERE id = $1', [user.id]);
            speechesRemaining = updated.rows[0].free_speeches_remaining;
        }

        // Return success response
        res.json({
            success: true,
            speech_text: speechText,
            audio_data: audioData,
            processing_time_ms: totalTime,
            speeches_remaining: speechesRemaining,
            tier: isHeadless ? 'headless' : userTier
        });

    } catch (error) {
        console.error(`\n[${requestId}] ✗ Unexpected Error:`, error);
        await sendDiscordAlert(`[${requestId}] Unexpected server error`, error);
        
        res.status(500).json({
            success: false,
            error: 'Internal server error: ' + error.message
        });
    }
});

// Test endpoint
app.post('/api/test', async (req, res) => {
    try {
        console.log('Test request received:', req.body);
        
        res.json({
            success: true,
            message: 'Backend is working!',
            received: req.body,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Admin authentication middleware
function requireAdminAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.status(401).sendFile(__dirname + '/admin-login.html');
}

// Admin login endpoint
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
        return res.status(500).json({
            success: false,
            error: 'Admin password not configured. Set ADMIN_PASSWORD in .env file.'
        });
    }
    
    if (password === adminPassword) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

// Admin logout endpoint
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Check admin auth status
app.get('/api/admin/check-auth', (req, res) => {
    res.json({ isAuthenticated: !!(req.session && req.session.isAdmin) });
});

// Serve admin dashboard (protected)
app.get('/admin', requireAdminAuth, (req, res) => {
    res.sendFile(__dirname + '/admin.html');
});

// ADMIN API ENDPOINTS (all protected)
app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
    try {
        const key_stats = await keyPoolManager.getStats();
        const user_stats = await userManager.getStats();
        const proxy_stats = await proxyPoolManager.getStats();
        res.json({ success: true, key_stats, user_stats, proxy_stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/keys', requireAdminAuth, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM elevenlabs_keys ORDER BY priority ASC, status ASC');
        res.json({ success: true, keys: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/keys', requireAdminAuth, async (req, res) => {
    try {
        const key = await keyPoolManager.addKey(req.body);
        res.json({ success: true, key });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/keys/:id/pause', requireAdminAuth, async (req, res) => {
    try {
        await keyPoolManager.pauseKey(req.params.id, 'Manual pause via admin dashboard');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/keys/:id/resume', requireAdminAuth, async (req, res) => {
    try {
        await keyPoolManager.resumeKey(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/keys/:id/reset-health', requireAdminAuth, async (req, res) => {
    try {
        await keyPoolManager.resetHealth(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/admin/keys/:id', requireAdminAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM elevenlabs_keys WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/keys/:id/update-country', requireAdminAuth, async (req, res) => {
    try {
        const { country_code } = req.body;
        if (!country_code) {
            return res.status(400).json({ success: false, error: 'country_code is required' });
        }
        await db.query(
            'UPDATE elevenlabs_keys SET country_code = $1, updated_at = NOW() WHERE id = $2',
            [country_code.toLowerCase(), req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test Oxylabs proxy connection
app.post('/api/admin/test-oxylabs-proxy', requireAdminAuth, async (req, res) => {
    try {
        const { country_code } = req.body;
        const cc = (country_code || 'us').toLowerCase();

        console.log(`[ProxyTest] Testing Oxylabs proxy for country: ${cc.toUpperCase()}`);

        // Get a healthy key for testing
        const keyResult = await db.query(`
            SELECT id, api_key, key_name FROM elevenlabs_keys
            WHERE status = 'active' AND health_score >= 80
            ORDER BY health_score DESC
            LIMIT 1
        `);

        if (keyResult.rows.length === 0) {
            return res.status(503).json({
                success: false,
                error: 'No healthy ElevenLabs keys available for testing'
            });
        }

        const testKey = keyResult.rows[0];
        const startTime = Date.now();

        // Get Oxylabs proxy config
        const proxyConfig = proxyPoolManager.getOxylabsProxyConfig(cc);
        const proxyUrl = proxyPoolManager.buildOxylabsProxyUrl(cc);
        console.log(`[ProxyTest] Using proxy URL: ${proxyUrl.replace(/:[^:@]+@/, ':****@')}`);

        // Test with ElevenLabs
        const testResponse = await axios.post(
            'https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL',
            {
                text: 'Test',
                model_id: 'eleven_turbo_v2_5',
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': testKey.api_key
                },
                responseType: 'arraybuffer',
                timeout: 30000,
                ...proxyConfig
            }
        );

        const responseTime = Date.now() - startTime;

        if (testResponse.status === 200 && testResponse.data) {
            console.log(`[ProxyTest] SUCCESS - ${responseTime}ms`);
            res.json({
                success: true,
                message: `Proxy test successful for ${cc.toUpperCase()}`,
                response_time_ms: responseTime,
                key_used: testKey.key_name,
                proxy_host: 'pr.oxylabs.io:7777',
                country: cc.toUpperCase()
            });
        } else {
            res.json({
                success: false,
                error: `Unexpected response: ${testResponse.status}`
            });
        }

    } catch (error) {
        console.error('[ProxyTest] FAILED:', error.message);

        let errorDetail = error.message;
        if (error.response) {
            errorDetail = `HTTP ${error.response.status}: ${error.response.statusText}`;
            if (error.response.data) {
                try {
                    const body = Buffer.isBuffer(error.response.data)
                        ? error.response.data.toString('utf-8')
                        : JSON.stringify(error.response.data);
                    errorDetail += ` - ${body.substring(0, 200)}`;
                } catch (e) {}
            }
        } else if (error.code === 'ECONNREFUSED') {
            errorDetail = 'Connection refused - proxy may be offline';
        } else if (error.code === 'ETIMEDOUT') {
            errorDetail = 'Connection timed out';
        } else if (error.code === 'ENOTFOUND') {
            errorDetail = 'Proxy host not found';
        } else if (error.code === 'ECONNRESET') {
            errorDetail = 'Connection reset by proxy';
        }

        res.json({
            success: false,
            error: errorDetail,
            error_code: error.code || ''
        });
    }
});

app.get('/api/admin/users', requireAdminAuth, async (req, res) => {
    try {
        const result = await db.query('SELECT user_key, username, tier, total_speeches_generated, free_speeches_remaining, created_at, last_used FROM users ORDER BY created_at DESC LIMIT 100');
        res.json({ success: true, users: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/users/update-username', requireAdminAuth, async (req, res) => {
    try {
        const { user_key, username } = req.body;
        
        if (!user_key) {
            return res.status(400).json({ success: false, error: 'Missing user_key' });
        }
        
        // Allow empty username to clear it
        const result = await db.query(
            'UPDATE users SET username = $1 WHERE user_key = $2 RETURNING username',
            [username || null, user_key]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        res.json({ success: true, username: result.rows[0].username });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/codes', requireAdminAuth, async (req, res) => {
    try {
        const result = await db.query('SELECT code, tier, used_by, created_at, redeemed_at FROM supporter_codes ORDER BY created_at DESC LIMIT 100');
        res.json({ success: true, codes: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/codes/generate', requireAdminAuth, async (req, res) => {
    try {
        const { count, tier } = req.body;
        const codes = await userManager.generateSupporterCodes(parseInt(count), tier, 'admin-dashboard');
        res.json({ success: true, codes });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/logs', requireAdminAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const result = await db.query('SELECT l.*, u.tier as user_tier, u.username, k.key_name, p.proxy_name FROM usage_logs l LEFT JOIN users u ON l.user_id = u.id LEFT JOIN elevenlabs_keys k ON l.elevenlabs_key_id = k.id LEFT JOIN proxies p ON l.proxy_id = p.id ORDER BY l.created_at DESC LIMIT $1', [limit]);
        res.json({ success: true, logs: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PROXY MANAGEMENT ENDPOINTS
app.get('/api/admin/proxies', requireAdminAuth, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM proxies ORDER BY priority ASC, status ASC');
        res.json({ success: true, proxies: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/proxies/stats', requireAdminAuth, async (req, res) => {
    try {
        const stats = await proxyPoolManager.getStats();
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/proxies/test', requireAdminAuth, async (req, res) => {
    try {
        const { proxy_url, proxy_type } = req.body;
        
        if (!proxy_url) {
            return res.status(400).json({ success: false, error: 'proxy_url is required' });
        }

        const startTime = Date.now();
        
        // Get a healthy key for testing
        const keyResult = await db.query(`
            SELECT id, api_key FROM elevenlabs_keys
            WHERE status = 'active' AND health_score >= 80
            ORDER BY health_score DESC
            LIMIT 1
        `);
        
        if (keyResult.rows.length === 0) {
            return res.status(503).json({
                success: false,
                error: 'No healthy ElevenLabs keys available for testing'
            });
        }
        
        const testKey = keyResult.rows[0];
        
        // Parse proxy URL
        let proxyConfig = {};
        try {
            const url = new URL(proxy_url);
            proxyConfig = {
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
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: 'Invalid proxy URL format',
                details: error.message
            });
        }
        
        // Test the proxy with ElevenLabs
        const testResponse = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL`, // Default "Sarah" voice
            {
                text: 'Working',
                model_id: 'eleven_turbo_v2_5',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': testKey.api_key
                },
                responseType: 'arraybuffer',
                timeout: 30000,
                ...proxyConfig
            }
        );
        
        const responseTime = Date.now() - startTime;
        
        if (testResponse.status === 200 && testResponse.data) {
            res.json({
                success: true,
                message: 'Proxy test successful',
                response_time_ms: responseTime
            });
        } else {
            res.json({
                success: false,
                error: 'Unexpected response from ElevenLabs',
                details: `Status: ${testResponse.status}`
            });
        }
        
    } catch (error) {
        console.error('Proxy test error:', error.message);
        
        let errorDetail = error.message;
        if (error.response) {
            errorDetail = `HTTP ${error.response.status}: ${error.response.statusText}`;
        } else if (error.code === 'ECONNREFUSED') {
            errorDetail = 'Connection refused - proxy may be offline';
        } else if (error.code === 'ETIMEDOUT') {
            errorDetail = 'Connection timed out';
        } else if (error.code === 'ENOTFOUND') {
            errorDetail = 'Proxy host not found';
        }
        
        res.json({
            success: false,
            error: errorDetail,
            details: error.code || ''
        });
    }
});

app.post('/api/admin/proxies', requireAdminAuth, async (req, res) => {
    try {
        const proxy = await proxyPoolManager.addProxy(req.body);
        res.json({ success: true, proxy });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/proxies/:id/pause', requireAdminAuth, async (req, res) => {
    try {
        await proxyPoolManager.pauseProxy(req.params.id, 'Manual pause via admin dashboard');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/proxies/:id/resume', requireAdminAuth, async (req, res) => {
    try {
        await proxyPoolManager.resumeProxy(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/proxies/:id/reset-health', requireAdminAuth, async (req, res) => {
    try {
        await proxyPoolManager.resetHealth(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/admin/proxies/:id', requireAdminAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM proxies WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    sendDiscordAlert('Unhandled server error', err);
    
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Start server(s)
if (USE_HTTPS) {
    const sslKeyPath = process.env.SSL_KEY_PATH || '/etc/letsencrypt/live/api.leadleap.net/privkey.pem';
    const sslCertPath = process.env.SSL_CERT_PATH || '/etc/letsencrypt/live/api.leadleap.net/fullchain.pem';
    
    const httpsOptions = {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath)
    };

    https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
        console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║        🎙️  COLONIST VOICES BACKEND v2.0 STARTED  🎙️         ║
║                                                                ║
║  HTTPS Server: https://api.leadleap.net:${HTTPS_PORT}                  ║
║  Environment: ${process.env.NODE_ENV || 'development'}                                    ║
║                                                                ║
║  Features:                                                     ║
║  • User API key system with tiers                             ║
║  • Headless mode (10 speeches/month per IP)                   ║
║  • ElevenLabs key pool with intelligent selection             ║
║  • Automatic failover & health monitoring                     ║
║                                                                ║
║  Endpoints:                                                    ║
║  • GET  /health                                                ║
║  • POST /api/auth/register                                     ║
║  • POST /api/auth/redeem-code                                  ║
║  • GET  /api/user/status                                       ║
║  • POST /api/speech/generate                                   ║
║                                                                ║
║  Management:                                                   ║
║  • node manage-keys.js list                                    ║
║  • node manage-keys.js stats                                   ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
        `);
        
        sendDiscordNotification(
            '🚀 Backend v2.0 Started (HTTPS)',
            `Server running with key pool and user management`,
            3066993
        );
    });

    http.createServer((req, res) => {
        res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
        res.end();
    }).listen(PORT, () => {
        console.log(`HTTP redirect server running on port ${PORT}`);
    });

} else {
    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║        🎙️  COLONIST VOICES BACKEND v2.0 STARTED  🎙️         ║
║                                                                ║
║  Server running on: http://localhost:${PORT}                     ║
║  Environment: ${process.env.NODE_ENV || 'development'}                                    ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
        `);
    });
}

// Schedule daily public health stats (runs at midnight UTC)
setInterval(async () => {
    const now = new Date();
    if (now.getUTCHours() === 0 && now.getUTCMinutes() === 0) {
        console.log('🔔 Sending daily public health stats...');
        await sendPublicHealthStats();
    }
}, 60000); // Check every minute

// Note: Removed automatic health stats on startup to avoid spam during development/restarts
// Health stats will only be sent once daily at midnight UTC

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    sendDiscordAlert('🛑 Backend server shutting down (SIGTERM)');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    sendDiscordAlert('🛑 Backend server shutting down (SIGINT)');
    process.exit(0);
});
