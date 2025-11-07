# Architecture Overview

## System Design

```
┌─────────────────┐
│   RimWorld Game │
│   (Frontend)    │
└────────┬────────┘
         │ HTTP/HTTPS
         │
┌────────▼────────┐      ┌──────────────┐
│  Node.js API    │◄────►│  PostgreSQL  │
│   (Backend)     │      │   Database   │
└────────┬────────┘      └──────────────┘
         │
         ├──────────┐
         │          │
┌────────▼─────┐  ┌▼──────────────┐
│  OpenAI API  │  │ ElevenLabs API│
│   (GPT-4)    │  │  (TTS v3)     │
└──────────────┘  └───────────────┘
```

## Components

### Frontend (RimWorld Mod)
**Language:** C# (.NET Framework 4.7.2)
**Purpose:** In-game integration

**Key Classes:**
- `SpeechController` - Main controller, triggers speech
- `BackendAPIHandler` - API client
- `ColonistContextBuilder` - Context generation
- `AudioManager` - Audio playback
- `VoiceSelector` - Voice assignment
- `ColonistVoicesSettings` - UI and settings

**Flow:**
1. Game triggers speech event
2. Build colonist context
3. Send to backend API
4. Receive audio + text
5. Play in-game with subtitles

### Backend (API Server)
**Language:** Node.js + Express
**Purpose:** API key management, AI orchestration

**Services:**
- `database.js` - PostgreSQL connection
- `keyPoolManager.js` - ElevenLabs key pool
- `userManager.js` - User authentication

**Flow:**
1. Receive speech request
2. Authenticate user
3. Select best ElevenLabs key
4. Call OpenAI for dialogue
5. Call ElevenLabs for audio
6. Return to frontend
7. Log usage

### Database (PostgreSQL)
**Tables:**
- `users` - User accounts and quotas
- `supporter_codes` - Redemption codes
- `elevenlabs_keys` - API key pool
- `usage_logs` - Analytics

## Data Flow

### Speech Generation Request
```
1. Frontend → Backend
   POST /api/speech/generate
   Body: {
     user_key: "CV-XXXX-...",
     context: "colonist info",
     system_prompt: "AI instructions",
     model: "gpt-4o-mini",
     voice_id: "elevenlabs_id",
     voice_settings: {...}
   }

2. Backend → OpenAI
   Generate dialogue text

3. Backend → ElevenLabs
   Generate audio from text

4. Backend → Frontend
   Response: {
     success: true,
     speech_text: "...",
     audio_data: "base64...",
     speeches_remaining: 7
   }

5. Frontend
   Decode audio, play in-game
```

### User Registration
```
1. Frontend → Backend
   POST /api/auth/register
   Body: { hardware_id: "..." }

2. Backend
   - Check device limit
   - Generate unique key
   - Create user record

3. Backend → Frontend
   Response: {
     user_key: "CV-XXXX-...",
     tier: "free",
     free_speeches_remaining: 10
   }
```

## Key Pool System

**Purpose:** Manage multiple ElevenLabs API keys efficiently

**Features:**
- Load balancing across keys
- Priority routing (free/supporter/premium)
- Health monitoring
- Automatic failover
- Quota management

**Selection Algorithm:**
1. Get all healthy keys (health >= 70, not exhausted)
2. Filter by user tier
3. Sort by: priority → cost → health
4. Round-robin among top-priority keys

**Health Tracking:**
- +2 points per success
- -10 points per failure
- Auto-pause at 5 consecutive failures
- Monthly quota reset

## Security

### Authentication
- Users identified by unique keys (CV-XXXX-...)
- Hardware ID limits (max 3 accounts per device)
- Supporter codes for tier upgrades

### API Security
- No API keys stored on frontend
- All keys managed server-side
- CORS enabled for rimworld requests only
- Rate limiting per user/IP
- Session management for admin

### Data Privacy
- Only colonist game data sent (no personal info)
- Hardware IDs hashed
- Usage logs anonymizable
- GDPR compliant

## Performance

### Caching
- Key pool cached (60s TTL)
- Voice assignments cached per game session
- Speech history cached (last 5 per colonist)

### Optimization
- Async/non-blocking requests
- Connection pooling (PostgreSQL)
- Efficient DB queries
- Minimal frontend overhead

### Scaling
- Horizontal: Add more backend instances
- Vertical: Increase PostgreSQL resources
- Key pool: Add more ElevenLabs accounts
- CDN: Serve static assets (if needed)

## Monitoring

### Logs
- Request/response logging
- Error tracking
- Performance metrics
- Usage analytics

### Alerts (Discord Webhooks)
- Service errors
- Key failures
- New registrations
- Code redemptions

## Future Improvements

- [ ] Redis caching layer
- [ ] Admin dashboard UI
- [ ] Automated key health checks
- [ ] Load balancer setup
- [ ] Kubernetes deployment
- [ ] Rate limit middleware
- [ ] API versioning
