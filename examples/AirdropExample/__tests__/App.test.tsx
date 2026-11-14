/**
 * @format
 */

import React from 'react';
import { NativeModules } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// Hermetic native module: jest has no native side, and this test must not hit
// the network, so the update check resolves to "noUpdate" locally.
(NativeModules as any).RNAirdrop = {
  platform: 'ios',
  sdkVersion: '0.1.0-test',
  enabled: true,
  runtimeVersion: 'test',
  serverUrl: 'https://jest.local',
  appId: 'jest-app',
  channel: 'production',
  getState: async () => ({
    deviceId: 'jest-device',
    currentUpdateId: null,
    pendingUpdateId: null,
    rollbackToEmbeddedPending: false,
    failedUpdateIds: [],
  }),
  downloadUpdate: async () => 'staged',
  notifyAppReady: async () => ({ installedUpdateId: null, rolledBackUpdateIds: [] }),
  clearUpdates: async () => {},
  restartApp: () => {},
};

(global as any).fetch = async () => ({
  ok: true,
  json: async () => ({ status: 'noUpdate' }),
});

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
