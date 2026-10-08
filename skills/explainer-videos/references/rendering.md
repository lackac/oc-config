# Rendering and review

## Tools in this environment

`kokoro-narrate`, Node.js/npm, Nix, ImageMagick, and Google Chrome are available in
the current setup. Discover tools again at execution time. A cached Playwright
browser does not imply that the project's JavaScript Playwright package exists.

FFmpeg and ffprobe may need a Nix shell. Reuse the project's tool environment, or
use the Nixpkgs input already pinned by this user's host configuration:

```sh
nix shell --inputs-from "$HOME/Code/lackac/nix-config" nixpkgs#ffmpeg \
  --command ffmpeg -version
```

Run ffprobe or encoding commands through the same shell. For a different
workspace, use its pinned Nixpkgs input or record an explicit flake revision in
the video's regeneration instructions. Keep project-local JavaScript dependencies
and their lockfile with the editable sources.

## Deterministic animation

Reuse an existing video renderer when the project has one. Otherwise, a small
HTML/SVG/Canvas scene with a JavaScript `renderAt(seconds)` function, driven by
Playwright and encoded with FFmpeg, is a suitable default.

- Derive every object's state from the supplied time. Use seeded randomness for
  hand-drawn or collage effects. Avoid wall-clock animation and real-time screen
  recording as a substitute for frame rendering.
- Set the viewport to the requested output dimensions and device scale to one.
- Wait for `document.fonts.ready`, decode images, and load local assets before
  capturing frames. Prefer bundled fonts/assets to network-dependent rendering.
- Capture frame `i` at `i / fps`; number frames consistently from zero. Respect
  measured beat starts and lengths from `timeline.json`.
- Use a fresh frame directory for each render pass so stale frames cannot extend
  a shorter revision. Retain the low-cost draft until the final render passes review.

A minimal capture loop inside the project's renderer looks like this:

```javascript
await page.evaluate(() => document.fonts.ready);
for (let i = 0; i < frameCount; i++) {
  await page.evaluate((seconds) => window.renderAt(seconds), i / fps);
  await page.screenshot({
    path: `${framesDir}/${String(i).padStart(6, "0")}.png`,
  });
}
```

This assumes the scene, browser, viewport, assets, and directories are already
initialized. Verify a few still frames before capturing the complete sequence.

## Audio, captions, and export

Build `narration.wav` by assembling the generated beats and silence according to
the shared frame timeline. Keep sample rate, channel count, and sample width
consistent when concatenating. Its padded duration should match the video's
total frame count divided by fps. Avoid introducing crossfades that shorten the
timeline unless both audio and visuals account for their overlap.

Export with explicit stream selection, broadly compatible codecs, and fast-start
metadata. For example, from the source project, with its resolved `fps`:

```sh
ffmpeg -n -framerate "$fps" -start_number 0 -i frames/%06d.png \
  -i narration.wav -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
  -c:a aac -b:a 160k -ar 48000 -movflags +faststart "$output_mp4"
```

Use even output dimensions for this pixel format. Align inputs before encoding;
`-shortest` can hide an incorrectly short video by truncating the narration.
Check speech loudness and clipping, and normalize the final mix when needed.
Keep music off by default; when requested, duck it beneath speech. Keep the SRT
as a separate deliverable even when also burning captions into the video.

## Review the actual result

Extract representative frames from the finished MP4, including scene boundaries,
and read them as images. A contact sheet helps check continuity; full-size frames
reveal clipping and legibility problems. Check captions at the intended viewing
size and inspect the final frame, not only the opening.

```sh
ffprobe -v error -show_streams -show_format -of json "$output_mp4"
ffmpeg -v error -i "$output_mp4" -f null -
```

Confirm expected dimensions, fps, video and audio streams, and duration against
the shared timeline. Allow for small codec/container padding, not missing beats.
Review the ending and representative speech samples through available playback
tools. Report which visual, audio, and technical checks actually ran.
