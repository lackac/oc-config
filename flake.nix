{
  description = "Opinionated OpenCode wrappers and profiles";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    opencode.url = "github:anomalyco/opencode/dev";
    bun2nix.url = "github:nix-community/bun2nix";
    oh-my-opencode = {
      url = "github:code-yeongyu/oh-my-opencode/dev";
      flake = false;
    };
  };

  outputs =
    {
      nixpkgs,
      opencode,
      bun2nix,
      oh-my-opencode,
      ...
    }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f system);
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          bun2nixPkg = bun2nix.packages.${system}.default;
          opencodePr15089Patch = pkgs.fetchpatch {
            url = "https://github.com/kavhnr/opencode/commit/ef1bf8f9088291ef655f7198235ec917cc522b82.patch";
            hash = "sha256-ufNA+14Al/MqNiDNHkeW7esYkEqSzrnmNTfPJZfZO20=";
          };

          patchedOpencode = opencode.packages.${system}.opencode.overrideAttrs (old: {
            patches = (old.patches or [ ]) ++ [ opencodePr15089Patch ];
          });

          ohMyOpencodeDeps = bun2nixPkg.fetchBunDeps {
            bunNix = ./nix/oh-my-opencode/bun.nix;
          };

          ohMyOpencodePlugin = pkgs.stdenvNoCC.mkDerivation {
            pname = "oh-my-opencode-plugin";
            version = "unstable";
            src = oh-my-opencode;

            nativeBuildInputs = [
              bun2nixPkg.hook
              pkgs.bun
            ];

            bunDeps = ohMyOpencodeDeps;
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
              mkdir -p "$out/lib/oh-my-opencode"
              cp -R dist "$out/lib/oh-my-opencode/"
              cp -R node_modules "$out/lib/oh-my-opencode/"
              runHook postInstall
            '';
          };

          coreConfigDir = pkgs.runCommand "opencode-config-core" { } ''
            mkdir -p "$out"
            cp -R ${./config/core}/. "$out/"
          '';

          ohMyOpencodeConfigDir = pkgs.runCommand "opencode-config-oh-my-opencode" {
            nativeBuildInputs = [ pkgs.jq ];
          } ''
            mkdir -p "$out"
            cp -R ${./config/core}/. "$out/"
            jq '.default_agent = "sisyphus"' "$out/opencode.jsonc" > "$out/opencode.jsonc.tmp"
            mv "$out/opencode.jsonc.tmp" "$out/opencode.jsonc"
            cp ${./config/oh-my-opencode/oh-my-opencode.jsonc} "$out/oh-my-opencode.jsonc"
            mkdir -p "$out/plugins"

            cat > "$out/plugins/oh-my-opencode.js" <<'EOF'
import plugin from "${ohMyOpencodePlugin}/lib/oh-my-opencode/dist/index.js"

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
                --set OPENCODE_CONFIG_DIR ${coreConfigDir}

              makeWrapper ${patchedOpencode}/bin/opencode "$out/bin/oc" \
                --set OPENCODE_CONFIG_DIR ${coreConfigDir}
            '';

            meta = {
              description = "OpenCode wrapper with managed profile";
              mainProgram = "opencode";
              platforms = nixpkgs.lib.platforms.all;
            };
          };

          wrappedOhMyOpencode = pkgs.stdenvNoCC.mkDerivation {
            pname = "opencode-profile-oh-my-opencode";
            version = "unstable";
            dontUnpack = true;
            nativeBuildInputs = [ pkgs.makeBinaryWrapper ];

            installPhase = ''
              mkdir -p "$out/bin"

              makeWrapper ${patchedOpencode}/bin/opencode "$out/bin/oh-my-opencode" \
                --set OPENCODE_CONFIG_DIR ${ohMyOpencodeConfigDir}

              makeWrapper ${patchedOpencode}/bin/opencode "$out/bin/omo" \
                --set OPENCODE_CONFIG_DIR ${ohMyOpencodeConfigDir}
            '';

            meta = {
              description = "OpenCode wrapper with oh-my-opencode profile";
              mainProgram = "oh-my-opencode";
              platforms = nixpkgs.lib.platforms.all;
            };
          };
        in
        {
          default = wrappedOpencode;
          opencode = wrappedOpencode;
          "oh-my-opencode" = wrappedOhMyOpencode;
        }
      );
    };
}
