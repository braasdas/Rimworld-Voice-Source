# ElevenLabs Key Redemption Discord Bot

A Discord bot that allows users to redeem ElevenLabs API keys and automatically adds them to your backend's key pool.

## Features

✅ **Self-Service Key Redemption** - Users can submit their ElevenLabs API keys via `/redeem` command  
✅ **Automatic Validation** - Tests keys against ElevenLabs API before accepting  
✅ **Database Integration** - Automatically adds valid keys to your PostgreSQL database  
✅ **Smart Tier Detection** - Automatically detects subscription tier and quota limits  
✅ **Discord Notifications** - Sends webhook notifications when new keys are added  
✅ **Statistics Command** - View key pool health and usage with `/stats`

## Commands

- `/redeem <key>` - Redeem an ElevenLabs API key (ephemeral - only you can see it)
- `/stats` - View key pool statistics

## Setup Instructions

### 1. Install Dependencies

```bash
cd discord-bot
npm install
```

### 2. Environment Variables

The bot uses the parent backend's `.env` file. Make sure it contains:

```env
DATABASE_URL=postgresql://user:password@host:port/database
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
```

### 3. Discord Bot Configuration

The bot token should be configured in the `.env` file:
- **Token:** Set `DISCORD_BOT_TOKEN` in your `.env` file
- **Client ID:** `1437411061560250430`

### 4. Bot Permissions

When inviting the bot to your server, ensure it has these permissions:
- Send Messages
- Use Slash Commands
- Read Message History

**Invite Link:**
```
https://discord.com/api/oauth2/authorize?client_id=1437411061560250430&permissions=2147485696&scope=bot%20applications.commands
```

### 5. Run the Bot

```bash
npm start
```

Or with auto-restart on file changes:
```bash
npm run dev
```

## How It Works

### 1. Key Validation Flow

```
User submits /redeem <key>
    ↓
Bot tests key with ElevenLabs API
GET https://api.elevenlabs.io/v1/user/subscription
    ↓
If valid: Extract subscription info
    ↓
Add to PostgreSQL database
    ↓
Send Discord notification
    ↓
Confirm to user
```

### 2. Key Testing

The bot validates keys by calling the ElevenLabs subscription endpoint:

```javascript
GET https://api.elevenlabs.io/v1/user/subscription
Headers: { 'xi-api-key': 'YOUR_KEY' }
```

**Valid Response (200):**
```json
{
  "tier": "starter",
  "character_count": 25000,
  "character_limit": 30000,
  "next_character_count_reset_unix": 1734567890
}
```

**Invalid Key (401):**
```json
{
  "detail": {
    "status": "unauthorized",
    "message": "Invalid API key"
  }
}
```

### 3. Database Integration

Keys are added with:
- **Unique name:** `discord_username_timestamp`
- **Tier mapping:** Automatically maps ElevenLabs tiers to your internal tiers
- **Quota tracking:** Sets `monthly_quota`, `quota_used_this_month`, and `quota_reset_date`
- **Health:** Starts at 100% health
- **Priority:** Default priority of 5
- **Notes:** Records who submitted it and original tier

### 4. Tier Mapping

| ElevenLabs Tier | Internal Tier | Monthly Quota | Cost per Char |
|----------------|---------------|---------------|---------------|
| free           | promo_starter | 10,000        | $0.00000      |
| starter        | promo_starter | 30,000        | $0.00030      |
| creator        | creator       | 100,000       | $0.00018      |
| pro            | pro           | 500,000       | $0.00016      |
| scale          | scale         | 2,000,000     | $0.00011      |
| business       | business      | 11,000,000    | $0.00009      |

## Security Considerations

⚠️ **IMPORTANT:** The bot token is hardcoded for this implementation. For production:

1. **Never commit tokens to public repos**
2. Consider moving the token to `.env`:
   ```env
   DISCORD_BOT_TOKEN=your_token_here
   ```
3. Restrict bot permissions to only what's needed
4. Use Discord's OAuth2 scope restrictions

## Error Handling

The bot handles various error scenarios:

- **Invalid Key (401):** "Invalid API key - authentication failed"
- **Rate Limited (429):** "Rate limit exceeded - key may be valid but temporarily blocked"
- **Duplicate Key:** "This API key has already been added to the pool"
- **Network Errors:** "Network error: [details]"
- **Database Errors:** Caught and reported to user

## Monitoring

The bot logs:
- ✅ Successful key additions
- ❌ Failed validation attempts
- 🔍 All key redemption attempts
- 📊 Statistics queries

## Database Schema

Keys are added to the `elevenlabs_keys` table with these fields:

```sql
id UUID PRIMARY KEY
key_name VARCHAR(100)
api_key VARCHAR(255)
tier VARCHAR(50)
cost_per_char DECIMAL(10, 8)
monthly_quota INTEGER
quota_used_this_month INTEGER
quota_reset_date DATE
priority INTEGER DEFAULT 5
status VARCHAR(50) DEFAULT 'active'
health_score DECIMAL(5, 2) DEFAULT 100.0
notes TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

## Troubleshooting

### Bot Not Responding to Commands

1. Check if bot is online in Discord
2. Verify slash commands are registered:
   ```bash
   node bot.js
   # Should see: "✅ Slash commands registered successfully!"
   ```
3. Wait 5-10 minutes for Discord to propagate commands globally
4. Try kicking and re-inviting the bot

### Database Connection Errors

1. Verify `DATABASE_URL` in `.env` is correct
2. Check PostgreSQL is running
3. Ensure database user has INSERT permissions on `elevenlabs_keys` table

### Key Validation Failures

1. Test the key manually:
   ```bash
   curl -H "xi-api-key: YOUR_KEY" https://api.elevenlabs.io/v1/user/subscription
   ```
2. Check if key has been deleted from ElevenLabs account
3. Verify key hasn't exceeded rate limits

## Advanced: Running as a Service

### Using PM2 (Recommended)

```bash
npm install -g pm2
pm2 start bot.js --name elevenlabs-bot
pm2 save
pm2 startup
```

### Using systemd (Linux)

Create `/etc/systemd/system/elevenlabs-bot.service`:

```ini
[Unit]
Description=ElevenLabs Discord Bot
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/backend/discord-bot
ExecStart=/usr/bin/node bot.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable elevenlabs-bot
sudo systemctl start elevenlabs-bot
```

## Support

For issues or questions:
1. Check bot logs: `console.log` output
2. Review Discord webhook for error notifications
3. Check database logs for INSERT failures
4. Verify ElevenLabs API status: https://status.elevenlabs.io/

## License

MIT
