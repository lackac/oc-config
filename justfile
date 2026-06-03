# https://just.systems

default:
  @just --list

fmt:
  nix fmt

check:
  nix flake check

refresh-openagent-bun:
  mkdir -p nix/oh-my-openagent
  cp "$(nix eval --impure --raw --expr 'let flake = builtins.getFlake (toString ./.) ; in flake.inputs."oh-my-openagent".sourceInfo.outPath')/bun.lock" nix/oh-my-openagent/bun.lock
  "$(nix build --impure --no-link --print-out-paths --expr 'let flake = builtins.getFlake (toString ./.) ; system = builtins.currentSystem; in flake.inputs.bun2nix.packages.${system}.default')/bin/bun2nix" -l nix/oh-my-openagent/bun.lock -o nix/oh-my-openagent/bun.nix --copy-prefix './'
  perl -0pi -e 's/(\{\n  copyPathToStore,\n)/$1  ohMyOpenagent,\n/' nix/oh-my-openagent/bun.nix
  perl -0pi -e 's#copyPathToStore \./packages/([^;\n]+)#copyPathToStore (ohMyOpenagent + "/packages/$1")#g' nix/oh-my-openagent/bun.nix
  awk 1 nix/oh-my-openagent/bun.nix > nix/oh-my-openagent/bun.nix.tmp
  mv nix/oh-my-openagent/bun.nix.tmp nix/oh-my-openagent/bun.nix

up:
  nix flake update

upp-opencode-tag tag:
  nix flake lock . --override-input opencode github:anomalyco/opencode/{{tag}}

upp-oh-my-openagent-tag tag:
  nix flake lock . --override-input oh-my-openagent 'git+https://github.com/code-yeongyu/oh-my-openagent?ref=refs/tags/{{tag}}&submodules=1'

upp input tag='':
  if [ -n "{{tag}}" ]; then just upp-{{input}}-tag {{tag}}; else nix flake update {{input}}; fi
  if [ "{{input}}" = "oh-my-openagent" ]; then just refresh-openagent-bun; fi

syncupp input tag='':
  just sync-nixpkgs
  just upp {{input}} {{tag}}

sync-nixpkgs:
  nix flake lock \
    --override-input nixpkgs github:nixos/nixpkgs/$(nix flake metadata ../nix-config --json | jq -r '.locks.nodes[.locks.nodes[.locks.root].inputs.nixpkgs].locked.rev')
