# OWS #254 continuation handoff

This folder is a **fork-only handoff**, prepared at Akshat's request for a new macOS machine. It is on `codex/ows-254-handoff`. Do not include its commit in the eventual upstream contribution PR.

## Start here

- Fork: <https://github.com/AkshatGada/openwallet>
- Upstream: <https://github.com/open-wallet-standard/core>
- Contribution branch: `codex/spending-accounting-unavailable`
- Committed and pushed code: **`1e02d8d92506ade715af4952f91f4889bc543286`**
- Base/upstream main last checked on October 18, 2026: `ade81d535731ad30986969a8eba8dd8ebf8609bd`.
- Reviewed source diff SHA-256: `cbf24fa81f474161ee403f503c2fe60a79454e625069c5f05457fa894d4f895b`.
- The contribution is implemented and independently reviewed. Full local compatibility gates passed. A PR title/body is drafted. **No upstream PR exists.**
- Current authorization covers commits/pushes to Akshat's fork and this handoff. It does not authorize an upstream PR, CLA acceptance, outreach, live payments, or production changes. Do not edit the coordinator's Excel or work in unrelated project sessions.

The previous Mac's working tree was clean after the contribution push. All code was on GitHub. The original temporary build outputs are unnecessary for continuation; download dependencies and rebuild on the new Mac. No production wallet or credential is needed, and no default `~/.ows` vault existed on the old Mac when checked. All validation used synthetic fixtures, temporary vaults, and local mocks.

## Read these files

1. This README: purpose, current state, scope and decisions.
2. [STATUS.json](STATUS.json): exact branches, commits, overlap snapshot and authorization boundary.
3. [PR_BODY.md](PR_BODY.md) and [PR_TITLE.txt](PR_TITLE.txt): ready-to-review upstream PR draft, including breaking migration and limitations.
4. [INDEPENDENT_REVIEW.txt](INDEPENDENT_REVIEW.txt): reviewer findings, independently executed checks, and limits of that review.
5. [REPRODUCE.md](REPRODUCE.md): macOS setup and commands, Linux and cross-build reproduction.
6. [results.json](results.json), [evidence/](evidence/), and [HISTORICAL_FULL_REPORT.txt](HISTORICAL_FULL_REPORT.txt): recorded results and detailed provenance.
7. [OLD_MACHINE_CLEANUP.md](OLD_MACHINE_CLEANUP.md): task-owned disk inventory and cleanup boundaries.

Historical reports/logs are evidence from October 18, not proof about the new machine or current upstream. Personal checkout/cache paths in copied logs were replaced with `<original-...>` markers, and trailing blank lines were normalized. A few reports retain references to old temporary files; the corresponding evidence is now in this folder. Do not try to access the original machine's paths. Do not report historical tests as newly run.

## Working branches on the new Mac

Clone the **contribution** branch for actual code work. The handoff is deliberately separate:

```sh
git clone --branch codex/spending-accounting-unavailable https://github.com/AkshatGada/openwallet.git
cd openwallet
git rev-parse HEAD
# Expected: 1e02d8d92506ade715af4952f91f4889bc543286
git status --short --branch
git show origin/codex/ows-254-handoff:handoff/ows-254/README.md
```

To read all evidence and run the helpers without adding handoff files to the contribution branch:

```sh
git worktree add --detach ../openwallet-context origin/codex/ows-254-handoff
```

The context checkout includes the exact contribution code plus handoff files. The main checkout stays on the clean contribution branch. Future upstream PRs must use the contribution branch, not the handoff branch. Do not cherry-pick the handoff commit into the contribution.

## Original objective and verified issue

