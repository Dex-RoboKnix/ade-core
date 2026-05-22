# ADE Core

`ade-core` is the AGPL community-edition boundary for ADE. It will contain the
native Tauri shell, shared packages, design system, filesystem bridge, window
manager, agent runtime, and MCP server.

Core must remain fully usable without enterprise modules. It must not import or
reference `ade-enterprise`.
