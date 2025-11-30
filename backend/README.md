# Colonist Voices Backend

Backend API server for the RimWorld Colonist Voices mod. Handles OpenAI and ElevenLabs API calls centrally.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your API keys:
```bash
cp .env.example .env
```

Edit `.env`:
```env
OPENAI_API_KEY=sk-your-key-here
ELEVENLABS_API_KEY=your-key-here
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
PORT=3000
```

### 3. Run the Server

**Development mode (auto-restart on changes):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## API Endpoints

### Health Check
```
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

### Generate Speech
```
POST /api/speech/generate
```

Request body:
```json
{
  "context": "You are John, a colonist...",
  "system_prompt": "You are a colonist in RimWorld...",
  "model": "gpt-4o-mini",
  "voice_id": "21m00Tcm4TlvDq8ikWAM",
  "voice_settings": {
    "stability": 0.0,
    "similarity_boost": 0.75
  }
}
```

Response (success):
```json
{
  "success": true,
  "speech_text": "[excited] This is amazing!",
  "audio_data": "base64_encoded_mp3_data...",
  "processing_time_ms": 2543
}
```

Response (error):
```json
{
  "success": false,
  "error": "OpenAI API call failed: ..."
}
```

### Test Endpoint
```
POST /api/test
```

Simple test endpoint to verify the server is working.

## Configuration

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `ELEVENLABS_API_KEY`: Your ElevenLabs API key (required)
- `DISCORD_WEBHOOK_URL`: Discord webhook for error notifications (optional)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `RATE_LIMIT`: Requests per minute limit (default: 100)

### Security Notes

1. **Never commit `.env` file** - it contains your API keys
2. **Use HTTPS in production** - get a free SSL cert with Let's Encrypt
3. **Set API spending limits** on OpenAI and ElevenLabs dashboards
4. Consider adding authentication for production use

## Deployment

### Option 1: Local Server
Run on your own machine/server using the instructions above.

Access via: `http://YOUR_IP:3000`

### Option 2: VPS (DigitalOcean, Linode, etc.)
1. Create a VPS ($5-10/month)
2. Install Node.js 18+
3. Clone/upload this backend folder
4. Install dependencies: `npm install`
5. Configure `.env` file
6. Run with PM2 for auto-restart:
   ```bash
   npm install -g pm2
   pm2 start server.js --name colonist-voices
   pm2 startup
   pm2 save
   ```

### Option 3: Railway.app (Easiest)
1. Sign up at railway.app
2. Create new project from GitHub
3. Add environment variables in dashboard
4. Auto-deploys on git push
5. Provides HTTPS domain automatically

## Monitoring

- Server logs all requests to console
- Errors are sent to Discord webhook (if configured)
- Check `/health` endpoint for server status

## Cost Estimates

Per 1000 speech requests:
- OpenAI (gpt-4o-mini): ~$0.15
- ElevenLabs (turbo_v2.5): ~$3.00
- **Total: ~$3.15 per 1000 requests**

With 100 active users @ 1 speech/day:
- 3,000 requests/month
- Cost: ~$9.45/month

## Troubleshooting

**Server won't start:**
- Check if port 3000 is already in use
- Verify `.env` file exists and has valid API keys
- Check `npm install` completed successfully

**"OpenAI API call failed":**
- Verify `OPENAI_API_KEY` in `.env` is correct
- Check OpenAI dashboard for API key status
- Ensure API key has sufficient credits

**"ElevenLabs API call failed":**
- Verify `ELEVENLABS_API_KEY` in `.env` is correct
- Check ElevenLabs dashboard for quota/credits
- Ensure voice_id exists and is accessible

**Discord webhook not working:**
- Verify webhook URL is correct in `.env`
- Check Discord server settings allow webhooks
- Test webhook with a manual curl request

## Development

### Adding New Features

Edit `server.js` and add new endpoints as needed. The structure is:

```javascript
app.post('/api/your-endpoint', async (req, res) => {
    try {
        // Your logic here
        res.json({ success: true, data: ... });
    } catch (error) {
        console.error(error);
        await sendDiscordAlert('Error message', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
```

### Testing

Use curl or Postman to test endpoints:

```bash
# Health check
curl http://localhost:3000/health

# Test endpoint
curl -X POST http://localhost:3000/api/test \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Speech generation (with your data)
curl -X POST http://localhost:3000/api/speech/generate \
  -H "Content-Type: application/json" \
  -d @test-request.json
```

## License

MIT
