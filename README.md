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

It provides specialist subagents. `architect` and `general` use OpenAI
subscription models; `routine`, `explore`, `scout`, and `designer` use GPT-6
Luna from OpenCode Go to spare Plus quota. `*-go` and `*-go2` agents use
zero-day-retention models from OpenCode Go. Go-provided Luna retains
abuse-monitoring logs for up to 30 days.

| Role | Default | OpenCode Go alternative |
| --- | --- | --- |
| Architecture and difficult problems | `architect` (GPT-6 Astra, max) | `architect-go` (GLM-5.3, max); `architect-go2` (Kimi K3, max) |
| Codebase exploration | `explore` (Go Luna) | `explore-go` (GLM-5.3 Flash) |
| External research | `scout` (Go Luna) | `scout-go` (GLM-5.3 Flash) |
| Broad implementation | `general` (GPT-6.1 Sol, high) | `general-go` (GLM-5.3, high); `general-go2` (Kimi K3, max) |
| Routine implementation | `routine` (Go Luna) | — |
| Interface work | `designer` (Go Luna) | `designer-go` (Kimi K2.7 Code) |

Unsuffixed agents remain preferred. The Go counterparts provide independent
perspectives on request or when useful, and alternatives when GPT quota is
constrained. GLM is the first Go choice for implementation and investigative
debugging; Kimi provides another perspective for long-context design analysis
and repository work. These are selection guidelines, not limits on their roles.

GLM uses max reasoning for architecture and high for implementation. Kimi uses
max for both because that is the only effort variant currently exposed by Go;
its architect and general agents differ in role and permissions. Published
benchmarks support these as capable counterpoints, without establishing parity
with Astra or Sol at maximum effort. See [Artificial Analysis](https://artificialanalysis.ai/models/releases/comparisons/glm-5-3-vs-kimi-k3)
and the [GLM model card](https://huggingface.co/zai-org/GLM-5.3).

All variants are enabled by default. Project instructions can express a
preference, while project `opencode.json` files can block delegation to Go
counterparts:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permissions": [
    { "action": "subagent", "resource": "*-go*", "effect": "deny" }
  ]
}
```

To disable an agent entirely, enumerate it under `agents`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "agents": {
    "architect-go": {
      "disabled": true
    }
  }
}
```

To prevent any use of OpenCode Go for a project, add an experimental provider
policy; subagent permissions only govern delegation.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "experimental": {
    "policies": [
      { "action": "provider.use", "resource": "opencode-go", "effect": "deny" }
    ]
  }
}
```

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

`plugins/quota/` provides compact OpenAI and OpenCode Go quota meters using
existing ChatGPT OAuth and Go API-key connections, with no additional packages.

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
