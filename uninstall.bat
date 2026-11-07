@echo off
setlocal
title LindMotion SB Plugin uninstall
cd /d "%~dp0"

set "PLUGIN=LindMotion SB Plugin.sdPlugin"
set "DEST=%APPDATA%\HotSpot\StreamDock\plugins\%PLUGIN%"
set "OLDDEST=%APPDATA%\HotSpot\StreamDock\plugins\com.lindmotion.streamerbot.sdPlugin"
set "APP32=%ProgramFiles(x86)%\fifine Control Deck\fifine Control Deck.exe"
set "APP64=%ProgramFiles%\fifine Control Deck\fifine Control Deck.exe"

echo.
echo This removes only LindMotion SB Plugin.
echo Other StreamDock plugins are left alone.
echo.

echo Closing FIFINE Control Deck if it is open...
taskkill /IM "fifine Control Deck.exe" /F >nul 2>&1
taskkill /IM "StreamDock.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

if exist "%DEST%" (
  echo Removing:
  echo   %DEST%
  rmdir /s /q "%DEST%"
) else (
  echo Plugin folder was not found:
  echo   %DEST%
)

if exist "%OLDDEST%" (
  echo Removing old folder:
  echo   %OLDDEST%
  rmdir /s /q "%OLDDEST%"
)

echo.

if exist "%APP32%" (
  echo Starting FIFINE Control Deck...
  start "" "%APP32%"
) else if exist "%APP64%" (
  echo Starting FIFINE Control Deck...
  start "" "%APP64%"
)

echo Done.
echo.
pause
