@echo off
echo Simple C# Compiler for Colonist Voices Backend
echo ================================================
echo.
echo Current directory: %CD%
echo.

REM Find csc.exe (C# compiler)
set CSC_PATH=

REM Check common .NET Framework locations
echo Searching for C# compiler...
if exist "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
    set CSC_PATH=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
    echo Found: C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
)

if not defined CSC_PATH (
    echo.
    echo ERROR: C# compiler not found!
    echo.
    echo You need to install .NET Framework SDK or Visual Studio.
    echo Download from: https://dotnet.microsoft.com/download/dotnet-framework/net472
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo Found C# compiler: %CSC_PATH%
echo.

REM Set paths
set RIMWORLD_MANAGED=E:\SteamLibrary\steamapps\common\RimWorld\RimWorldWin64_Data\Managed
set MOD_DIR=E:\SteamLibrary\steamapps\common\RimWorld\Mods\Colonist Voices_Backended
set OUTPUT_DIR=%MOD_DIR%\Assemblies
set SOURCE_DIR=.

echo Checking paths...
echo RimWorld Managed: %RIMWORLD_MANAGED%
echo Mod Directory: %MOD_DIR%
echo Output Directory: %OUTPUT_DIR%
echo Source Directory: %SOURCE_DIR%
echo.

REM Check if RimWorld DLLs exist
if not exist "%RIMWORLD_MANAGED%\Assembly-CSharp.dll" (
    echo ERROR: Cannot find RimWorld DLLs at: %RIMWORLD_MANAGED%
    echo Make sure RimWorld is installed correctly.
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

REM Setup mod directory structure
echo Setting up mod directory structure...
if not exist "%MOD_DIR%" (
    echo Creating mod directory: %MOD_DIR%
    mkdir "%MOD_DIR%"
)

if not exist "%MOD_DIR%\About" (
    echo Creating About folder...
    mkdir "%MOD_DIR%\About"
)

if not exist "%MOD_DIR%\Assemblies" (
    echo Creating Assemblies folder...
    mkdir "%MOD_DIR%\Assemblies"
)

REM Copy About.xml if it doesn't exist or is outdated
if not exist "%MOD_DIR%\About\About.xml" (
    echo Copying About.xml...
    copy /Y "..\About\About.xml" "%MOD_DIR%\About\About.xml" >nul
) else (
    echo Updating About.xml...
    copy /Y "..\About\About.xml" "%MOD_DIR%\About\About.xml" >nul
)

REM Try to delete existing DLL to avoid file locks
if exist "%OUTPUT_DIR%\ColonistVoicesBackend.dll" (
    echo Attempting to delete old DLL...
    del /F /Q "%OUTPUT_DIR%\ColonistVoicesBackend.dll" 2>nul
    if exist "%OUTPUT_DIR%\ColonistVoicesBackend.dll" (
        echo WARNING: Could not delete old DLL - it may be in use by RimWorld
        echo Please close RimWorld and try again.
        echo.
        echo Press any key to exit...
        pause >nul
        exit /b 1
    )
    echo Old DLL deleted successfully.
)

REM Compile
echo.
echo Compiling C# files...
echo.
"%CSC_PATH%" /target:library /out:"%OUTPUT_DIR%\ColonistVoicesBackend.dll" /reference:"%RIMWORLD_MANAGED%\Assembly-CSharp.dll" /reference:"%RIMWORLD_MANAGED%\UnityEngine.dll" /reference:"%RIMWORLD_MANAGED%\UnityEngine.CoreModule.dll" /reference:"%RIMWORLD_MANAGED%\UnityEngine.IMGUIModule.dll" /reference:"%RIMWORLD_MANAGED%\UnityEngine.UnityWebRequestModule.dll" /reference:"%RIMWORLD_MANAGED%\UnityEngine.UnityWebRequestAudioModule.dll" /reference:"%RIMWORLD_MANAGED%\UnityEngine.AudioModule.dll" /reference:"%RIMWORLD_MANAGED%\UnityEngine.JSONSerializeModule.dll" /reference:"%RIMWORLD_MANAGED%\netstandard.dll" /optimize+ "%SOURCE_DIR%\*.cs"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====================================
    echo Build completed successfully!
    echo ====================================
    echo.
    echo Mod deployed to: %MOD_DIR%
    echo DLL location: %OUTPUT_DIR%\ColonistVoicesBackend.dll
    echo.
    echo Mod folder structure:
    echo   %MOD_DIR%\
    echo   ├── About\
    echo   │   └── About.xml
    echo   └── Assemblies\
    echo       └── ColonistVoicesBackend.dll
    echo.
    echo Ready to use in RimWorld!
    echo ====================================
) else (
    echo.
    echo ====================================
    echo Build FAILED!
    echo Check the errors above
    echo ====================================
)

echo.
echo Press any key to exit...
pause >nul
