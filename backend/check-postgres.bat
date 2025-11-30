@echo off
echo ========================================
echo PostgreSQL Status Checker
echo ========================================
echo.

echo Checking if PostgreSQL is installed...
where psql >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] PostgreSQL is installed!
    psql --version
) else (
    echo [ERROR] PostgreSQL is NOT installed
    echo.
    echo Please install PostgreSQL from:
    echo https://www.postgresql.org/download/windows/
    echo.
    pause
    exit /b 1
)

echo.
echo Checking if PostgreSQL service is running...
sc query postgresql-x64-16 | find "RUNNING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] PostgreSQL service is RUNNING
) else (
    echo [WARNING] PostgreSQL service is NOT running
    echo.
    echo Starting PostgreSQL service...
    net start postgresql-x64-16
    if %ERRORLEVEL% EQU 0 (
        echo [OK] PostgreSQL service started successfully!
    ) else (
        echo [ERROR] Failed to start PostgreSQL service
        echo Try starting it manually from Services
    )
)

echo.
echo ========================================
echo Status Check Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Make sure DATABASE_URL is set in .env
echo 2. Run: npm install
echo 3. Run: npm start
echo.
pause