The goal was a useful, focused contribution around [issue #254](https://github.com/open-wallet-standard/core/issues/254), rather than inventing a broad ledger. Eric Chennells reported the field problem. [Conny Brunnkvist's October 8 comment](https://github.com/open-wallet-standard/core/issues/254#issuecomment-6059578452) corroborates it and self-identifies as a Nano crate/xno-skills maintainer.

Historical research pointed to `key_ops.rs` at an earlier commit. We independently verified the actual current source at `ade81d5`: its only production spending constructor supplied `daily_total: "0"` before every API-token signing policy. No cumulative spending ledger or settlement reconciliation existed. Nonzero examples in documentation were test fixtures. The red regression independently captured the placeholder in offline signing; it did not demonstrate settlement or lost funds.

## Architecture and contribution rules

- `ows-core`: types, CAIP/configuration and shared policy schema.
- `ows-signer`: chain-specific context/crypto/signing.
- `ows-lib`: vault, API keys, policy storage/evaluation, operations and broadcast.
- `ows-pay`: payment/funding protocols; `ows-cli`: CLI.
- Node NAPI and Python PyO3 bindings embed the Rust library. JS adapters are separate.
- Owner-passphrase operations bypass policies by design. API-token operations load authorization and policies, build `PolicyContext`, evaluate AND semantics, then decrypt and sign. `sign_and_send` shares the gate and broadcasts afterward.
- Built-in policies do not implement cumulative limits. Custom executables receive JSON on stdin; nonzero exits, invalid results and timeouts deny.
- Transaction effects are request context, not settled history. At the checked main, Cardano populated per-asset effects; other signers could leave them empty.
- MIT licenses were inspected. `CONTRIBUTING.md` requires focused branches, tests/clippy/formatting and public API docs. No applicable `AGENTS.md` was found then; inspect again before further work. No CLA/DCO requirement was found in inspected files, and no agreement was accepted.
- `CODEOWNERS` names `@njdawn`; the public profile identifies Neeraj Prasad. `@0xultravioleta` was verified as a public collaborator from reviews and merged release work. No X/Telegram identities were inferred; nobody was contacted.
- Respect `SECURITY.md`: do not publish new security findings outside its disclosure process. This task added no report, PR or outreach upstream.

## Overlap verdict

As last checked October 18:

| Work | State and scope |
|---|---|
| [#254](https://github.com/open-wallet-standard/core/issues/254) | Open, one corroborating comment; cumulative accounting remains unresolved. |
| [#225](https://github.com/open-wallet-standard/core/pull/225) | Open/unmerged, head `e2431350063c08a3cc2b4cc2d65efd7ffcdd62ec`; recipient allowlist, validation and shared RLP extraction. |
| [#169](https://github.com/open-wallet-standard/core/pull/169) | Open/unmerged, head `0596edb8a7e2f23206636e60dcbd6f782c8770ed`; recipients, per-transaction value cap and operation gating. |

Those discussions converge on #225 as the recipient base and #169's amount/operation pieces as a follow-up. They explicitly distinguish cumulative #254. They overlap in files but do not implement this accounting-availability mitigation. An open-PR/search/timeline scan found no direct competing implementation; unpublished work is unknown. #250 concerned Midnight transaction effects, not a settled cumulative ledger. **Recheck upstream and overlap before extending or preparing publication.**

## Implemented design and exact scope

The code commit changes six files: three Rust sources and three source docs. It replaces the fabricated production zero with `SpendingContext::unavailable(date)`, serializing `daily_total` as explicit JSON `null`. The Rust field becomes `Option<String>`. Missing totals deserialize as unavailable. Legacy strings still roundtrip without numeric coercion, with no claim of trustworthiness. The date remains the signing request's UTC date, not an accounting/freshness window.

The docs explain unavailable accounting, migration, units and settlement boundaries, and provide an explicit deny-on-unavailable Python guard. Five new tests cover null, missing/legacy data, large-string fidelity/numeric rejection, repeated signing and all four signing operations, and denial before key decryption/broadcast.

This intentionally does **not** add counters, reservations, locking, accounting persistence, an external provider, asset conversion, RPC calls, or settled-spend inference. No package versions, dependencies, lockfiles, binding source, or generated outputs changed. The source diff remained byte-identical through review and compatibility checks. Reconstruct it from Git with `git diff --binary ade81d535731ad30986969a8eba8dd8ebf8609bd 1e02d8d92506ade715af4952f91f4889bc543286`; its SHA-256 must match the reviewed source hash above. No separate patch backup is necessary.

## Compatibility and security limits to preserve

- This is a breaking Rust/JSON contract change. Old Rust code assigning `String` fails compilation; old executable schemas requiring a string reject null. Release/migration treatment needs maintainer agreement before upstream merge/publication. No version bump was made.
- `Number(null)`, `null || "0"`, Python `value or "0"`, and similar default-zero patterns can still allow. The engine cannot infer ledger requirements inside arbitrary executable code. Audit policies; never claim all cumulative policies automatically fail closed.
- The documented Python snippet is only an availability guard. Nonnull legacy or malformed values do not become verified accounting.
- A signature authorizes an operation; it is not proof of submission or settlement. Even a returned transaction hash is not finality. Never count signatures as settled spend.
- Future accounting needs explicit per-chain/per-asset smallest units, wallet/key scope, time windows, freshness, atomic reservations across concurrent signers, durable restart recovery, failure/replacement/reorg reconciliation, and privacy boundaries. None is implemented or tested as a ledger here.
- The supplemental concurrency probes used two batches of four processes: eight total allowed signatures and eight total denials per language/platform. They establish consistent unavailable context across fresh callers, not atomic cumulative-budget enforcement.
- Do not mark #254 fully fixed or use `Closes #254`; the draft says **partially addresses** it.

## Recorded validation and independent review

| Gate | macOS ARM64 | Linux ARM64 |
|---|---|---|
| Rust | exact 1.94.0 | exact 1.94.0 |
| Rust tests | 724 passed / 0 failed | 724 passed / 0 failed |
| Ignored | 4 live tests + 2 doctests | same 6 |
| Node | 22.23.3; 22 tests passed | 22.23.3; 22 tests passed |
| Python | 3.12.12; 17 tests passed | 3.12.15; 17 tests passed |
| Clippy, fmt, locked metadata, generated READMEs | passed | passed |

A native Linux ARM64 release build passed. A macOS-to-Linux ARM64 cross-build passed with cargo-zigbuild 0.23.4, Zig 0.13.0, and the CI `--zig-abi-suffix 2.17` flags. Its ELF addon had maximum `GLIBC_2.17`, loaded in Linux Node 22, and passed the availability/concurrency probe. **Actual GitHub Actions Ubuntu x86_64 CI did not run this diff.**

The earlier Rust 1.94.1 baseline passed 719 tests. The new regression failed against its original production constructor with `String("0")` where `Null` was expected. Those failures are expected evidence; the changed exact-1.94.0 suites passed afterward.

Fresh independent reviewer `/root/ows_independent_review` directly read the actual source/diff/tests/docs and independently checked the guard/coercions and whitespace. It found no actionable source correctness/security defect. It did not independently compile Rust or bindings; the implementing agent ran those gates. Its follow-up review corrected the PR's concurrency wording. This is not code-owner/maintainer approval.

Known setup/transient results are recorded transparently:

- An initial offline attempt lacked cached dependencies; they were then fetched before offline tests.
- Sandboxed mock servers could not bind loopback; authorized loopback-capable runs passed.
- `npm ci` rejects existing incomplete optional-package entries in the committed Node lockfile. CI uses `npm install`; we did that in temporary snapshots. Original repository lockfiles remained unchanged.
- One supplemental macOS Node executable policy timed out after five seconds and denied. An unchanged retry passed; no cause was established. No timeout or unrelated source behavior was changed.
- Dependency/container downloads had setup delays. Final Linux tests ran with networking disabled; live-network tests stayed ignored.

## Next agent's job

1. Verify the remote branch/commit and read all handoff references before changing code.
2. Recheck current upstream main, #254 and overlapping PRs. Historical state is not current proof.
3. Recreate the macOS toolchain and validation when needed, using isolated caches/snapshots and synthetic fixtures. Use the helpers and commands in REPRODUCE.md; record what actually runs on this Mac.
4. Preserve the small unavailable-state design and the reviewed contribution branch. Do not implement a ledger, expand into other projects, or silently relax accounting semantics.
5. Keep the draft accurate as new checks or findings arrive. Publication to upstream remains a separate authorization step. Do not accept a CLA or contact maintainers by inference.
6. When later explicitly authorized to open a PR, use only the contribution branch's code commit(s), exclude this handoff branch, and retain the breaking-change and partial-remediation disclosures.

The original machine's caches, toolchain copies, native binaries, Docker state and chat history are not required. The code, necessary context, review, test evidence and recreation inputs are all represented on the fork.
