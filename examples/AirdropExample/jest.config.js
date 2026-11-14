module.exports = {
  preset: '@react-native/jest-preset',
  // The SDK is linked via `file:` so babel-jest transforms its compiled output
  // outside node_modules; point @babel/runtime helpers at this app's copy.
  moduleNameMapper: {
    '^@babel/runtime/(.*)$': '<rootDir>/node_modules/@babel/runtime/$1',
    // Single React copy: the linked SDK resolves `react` from the monorepo
    // store, which breaks hooks when mixed with this app's renderer.
    '^react$': '<rootDir>/node_modules/react',
  },
};
