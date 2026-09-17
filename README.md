# YTR (YouTube Refreshed extension for Orion)

YTR is a web extension designed primarily for the Orion browser (iOS/macOS) that provides a clean, premium-like YouTube experience.

## Features

- **Ad Blocking:** Hides ad slots, banners, and overlays. Auto-skips video ads instantly.
- **Hide Shorts:** Removes the Shorts tab, shelves, and icons.
- **Hide Community Posts:** Cleans up your feed by removing community posts.
- **Hide Mixes:** Removes auto-generated YouTube Mixes and radio playlists.
- **Video Quality:** Choose Auto, highest available, or a resolution from 144p to 8K. Falls back to the nearest available lower resolution (or the lowest available if none is lower). YouTube may override the preference.
- **Picture-in-Picture:** A neutral button inside the player, with floating and hidden options. Supports standard PiP and WebKit presentation mode where available.

- **Sleep Timer:** Start or cancel a 1–480 minute timer for the active YouTube tab. It follows video navigation and survives reloads in that tab. Suspended tabs pause when execution resumes; closing the tab ends the timer.
- **SponsorBlock:** Optional automatic skipping of crowdsourced sponsor segments. Disabled by default; it does not skip intros, outros, or other categories. Requests use SponsorBlock's four-character SHA-256 prefix endpoint rather than sending the full video ID. No submissions or votes are sent.

## Settings

The extension includes a popup menu where you can change filtering, quality, and PiP placement in real time across open YouTube tabs. Existing maximum-quality preferences are preserved.

## Installation (Orion iOS)

1. Download the `YTR.zip` file from the [Releases](../../releases/latest) page.
2. Transfer the `.zip` file to your iOS device (via iCloud Drive, AirDrop, etc.).
3. Open Orion and go to **Settings > Extensions**.
4. Tap the **+** button (or "Install from File") and select the `YTR.zip` file.
5. Ensure the extension is enabled and has permissions for `youtube.com`.

## Installation (Orion macOS / Chrome / Firefox)

1. Download the source code or clone this repository.
2. Go to your browser's extension management page.
3. Enable **Developer Mode**.
4. Select **Load Unpacked** (or equivalent) and select the `YTR` folder.

## Playback features

Reload the extension and existing YouTube tabs after updating. The new SponsorBlock host permission allows requests to `https://sponsor.ajay.app/`; requests only occur while SponsorBlock is enabled on a watch page. Segment data comes from [SponsorBlock](https://sponsor.ajay.app/) using its [public API](https://wiki.sponsor.ajay.app/w/API_Docs). Missing segments or service failures leave playback unchanged, with delayed retries. Turn off SponsorBlock to watch skipped content.

Set the sleep timer from the extension popup while the desired YouTube tab is active. The options page needs an active YouTube tab to control a timer. The timer is local to that tab, not synced between devices, and uses elapsed clock time even while playback is paused.

## Validation

Run `node --test tests/*.test.cjs` for quality, timer, SponsorBlock navigation, and API handler tests. Live Orion/iOS checks are still needed: start a one-minute timer, navigate/reload, test cancellation and background playback; enable SponsorBlock on a video with known sponsor segments and check PiP playback. Browser suspension can delay the sleep timer.
