# Colonist Voices Backend

Node.js API server that handles OpenAI and ElevenLabs API calls for the RimWorld Colonist Voices mod.

## Features

- **User Authentication** - API key system with free/supporter/premium tiers
- **Key Pool Management** - Intelligent load balancing across multiple ElevenLabs accounts
- **Health Monitoring** - Automatic failover and health tracking
- **Headless Mode** - 10 free speeches/month without registration
- **Usage Tracking** - Comprehensive logging and analytics

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Setup Database
```bash
# Create PostgreSQL database
createdb colonist_voices

# Run schema
psql colonist_voices < schema.sql
```

### 4. Run Server
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Health Check
```
GET /health
```

### User Registration
```
POST /api/auth/register
Body: { hardware_id: "optional" }
```

### Code Redemption
```
POST /api/auth/redeem-code
Body: { user_key: "CV-...", code: "COLONIST-..." }
```

### Speech Generation
```
POST /api/speech/generate
Body: {
  user_key: "optional",
  context: "colonist context",
  system_prompt: "AI instructions",
  model: "gpt-4o-mini",
  voice_id: "elevenlabs_voice_id",
  voice_settings: { stability: 0.0, similarity_boost: 0.75 }
}
```

## Environment Variables

```env
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-proj-...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... (optional)
PORT=3000
HTTPS_PORT=3443
USE_HTTPS=false
```

## Deployment

See [docs/BACKEND_SETUP.md](../docs/BACKEND_SETUP.md) for detailed deployment instructions.

## License

MIT
