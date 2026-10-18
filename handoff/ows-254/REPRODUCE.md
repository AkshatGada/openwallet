# Recreate the validation on the new Mac

The source already contains the implementation. Rebuild dependencies/binaries and rerun checks; do not rewrite the fix from the historical description. Start on the contribution branch at `1e02d8d92506ade715af4952f91f4889bc543286`, with a separate context worktree as described in README.md.

The portable commands below encode the procedure used previously. They have been inspected for portability/syntax; the historical logs record the actual completed old-machine runs. Do not describe a new-machine run as passed until it actually finishes. These commands build in a disposable source snapshot so generated binding files and npm lock metadata do not dirty the contribution checkout.

## Prerequisites

- Xcode Command Line Tools, Git, and Rustup on macOS. Check existing tools before installing anything.
- Exact Rust **1.94.0**, with rustfmt and clippy. The repository's `rust-toolchain.toml` pins it. Use Rustup shims rather than a different Homebrew Rust.
- Node **22**; the old run used **22.23.3**.
- Python **3.12**; the old Mac used **3.12.12**.
- Python test tools were maturin **1.15.0** and pytest **9.1.1**.
- Optional cross-build: cargo-zigbuild **0.23.4**, Zig **0.13.0**, Linux ARM64 Rust target.
- Optional Linux reproduction: Docker Desktop. No existing containers/volumes need modification.

Use existing compatible tools or install isolated task-local runtimes. Do not overwrite global defaults, shell profiles, credentials or wallet stores. A GitHub login is unnecessary for public cloning/testing; authenticate afresh when a later authorized push requires it. No old-machine credentials, API keys, vaults, `.env`, private keys or npm tokens are required.

These fresh builds can use roughly 20 GB including multiple platforms/profiles and dependency caches. The old machine's cache is disposable and is deliberately not committed.

## 1. Set paths and make an isolated source snapshot

Run from the contribution checkout; adjust the context path if needed. All paths below are on the **new** Mac:

```sh
export OWS_REPO="$PWD"
export OWS_HANDOFF="$(cd ../openwallet-context/handoff/ows-254 && pwd)"
export OWS_RUN="$(mktemp -d -t ows254-recreate)"

git status --short --branch
git rev-parse HEAD
# Expected code commit: 1e02d8d92506ade715af4952f91f4889bc543286

python3.12 - <<'PY'
from pathlib import Path
import os, shutil, subprocess
repo = Path(os.environ['OWS_REPO'])
dest = Path(os.environ['OWS_RUN']) / 'source'
for name in subprocess.check_output(['git', 'ls-files', '-z'], cwd=repo).decode().split('\0'):
    if not name:
        continue
    target = dest / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(repo / name, target)
PY

mkdir -p "$OWS_RUN/logs"
export CARGO_HOME="$OWS_RUN/cargo-home"
export RUSTUP_HOME="$OWS_RUN/rustup"
export RUSTUP_TOOLCHAIN=1.94.0
export CARGO_TARGET_DIR="$OWS_RUN/target"
rustup toolchain install 1.94.0 --profile minimal --component rustfmt --component clippy
rustc --version
cargo --version
node --version
python3.12 --version
# Verify Rust 1.94.0 and Node 22 before continuing.
```

Keep the already-installed Rustup executable/shims on PATH while using task-local CARGO_HOME/RUSTUP_HOME. If Rustup itself is absent, install it in task-local directories with `--no-modify-path`, as the official Rustup instructions support. Do not silently fall back to Rust 1.94.1/another version.

## 2. Fetch dependencies once, then make Rust builds offline

```sh
cargo fetch --locked --manifest-path "$OWS_RUN/source/ows/Cargo.toml"
cargo fetch --locked --manifest-path "$OWS_RUN/source/bindings/node/Cargo.toml"
cargo fetch --locked --manifest-path "$OWS_RUN/source/bindings/python/Cargo.toml"

npm install --prefix "$OWS_RUN/source/bindings/node" \
  --ignore-scripts --omit=optional --no-audit --no-fund \
  --cache "$OWS_RUN/npm-cache"

python3.12 -m venv "$OWS_RUN/venv"
"$OWS_RUN/venv/bin/python" -m pip install --cache-dir "$OWS_RUN/pip-cache" \
  maturin==1.15.0 pytest==9.1.1
export VIRTUAL_ENV="$OWS_RUN/venv"
export PATH="$VIRTUAL_ENV/bin:$PATH"
export CARGO_NET_OFFLINE=true
```

`npm ci` failed on the original incomplete optional-package lockfile. `npm install` matches repository CI and may fill metadata in the **snapshot** only. Keep original checkout lockfiles unchanged. No package installation needs publication scripts or credentials.

## 3. Rust and generated-document gates

```sh
cd "$OWS_RUN/source/ows"
cargo metadata --locked --offline --format-version 1 > "$OWS_RUN/logs/workspace-metadata.json"
cargo test --workspace --locked --offline > "$OWS_RUN/logs/rust-tests.log" 2>&1
cargo clippy --workspace --locked --offline -- -D warnings > "$OWS_RUN/logs/clippy.log" 2>&1
cargo fmt --all -- --check > "$OWS_RUN/logs/fmt.log" 2>&1
cd "$OWS_RUN/source"
./readme/generate.sh --check > "$OWS_RUN/logs/readme.log" 2>&1
```

