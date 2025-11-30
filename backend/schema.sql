-- User API Keys Table (for users accessing YOUR backend)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_key VARCHAR(255) UNIQUE NOT NULL,
    hardware_id VARCHAR(255),
    tier VARCHAR(50) DEFAULT 'free',
    free_speeches_remaining INTEGER DEFAULT 10,
    total_speeches_generated INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP,
    supporter_code_used VARCHAR(100),
    notes TEXT
);

-- Supporter Codes Table (for redeeming supporter access)
CREATE TABLE IF NOT EXISTS supporter_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    tier VARCHAR(50) DEFAULT 'supporter',
    used_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    redeemed_at TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'admin',
    notes TEXT
);

-- ElevenLabs API Key Pool Table (for managing multiple ElevenLabs accounts)
CREATE TABLE IF NOT EXISTS elevenlabs_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name VARCHAR(100) NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    tier VARCHAR(50) DEFAULT 'promo_starter',
    cost_per_char DECIMAL(10, 8) DEFAULT 0.00015,
    monthly_quota INTEGER DEFAULT 30000,
    quota_used_this_month INTEGER DEFAULT 0,
    quota_reset_date DATE,
    priority INTEGER DEFAULT 5,
    status VARCHAR(50) DEFAULT 'active',
    health_score DECIMAL(5, 2) DEFAULT 100.0,
    consecutive_failures INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    last_success TIMESTAMP,
    last_failure TIMESTAMP,
    last_failure_reason TEXT,
    promo_type VARCHAR(100),
    promo_expires_at DATE,
    notes TEXT,
    country_code VARCHAR(10) DEFAULT 'us',  -- ISO 3166-1 alpha-2 country code for Oxylabs proxy
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage Logs Table (for analytics and debugging)
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    elevenlabs_key_id UUID REFERENCES elevenlabs_keys(id) ON DELETE SET NULL,
    speech_text TEXT,
    voice_id VARCHAR(100),
    model_used VARCHAR(50),
    characters_used INTEGER,
    cost_openai DECIMAL(10, 6),
    cost_elevenlabs DECIMAL(10, 6),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_user_key ON users(user_key);
CREATE INDEX IF NOT EXISTS idx_users_hardware_id ON users(hardware_id);
CREATE INDEX IF NOT EXISTS idx_supporter_codes_code ON supporter_codes(code);
CREATE INDEX IF NOT EXISTS idx_elevenlabs_keys_status ON elevenlabs_keys(status);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);

-- Insert default admin key (for initial setup)
INSERT INTO elevenlabs_keys (key_name, api_key, tier, cost_per_char, monthly_quota, priority, notes)
VALUES ('default_key', 'YOUR_ELEVENLABS_KEY_HERE', 'main', 0.00011, 100000, 1, 'Default production key')
ON CONFLICT DO NOTHING;
