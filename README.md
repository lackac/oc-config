# oc-config

Personal OpenCode v2 configuration, used directly from this checkout.

Home Manager in [`nix-config`](https://github.com/lackac/nix-config) installs OpenCode
from `llm-agents.nix` and links this checkout to `~/.config/opencode`. OpenCode
reads these files directly, so edits to the configuration do not require a Nix
rebuild:

- `opencode.jsonc`: server configuration, models, permissions, and compaction
- `cli.json`: terminal settings; changes made in OpenCode's settings UI are tracked here
- `AGENTS.md`: global agent guidance
- `agents/` and `skills/`: global agent and skill definitions

OpenCode writes `service.json` into this directory; it is ignored by Git. The
background service may need a restart after upgrading the OpenCode binary, but
ordinary configuration changes are loaded from the stable global path.

## Agent models

The core profile uses OpenAI subscription models for its primary agents:

- Build (the default agent): GPT-6 Astra with medium reasoning
- Plan: GPT-6 Astra with medium reasoning

All specialist subagents use OpenAI subscription models:

| Role | Agent | Model |
| --- | --- | --- |
| Architecture and difficult problems | `architect` | GPT-6 Astra, max |
| Codebase exploration | `explore` | GPT-6 Luna |
| External research | `scout` | GPT-6 Luna |
| Broad implementation | `general` | GPT-6.1 Sol, high |
| Routine implementation | `routine` | GPT-6.1 Sol, low |
| Interface work | `designer` | GPT-6.1 Sol, low |

## Compaction

The core profile enables OpenCode v2's checkpoint-based automatic compaction.
It retains 15,000 recent tokens beside a structured checkpoint and reserves a
20,000-token safety buffer. Earlier session messages remain stored, while the
checkpoint replaces them in active model context.

## Explainer videos

The [`explainer-videos`](skills/explainer-videos/SKILL.md) skill creates narrated
videos with the local `kokoro-narrate` tool from CLI toolbox. Emma is the default
voice. Requests can select a voice or blend, speed, pronunciation, pauses, visual
style, palette, typography, aspect ratio, duration, and captions.

Styles include whiteboard, collage, technical diagrams, editorial layouts,
kinetic typography, interface walkthroughs, and custom directions. For example:

> Use explainer-videos to explain cache invalidation for junior developers in
> about 60 seconds. Use technical diagrams with a warm light palette, Emma at
> 1.05× speed, and sidecar captions.

> Make a portrait collage explainer about heat pumps. Blend Emma, Isabella, and
> Lewis equally, with calm motion and burned-in captions.

The skill keeps a per-video brief and editable sources, measures narration to
drive animation and caption timing, and requires review of the rendered output.
It uses project-local rendering tools; FFmpeg can run through a pinned Nix shell.

## Installation

### Quota sidebar

`plugins/quota/` shows OpenAI quota using the existing ChatGPT OAuth connection,
with no additional packages.

- Meters show remaining quota: `5` (five-hour), `W` (weekly), `M` (monthly).
  Unavailable windows are omitted; fills turn amber at ≤50% and red at ≤20%.
- Click **Quota left** or select **Toggle quota details** in the command palette
  for reset times. Low-quota details appear automatically.
- Readings refresh after completions and every 15 minutes while visible, using
  a shared server cache. Failed refreshes mark retained readings as stale.

OpenAI's usage endpoint is undocumented; provider changes may require repairs.

Tests: `node --test plugins/quota/quota.test.ts`.

### Home Manager

Clone this repo to `~/Code/lackac/oc-config` and activate Home Manager through
`nix-config`. On the first activation, Home Manager backs up an existing
`~/.config/opencode` directory and carries its `service.json` into the checkout.
Review the backup for any other local files you want to retain. Restart the
background service after activation so it drops the previous Nix-store config
path (`opencode service restart`); newly created sessions then use this config.
