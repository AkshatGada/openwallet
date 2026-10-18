#!/bin/sh
set -eu
export CARGO_NET_OFFLINE=true
rustc --version > /logs/linux-versions.log
cargo --version >> /logs/linux-versions.log
node --version >> /logs/linux-versions.log
python --version >> /logs/linux-versions.log
uname -m >> /logs/linux-versions.log
cd /work/ows
cargo metadata --locked --offline --format-version 1 > /logs/linux-workspace-metadata.json
cargo test --workspace --locked --offline > /logs/linux-rust-tests.log 2>&1
cargo clippy --workspace --locked --offline -- -D warnings > /logs/linux-clippy.log 2>&1
cargo fmt --all -- --check > /logs/linux-fmt.log 2>&1
cd /work
./readme/generate.sh --check > /logs/linux-readme.log 2>&1
cd /work/bindings/node
cargo metadata --locked --offline --format-version 1 > /logs/linux-node-metadata.json
npm test > /logs/linux-node-tests.log 2>&1
OWS_BINDING_MODULE=/work/bindings/node/index.js node /checks/node-spending.mjs > /logs/linux-node-spending.log 2>&1
# Validate the Linux ARM64 release target used by the cross-compile CI job.
# This is a native ARM64 build, not a reproduction of its x86_64/zig host.
./node_modules/.bin/napi build --platform --release --target aarch64-unknown-linux-gnu > /logs/linux-node-release.log 2>&1
cd /work/bindings/python
cargo metadata --locked --offline --format-version 1 > /logs/linux-python-metadata.json
VIRTUAL_ENV=/opt/ows-venv maturin develop --features fast-kdf --locked --offline > /logs/linux-python-build.log 2>&1
python -m pytest -q > /logs/linux-python-tests.log 2>&1
python /checks/python-spending.py > /logs/linux-python-spending.log 2>&1
printf 'all Linux compatibility steps completed\n' > /logs/linux-complete.txt
