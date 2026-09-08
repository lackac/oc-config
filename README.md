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
