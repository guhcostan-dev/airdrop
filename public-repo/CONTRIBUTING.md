# Contributing

Thanks for helping! A few things to know:

- This repository is **published automatically** from the Airdrop monorepo, where the server and
  the website also live. Pull requests here are reviewed as usual; once merged, the change is applied
  upstream and comes back in the next sync, so the commit may show up with a different hash.
- Run `pnpm install && pnpm typecheck && pnpm test` before opening a PR.
- The **signing message** is defined in `packages/core/src/signing.ts` and mirrored in
  `UpdateManager.signingMessage` (Java) and `+[RNAirdropUpdateManager signingMessage:]` (Objective-C).
  Change all three together; `UpdateManagerTest` checks they agree.
- iOS (`RNAirdropUpdateManager`) and Android (`UpdateManager`) implement the same launch protocol;
  keep them in sync.
- Security issues: please don't open a public issue. Email the maintainer instead.
