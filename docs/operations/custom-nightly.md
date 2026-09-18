# Custom nightly builds

This fork follows released T3 Code nightlies and publishes an unsigned macOS arm64 build. A local updater signs each downloaded application with a certificate stored in the user's login keychain, then installs it under `~/Applications`.

The automation merges upstream nightly tags into the fork's default branch. A merge conflict stops the workflow so a customization cannot disappear silently. The workflow retries the build until a release records the upstream tag it contains.

## Install the Mac updater

Install and authenticate GitHub CLI, then run:

```bash
./scripts/custom-nightly-macos.sh install
```

The first run creates a self-signed `T3 Code Local Development` code-signing identity. macOS may ask for permission to update the login keychain. The certificate never leaves the Mac.

The updater checks hourly and installs the app at:

```text
~/Applications/T3 Code Custom Nightly.app
```

It keeps the existing T3 Code data under `~/.t3/userdata` and the existing desktop data directory. The custom application does not support passkeys because its local certificate has no Apple provisioning profile. Other T3 Connect sign-in methods use the public production configuration in `.env.example`.

Inspect or run the updater manually:

```bash
./scripts/custom-nightly-macos.sh status
./scripts/custom-nightly-macos.sh update
```

Remove the hourly job without deleting the application, data, or signing identity:

```bash
./scripts/custom-nightly-macos.sh uninstall
```

## Publish a build

The `Custom nightly` GitHub Actions workflow runs hourly. Its manual dispatch has a `force` input for rebuilding the current upstream nightly. Each release contains a DMG, a zip, and the zip's SHA-256 checksum.

The official `Release` workflow must remain disabled in the fork. It expects the maintainers' production signing and deployment credentials.
