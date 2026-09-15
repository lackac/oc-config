# oc-config

Opinionated OpenCode wrapper and configuration.

This repository packages one managed OpenCode configuration with Nix:

- `opencode` / `oc`: the core profile from `config/core`

The flake wraps the `opencode` binary from [`llm-agents.nix`](https://github.com/numtide/llm-agents.nix), injects repository-managed config, disables on-demand LSP downloads, and puts a baseline set of language servers on `PATH`.

The wrapper also provides [`tuicr`](https://github.com/agavra/tuicr) for interactive diff review.

## What is in here

- `flake.nix`: builds the wrapped binaries, dev shell, formatter, and checks
- `config/core/`: base OpenCode config, agent guidance, and user-installed skills
- `justfile`: common maintenance commands

## Agent models

The core profile uses OpenAI subscription models for its primary agents:

- Plan: GPT-5.6 Sol with medium reasoning
- Build: GPT-5.6 Terra with medium reasoning

It provides paired specialist subagents. Unsuffixed `architect` and `general`
use OpenAI subscription models; `explore`, `scout`, and `designer` use
GPT-5.6 Luna from OpenCode Go to spare Plus quota. `*-go` agents use
zero-day-retention models from OpenCode Go, except Go-provided Luna which
retains abuse-monitoring logs for up to 30 days:

| Role | Default | OpenCode Go alternative |
| --- | --- | --- |
| Architecture and difficult problems | `architect` (GPT-6 Astra) | `architect-go` (Qwen3.8 Max) |
| Codebase exploration | `explore` (Go Luna) | `explore-go` (GLM-5.3 Flash) |
| External research | `scout` (Go Luna) | `scout-go` (GLM-5.3 Flash) |
| Scoped implementation | `general` (GPT-5.6 Terra, low) | `general-go` (MiniMax M3) |
| Interface work | `designer` (Go Luna) | `designer-go` (Kimi K2.7 Code) |

Both tracks are enabled by default. Project instructions can express a
preference, while project `opencode.json` files can prevent automatic
delegation to one track:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "task": {
      "*-go": "deny"
    }
  }
}
```

To disable an agent entirely, enumerate it under `agent`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "architect-go": {
      "disable": true
    }
  }
}
```

To prevent any use of Go for a project, also add `opencode-go` to
`disabled_providers`; task permissions only govern delegation.

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

OpenCode and tuicr package updates come from the `llm-agents` input. This repository keeps only the wrapper and project-specific configuration.

## Profiles

The core profile is defined in `config/core/`. Treat that directory as the source of truth for OpenCode settings, agent guidance, TUI preferences, and user-installed skills.

The flake defines configurations as data and builds their wrappers through a shared constructor. Additional profiles can be introduced as sibling configuration directories and entries in the `configurations` attribute set.

## tuicr

The managed profile includes the `tuicr` executable and its agent skill. Start a review of uncommitted changes in another terminal, then ask the agent to read your comments from the active session:

```bash
tuicr -w
```

The agent can discover the persisted review session and exchange inline comments through `tuicr review`.
