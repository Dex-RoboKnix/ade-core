/*
 * Agent Desktop Environment (ADE)
 * Copyright (C) 2026  DexRoboKnix
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

//! Generated Rust protocol types from the TypeScript Zod schemas.
//!
//! Do not edit by hand. Run `pnpm --filter @dexroboknix/protocol codegen:rust`.

/// Current protocol envelope version generated from TypeScript.
pub const PROTOCOL_VERSION: u16 = 1;

/// Typed command payload carried by IPC command envelopes.
#[derive(Clone, Debug, Eq, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(deny_unknown_fields)]
pub struct IpcCommandPayload {
    /// Dot-delimited IPC command name.
    pub command: String,
    /// Command-specific input payload.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

/// Typed success payload carried by IPC response envelopes.
#[derive(Clone, Debug, Eq, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(deny_unknown_fields)]
pub struct IpcResponsePayload {
    /// Dot-delimited IPC command name that produced this response.
    pub command: String,
    /// Command-specific output payload.
    pub result: serde_json::Value,
}

/// Typed event payload carried by IPC event envelopes.
#[derive(Clone, Debug, Eq, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(deny_unknown_fields)]
pub struct IpcEventPayload {
    /// Dot-delimited IPC event topic.
    pub topic: String,
    /// Event-specific payload.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// RFC 9457-style error payload carried by protocol envelopes.
#[derive(Clone, Debug, Eq, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(deny_unknown_fields)]
pub struct ProtocolProblemDetails {
    /// Stable ADE error code.
    pub code: String,
    /// Human-readable diagnostic detail.
    pub detail: String,
    /// Optional message, session, or resource instance identifier.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instance: Option<String>,
    /// HTTP status code aligned with the problem type.
    pub status: u16,
    /// Short, stable summary of the problem type.
    pub title: String,
    /// Canonical problem type URL.
    #[serde(rename = "type")]
    pub problem_type: String,
}

/// Versioned envelope shared by IPC, bridge, and MCP messages.
#[derive(Clone, Debug, Eq, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(deny_unknown_fields)]
pub struct ProtocolEnvelope {
    /// Unique message id within the sending context.
    pub id: String,
    /// Dot-delimited lowercase message kind.
    pub kind: String,
    /// Schema-specific success payload or Problem Details error payload.
    pub payload: serde_json::Value,
    /// Canonical ISO 8601 UTC timestamp.
    pub ts: String,
    /// Protocol envelope version.
    pub v: u16,
}
