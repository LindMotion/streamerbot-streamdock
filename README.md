# Lindmotion Streamer.bot for FIFINE Control Deck

Native StreamDock plugin for the FIFINE AmpliGame D6 / D6-Pro. It is **not** a standalone app and **not** an Elgato-only plugin. It installs into the existing FIFINE Control Deck action list.

## Install

Double-click **`install.bat`**.

That copies the plugin into FIFINE Control Deck, leaves your other plugins alone, and restarts the app. After it finishes, look for the **Streamer.bot** category in the action list.

Install path:

`%APPDATA%\HotSpot\StreamDock\plugins\LindMotion SB Plugin.sdPlugin`

To remove it, double-click **`uninstall.bat`**.

## Streamer.bot setup

1. In Streamer.bot, enable the **WebSocket Server** (default `127.0.0.1:8080`).
2. If you enabled a password, enter it on the **Connection Status** key.
3. Drag **Connection Status** onto a D6 key, save IP/port, and press Connect.
4. Drag **Execute Action**, open the property inspector, pick an action, press the key.

### Named actions for OBS / Twitch / audio keys

Create Streamer.bot actions with these exact names:

- `D6 Start Streaming`
- `D6 Stop Streaming`
- `D6 Start Recording`
- `D6 Stop Recording`
- `D6 Change Scene` (uses arg `scene`)
- `D6 Toggle Source` (uses args `scene`, `source`)
- `D6 Mute Microphone`
- `D6 Shoutout` (uses arg `user`)
- `D6 Announce` (uses arg `message`)
- `D6 Trigger Custom Bot Command` (uses arg `command`)
- `D6 Toggle Microphone`
- `D6 Toggle Music`
- `D6 Soundboard` (uses arg `sound`)
- `D6 Audio Presets` (uses arg `preset`)

Chat Message uses the documented `SendMessage` request and does not need a named action.

If a named action is missing, the key shows an alert and writes the missing name to `plugin\log`.

## Windows launcher fallback

FIFINE Control Deck 3.10.188.226+ launches `plugin/index.js` with the bundled `node20.exe` when the manifest includes `"Nodejs": { "Version": "20" }`. That path is verified on this machine.

If a host log shows `SDPluginManager::restartPlugin` looping, compile `tools/launcher.c` to `plugin/launch.exe` and set `"CodePathWin": "plugin/launch.exe"`.

## Logs

`%APPDATA%\HotSpot\StreamDock\plugins\LindMotion SB Plugin.sdPlugin\plugin\log\`

FIFINE host log:

`%APPDATA%\HotSpot\StreamDock\logs\`

## Uninstall

See [uninstall.md](uninstall.md).
