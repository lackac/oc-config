{
  description = "Opinionated OpenCode wrappers and profiles";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    opencode = {
      url = "github:anomalyco/opencode/dev";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    bun2nix = {
      url = "github:nix-community/bun2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    beadwork = {
      url = "github:jallum/beadwork";
      flake = false;
    };
    oh-my-openagent = {
      url = "git+https://github.com/code-yeongyu/oh-my-openagent?ref=dev&submodules=1";
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
      opencode,
      bun2nix,
      beadwork,
      oh-my-openagent,
      treefmt-nix,
      ...
    }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
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
          bun2nixPkg = bun2nix.packages.${system}.default;
          opencodePatchDir = ./patches/opencode;
          opencodePatches = map (name: opencodePatchDir + "/${name}") (
            builtins.filter (name: pkgs.lib.hasSuffix ".patch" name) (
              builtins.attrNames (builtins.readDir opencodePatchDir)
            )
          );
          patchedOpencode = opencode.packages.${system}.opencode.overrideAttrs (old: {
            src = pkgs.applyPatches {
              name = "opencode-patched-source";
              src = old.src;
              patches = opencodePatches;
            };
            env = (old.env or { }) // {
              OPENCODE_CHANNEL = "stable";
            };
          });

          baselineLsps = [
            pkgs.ast-grep
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
              makeWrapper ${patchedOpencode}/bin/opencode "$out/bin/${binName}" \
                --run 'mkdir -p /tmp/opencode' \
                --set OPENCODE_CONFIG_DIR ${configDir} \
                --set TMPDIR /tmp/opencode \
                --set BUN_TMPDIR /tmp/opencode \
                --set OPENCODE_DISABLE_LSP_DOWNLOAD true \
                --suffix PATH : ${baselineToolPath}
            '';

          ohMyOpenagentBunNix =
            args@{
              copyPathToStore,
              fetchFromGitHub,
              fetchgit,
              fetchurl,
              ...
            }:
            import ./nix/oh-my-openagent/bun.nix (args // { ohMyOpenagent = oh-my-openagent; });

          ohMyOpenagentDeps = bun2nixPkg.fetchBunDeps {
            bunNix = ohMyOpenagentBunNix;
          };

          lspToolsMcp = pkgs.buildNpmPackage {
            pname = "lsp-tools-mcp";
            version = "unstable";
            src = oh-my-openagent + "/packages/lsp-tools-mcp";
            npmDepsHash = "sha256-y8F+nZGIT/wnTZJSqWfLWJvVroFUAF55Nq0bv6Im1mU=";
            nativeBuildInputs = [ pkgs.python3 ];
            dontNpmBuild = false;
            postInstall = ''
              mkdir -p $out/dist
              cp -R dist/* $out/dist/
            '';
          };

          ohMyOpenagentPlugin = pkgs.stdenvNoCC.mkDerivation {
            pname = "oh-my-openagent-plugin";
            version = "unstable";
            src = oh-my-openagent;

            nativeBuildInputs = [
              bun2nixPkg.hook
              pkgs.bun
            ];

            bunDeps = ohMyOpenagentDeps;
            dontRunLifecycleScripts = true;
            dontUseBunBuild = true;
            dontUseBunInstall = true;

            buildPhase = ''
              runHook preBuild
              bun run build
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              mkdir -p "$out/lib/oh-my-openagent"
              cp -R dist "$out/lib/oh-my-openagent/"
              cp -R packages "$out/lib/oh-my-openagent/"
              cp -R node_modules "$out/lib/oh-my-openagent/"
              mkdir -p "$out/lib/oh-my-openagent/dist/packages/lsp-tools-mcp"
              cp -R ${lspToolsMcp}/dist "$out/lib/oh-my-openagent/dist/packages/lsp-tools-mcp/dist"
              runHook postInstall
            '';
          };

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
                jq '.default_agent = "sisyphus"' "$out/opencode.jsonc" > "$out/opencode.jsonc.tmp"
                mv "$out/opencode.jsonc.tmp" "$out/opencode.jsonc"
                cp ${./config/oh-my-openagent/oh-my-openagent.jsonc} "$out/oh-my-opencode.jsonc"
                mkdir -p "$out/plugins"

                cat > "$out/plugins/oh-my-openagent.js" <<'EOF'
                import plugin from "${ohMyOpenagentPlugin}/lib/oh-my-openagent/dist/index.js"

                export default plugin
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
              inherit ohMyOpenagentPlugin;
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
          "lsp-tools-mcp" = lspToolsMcp;
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

          oh-my-openagent-lockfile =
            pkgs.runCommand "oh-my-openagent-lockfile-check"
              {
                nativeBuildInputs = [ pkgs.diffutils ];
              }
              ''
                diff -u ${oh-my-openagent}/bun.lock ${./nix/oh-my-openagent/bun.lock}
                mkdir -p "$out"
              '';

          oh-my-openagent-lsp-mcp-path = pkgs.runCommand "oh-my-openagent-lsp-mcp-path-check" { } ''
            if [ ! -f "${
              self.packages.${system}."oh-my-openagent".ohMyOpenagentPlugin
            }/lib/oh-my-openagent/dist/packages/lsp-tools-mcp/dist/cli.js" ]; then
              echo "Error: cli.js not found at expected path"
              exit 1
            fi
            mkdir -p "$out"
          '';
        }
      );
    };
}
