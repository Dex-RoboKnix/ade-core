---
provenance: AAC
---

# START (for an LLM)

Layer L3, component of ShadowOS. Pre-1.0. Read `CLAUDE.md`, then `REPO-STATUS.md`. Terms follow the DexRoboKnix `CONTEXT.md` glossary (Dex-RoboKnix/dexroboknix).

This repo is a published slice. The active product workspace has its own `AGENTS.md` onboarding protocol; follow it if you work in that workspace, not here.

## Build and test

No root manifest exists here, so there is no single command. Per package (needs a workspace install in a parent that provides pnpm and vitest):

- `packages/shared`: `pnpm build`, `pnpm test` (`tsc -b`, `vitest run`).
- `packages/protocol`, `apps/shell`: see each `package.json`.
- Rust (`apps/shell/src-tauri`): `cargo test`, `cargo clippy -- -D warnings`. Heavy; skip unless asked.

## Boundary check

`grep -rIl "ade-enterprise" . --exclude-dir=.git` must list only documentation. Core never imports Enterprise.

## Scan before push

Search the diff for personal emails, keys and tokens. Never read `.env` contents. Commit as the GitHub no-reply address.
