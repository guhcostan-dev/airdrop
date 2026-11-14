#!/usr/bin/env node
/**
 * Writes the react-native-airdrop native config into Info.plist and strings.xml.
 *
 *   node scripts/configure-airdrop.js --app-id <id> [--server <url>] [--android-server <url>] [--public-key <b64>]
 *
 * --server is used for iOS (and Android unless --android-server is given).
 */
const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : '']);
    return acc;
  }, []),
);
const root = path.resolve(__dirname, '..');

function setPlist(xml, key, value) {
  const re = new RegExp(`(<key>${key}</key>\\s*<string>)[^<]*(</string>)`);
  if (!re.test(xml)) throw new Error(`Info.plist is missing ${key}`);
  return xml.replace(re, `$1${value}$2`);
}
function setString(xml, name, value) {
  const re = new RegExp(`(<string name="${name}"[^>]*>)[^<]*(</string>)`);
  if (!re.test(xml)) throw new Error(`strings.xml is missing ${name}`);
  return xml.replace(re, `$1${value}$2`);
}

const plistPath = path.join(root, 'ios/AirdropExample/Info.plist');
const stringsPath = path.join(root, 'android/app/src/main/res/values/strings.xml');
let plist = fs.readFileSync(plistPath, 'utf8');
let strings = fs.readFileSync(stringsPath, 'utf8');

if (args['app-id'] !== undefined) {
  plist = setPlist(plist, 'AirdropAppId', args['app-id']);
  strings = setString(strings, 'airdrop_app_id', args['app-id']);
}
if (args.server !== undefined) plist = setPlist(plist, 'AirdropServerURL', args.server);
const androidServer = args['android-server'] ?? args.server;
if (androidServer !== undefined) strings = setString(strings, 'airdrop_server_url', androidServer);
if (args['public-key'] !== undefined) {
  plist = setPlist(plist, 'AirdropPublicKey', args['public-key']);
  strings = setString(strings, 'airdrop_public_key', args['public-key']);
}

fs.writeFileSync(plistPath, plist);
fs.writeFileSync(stringsPath, strings);
console.log('Updated', path.relative(root, plistPath), 'and', path.relative(root, stringsPath));
