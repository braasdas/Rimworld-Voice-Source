-- Proxy Pool Table for rotating IPs
CREATE TABLE IF NOT EXISTS proxies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proxy_name VARCHAR(100) NOT NULL,
    proxy_url VARCHAR(500) NOT NULL, -- Format: http://username:password@host:port or socks5://...
    proxy_type VARCHAR(20) DEFAULT 'http', -- http, https, socks5
    status VARCHAR(50) DEFAULT 'active', -- active, paused, failed
    health_score DECIMAL(5, 2) DEFAULT 100.0,
    consecutive_failures INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    last_success TIMESTAMP,
    last_failure TIMESTAMP,
    last_failure_reason TEXT,
    priority INTEGER DEFAULT 5, -- 1 = highest priority, 10 = lowest
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add proxy_id to usage_logs to track which proxy was used
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS proxy_id UUID REFERENCES proxies(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_proxies_status ON proxies(status);
CREATE INDEX IF NOT EXISTS idx_proxies_priority ON proxies(priority);
CREATE INDEX IF NOT EXISTS idx_usage_logs_proxy_id ON usage_logs(proxy_id);

-- Add example proxy (replace with your actual proxy)
INSERT INTO proxies (proxy_name, proxy_url, proxy_type, priority, notes)
VALUES ('Example Proxy', 'http://username:password@proxy.example.com:8080', 'http', 5, 'Example proxy - replace with real proxy')
ON CONFLICT DO NOTHING;
