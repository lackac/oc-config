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

- Build (the default agent): GPT-6 Sol with medium reasoning
- Plan: GPT-6 Astra with medium reasoning

It provides specialist subagents. `architect`, `general`, and `routine` use
OpenAI subscription models; `explore`, `scout`, and `designer` use GPT-5.6
Luna from OpenCode Go to spare Plus quota. `*-go` agents use zero-day-retention
models from OpenCode Go, except Go-provided Luna which retains abuse-monitoring
logs for up to 30 days:

| Role | Default | OpenCode Go alternative |
| --- | --- | --- |
| Architecture and difficult problems | `architect` (GPT-6 Astra) | `architect-go` (GLM-5.3) |
| Codebase exploration | `explore` (Go Luna) | `explore-go` (GLM-5.3 Flash) |
| External research | `scout` (Go Luna) | `scout-go` (GLM-5.3 Flash) |
| Broad implementation | `general` (GPT-6 Sol, low) | `general-go` (MiniMax M3) |
| Routine implementation | `routine` (GPT-6 Luna, medium) | — |
| Interface work | `designer` (Go Luna) | `designer-go` (Kimi K2.7 Code) |

Both tracks are enabled by default. Project instructions can express a
preference, while project `opencode.json` files can prevent automatic
delegation to one track:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permissions": [
    { "action": "subagent", "resource": "*-go", "effect": "deny" }
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

## Installation

Clone this repo to `~/Code/lackac/oc-config` and activate Home Manager through
`nix-config`. On the first activation, Home Manager backs up an existing
`~/.config/opencode` directory and carries its `service.json` into the checkout.
Review the backup for any other local files you want to retain. Restart the
background service after activation so it drops the previous Nix-store config
path (`opencode service restart`); newly created sessions then use this config.
