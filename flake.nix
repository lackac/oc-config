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
          opencodePackage = llmAgentPackages.opencode;
          tuicr = llmAgentPackages.tuicr;

          baselineTools = [
            pkgs.ast-grep
            pkgs.biome
            pkgs.nixd
            pkgs.marksman
            pkgs.vscode-langservers-extracted
            pkgs.bash-language-server
            pkgs.yaml-language-server
            pkgs.git
            tuicr
          ];

          baselineToolPath = pkgs.lib.makeBinPath baselineTools;

          mkWrappedOpencodeBinary = configDir: binName: ''
            makeWrapper ${opencodePackage}/bin/opencode "$out/bin/${binName}" \
              --run 'mkdir -p /tmp/opencode' \
              --set OPENCODE_CONFIG_DIR ${configDir} \
              --set TMPDIR /tmp/opencode \
              --set BUN_TMPDIR /tmp/opencode \
              --set OPENCODE_DISABLE_AUTOUPDATE true \
              --set OPENCODE_DISABLE_LSP_DOWNLOAD true \
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
                mkdir -p "$out/skills"
                chmod u+w "$out/skills"
                ln -s ${tuicr.src}/skills/tuicr "$out/skills/tuicr"
              '';
            in
            pkgs.stdenvNoCC.mkDerivation {
              inherit pname;
              version = "unstable";
              dontUnpack = true;
              nativeBuildInputs = [ pkgs.makeWrapper ];

              installPhase = ''
                mkdir -p "$out/bin"
                ln -s ${tuicr}/bin/tuicr "$out/bin/tuicr"

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
          inherit tuicr;
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
              self.packages.${system}.tuicr
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
