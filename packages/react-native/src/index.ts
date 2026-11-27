import {
  checkForUpdate,
  clearUpdates,
  configure,
  downloadUpdate,
  getState,
  notifyAppReady,
  restartApp,
  sync,
} from "./client";

export * from "./types";
export { checkForUpdate, clearUpdates, configure, downloadUpdate, getState, notifyAppReady, restartApp, sync };
export { useAirdrop, withAirdrop, type WithAirdropOptions } from "./react";

const Airdrop = {
  configure,
  checkForUpdate,
  downloadUpdate,
  sync,
  notifyAppReady,
  restartApp,
  clearUpdates,
  getState,
};
export default Airdrop;
