# ADE Core Repo Status

This repo points at the current ADE core source inside the Agent Desktop Environment workspace.

## Current State

- Tauri/Solid/Rust shell source is present under `apps/shell`.
- Protocol, shared, and design-system packages are present under `packages`.
- Phase 0 validation passed from the parent ADE workspace.

## Important Boundary Note

The parent ADE workspace currently implements a native Tauri shell. The ratified DexRoboKnix structure says ShadowOS is the desktop and ADE is the agent-operability layer on top of ShadowOS.

Before substantial ADE Phase 1/Phase 2 work, add an ADR deciding whether ADE remains L3 over ShadowOS or becomes the native shell direction.

## Next Work

1. Add boundary ADR.
2. Continue T045-T066 shell/control UI tasks.
3. Implement design-system components from `ADE Desktop v2.html`.
4. Build MCP server skeleton and permissioned tool registry in Phase 2.

