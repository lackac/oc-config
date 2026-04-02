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
    oh-my-openagent = {
      url = "github:code-yeongyu/oh-my-openagent/dev";
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
          patchedOpencode = opencode.packages.${system}.opencode.overrideAttrs (old: {
            env = (old.env or { }) // {
              OPENCODE_CHANNEL = "stable";
            };
          });

          baselineLsps = [
            pkgs.ast-grep
            pkgs.nixd
            pkgs.marksman
            pkgs.vscode-langservers-extracted
            pkgs.nodePackages.bash-language-server
            pkgs.nodePackages.yaml-language-server
          ];

          baselineLspPath = pkgs.lib.makeBinPath baselineLsps;

          ohMyOpenagentDeps = bun2nixPkg.fetchBunDeps {
            bunNix = ./nix/oh-my-openagent/bun.nix;
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
              cp -R node_modules "$out/lib/oh-my-openagent/"
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
            nativeBuildInputs = [ pkgs.makeBinaryWrapper ];

            installPhase = ''
              mkdir -p "$out/bin"

              makeWrapper ${patchedOpencode}/bin/opencode "$out/bin/opencode" \
                --set OPENCODE_CONFIG_DIR ${coreConfigDir} \
                --set OPENCODE_DISABLE_LSP_DOWNLOAD true \
                --suffix PATH : ${baselineLspPath}

              makeWrapper ${patchedOpencode}/bin/opencode "$out/bin/oc" \
                --set OPENCODE_CONFIG_DIR ${coreConfigDir} \
                --set OPENCODE_DISABLE_LSP_DOWNLOAD true \
                --suffix PATH : ${baselineLspPath}
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
            nativeBuildInputs = [ pkgs.makeBinaryWrapper ];

            installPhase = ''
              mkdir -p "$out/bin"

              makeWrapper ${patchedOpencode}/bin/opencode "$out/bin/oh-my-openagent" \
                --set OPENCODE_CONFIG_DIR ${ohMyOpenagentConfigDir} \
                --set OPENCODE_DISABLE_LSP_DOWNLOAD true \
                --suffix PATH : ${baselineLspPath}

              makeWrapper ${patchedOpencode}/bin/opencode "$out/bin/omo" \
                --set OPENCODE_CONFIG_DIR ${ohMyOpenagentConfigDir} \
                --set OPENCODE_DISABLE_LSP_DOWNLOAD true \
                --suffix PATH : ${baselineLspPath}
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

        }
      );
    };
}
