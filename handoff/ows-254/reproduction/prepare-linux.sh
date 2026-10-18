#!/bin/sh
set -eu
rustc --version
cargo --version
node --version
python --version
uname -m
cargo fetch --locked --manifest-path ows/Cargo.toml
cargo fetch --locked --manifest-path bindings/node/Cargo.toml
cargo fetch --locked --manifest-path bindings/python/Cargo.toml
npm install --prefix bindings/node --ignore-scripts --omit=optional --no-audit --no-fund