At the exact recorded code commit: 724 passing tests, zero failures; four live-network tests and two doctests ignored. Do not enable ignored live tests. Some tests bind loopback mock servers; a restrictive execution sandbox may need an authorized loopback-capable run. That does not authorize remote RPC/payment traffic.

## 4. Node native bindings and supplemental checks

```sh
cd "$OWS_RUN/source/bindings/node"
cargo metadata --locked --offline --format-version 1 > "$OWS_RUN/logs/node-metadata.json"
npm test > "$OWS_RUN/logs/node-tests.log" 2>&1
OWS_BINDING_MODULE="$OWS_RUN/source/bindings/node/index.js" \
  node "$OWS_HANDOFF/checks/node-spending.mjs" > "$OWS_RUN/logs/node-spending.log" 2>&1
```

Expected recorded suite: 22 tests. `npm test` rebuilds the NAPI addon with `fast-kdf`. The supplemental check creates only a temporary synthetic wallet, validates explicit null/date, denies all four signing operations, and uses two batches of four fresh processes for each allow/deny case. It verifies coercion pitfalls. It does not test ledger atomicity or settlement.

One original first invocation timed out at the policy engine's five-second deadline and denied; an unchanged retry passed. Preserve/report any fresh failure rather than assuming it is the same transient or changing the timeout by inference.

## 5. Python native bindings and supplemental checks

```sh
cd "$OWS_RUN/source/bindings/python"
cargo metadata --locked --offline --format-version 1 > "$OWS_RUN/logs/python-metadata.json"
maturin develop --features fast-kdf --locked --offline > "$OWS_RUN/logs/python-build.log" 2>&1
python -m pytest -q > "$OWS_RUN/logs/python-tests.log" 2>&1
python "$OWS_HANDOFF/checks/python-spending.py" > "$OWS_RUN/logs/python-spending.log" 2>&1
```

Expected recorded suite: 17 tests. The supplemental Python check covers the same availability and four-concurrent-process batches as the Node check.

## 6. Rust consumer compatibility

The included consumer project is intentionally separate from the production workspace. Copy it under the disposable run and point it at the tested source snapshot:

```sh
cp -R "$OWS_HANDOFF/checks/rust-consumer" "$OWS_RUN/rust-consumer"
python - <<'PY'
from pathlib import Path
import json, os
run = Path(os.environ['OWS_RUN'])
manifest = run / 'rust-consumer/Cargo.toml'
text = manifest.read_text()
text = text.replace('"../../../../ows/crates/ows-core"', json.dumps(str(run / 'source/ows/crates/ows-core')))
manifest.write_text(text)
PY
cd "$OWS_RUN/rust-consumer"
cargo run --bin contract --locked --offline > "$OWS_RUN/logs/rust-consumer.log" 2>&1
cargo check --bin legacy-source --locked --offline > "$OWS_RUN/logs/legacy-source.log" 2>&1
# EXPECTED FAILURE for legacy-source: E0308, expected Option<String>, found String.
```

The `contract` binary must pass. The negative compile check must fail for the documented type mismatch, not because dependencies/tools are missing. An old String-only JSON schema rejects null. Legacy strings still deserialize for custom tooling; neither makes the value trusted accounting.

## 7. Linux ARM64/glibc-2.17 cross-build

Prepare this tooling **before** offline validation, or temporarily allow dependency downloads only for this setup step. Pip accesses the package registry even when CARGO_NET_OFFLINE is true:

```sh
python -m pip install --cache-dir "$OWS_RUN/pip-cache" cargo-zigbuild==0.23.4 ziglang==0.13.0
rustup target add aarch64-unknown-linux-gnu --toolchain 1.94.0
mkdir -p "$OWS_RUN/cross-bin"
python - <<'PY'
from pathlib import Path
import os, ziglang
run = Path(os.environ['OWS_RUN'])
zig = Path(ziglang.__file__).parent / 'zig'
link = run / 'cross-bin/zig'
if not link.exists(): link.symlink_to(zig)
wrapper = run / 'cross-bin/cc-aarch64.sh'
wrapper.write_text('#!/bin/sh\nexec "' + str(link) + '" cc "$@" -target aarch64-linux-gnu.2.17\n')
wrapper.chmod(0o700)
PY
export PATH="$OWS_RUN/cross-bin:$PATH"
export CARGO_ZIGBUILD_ZIG_PATH="$OWS_RUN/cross-bin/zig"
export CARGO_ZIGBUILD_CACHE_DIR="$OWS_RUN/zigbuild-cache"
export ZIG_GLOBAL_CACHE_DIR="$OWS_RUN/zig-global-cache"
export ZIG_LOCAL_CACHE_DIR="$OWS_RUN/zig-local-cache"
export CC_aarch64_unknown_linux_gnu="$OWS_RUN/cross-bin/cc-aarch64.sh"

cd "$OWS_RUN/source/bindings/node"
./node_modules/.bin/napi build --platform --release \
  --target aarch64-unknown-linux-gnu --zig --zig-abi-suffix 2.17 \
  > "$OWS_RUN/logs/node-cross-build.log" 2>&1
file ows-node.linux-arm64-gnu.node
```

