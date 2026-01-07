@echo off
echo ========================================
echo PakFolio - Android Setup Script
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/7] Initializing npm...
call npm init -y

echo.
echo [2/7] Installing Capacitor...
call npm install @capacitor/core @capacitor/cli

echo.
echo [3/7] Initializing Capacitor project...
call npx cap init "PakFolio" "com.pakfolio.taxcalculator" --web-dir="mobile"

echo.
echo [4/7] Installing Android platform...
call npm install @capacitor/android

echo.
echo [5/7] Adding Android to project...
call npx cap add android

echo.
echo [6/7] Syncing web assets to Android...
call npx cap sync android

echo.
echo [7/7] Setup complete!
echo.
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Open Android Studio: npx cap open android
echo 2. Connect a device or start an emulator
echo 3. Click the green Run button
echo.
echo For detailed instructions, see CAPACITOR-SETUP.md
echo ========================================
pause
