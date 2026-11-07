@echo off
setlocal
title LindMotion SB Plugin installer
cd /d "%~dp0"

set "PLUGIN=LindMotion SB Plugin.sdPlugin"
set "SRC=%~dp0%PLUGIN%"
set "DESTROOT=%APPDATA%\HotSpot\StreamDock\plugins"
set "DEST=%DESTROOT%\%PLUGIN%"
set "OLDDEST=%DESTROOT%\com.lindmotion.streamerbot.sdPlugin"
set "APP32=%ProgramFiles(x86)%\fifine Control Deck\fifine Control Deck.exe"
set "APP64=%ProgramFiles%\fifine Control Deck\fifine Control Deck.exe"

echo.
echo LindMotion SB Plugin installer
echo.

if not exist "%SRC%\manifest.json" (
  echo Could not find "%PLUGIN%" next to this installer.
  echo Put install.bat in the same folder as "%PLUGIN%".
  goto :end
)

echo Closing FIFINE Control Deck if it is open...
taskkill /IM "fifine Control Deck.exe" /F >nul 2>&1
taskkill /IM "StreamDock.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

if not exist "%DESTROOT%" mkdir "%DESTROOT%"

if exist "%OLDDEST%" (
  echo Removing old plugin folder...
  rmdir /s /q "%OLDDEST%"
)

if exist "%DEST%" (
  echo Updating existing plugin...
  rmdir /s /q "%DEST%"
)

echo Copying plugin to:
echo   %DEST%
xcopy "%SRC%" "%DEST%\" /E /I /Y /Q >nul
if errorlevel 1 (
  echo Copy failed.
  goto :end
)

echo Installed. Other plugins were not changed.
echo.

if exist "%APP32%" (
  echo Starting FIFINE Control Deck...
  start "" "%APP32%"
) else if exist "%APP64%" (
  echo Starting FIFINE Control Deck...
  start "" "%APP64%"
) else (
  echo Could not find FIFINE Control Deck. Start it from the Start menu.
)

echo.
echo Look for the Streamer.bot category in the action list.

:end
echo.
pause