The old artifact was an ELF ARM64 shared object with SHA-256 `ed309a9049daaedc3020c6e37315366b83886539b99ef846875ecb5a5df11df7`. Fresh binary hashes need not match across machines/tool paths. Inspect symbol versions in Linux; the old maximum was GLIBC_2.17. Loading on a newer glibc alone does not prove the minimum requirement.

`cargo zigbuild --version` is not supported by the tool's subcommand parser; report the installed package version with `python -c 'import importlib.metadata; print(importlib.metadata.version("cargo-zigbuild"))'` instead.

## 8. Recreate the Linux checks if needed

The exact test script used is [reproduction/test-linux.sh](reproduction/test-linux.sh). Its container paths are deliberate and portable: `/work` source snapshot, `/cache` Cargo cache, `/target` artifacts, `/checks` helpers, `/logs` writable results. It needs a writable venv at `/opt/ows-venv`. Test containers run with `--network none`; their loopback mocks still work.

The [Dockerfile](reproduction/Dockerfile) combines official Rust 1.94.0, Node 22 and Python 3.12 Bookworm images. Its Node/Python tags are mutable: record the actual new versions rather than claiming they equal the old Node 22.23.3/Python 3.12.15. Old image ID in the report is local provenance, not a remotely pullable custom image.

Prepare Linux ARM64 wheels on the host to avoid the original container download stall:

```sh
mkdir -p "$OWS_RUN/linux-image/linux-wheels"
python -m pip download --cache-dir "$OWS_RUN/pip-cache" --only-binary=:all: \
  --platform manylinux_2_17_aarch64 --python-version 312 --implementation cp --abi cp312 \
  --dest "$OWS_RUN/linux-image/linux-wheels" maturin==1.15.0 pytest==9.1.1
docker build --platform linux/arm64 -t ows254-recreate:local \
  -f "$OWS_HANDOFF/reproduction/Dockerfile" "$OWS_RUN/linux-image"
```

On an Intel Mac, ARM64 Docker runs may require emulation and be slower. Do not claim an ARM run from an x86 build without checking `uname -m` in the container.

Make a fresh Linux source snapshot (same tracked-file copy as step 1) at `$OWS_RUN/linux-source`; do not reuse a source folder containing macOS `.so` or native addons. Copy the host's fetched Cargo registry into a separate `$OWS_RUN/linux-cargo/registry`, and the installed pure-JS Node `node_modules` into the Linux snapshot's Node folder. Do not share mutable build/cache directories between concurrent host/container builds. The recorded run used the same NAPI CLI 2.18.4 package on both platforms.

```sh
mkdir -p "$OWS_RUN/linux-target" "$OWS_RUN/linux-logs"
cp "$OWS_HANDOFF/reproduction/test-linux.sh" "$OWS_RUN/linux-logs/test-linux.sh"
docker run --rm --platform linux/arm64 --network none \
  --mount "type=bind,source=$OWS_RUN/linux-source,target=/work" \
  --mount "type=bind,source=$OWS_RUN/linux-cargo,target=/cache" \
  --mount "type=bind,source=$OWS_RUN/linux-target,target=/target" \
  --mount "type=bind,source=$OWS_HANDOFF/checks,target=/checks,readonly" \
  --mount "type=bind,source=$OWS_RUN/linux-logs,target=/logs" \
  -e CARGO_HOME=/cache -e CARGO_TARGET_DIR=/target -e CARGO_BUILD_JOBS=4 \
  ows254-recreate:local sh /logs/test-linux.sh
```

If offline Cargo reports a missing platform dependency, fetch that locked dependency before the test run, then restore network isolation. Do not turn ignored live-payment tests on. Expected historical counts: Rust 724, Node 22, Python 17; six Rust tests/doctests ignored.

To inspect/load the macOS-cross-built addon, mount `$OWS_RUN/source/bindings/node` read-only as `/addon` in the same Linux image, mount the checks as `/checks`, set `OWS_BINDING_MODULE=/addon/index.js`, and run:

```sh
readelf --version-info /addon/ows-node.linux-arm64-gnu.node > /tmp/versions.txt
grep -o 'GLIBC_[0-9.]*' /tmp/versions.txt | sort -Vu | tail -1
node /checks/node-spending.mjs
```

Do not equate these local Linux ARM64/cross-target gates with an actual GitHub Actions Ubuntu x86_64 run. No upstream CI was triggered for the original contribution.

## Finish

Record actual versions, commands, failures and results. Compare the contribution checkout with `git status`, check lockfiles remain unchanged, and retain only useful evidence outside the upstream code commit. Never count signatures as settled spend. No payments, funded wallets, production changes or outreach are needed for any of these checks.
