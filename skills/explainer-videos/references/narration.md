# Local narration

Use the installed `kokoro-narrate` command. It generates local, Metal-accelerated
English speech on Apple Silicon with macOS 26 or later. Its dependencies, model,
and voice assets are packaged by CLI toolbox; generation works offline.

```sh
kokoro-narrate --list-voices
kokoro-narrate --voice bf_emma --speed 1.0 \
  --input narration/001.txt --output narration/001.wav
```

If it is missing from PATH, the same package is available through Nix:

```sh
nix run github:lackac/cli-toolbox#kokoro-narrate -- --list-voices
```

Use the project's pinned toolbox input when available. If local narration cannot
run, explain the missing prerequisite and ask how to proceed; a cloud TTS service
is a different user choice. This wrapper supports English, not every language the
underlying model supports.

## Parameters

| Brief field | Command / behavior |
| --- | --- |
| `voice` | `--voice NAME` or a comma-separated blend; default `bf_emma` |
| `speed` | `--speed NUMBER`; finite and greater than zero; `1` is normal |
| `lang_code` | `null`: omit the flag and follow the first voice; `a` or `b`: pass `--lang-code` |
| `gap_seconds` | Add silence in the assembly timeline; not a TTS flag |

Enumerate voices instead of inventing names. Preset prefixes are `af` / `am` for
American female/male and `bf` / `bm` for British female/male. Emma, Isabella, and
Lewis are `bf_emma`, `bf_isabella`, and `bm_lewis`.

Comma-separated entries receive equal weight, including repeated entries. Male
and female presets can be blended:

```sh
# Equal thirds: Emma, Isabella, Lewis.
kokoro-narrate --voice bf_emma,bf_isabella,bm_lewis \
  --input narration/001.txt --output narration/001-blend.wav

# Two-thirds Emma, one-third Lewis.
kokoro-narrate --voice bf_emma,bf_emma,bm_lewis \
  --input narration/001.txt --output narration/001-emma-weighted.wav
```

For a blend across accents, confirm the intended pronunciation or use the first
voice's accent. Voice and pronunciation are separate choices. There are no CLI
controls for emotion, pitch, or voice cloning; do not invent flags for them.

## Beats, pacing, and captions

Write UTF-8 text files and quote paths and argument values when scripting. Keep
beats short enough for readable captions and a clear visual action. A visual
scene may span several beats. Narration overrides belong to individual beats;
otherwise inherit the video's settings.

The output is mono, 24 kHz, 16-bit PCM WAV. Validate successful generation and
nonempty audio. Measure each WAV, for example with Python's standard library:

```python
import wave

with wave.open("narration/001.wav", "rb") as audio:
    seconds = audio.getnframes() / audio.getframerate()
```

Use those durations to construct the shared timeline. Add explicit silence for
pauses and holds. Allocate integer video frames, pad each beat's audio to its
allocated duration, and carry cumulative positions without rounding to whole
seconds. At 30 fps and 24 kHz, each video frame is exactly 800 audio samples.

SRT cues can use measured beat boundaries, ending before the following pause.
Wrap a cue into one or two readable lines. For finer cues, generate shorter beats
or use a verified alignment tool. Kokoro's WAV output provides no word timestamps;
uniformly dividing a sentence's duration does not establish word-level sync.

If a fixed video duration is requested, edit the script and regenerate the
affected beats. Do not cut off speech or stretch finished audio just to meet an
earlier estimate. Keep the original WAVs alongside any final normalization or mix.
