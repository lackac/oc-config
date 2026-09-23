# oc-config

Opinionated OpenCode wrapper and configuration.

This repository packages one managed OpenCode configuration with Nix:

- `opencode` / `oc`: the OpenCode v2 core profile from `config/core`

The flake wraps OpenCode v2 from [`llm-agents.nix`](https://github.com/numtide/llm-agents.nix), injects repository-managed server and CLI configuration, and adds Git to its `PATH`.

## What is in here

- `flake.nix`: builds the wrapped binaries, dev shell, formatter, and checks
- `config/core/`: base OpenCode config, agent guidance, and user-installed skills
- `justfile`: common maintenance commands

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

## Common workflows

Enter the dev shell:

```bash
nix develop
```

List the available `just` commands:

```bash
just
```

Useful commands:

```bash
just fmt                     # run nix fmt
just check                   # run nix flake check
just up                      # update all flake inputs
just upp llm-agents          # update the agent package set
just syncupp llm-agents      # sync nixpkgs, then update the agent package set
```

OpenCode package updates come from the `llm-agents` input. This repository keeps only the wrapper and project-specific configuration.

## Profiles

The core profile is defined in `config/core/`. Treat that directory as the source of truth for OpenCode settings, agent guidance, CLI preferences, and user-installed skills.

The flake defines configurations as data and builds their wrappers through a shared constructor. Additional profiles can be introduced as sibling configuration directories and entries in the `configurations` attribute set.
