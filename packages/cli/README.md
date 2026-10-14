# react-native-airdrop-cli

CLI for [react-native-airdrop](https://github.com/guhcostan-dev/airdrop):
over-the-air updates for React Native.

```sh
npm install -g react-native-airdrop-cli
airdrop login --server https://ota.example.com --token <token>
airdrop init --name "My App" --sign
airdrop release --platform android --message "Fix checkout" --private-key airdrop-private-key.pem
airdrop updates list
airdrop rollback <updateId>
```

Run `airdrop help` for all commands. Full docs: https://airdrop.guhcostan.dev/docs/
