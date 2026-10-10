---
provenance: AAC
---

# ADE Core for a person

ADE (Agent Desktop Environment) is the L3 component of ShadowOS that lets an external LLM drive a desktop. This repo is its AGPL-3.0 Core edition and is pre-1.0.

## Layout

- `apps/shell`: Tauri, SolidJS and Rust shell source.
- `packages/protocol`: protocol envelope and IPC types.
- `packages/shared`: shared utilities (errors, paths, storage, i18n).
- `packages/design-system`: design system.

## Build steps

See `START.md`. There is no root manifest yet, so build per package.

## Open question

`REPO-STATUS.md` notes a boundary ADR is still needed on how this code relates to ShadowOS. Not resolved here.
