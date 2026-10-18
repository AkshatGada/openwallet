# Old Mac cleanup inventory

No deletion was performed as part of preparing this handoff. The code is pushed to `codex/spending-accounting-unavailable`; the handoff is separately pushed to `codex/ows-254-handoff`. Verify those remote branches before removing local copies.

As measured October 18, 2026:

| Task-owned item | Approximate size | Needed on new Mac? |
|---|---:|---|
| Original `openwallet` checkout | 4.8 MB | Clone from fork instead. |
| `/private/tmp/openwallet-compat` | 16 GB | No; evidence/helpers are copied into this handoff, dependencies and binaries rebuild. |
| `/private/tmp/openwallet-target` | 3.5 GB | No; first-pass build artifacts. |
| `/private/tmp/openwallet-cargo-home` | 801 MB | No; task-local dependencies/tool shims. |
| Remaining `/private/tmp/openwallet-254*`, baseline/test/clippy logs and test-surface text | Small | Necessary evidence/context is copied here. |
| Docker image `openwallet-compat-194:local` | Image metadata reported about 632 MB | No; rebuild from reproduction inputs if needed. |

The temporary directories account for roughly 20 GB. Removing the tiny checkout alone will barely help. Actual space reclaimed can differ because of shared layers, APFS accounting and caches.

The task image's recorded ID was `sha256:870cd699ba232935ba012b564e88a528a08609700f2be3a390e8c8d473b0b184`; no containers using it remained when inspected. Test containers used `--rm`. Docker also contains unrelated containers, images, volumes and shared build cache. Do **not** use a global Docker system/volume prune for this project. Inspect shared base images/build-cache ownership separately before removal; they may be used elsewhere.

No default `~/.ows` vault was present when checked. Do not delete unrelated wallet stores or credentials based on this handoff. A convenience Python symlink created during setup was already removed. Global Rust/Node/Python defaults and shell files were not changed; the project's extra runtimes lived under the temporary directories above.

No backup archive is needed or was created: Akshat requested GitHub-hosted source/context instead. The receiving agent can clone and verify the exact contribution commit, then rebuild. Chat history is not necessary for reconstruction; this folder supplies the task-relevant context.
