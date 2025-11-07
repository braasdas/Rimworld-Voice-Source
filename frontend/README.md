# Colonist Voices - RimWorld Mod (Frontend)

This folder contains the RimWorld mod component that interfaces with the backend API.

## Structure

```
frontend/
├── About/                    # Mod metadata
│   └── About.xml            # Steam Workshop description
├── Assemblies/              # Compiled DLL (excluded from repo)
│   └── ColonistVoices.dll  
└── Source/                  # C# source code
    ├── AudioManager.cs
    ├── BackendAPIHandler.cs
    ├── ColonistContextBuilder.cs
    ├── ColonistVoices.csproj
    ├── ColonistVoicesSettings.cs
    ├── CoroutineManager.cs
    ├── SpeechController.cs
    ├── SpeechHistoryEntry.cs
    ├── VoiceSelector.cs
    └── build_simple.bat
```

## Key Components

### SpeechController.cs
- Main game component that triggers speech generation
- Manages cooldowns and speech history
- Coordinates between other components

### BackendAPIHandler.cs
- Handles all API communication with backend
- User registration and authentication
- Code redemption
- Speech generation requests

### ColonistContextBuilder.cs
- Builds contextual information about colonists
- Includes thoughts, mood, health, relationships
- Provides AI with rich context for dialogue generation

### AudioManager.cs
- Plays generated audio in-game
- Shows subtitles/captions
- Manages audio lifecycle

### VoiceSelector.cs
- Assigns unique voices to colonists
- Based on gender, age, personality traits
- Maintains consistent voice assignments

### ColonistVoicesSettings.cs
- Mod settings UI
- User authentication management
- Configuration options

### CoroutineManager.cs
- Unity coroutine management for async operations
- Required for non-blocking API calls

## Building

### Windows (Easiest)
```batch
cd Source
build_simple.bat
```

### Command Line
```bash
csc /target:library /out:../Assemblies/ColonistVoices.dll /reference:"PATH_TO_RIMWORLD\Managed\*.dll" *.cs
```

### Visual Studio
1. Open `ColonistVoices.csproj`
2. Build Solution (Ctrl+Shift+B)

## Requirements

- Visual Studio 2019+ OR .NET Framework SDK 4.7.2+
- RimWorld 1.6
- Harmony (dependency managed by mod)

## Installation (For Users)

1. Subscribe on Steam Workshop
2. Enable in mod list
3. Launch game
4. Configure in Mod Options

## Installation (For Developers)

1. Clone this repository
2. Build the DLL using instructions above
3. Copy to RimWorld/Mods/ folder:
```
RimWorld/Mods/ColonistVoices/
├── About/
│   └── About.xml
└── Assemblies/
    └── ColonistVoices.dll
```

## Configuration

All settings accessible via:
**Mod Options → Colonist Voices**

- Speech frequency
- Cooldown timers
- Voice settings
- Account management
- Debug mode

## Development Notes

- Uses Harmony for patching RimWorld
- Async API calls via coroutines
- All network calls to backend are non-blocking
- Speech history prevents repetition
- Comprehensive error handling and logging

## API Integration

Communicates with backend at:
- Default: `https://api.leadleap.net:3443`
- Configurable in settings

See [../backend/README.md](../backend/README.md) for backend setup.

## License

MIT - See [../LICENSE](../LICENSE)
