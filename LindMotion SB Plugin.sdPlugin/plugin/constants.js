'use strict';

const PLUGIN_UUID = 'com.lindmotion.streamerbot';

const ACTIONS = {
  connection: `${PLUGIN_UUID}.connection`,
  execute: `${PLUGIN_UUID}.execute`,
  executeArgs: `${PLUGIN_UUID}.executeArgs`,
  executeRandom: `${PLUGIN_UUID}.executeRandom`,
  executeSequence: `${PLUGIN_UUID}.executeSequence`,
  obsStartStreaming: `${PLUGIN_UUID}.obs.startStreaming`,
  obsStopStreaming: `${PLUGIN_UUID}.obs.stopStreaming`,
  obsStartRecording: `${PLUGIN_UUID}.obs.startRecording`,
  obsStopRecording: `${PLUGIN_UUID}.obs.stopRecording`,
  obsChangeScene: `${PLUGIN_UUID}.obs.changeScene`,
  obsToggleSource: `${PLUGIN_UUID}.obs.toggleSource`,
  obsMuteMic: `${PLUGIN_UUID}.obs.muteMic`,
  twitchShoutout: `${PLUGIN_UUID}.twitch.shoutout`,
  twitchAnnounce: `${PLUGIN_UUID}.twitch.announce`,
  chatMessage: `${PLUGIN_UUID}.chat.message`,
  chatCommand: `${PLUGIN_UUID}.chat.command`,
  audioToggleMic: `${PLUGIN_UUID}.audio.toggleMic`,
  audioToggleMusic: `${PLUGIN_UUID}.audio.toggleMusic`,
  audioSoundboard: `${PLUGIN_UUID}.audio.soundboard`,
  audioPresets: `${PLUGIN_UUID}.audio.presets`,
  statusStreaming: `${PLUGIN_UUID}.status.streaming`,
  statusRecording: `${PLUGIN_UUID}.status.recording`,
  statusMicrophone: `${PLUGIN_UUID}.status.microphone`,
  statusViewers: `${PLUGIN_UUID}.status.viewers`
};

const NAMED_ACTIONS = {
  [ACTIONS.obsStartStreaming]: { name: 'D6 Start Streaming', args: [] },
  [ACTIONS.obsStopStreaming]: { name: 'D6 Stop Streaming', args: [] },
  [ACTIONS.obsStartRecording]: { name: 'D6 Start Recording', args: [] },
  [ACTIONS.obsStopRecording]: { name: 'D6 Stop Recording', args: [] },
  [ACTIONS.obsChangeScene]: { name: 'D6 Change Scene', args: ['scene'] },
  [ACTIONS.obsToggleSource]: { name: 'D6 Toggle Source', args: ['scene', 'source'] },
  [ACTIONS.obsMuteMic]: { name: 'D6 Mute Microphone', args: [] },
  [ACTIONS.twitchShoutout]: { name: 'D6 Shoutout', args: ['user'] },
  [ACTIONS.twitchAnnounce]: { name: 'D6 Announce', args: ['message'] },
  [ACTIONS.chatCommand]: { name: 'D6 Trigger Custom Bot Command', args: ['command'] },
  [ACTIONS.audioToggleMic]: { name: 'D6 Toggle Microphone', args: [] },
  [ACTIONS.audioToggleMusic]: { name: 'D6 Toggle Music', args: [] },
  [ACTIONS.audioSoundboard]: { name: 'D6 Soundboard', args: ['sound'] },
  [ACTIONS.audioPresets]: { name: 'D6 Audio Presets', args: ['preset'] }
};

const COLORS = {
  connected: '#1f8a4c',
  disconnected: '#5a5a5a',
  reconnecting: '#c48a12',
  error: '#b3261e',
  live: '#c62828',
  offline: '#5a5a5a',
  recording: '#c62828',
  muted: '#c62828',
  unmuted: '#1f8a4c',
  viewers: '#1565c0',
  plugin: '#5b4dff',
  execute: '#1565c0'
};

const DEFAULT_GLOBAL = {
  host: '127.0.0.1',
  port: 8080,
  password: '',
  autoConnect: true
};

const STREAMERBOT_HOME = 'D:\\STREAMERBOT';

const APPLICATION_EVENTS = {
  Application: [
    'ActionAdded',
    'ActionDeleted',
    'ActionUpdated',
    'CommandAdded',
    'CommandDeleted',
    'CommandUpdated'
  ]
};

const APPLICATION_REFRESH_TYPES = new Set(APPLICATION_EVENTS.Application);

module.exports = {
  PLUGIN_UUID,
  ACTIONS,
  NAMED_ACTIONS,
  COLORS,
  DEFAULT_GLOBAL,
  STREAMERBOT_HOME,
  APPLICATION_EVENTS,
  APPLICATION_REFRESH_TYPES
};
