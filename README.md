# oc-config

Opinionated OpenCode wrappers and profiles.

This repository packages two managed OpenCode entry points with Nix:

- `opencode` / `oc`: the core profile from `config/core`
- `oh-my-openagent` / `omo`: the Oh My OpenAgent profile, built on top of the core profile and wired to the plugin package from `llm-agents.nix`

The flake wraps the `opencode` binary from [`llm-agents.nix`](https://github.com/numtide/llm-agents.nix), injects repository-managed config, disables on-demand LSP downloads, and puts a baseline set of language servers on `PATH`.

The wrappers also provide [`beadwork`](https://github.com/jallum/beadwork)'s `bw` CLI and [`Hunk`](https://github.com/modem-dev/hunk) for agentic project workflows and interactive diff review. Projects opt into Beadwork through their own `AGENTS.md` or other agent instruction files.

## What is in here

- `flake.nix`: builds the wrapped binaries, dev shell, formatter, and checks
- `config/core/`: base OpenCode config, agent guidance, and user-installed skills
- `config/oh-my-openagent/`: Oh My OpenAgent profile overrides
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

OpenCode and Oh My OpenAgent package updates come from the `llm-agents` input. This repository keeps only the wrapper, profile, and project-specific configuration logic.

## Profiles

The core profile is defined in `config/core/`. Treat that directory as the source of truth for OpenCode settings, agent guidance, TUI preferences, and user-installed skills.

The OMO profile is assembled during the flake build. It layers the Oh My OpenAgent configuration from `config/oh-my-openagent/` onto the core profile and mounts the `llm-agents.nix` plugin package into the generated config directory.

## Beadwork

Both managed profiles expose `bw`, the Beadwork CLI, so agents can use it when a project asks for that workflow. The global `config/core/AGENTS.md` intentionally does not mention Beadwork; enabling it is a project-level decision.

To set up a new project, initialize Beadwork in that repository and copy its onboarding guidance into the project's agent instructions:

```bash
bw init
bw onboard
```

Then add the relevant `bw onboard` output to the project's `AGENTS.md`. For projects that opt in, the usual session-start instruction is to run `bw prime` before selecting or updating work.

## Hunk

Both managed profiles include the `hunk` executable and its `hunk-review` skill. Start a review in another terminal, then ask the agent to use the live session:

```bash
hunk diff
```

The agent can inspect the changes, navigate the review, and exchange inline comments through Hunk's local session daemon.
