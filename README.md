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

## Submit to addons.mozilla.org

The add-on is published as a listed (public) add-on on AMO. Create API credentials at
https://addons.mozilla.org/developers/addon/api/key/ and run:

    ./scripts/sign.sh

It asks for the credentials and submits the add-on to AMO for review. Once Mozilla approves
it, the version is public in the store. Bump `version` in `extension/manifest.json` before
submitting again: Mozilla rejects an upload whose version has already been submitted.

## Build

    npx web-ext lint --source-dir extension
    npx web-ext build --source-dir extension --artifacts-dir dist

## Releases

Publishing a GitHub release runs `.github/workflows/release.yml`, which:

1. sets the add-on version from the release tag (`v1.2.0` → `1.2.0`),
2. lints the add-on and submits it to AMO (listed) for review.

Once Mozilla approves the version, Firefox updates installed copies from AMO. Each release
needs a higher version than the last.

One-time setup: add the AMO credentials as repository secrets `AMO_JWT_ISSUER` and
`AMO_JWT_SECRET`:

    gh secret set AMO_JWT_ISSUER
    gh secret set AMO_JWT_SECRET

## License

Copyright (C) 2026 Rodrigo Silva

Licensed under the GNU General Public License v3.0 or later. See [LICENSE](LICENSE).
