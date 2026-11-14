const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// The SDK is linked from the monorepo (packages/react-native). Watch it, and
// resolve every dependency from this app so there is a single copy of react-native.
const sdkRoot = path.resolve(__dirname, '../../packages/react-native');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  watchFolders: [sdkRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    disableHierarchicalLookup: true,
    blockList: [new RegExp(`${sdkRoot.replace(/[/\\]/g, '[/\\\\]')}[/\\\\]node_modules[/\\\\].*`)],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
