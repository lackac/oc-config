# https://just.systems

default:
  @just --list

fmt:
  nix fmt

check:
  nix flake check

refresh-openagent-bun:
  nix develop -c refresh-openagent-bun .

up:
  nix flake update

upp input:
  nix flake update {{input}}

sync-nixpkgs:
  nix flake lock \
    --override-input nixpkgs github:nixos/nixpkgs/$(nix flake metadata ../nix-config --json | jq -r '.locks.nodes[.locks.nodes[.locks.root].inputs.nixpkgs].locked.rev')
