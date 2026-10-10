# ADE Core

**Layer L3.** Parent: **ShadowOS** (L2). Pre-1.0 / prototype.

`ade-core` is the AGPL-3.0 Core edition of ADE (Agent Desktop Environment): the harness layer that lets an external LLM drive a ShadowOS desktop. Not used by dex.md directly.

It is the OpenCore boundary: Core must be fully usable without Enterprise and must never import or reference `ade-enterprise`. Licence: AGPL-3.0 Core; no Enterprise edition exists yet. Source today: Tauri/SolidJS/Rust shell under `apps/shell`, plus `packages/protocol`, `packages/shared`, `packages/design-system`.

## Which document do I read?

| You are... | Read |
|---|---|
| An LLM agent | [START.md](START.md), then [CLAUDE.md](CLAUDE.md) |
| A person wanting steps | [docs/README.md](docs/README.md) |
| Checking current state | [REPO-STATUS.md](REPO-STATUS.md) |
| Releasing | [RELEASING.md](RELEASING.md) |
| Checking the licence | [LICENSE](LICENSE) |
