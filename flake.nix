{
  nixConfig = {
    extra-substituters = [ "https://cache.numtide.com" ];
    extra-trusted-public-keys = [
      "niks3.numtide.com-1:DTx8wZduET09hRmMtKdQDxNNthLQETkc/yaX7M4qK0g="
    ];
  };

  description = "Opinionated OpenCode wrapper and configuration";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    llm-agents = {
      url = "github:numtide/llm-agents.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      llm-agents,
      treefmt-nix,
      ...
    }:
    let
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      pkgsFor = system: import nixpkgs { inherit system; };
      forAllSystems = nixpkgs.lib.genAttrs systems;
      treefmtEval = forAllSystems (system: treefmt-nix.lib.evalModule (pkgsFor system) ./treefmt.nix);
      configurations = {
        opencode = {
          pname = "opencode-profile-custom";
          source = ./config/core;
          binaries = [
            "opencode"
            "oc"
          ];
          description = "OpenCode wrapper with managed configuration";
          mainProgram = "opencode";
        };
      };
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
          llmAgentPackages = llm-agents.packages.${system};
          opencodePackage = llmAgentPackages.opencode2;

          baselineTools = [
            pkgs.git
          ];

          baselineToolPath = pkgs.lib.makeBinPath baselineTools;

          mkWrappedOpencodeBinary = configDir: binName: ''
            makeWrapper ${opencodePackage}/bin/opencode2 "$out/bin/${binName}" \
              --run 'mkdir -p /tmp/opencode' \
              --run 'config_root="''${XDG_CONFIG_HOME:-$HOME/.config}/opencode"' \
              --run 'mkdir -p "$config_root/agents" "$config_root/skills"' \
              --run 'for source in ${configDir}/agents/*.md ${configDir}/skills/*; do target="$config_root/$(basename "$(dirname "$source")")/$(basename "$source")"; if [ ! -e "$target" ] || [ -L "$target" ]; then ln -sfn "$source" "$target"; fi; done' \
              --run 'export OPENCODE_CLI_CONFIG_CONTENT="$(< ${configDir}/cli.json)"' \
              --set OPENCODE_CONFIG ${configDir}/opencode.jsonc \
              --unset OPENCODE_CONFIG_DIR \
              --set TMPDIR /tmp/opencode \
              --set BUN_TMPDIR /tmp/opencode \
              --set OPENCODE_DISABLE_AUTOUPDATE true \
              --suffix PATH : ${baselineToolPath}
          '';

          mkConfiguration =
            name:
            {
              pname,
              source,
              binaries,
              description,
              mainProgram,
            }:
            let
              configDir = pkgs.runCommand "opencode-config-${name}" { } ''
                mkdir -p "$out"
                cp -R ${source}/. "$out/"
              '';
            in
            pkgs.stdenvNoCC.mkDerivation {
              inherit pname;
              version = "unstable";
              dontUnpack = true;
              nativeBuildInputs = [ pkgs.makeWrapper ];

              installPhase = ''
                mkdir -p "$out/bin"

                ${pkgs.lib.concatMapStringsSep "\n" (mkWrappedOpencodeBinary configDir) binaries}
              '';

              meta = {
                inherit description mainProgram;
                platforms = nixpkgs.lib.platforms.all;
              };
            };

          configurationPackages = pkgs.lib.mapAttrs mkConfiguration configurations;

        in
        configurationPackages
        // {
          default = configurationPackages.opencode;
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          default = pkgs.mkShell {
            packages = [
              self.packages.${system}.opencode
            ];
          };
        }
      );

      formatter = forAllSystems (system: treefmtEval.${system}.config.build.wrapper);

      checks = forAllSystems (system: {
        formatting = treefmtEval.${system}.config.build.check self;
      });
    };
}
