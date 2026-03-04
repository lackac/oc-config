{
  description = "Opinionated OpenCode wrappers and profiles";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    opencode.url = "github:anomalyco/opencode/dev";
  };

  outputs =
    {
      nixpkgs,
      opencode,
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
          upstreamOpencode = opencode.packages.${system}.opencode;

          configDir = pkgs.runCommand "opencode-config-core" { } ''
            mkdir -p "$out"
            cp -R ${./config/core}/. "$out/"
          '';

          wrappedOpencode = pkgs.stdenvNoCC.mkDerivation {
            pname = "opencode-profile-custom";
            version = "unstable";
            dontUnpack = true;
            nativeBuildInputs = [ pkgs.makeBinaryWrapper ];

            installPhase = ''
              mkdir -p "$out/bin"

              makeWrapper ${upstreamOpencode}/bin/opencode "$out/bin/opencode" \
                --set OPENCODE_CONFIG_DIR ${configDir}

              makeWrapper ${upstreamOpencode}/bin/opencode "$out/bin/oc" \
                --set OPENCODE_CONFIG_DIR ${configDir}
            '';

            meta = {
              description = "OpenCode wrapper with managed profile";
              mainProgram = "opencode";
              platforms = nixpkgs.lib.platforms.all;
            };
          };
        in
        {
          default = wrappedOpencode;
          opencode = wrappedOpencode;
        }
      );
    };
}
