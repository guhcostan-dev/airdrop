// Pure source transforms used by the Expo config plugin (app.plugin.js). Kept free of Expo
// imports so they can be unit-tested without an Expo project.
"use strict";

const DEFAULT_SERVER = "https://airdrop-api.guhcostan.dev";
const SWIFT_EMBEDDED = 'Bundle.main.url(forResource: "main", withExtension: "jsbundle")';
const OBJC_EMBEDDED = '[[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"]';
// Expo SDK 55+: ExpoReactHostFactory.getDefaultReactHost(context = applicationContext, ...).
const KOTLIN_FACTORY = /(ExpoReactHostFactory\.getDefaultReactHost\(\s*\n([ \t]*)context = applicationContext,\s*\n)/;
// Older templates: an anonymous DefaultReactNativeHost.
const KOTLIN_HOST = /(override fun getJSMainModuleName\(\): String = "[^"]*"\s*\n)/;
const MARK = "// @airdrop";

function fail(file) {
  return new Error(
    `react-native-airdrop: couldn't find where ${file} loads the JS bundle. ` +
      "Set it up by hand: https://airdrop.guhcostan.dev/docs/getting-started/#4-install-the-sdk",
  );
}

/** Native config values from plugin options. */
function nativeValues(options = {}) {
  if (!options.appId || typeof options.appId !== "string")
    throw new Error('react-native-airdrop: set the plugin option "appId" (from `airdrop init`).');
  const values = {
    serverUrl: options.serverUrl || DEFAULT_SERVER,
    appId: options.appId,
  };
  for (const k of ["publicKey", "runtimeVersion", "channel"]) if (options[k]) values[k] = String(options[k]);
  return values;
}

function plistEntries(v) {
  const out = { AirdropServerURL: v.serverUrl, AirdropAppId: v.appId };
  if (v.publicKey) out.AirdropPublicKey = v.publicKey;
  if (v.runtimeVersion) out.AirdropRuntimeVersion = v.runtimeVersion;
  if (v.channel) out.AirdropChannel = v.channel;
  return out;
}

function stringEntries(v) {
  const out = { airdrop_server_url: v.serverUrl, airdrop_app_id: v.appId };
  if (v.publicKey) out.airdrop_public_key = v.publicKey;
  if (v.runtimeVersion) out.airdrop_runtime_version = v.runtimeVersion;
  if (v.channel) out.airdrop_channel = v.channel;
  return out;
}

/** AppDelegate.swift (Expo SDK 53+): release builds boot RNAirdrop.bundleURL(). */
function patchAppDelegateSwift(src) {
  if (src.includes("RNAirdrop.bundleURL")) return src;
  if (!src.includes(SWIFT_EMBEDDED)) throw fail("AppDelegate.swift");
  let out = src.replace(`return ${SWIFT_EMBEDDED}`, `return RNAirdrop.bundleURL() ${MARK}`);
  const expoImport = /^((?:internal |public )?import Expo)$/m;
  out = expoImport.test(out)
    ? out.replace(expoImport, "$1\nimport ReactNativeAirdrop")
    : `import ReactNativeAirdrop\n${out}`;
  return out;
}

/** AppDelegate.mm (older Expo templates). */
function patchAppDelegateObjc(src) {
  if (src.includes("[RNAirdrop bundleURL]")) return src;
  if (!src.includes(OBJC_EMBEDDED)) throw fail("AppDelegate.mm");
  let out = src.replace(`return ${OBJC_EMBEDDED};`, `return [RNAirdrop bundleURL]; ${MARK}`);
  out = out.replace(/(#import "AppDelegate\.h"\n)/, `$1#import <ReactNativeAirdrop/RNAirdrop.h>\n`);
  return out;
}

/** MainApplication.kt: release builds boot Airdrop's bundle (bridge and bridgeless). */
function patchMainApplicationKotlin(src) {
  if (src.includes("Airdrop.getJSBundleFile")) return src;
  const call = "com.rnairdrop.Airdrop.getJSBundleFile(applicationContext)";
  const factory = KOTLIN_FACTORY.exec(src);
  if (factory) return src.replace(KOTLIN_FACTORY, `$1${factory[2]}jsBundleFilePath = ${call}, ${MARK}\n`);
  const host = KOTLIN_HOST.exec(src);
  if (host) {
    const indent = /^([ \t]*)override fun getJSMainModuleName/m.exec(src)[1];
    return src.replace(KOTLIN_HOST, `$1${indent}override fun getJSBundleFile(): String? = ${call} ${MARK}\n`);
  }
  throw fail("MainApplication.kt");
}

module.exports = {
  DEFAULT_SERVER,
  nativeValues,
  plistEntries,
  stringEntries,
  patchAppDelegateSwift,
  patchAppDelegateObjc,
  patchMainApplicationKotlin,
};
