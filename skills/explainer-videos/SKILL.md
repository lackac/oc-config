---
name: explainer-videos
description: Create or revise narrated explainer videos with local Kokoro narration, selectable visual styles, voice blends and speed, audio-driven animation timing, captions, and editable sources.
---

# Explainer videos

Create a finished, understandable video from a subject or source material. Use
local `kokoro-narrate` for English speech and a project-local renderer for the
animation. Work through rendering and review, rather than stopping at a script.

## Resolve the brief

Ask for a subject if none is given. Extract the audience, target duration,
visual direction, format, and narration settings from the request and existing
project. Explicit choices take precedence over defaults.

When the user wants to explore options, offer a small style or voice shortlist
and make a short preview. Otherwise, state sensible defaults and proceed; a
missing palette or voice preference does not require a questionnaire.

Use [templates/brief.json](templates/brief.json) as a starting point. Resolve its
empty topic and automatic design choices before production. The brief records
choices for the agent and generated project; it is not a `kokoro-narrate` input.

| Setting         | Default / choices                                                             |
| --------------- | ----------------------------------------------------------------------------- |
| Audience        | Curious non-specialists                                                       |
| Target length   | About 60 seconds; measured narration determines the actual length             |
| Format          | 1920×1080, 30 fps; adapt to square or portrait when requested                 |
| Visual language | Choose from the style guide, or use the user's custom direction               |
| Design          | Resolve palette, fonts, spacing, illustration treatment, and motion intensity |
| Voice           | `bf_emma` (Emma); any bundled English preset or comma-separated blend         |
| Speed           | `1.0`; a finite positive value, such as `0.9` or `1.1`                        |
| Pronunciation   | Follow the first voice's accent; optionally force `a` (US) or `b` (UK)        |
| Pauses          | 0.25 seconds between narration beats; adjust for the subject and pacing       |
| Captions        | Sidecar SRT; burn in captions when requested                                  |

Read [references/visual-styles.md](references/visual-styles.md) to choose or
interpret the visual direction. It covers whiteboard, collage, technical
diagrams, editorial layouts, kinetic typography, and interface walkthroughs.
Custom styles and deliberate combinations are welcome. Keep a coherent visual
system across the video, with per-scene variation where it helps the explanation.

## Preflight and workspace

1. Check `kokoro-narrate --help` and `--list-voices`. Validate every selected voice,
   including every member of a blend. Read [references/narration.md](references/narration.md).

1. Check for Node.js, FFmpeg/ffprobe, and an existing rendering setup. Read
   [references/rendering.md](references/rendering.md) for the local Nix and browser route.

1. Prefer the project's existing renderer and dependency management. Keep new
   rendering dependencies and lockfiles in the video's source project.

1. Generate one timestamp with `date +"%Y-%m-%d-%H%M%S"`. Use it throughout the run:

   ```text
   videos/<subject>-<timestamp>.mp4
   videos/<subject>-<timestamp>.srt
   videos/<subject>-<timestamp>/
     brief.json
     storyboard.md
     timeline.json
     narration/       # numbered text and WAV files
     assets/
     src/
     frames/
     README.md
   ```

Use the working project's output conventions when they differ. Keep outputs out
of the installed skill directory. Preserve existing work and give new versions
distinct paths; `kokoro-narrate` deliberately refuses to overwrite WAV files.

## Production workflow

### 1. Explain before decorating

Check the source material and research claims that need verification. Write for
the stated audience: establish the question, explain the mechanism with a concrete
example, and end with the central takeaway. Prefer a useful conclusion to a
generic call to action. Keep a source list beside the storyboard.

Break the script into short narration beats. A scene can contain several beats.
For each beat, record its spoken text, on-screen idea, visual action, and any
voice/speed override. Keep on-screen labels shorter than the narration. Write
numbers, abbreviations, and names in a pronounceable form when needed.

### 2. Make a representative preview

Resolve concrete design tokens from the selected visual language. Render a key
frame at the intended aspect ratio and generate a representative narration beat.
Read the frame as an image and check the actual speech for pronunciation and
pacing where audio review is available. Refine this sample before producing all
scenes. Ask for feedback here when the user requested a review or comparison.

### 3. Generate narration and derive timing

Generate one WAV per beat with the resolved narration settings. Measure the
actual samples and sample rate; estimated reading time is only a writing aid.
Record resolved voices, speed, audio paths, speech durations, start frames, and
total frame counts in `timeline.json`. Include explicit pauses and visual holds.

Build the audio and video from this same timeline. Changing spoken text, voice,
speed, or pronunciation invalidates that beat's audio and downstream timing and
captions. A visual-only change can reuse the measured narration.

### 4. Animate and assemble

Animate to the measured timeline. Introduce each visual when its idea is spoken,
then give it time to be understood. Reuse diagrams and objects across scenes to
maintain continuity. Keep transitions subordinate to the explanation.

Use deterministic frame rendering, local assets, and a fixed random seed for
intentional imperfections. Produce an H.264/AAC MP4 with readable text, plus
captions derived from the narration beats. Follow the rendering reference for
frame/audio alignment and export details.

### 5. Review and deliver

- Read a contact sheet and full-size frames, including transitions and the most
  crowded scene. Fix clipping, small labels, weak contrast, and unclear staging.
- Check speech and pauses, caption boundaries, and the ending. Confirm the entire
  final sentence is audible. Report audio playback as playback, not as listening
  comprehension if the available tools do not expose audio to the model.
- Use ffprobe to verify resolution, frame rate, audio/video streams, and duration.
  Decode the finished MP4 to check for errors. Watch the result when playback is
  available; a successful encode alone does not establish visual quality.
- Record resolved parameters, asset/source credits, dependency versions or pins,
  and exact regeneration commands in the source project's README.

Deliver the MP4, SRT, and editable source directory. Summarize the style, narration
settings, actual duration, and any review limitations that remain.
