# oc-config

Opinionated OpenCode wrappers and profiles.

This repository packages two managed OpenCode entry points with Nix:

- `opencode` / `oc`: the core profile from `config/core`
- `oh-my-openagent` / `omo`: the Oh My OpenAgent profile, built on top of the core profile and wired to the bundled plugin from `config/oh-my-openagent`

The flake wraps the upstream `opencode` binary, injects repository-managed config, disables on-demand LSP downloads, and puts a baseline set of language servers on `PATH`.

## What is in here

- `flake.nix`: builds the wrapped binaries, dev shell, formatter, and checks
- `config/core/`: base OpenCode config, agent guidance, and user-installed skills
- `config/oh-my-openagent/`: Oh My OpenAgent profile overrides
- `nix/oh-my-openagent/`: pinned Bun dependency data for the plugin build
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
just upp oh-my-openagent     # update one input and refresh Bun metadata when needed
just refresh-openagent-bun   # rebuild pinned bun.nix/bun.lock for the plugin
```

## Profiles

The core profile in `config/core/opencode.jsonc` uses `openai/gpt-5.4` as the main model and defaults to the `plan` agent.

The OMO profile is assembled during the flake build. It starts from the core config, switches the default agent to `sisyphus`, adds `config/oh-my-openagent/oh-my-openagent.jsonc`, and mounts the built Oh My OpenAgent plugin under `plugins/oh-my-openagent.js`.
