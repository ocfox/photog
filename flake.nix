{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
    wrangler.url = "github:ryand56/wrangler";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      wrangler,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        nix-settings = {
          substitutions = [ "https://wrangler.cachix.org" ];
          trusted-public-keys = [ "wrangler.cachix.org-1:N/FIcG2qBQcolSpklb2IMDbsfjZKWg+ctxx0mSMXdSs=" ];
        };
        devShell = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs
            wrangler.packages.${system}.default
          ];
        };
      }
    );
}
