# The Break Surf Media Helper

This macOS-only helper gives Safari's Frame Capture page narrowly scoped access
to a user-selected DCIM folder. Media stays on the Mac or attached card.

## What it does

- Opens a native macOS folder picker from the admin panel.
- Scans and previews media organisation.
- Uses atomic filesystem renames when source and destination are on the same
  volume.
- Uses copy, byte-size verification and SHA-256 verification before removing a
  source when media crosses volumes.
- Moves LRF proxy files to macOS Trash.
- Prevents idle sleep while an organisation job is active.
- Streams local videos to Safari with HTTP range support.
- Recursively loads every video in the selected folder.
- Rotates a video with a native passthrough export, verifies the temporary
  output, then atomically replaces the original while streaming progress.
- Moves unwanted source videos to macOS Trash after confirmation in the admin panel.
- Stores a hidden capture marker beside each source video so completed videos remain green after reconnecting a drive.
- Saves RAW and Edited JPEG captures back into the selected day folder.
- Supports safe stop between files and OS-confirmed SD-card eject.

## Security

The helper:

- binds only to `127.0.0.1`;
- uses a locally trusted HTTPS certificate;
- requires explicit approval for each admin-panel origin;
- issues a random bearer token after approval;
- validates all paths remain inside the selected DCIM root.

## Install

```sh
./tools/media-helper/install.sh
```

The installer creates a user LaunchAgent and starts the helper at login. It
does not install a root daemon.

## Remove

```sh
./tools/media-helper/uninstall.sh
```

The uninstaller stops the login service and removes certificate trust. It
leaves helper data in `~/Library/Application Support/The Break Surf Media
Helper` so logs and pairing information can be inspected before manual
removal.

## Test

```sh
node tools/media-helper/test-helper.mjs
```

The test uses a disposable temporary DCIM directory and never touches a real
media card.
