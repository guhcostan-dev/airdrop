"use strict";
// Expo config plugin: `plugins: [["react-native-airdrop", { "appId": "...", "publicKey": "..." }]]`
// in app.json, then `npx expo prebuild`. Writes the native config and points release builds at
// Airdrop's bundle. Remove expo-updates: two OTA systems can't both own the bundle URL.
const { withAppDelegate, withInfoPlist, withMainApplication, withStringsXml, AndroidConfig } = require("expo/config-plugins");
const t = require("./transforms");

function withAirdrop(config, options) {
  const values = t.nativeValues(options);

  config = withInfoPlist(config, (cfg) => {
    Object.assign(cfg.modResults, t.plistEntries(values));
    return cfg;
  });

  config = withStringsXml(config, (cfg) => {
    for (const [name, value] of Object.entries(t.stringEntries(values))) {
      cfg.modResults = AndroidConfig.Strings.setStringItem(
        [{ $: { name, translatable: "false" }, _: value }],
        cfg.modResults,
      );
    }
    return cfg;
  });

  config = withAppDelegate(config, (cfg) => {
    const lang = cfg.modResults.language;
    cfg.modResults.contents =
      lang === "swift" ? t.patchAppDelegateSwift(cfg.modResults.contents) : t.patchAppDelegateObjc(cfg.modResults.contents);
    return cfg;
  });

  config = withMainApplication(config, (cfg) => {
    if (cfg.modResults.language !== "kt")
      throw new Error("react-native-airdrop: only Kotlin MainApplication is supported by the Expo plugin.");
    cfg.modResults.contents = t.patchMainApplicationKotlin(cfg.modResults.contents);
    return cfg;
  });

  return config;
}

module.exports = withAirdrop;
