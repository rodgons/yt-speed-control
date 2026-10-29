# YT Speed Control

A Firefox add-on based on the Chrome extension
[YouTube Playback Speed Control](https://chromewebstore.google.com/detail/hdannnflhlmdablckfkjpleikpphncik),
rewritten from scratch as a Manifest V3 Firefox add-on with no third-party libraries.

## Features

- `+` / `=` speeds up, `-` slows down, `*` resets to 1× (keys are configurable)
- Speed overlay on each video with « / » buttons, click the readout to reset
- Overlay display modes (on hover, always, speed only, hidden) and six positions
- Shift + mouse wheel over a video changes speed
- The chosen speed is shared by all tabs for the browser session (optionally kept across restarts)
- Works on YouTube, embedded players, and (optionally) any HTML5 video
- "Time saved" counter
- On YouTube Shorts: a speed button in the side action bar that cycles 0.5×–3× on click, with the
  Short's current time / length underneath

The Shorts side buttons follow the approach used by
[Better YouTube Shorts](https://github.com/ynshung/better-yt-shorts): copy one of YouTube's own
action-bar buttons so ours match its current styling.

## Try it

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** and pick `extension/manifest.json`

Or run `npx web-ext run --source-dir extension`.

Temporary add-ons are removed when Firefox restarts.

## Install permanently

Release Firefox only installs signed add-ons. Create API credentials at
https://addons.mozilla.org/developers/addon/api/key/ and run:

    ./scripts/sign.sh

It asks for the credentials, signs the add-on as unlisted (private, not shown in the store),
saves the `.xpi` to `dist/` and opens it in Firefox to install. Bump `version` in
`extension/manifest.json` before signing again: Mozilla rejects an upload whose version
has already been signed.

## Build

    npx web-ext lint --source-dir extension
    npx web-ext build --source-dir extension --artifacts-dir dist

## Releases

Publishing a GitHub release runs `.github/workflows/release.yml`, which:

1. sets the add-on version from the release tag (`v1.2.0` → `1.2.0`),
2. lints and signs the add-on with Mozilla (unlisted),
3. attaches `yt-speed-control-<version>.xpi` and `updates.json` to the release.

Installed copies check `updates.json` from the latest release (via `update_url` in the
manifest) and update themselves. Each release needs a higher version than the last.

One-time setup: add the AMO credentials as repository secrets `AMO_JWT_ISSUER` and
`AMO_JWT_SECRET`:

    gh secret set AMO_JWT_ISSUER
    gh secret set AMO_JWT_SECRET

## License

Copyright (C) 2026 Rodrigo Silva

Licensed under the GNU General Public License v3.0 or later. See [LICENSE](LICENSE).
