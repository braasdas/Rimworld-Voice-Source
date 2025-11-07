# Colonist Voices - AI Speech for RimWorld

![RimWorld](https://img.shields.io/badge/RimWorld-1.6-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Discord](https://img.shields.io/badge/Discord-Join%20Us-7289DA)

**Give your colonists unique AI-generated voices that react to their emotions, situations, and personalities!**

[Steam Workshop]([https://steamcommunity.com/sharedfiles/filedetails/?id=3600539208]) | [Discord Server](https://discord.gg/yWC3Arr7pA) | [Report Issues](https://github.com/braasdas/colonist-voices/issues)

---

## 🎤 Features

- **Emotionally Expressive Speech** - Colonists laugh, sigh, whisper, and express emotions naturally
- **Context-Aware Dialogue** - Speech based on mood, health, relationships, and current activities
- **Unique Voices** - Each colonist gets their own AI-generated voice
- **No Setup Required** - Everything works out of the box
- **Free Demo** - 10 speeches/month for unregistered users
- **Unlimited Access** - Free for Discord community supporters
- **Managed Backend** - No API keys needed, all handled server-side

---

## 📁 Repository Structure

```
colonist-voices/
├── frontend/          # RimWorld mod (C#)
│   ├── About/        # Mod metadata
│   ├── Assemblies/   # Compiled DLL (not in repo)
│   └── Source/       # C# source code
├── backend/          # Node.js API server
│   ├── services/     # Service modules
│   ├── server.js     # Main server file
│   └── schema.sql    # Database schema
├── docs/             # Documentation
└── README.md
```

---

## 🚀 Quick Start

### For Users

1. Subscribe to the mod on [Steam Workshop](YOUR_WORKSHOP_LINK)
2. Launch RimWorld and enable the mod
3. Play! First 10 speeches are free
4. Join [Discord](https://discord.gg/yWC3Arr7pA) for unlimited access codes

### For Developers

See the detailed setup guides:
- **[Frontend Development Guide](docs/FRONTEND_SETUP.md)** - Building the RimWorld mod
- **[Backend Development Guide](docs/BACKEND_SETUP.md)** - Running the API server
- **[Contributing Guide](docs/CONTRIBUTING.md)** - How to contribute

---

## 🏗️ Architecture

### Frontend (RimWorld Mod)

The mod is written in C# and integrates with RimWorld using Harmony patches. It:

- Monitors colonist thoughts, moods, and activities
- Builds contextual information about each colonist
- Sends requests to the backend API
- Plays received audio in-game
- Manages user authentication and speech history

**Key Files:**
- `SpeechController.cs` - Main mod controller
- `BackendAPIHandler.cs` - API communication
- `ColonistContextBuilder.cs` - Context generation
- `AudioManager.cs` - Audio playback
- `VoiceSelector.cs` - Voice assignment

### Backend (Node.js API)

The backend handles all AI communication and manages API keys. It:

- Manages user registrations and authentication
- Pools multiple ElevenLabs API keys with intelligent selection
- Handles OpenAI GPT-4 requests for dialogue generation
- Provides admin dashboard for monitoring
- Tracks usage and enforces quotas

**Key Files:**
- `server.js` - Main API server
- `services/userManager.js` - User authentication
- `services/keyPoolManager.js` - ElevenLabs key pool
- `services/database.js` - Database connection
- `schema.sql` - PostgreSQL database schema

---

## 💻 Development Setup

### Prerequisites

- **Frontend:** Visual Studio 2019+, RimWorld 1.6, .NET Framework 4.7.2
- **Backend:** Node.js 18+, PostgreSQL 14+

### Building the Frontend

```bash
cd frontend/Source
build_simple.bat  # Windows
# or
msbuild ColonistVoices.csproj  # Cross-platform
```

The compiled DLL will be output to `frontend/Assemblies/`.

### Running the Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
```

See [Backend Setup Guide](docs/BACKEND_SETUP.md) for detailed instructions.

---

## 🔧 Configuration

### Frontend Settings

Configure via **Mod Options → Colonist Voices** in-game:

- Speech frequency and cooldowns
- Voice settings (stability, similarity)
- OpenAI model selection
- Context options (thoughts, health, memories)
- Account management (registration, codes)

### Backend Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost/colonist_voices

# API Keys
OPENAI_API_KEY=sk-proj-xxxxx
ELEVENLABS_API_KEY=sk_xxxxx

# Server
PORT=3000
HTTPS_PORT=3443
USE_HTTPS=true

# Discord Webhooks (optional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

---

## 🎮 How It Works

1. **In-Game Trigger** - Colonist mood/activity triggers speech generation
2. **Context Building** - Mod collects colonist info (thoughts, health, relationships)
3. **API Request** - Sends context to backend with user authentication
4. **Dialogue Generation** - Backend calls OpenAI GPT-4 to create contextual speech
5. **Voice Synthesis** - Backend uses ElevenLabs to generate audio
6. **Audio Playback** - Mod receives base64 audio and plays in-game

---

## 📊 Key Pool System

The backend uses an intelligent ElevenLabs API key pool:

- **Load Balancing** - Distributes requests across multiple keys
- **Priority System** - Routes users to appropriate tier keys
- **Health Monitoring** - Tracks success rates and auto-pauses failing keys
- **Quota Management** - Prevents exceeding monthly limits
- **Automatic Failover** - Switches to backup keys on failure

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

### Ways to Contribute

- 🐛 Report bugs
- 💡 Suggest features
- 🔧 Submit pull requests
- 📝 Improve documentation
- 🎨 Create preview images/videos
- 🌍 Add translations (coming soon)

---

## 📜 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

**Note:** This mod requires API access to OpenAI and ElevenLabs, which have their own terms of service.

---

## 🙏 Credits

**Created by:** Tempperment 22

**Powered by:**
- [OpenAI GPT-4](https://openai.com/) - Dialogue generation
- [ElevenLabs](https://elevenlabs.io/) - Voice synthesis
- [Harmony](https://github.com/pardeike/Harmony) - RimWorld modding framework

**Special Thanks:**
- RimWorld modding community
- All beta testers and supporters
- Discord community members
- API key contributors

---

## 📞 Support

- **Discord:** [Join our server](https://discord.gg/yWC3Arr7pA)
- **Issues:** [GitHub Issues](https://github.com/YOUR_USERNAME/colonist-voices/issues)
- **Steam:** [Workshop Page](YOUR_WORKSHOP_LINK)

---

## ⚠️ Disclaimer

This mod is **not affiliated** with Ludeon Studios or the Vanilla Expanded mod series. It is an independent community project.

---

**Enjoy your talking colonists!** 🎤🎮
