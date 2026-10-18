## What

API-key signing currently supplies `spending.daily_total: "0"` to every executable policy even though OWS maintains no cumulative spending ledger. A policy can mistake this placeholder for measured zero and approve requests against an unenforced cumulative limit.

Emit `spending.daily_total: null` through `SpendingContext::unavailable(date)` instead. The Rust field becomes `Option<String>`, and the UTC date remains the signing-request date. Update the policy documentation and examples to describe the unavailable state and provide an explicit deny-on-unavailable guard. Add coverage for serialized null, missing/legacy fields, repeated signing, all signing operations, and denial before decryption and broadcast.

Partially addresses #254. This does not implement cumulative accounting or count signatures as settled spend. It does not add the recipient or per-transaction value rules being discussed in #225/#169.

## Compatibility and limitations

This is a breaking Rust and executable-JSON contract change. Rust consumers constructing or reading `SpendingContext.daily_total` must handle `Option<String>`. Old executable schemas requiring a string reject null; old input strings still deserialize for custom tooling, without gaining verified accounting semantics.

Existing policies require an audit. `Number(null)`, `value || "0"`, and equivalent default-zero fallbacks can still allow. The engine cannot infer whether an arbitrary executable needs a cumulative ledger. The documented guard denies unavailable accounting; it is not a complete cumulative-limit implementation.

A future ledger still needs per-chain/per-asset units, accounting scope, freshness and time windows, atomic reservations across signers, persistence/restart recovery, and submission/settlement reconciliation. This change adds no counters, locks, reservations, or accounting persistence. Please confirm release and migration treatment for the public type/JSON change before merging.

## Testing

Local macOS ARM64, exact Rust 1.94.0:

- `cargo test --workspace --locked --offline`: 724 passed, 0 failed; four live-network tests and two doctests remained ignored.
- `cargo clippy --workspace --locked --offline -- -D warnings`, formatting, locked Cargo metadata, and generated-README checks passed.
- Node 22.23.3: `npm test` rebuilt the NAPI addon with `fast-kdf`; 22 tests passed.
- Python 3.12.12: `maturin develop --features fast-kdf --locked --offline` and `python -m pytest -q`; 17 tests passed.
- Supplemental native-binding checks validated null and denials across all four signing operations. Each language also exercised eight allowed offline signatures and eight denials in fresh processes, with four concurrent processes per batch, confirming only the unavailable-state behavior.
- Consumer checks confirmed that the new Rust type accepts null, legacy string schemas reject null, and old source assigning `String` fails to compile against the new field type.
- In the earlier Rust 1.94.1 run, the new regression failed against the original production constructor with `String("0")` instead of `Null`; that baseline had 719 passing Rust tests. The complete changed suite was then checked on exact Rust 1.94.0 as reported above.

Local Linux ARM64 container with networking disabled, exact Rust 1.94.0, Node 22.23.3, Python 3.12.15:

- Rust workspace: 724 passed, 0 failed; the same six tests/doctests ignored. Clippy, formatting, locked Cargo metadata, and generated-README checks passed.
- NAPI addon rebuilt with `fast-kdf`; all 22 Node tests passed. The native ARM64 release build also passed.
- PyO3 extension rebuilt with `fast-kdf`; all 17 Python tests passed.
- Both native-binding availability/concurrency probes passed with four concurrent fresh processes per batch.

The Linux ARM64 cross-build also passed from macOS with Rust 1.94.0, cargo-zigbuild 0.23.4 and Zig 0.13.0 using `napi build --platform --release --target aarch64-unknown-linux-gnu --zig --zig-abi-suffix 2.17`. The resulting ELF addon has a maximum `GLIBC_2.17` symbol requirement, loads in Linux Node 22, and passes the availability/concurrency probe. These are local checks; the GitHub Actions Ubuntu x86_64 host itself has not run this diff. No upstream CI, maintainer approval, independent compilation by the reviewer, live settlement, or fund-loss reproduction is claimed.

The source diff received an independent read-only review with no actionable correctness/security findings. The reviewer separately checked the migration guard and coercion cases; compilation and binding checks above were run by the implementing agent.

Dependency setup used isolated source snapshots and caches. The committed Node lockfile has pre-existing incomplete optional-package entries that reject `npm ci`; binding validation used `npm install`, as the repository CI does, without modifying this contribution's lockfiles. One supplemental Node policy invocation timed out on its first run and denied; an unchanged rerun passed. No cause was established, and the policy timeout was not changed.

No live payments or funded-wallet operations were performed.
