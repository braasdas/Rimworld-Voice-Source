# Setup Guide

Complete setup instructions for both backend and frontend components.

## Backend Setup

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- OpenAI API key
- ElevenLabs API key(s)

### Installation

1. **Clone Repository**
```bash
git clone https://github.com/YOUR_USERNAME/colonist-voices.git
cd colonist-voices/backend
```

2. **Install Dependencies**
```bash
npm install
```

3. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Setup Database**
```bash
createdb colonist_voices
psql colonist_voices < schema.sql
```

5. **Add API Keys to Pool**
```bash
# First, start the server
npm start

# Then in another terminal, add keys to the pool
# (You'll need to create an admin interface or use psql directly)
```

6. **Run Server**
```bash
# Development
npm run dev

# Production
npm start
```

### Production Deployment

**Option 1: VPS (DigitalOcean, Linode, etc.)**
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql

# Setup app
git clone https://github.com/YOUR_USERNAME/colonist-voices.git
cd colonist-voices/backend
npm install
npm install -g pm2

# Configure .env
cp .env.example .env
nano .env

# Setup database
sudo -u postgres createdb colonist_voices
sudo -u postgres psql colonist_voices < schema.sql

# Start with PM2
pm2 start server.js --name colonist-voices
pm2 startup
pm2 save
```

**Option 2: Railway.app (Easiest)**
1. Fork repository on GitHub
2. Sign up at railway.app
3. Create new project from GitHub
4. Add environment variables in dashboard
5. Add PostgreSQL plugin
6. Deploy!

**Option 3: Docker**
```bash
# Coming soon
```

### SSL/HTTPS Setup

For production, you'll want HTTPS:

```bash
# Install cert bot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d api.yourdomain.com

# Update .env
USE_HTTPS=true
SSL_KEY_PATH=/etc/letsencrypt/live/api.yourdomain.com/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/api.yourdomain.com/fullchain.pem
```

---

## Frontend Setup

### Prerequisites
- Visual Studio 2019+ OR .NET Framework SDK 4.7.2+
- RimWorld 1.6

### Development Setup

1. **Clone Repository**
```bash
git clone https://github.com/YOUR_USERNAME/colonist-voices.git
cd colonist-voices/frontend
```

2. **Update Paths in build_simple.bat**
Edit `Source/build_simple.bat` and update:
```batch
set RIMWORLD_MANAGED=C:\YOUR_PATH\RimWorld\RimWorldWin64_Data\Managed
set MOD_DIR=C:\YOUR_PATH\RimWorld\Mods\ColonistVoices
```

3. **Build**
```batch
cd Source
build_simple.bat
```

### Manual Build (Cross-platform)

```bash
# Find your RimWorld installation
RIMWORLD_PATH="/path/to/RimWorld"

# Compile
csc /target:library \
    /out:../Assemblies/ColonistVoices.dll \
    /reference:"$RIMWORLD_PATH/RimWorldWin64_Data/Managed/Assembly-CSharp.dll" \
    /reference:"$RIMWORLD_PATH/RimWorldWin64_Data/Managed/UnityEngine.dll" \
    /reference:"$RIMWORLD_PATH/RimWorldWin64_Data/Managed/UnityEngine.CoreModule.dll" \
    /reference:"$RIMWORLD_PATH/RimWorldWin64_Data/Managed/UnityEngine.IMGUIModule.dll" \
    /reference:"$RIMWORLD_PATH/RimWorldWin64_Data/Managed/UnityEngine.UnityWebRequestModule.dll" \
    /reference:"$RIMWORLD_PATH/RimWorldWin64_Data/Managed/UnityEngine.AudioModule.dll" \
    *.cs
```

### Testing

1. Build the DLL
2. Copy mod folder to RimWorld/Mods/
3. Launch RimWorld
4. Enable mod in mod list
5. Start/load a game
6. Check Debug Log for any errors

### Pointing to Your Backend

In-game:
1. Go to Mod Options → Colonist Voices
2. Change Backend URL to your server
3. Click "Test Connection"

---

## Troubleshooting

### Backend Issues

**"Cannot connect to database"**
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify DATABASE_URL in .env
- Check database exists: `psql -l`

**"No healthy keys available"**
- Add API keys to the pool
- Check key health in admin dashboard
- Verify ElevenLabs keys are valid

**"OpenAI API error"**
- Check OPENAI_API_KEY in .env
- Verify API key has credits
- Check OpenAI dashboard for issues

### Frontend Issues

**"Build failed"**
- Install Visual Studio Build Tools
- Check RimWorld paths in build script
- Verify all .cs files are present

**"Mod not loading"**
- Check RimWorld log at `%APPDATA%\..\LocalLow\Ludeon Studios\RimWorld by Ludeon Studios\Player.log`
- Verify Harmony is installed
- Check for conflicting mods

**"Connection failed"**
- Verify backend is running
- Check Backend URL in settings
- Test backend health endpoint manually

---

## Next Steps

- [Contributing Guide](CONTRIBUTING.md)
- [API Documentation](API.md)
- [Architecture Overview](ARCHITECTURE.md)
