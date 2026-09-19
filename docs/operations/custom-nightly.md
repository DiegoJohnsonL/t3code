# Custom nightly builds

This fork follows released T3 Code nightlies and publishes a macOS arm64 build signed with a private development certificate. The application uses T3 Code's built-in Check, Download, and Install update flow against the fork's GitHub releases.

The automation merges upstream nightly tags into the fork's default branch. A merge conflict stops the workflow so a customization cannot disappear silently. The workflow retries the build until a release records the upstream tag it contains.

## Install the Mac updater

Install and authenticate GitHub CLI, then run:

```bash
./scripts/custom-nightly-macos.sh install
```

The first run creates a self-signed `T3 Code Local Development` code-signing identity. macOS may ask for permission to update the login keychain. GitHub Actions stores an encrypted PKCS#12 export of this identity so every update has the same signature.

The bootstrap updater checks hourly and installs the app at:

```text
~/Applications/T3 Code Custom Nightly.app
```

It keeps the existing T3 Code data under `~/.t3/userdata` and the existing desktop data directory. The custom application does not support passkeys because its local certificate has no Apple provisioning profile. Other T3 Connect sign-in methods use the public production configuration in `.env.example`.

Once a build with `app-update.yml` is installed, the bootstrap updater becomes idle. Use the update control inside T3 Code to check, download, and install later releases.

Inspect or run the bootstrap updater manually:

```bash
./scripts/custom-nightly-macos.sh status
./scripts/custom-nightly-macos.sh update
```

Bootstrap checks defer while T3 Code is running. To install the first feed-enabled build immediately, quit and reopen the app as part of the update:

```bash
./scripts/custom-nightly-macos.sh update-now
```

Remove the hourly job without deleting the application, data, or signing identity:

```bash
./scripts/custom-nightly-macos.sh uninstall
```

## Publish a build

The `Custom nightly` GitHub Actions workflow runs hourly. Its manual dispatch has a `force` input for rebuilding the current upstream nightly. Each release contains a DMG, a signed zip, update metadata, a blockmap, and the zip's SHA-256 checksum.

All inherited upstream workflows remain disabled in the fork. Some expect the maintainers' production credentials, and others would duplicate work after every automated merge. Only `Custom nightly` runs here.
