#Requires -Version 5.1
<#
.SYNOPSIS
  Install Lindmotion Streamer.bot into FIFINE Control Deck / StreamDock.

.DESCRIPTION
  Copies "LindMotion SB Plugin.sdPlugin" into
  %APPDATA%\HotSpot\StreamDock\plugins\
  Replaces only this plugin folder. Never deletes other plugins.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$PluginName = "LindMotion SB Plugin.sdPlugin"
$Src = Join-Path $Root $PluginName
$DestRoot = Join-Path $env:APPDATA "HotSpot\StreamDock\plugins"
$Dest = Join-Path $DestRoot $PluginName
$OldDest = Join-Path $DestRoot "com.lindmotion.streamerbot.sdPlugin"
$ProcNames = @("fifine Control Deck", "StreamDock", "MiraBox Stream Dock", "Mirabox Stream Dock")

if (-not (Test-Path -LiteralPath $Src)) {
  Write-Error "Plugin folder not found: $Src"
}

New-Item -ItemType Directory -Path $DestRoot -Force | Out-Null

$appExe = $null
Write-Host "Stopping FIFINE Control Deck / StreamDock if it is running..."
foreach ($n in $ProcNames) {
  $procs = Get-Process -Name $n -ErrorAction SilentlyContinue
  foreach ($p in $procs) {
    if (-not $appExe -and $p.Path) { $appExe = $p.Path }
  }
  if ($procs) { $procs | Stop-Process -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 2

if (Test-Path -LiteralPath $OldDest) {
  Write-Host "Removing previous plugin folder:"
  Write-Host "  $OldDest"
  Remove-Item -LiteralPath $OldDest -Recurse -Force
}

if (Test-Path -LiteralPath $Dest) {
  Write-Host "Updating existing plugin folder:"
  Write-Host "  $Dest"
  Remove-Item -LiteralPath $Dest -Recurse -Force
} else {
  Write-Host "Installing new plugin folder:"
  Write-Host "  $Dest"
}

Copy-Item -LiteralPath $Src -Destination $Dest -Recurse -Force
Write-Host "Installed $PluginName"
Write-Host "Other plugins were not modified."

$launched = $false
if ($appExe -and (Test-Path $appExe)) {
  Start-Process $appExe
  $launched = $true
} else {
  $candidates = @(
    (Join-Path ${env:ProgramFiles} "fifine Control Deck\fifine Control Deck.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "fifine Control Deck\fifine Control Deck.exe")
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) {
      Start-Process $c
      $launched = $true
      break
    }
  }
}

if ($launched) {
  Write-Host "Started FIFINE Control Deck."
} else {
  Write-Host "Could not auto-launch FIFINE Control Deck. Start it manually."
}

Write-Host ""
Write-Host "Look for the Streamer.bot category in the action list."
Write-Host "Enable the Streamer.bot WebSocket server (default 127.0.0.1:8080)."
