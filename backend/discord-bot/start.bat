@echo off
echo ========================================
echo ElevenLabs Key Redemption Bot
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting bot...
echo.
node bot.js

pause
