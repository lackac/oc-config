{
  nixConfig = {
    extra-substituters = [ "https://cache.numtide.com" ];
    extra-trusted-public-keys = [
      "niks3.numtide.com-1:DTx8wZduET09hRmMtKdQDxNNthLQETkc/yaX7M4qK0g="
    ];
  };

  description = "Opinionated OpenCode wrappers and profiles";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    llm-agents = {
      url = "github:numtide/llm-agents.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    beadwork = {
      url = "github:jallum/beadwork";
      flake = false;
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
      beadwork,
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
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
          llmAgentPackages = llm-agents.packages.${system};
          opencodePackage = llmAgentPackages.opencode;
          ohMyOpencodePlugin = llmAgentPackages."oh-my-opencode";

          baselineLsps = [
            pkgs.ast-grep
            pkgs.biome
            pkgs.nixd
            pkgs.marksman
            pkgs.vscode-langservers-extracted
            pkgs.bash-language-server
            pkgs.yaml-language-server
          ];

          bw = pkgs.buildGoModule {
            pname = "bw";
            version = "unstable";
            src = beadwork;
            vendorHash = "sha256-LjqZSI7F3C8GyNrPK/BwG9QTmNg89hFAvhUuBjmbHTU=";
            subPackages = [ "cmd/bw" ];
            nativeCheckInputs = [ pkgs.git ];
          };

          agenticTools = [
            bw
            pkgs.git
          ];

          baselineToolPath = pkgs.lib.makeBinPath (baselineLsps ++ agenticTools);

          mkWrappedOpencodeBinary =
            {
              binName,
              configDir,
            }:
            ''
              makeWrapper ${opencodePackage}/bin/opencode "$out/bin/${binName}" \
                --run 'mkdir -p /tmp/opencode' \
                --set OPENCODE_CONFIG_DIR ${configDir} \
                --set TMPDIR /tmp/opencode \
                --set BUN_TMPDIR /tmp/opencode \
                --set OPENCODE_DISABLE_AUTOUPDATE true \
                --set OPENCODE_DISABLE_LSP_DOWNLOAD true \
                --suffix PATH : ${baselineToolPath}
            '';

          coreConfigDir = pkgs.runCommand "opencode-config-core" { } ''
            mkdir -p "$out"
            cp -R ${./config/core}/. "$out/"
          '';

          ohMyOpenagentConfigDir =
            pkgs.runCommand "opencode-config-omo"
              {
                nativeBuildInputs = [ pkgs.jq ];
              }
              ''
                mkdir -p "$out"
                cp -R ${./config/core}/. "$out/"
                jq --arg plugin "$out/plugins/oh-my-openagent.js" '.default_agent = "sisyphus" | .plugin = ((.plugin // []) + [$plugin])' "$out/opencode.jsonc" > "$out/opencode.jsonc.tmp"
                mv "$out/opencode.jsonc.tmp" "$out/opencode.jsonc"
                cp ${./config/oh-my-openagent/oh-my-openagent.jsonc} "$out/oh-my-opencode.jsonc"
                cp -R ${ohMyOpencodePlugin}/lib/oh-my-opencode "$out/oh-my-opencode"
                chmod -R u+w "$out/oh-my-opencode"
                ln -s "$out/oh-my-opencode/packages/shared-skills/skills" "$out/oh-my-opencode/dist/skills"
                substituteInPlace "$out/oh-my-opencode/dist/index.js" \
                  --replace-fail 'var __require = import.meta.require;' 'var __require = import.meta.require ?? createRequire(import.meta.url);'
                mkdir -p "$out/plugins"

                cat > "$out/plugins/oh-my-openagent.js" <<EOF
                import plugin from "$out/oh-my-opencode/dist/index.js"

                export default plugin.server
                EOF
              '';

          wrappedOpencode = pkgs.stdenvNoCC.mkDerivation {
            pname = "opencode-profile-custom";
            version = "unstable";
            dontUnpack = true;
            nativeBuildInputs = [ pkgs.makeWrapper ];

            installPhase = ''
              mkdir -p "$out/bin"

              ${mkWrappedOpencodeBinary {
                binName = "opencode";
                configDir = coreConfigDir;
              }}

              ${mkWrappedOpencodeBinary {
                binName = "oc";
                configDir = coreConfigDir;
              }}
            '';

            meta = {
              description = "OpenCode wrapper with managed profile";
              mainProgram = "opencode";
              platforms = nixpkgs.lib.platforms.all;
            };
          };

          wrappedOhMyOpenagent = pkgs.stdenvNoCC.mkDerivation {
            pname = "opencode-profile-omo";
            version = "unstable";
            dontUnpack = true;
            nativeBuildInputs = [ pkgs.makeWrapper ];
            passthru = {
              inherit ohMyOpencodePlugin;
            };

            installPhase = ''
              mkdir -p "$out/bin"

              ${mkWrappedOpencodeBinary {
                binName = "oh-my-openagent";
                configDir = ohMyOpenagentConfigDir;
              }}

              ${mkWrappedOpencodeBinary {
                binName = "omo";
                configDir = ohMyOpenagentConfigDir;
              }}
            '';

            meta = {
              description = "OpenCode wrapper with oh-my-openagent profile";
              mainProgram = "oh-my-openagent";
              platforms = nixpkgs.lib.platforms.all;
            };
          };

        in
        {
          default = wrappedOpencode;
          inherit bw;
          opencode = wrappedOpencode;
          "oh-my-openagent" = wrappedOhMyOpenagent;
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
              self.packages.${system}.bw
              self.packages.${system}.opencode
              self.packages.${system}."oh-my-openagent"
            ];
          };
        }
      );

      formatter = forAllSystems (system: treefmtEval.${system}.config.build.wrapper);

      checks = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          formatting = treefmtEval.${system}.config.build.check self;

          oh-my-openagent-plugin-layout = pkgs.runCommand "oh-my-openagent-plugin-layout-check" { } ''
            if [ ! -f "${
              self.packages.${system}."oh-my-openagent".ohMyOpencodePlugin
            }/lib/oh-my-opencode/dist/index.js" ]; then
              echo "Error: plugin index.js not found at expected path"
              exit 1
            fi

            if [ ! -f "${
              self.packages.${system}."oh-my-openagent".ohMyOpencodePlugin
            }/lib/oh-my-opencode/packages/lsp-daemon/dist/cli.js" ]; then
              echo "Error: cli.js not found at expected path"
              exit 1
            fi
            mkdir -p "$out"
          '';
        }
      );
    };
}
