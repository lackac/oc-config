# https://just.systems

default:
  @just --list

fmt:
  nix fmt

check:
  nix flake check

refresh-openagent-bun:
  mkdir -p nix/oh-my-openagent
  cp "$(nix eval --impure --raw --expr '(builtins.getFlake (toString ./.)).inputs."oh-my-openagent".outPath')/bun.lock" nix/oh-my-openagent/bun.lock
  "$(nix eval --impure --raw --expr 'let flake = builtins.getFlake (toString ./.) ; system = builtins.currentSystem; in flake.inputs.bun2nix.packages.${system}.default.outPath + "/bin/bun2nix"')" -l nix/oh-my-openagent/bun.lock -o nix/oh-my-openagent/bun.nix
  awk 1 nix/oh-my-openagent/bun.nix > nix/oh-my-openagent/bun.nix.tmp
  mv nix/oh-my-openagent/bun.nix.tmp nix/oh-my-openagent/bun.nix

up:
  nix flake update

upp-opencode-tag tag:
  nix flake lock . --override-input opencode github:anomalyco/opencode/{{tag}}

upp-oh-my-openagent-tag tag:
  nix flake lock . --override-input oh-my-openagent github:code-yeongyu/oh-my-openagent/{{tag}}

upp input tag='':
  if [ -n "{{tag}}" ]; then just upp-{{input}}-tag {{tag}}; else nix flake update {{input}}; fi
  if [ "{{input}}" = "oh-my-openagent" ]; then just refresh-openagent-bun; fi

syncupp input tag='':
  just sync-nixpkgs
  just upp {{input}} {{tag}}

sync-nixpkgs:
  nix flake lock \
    --override-input nixpkgs github:nixos/nixpkgs/$(nix flake metadata ../nix-config --json | jq -r '.locks.nodes[.locks.nodes[.locks.root].inputs.nixpkgs].locked.rev')
