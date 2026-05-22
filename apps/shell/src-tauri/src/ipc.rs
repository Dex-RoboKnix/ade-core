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

//! Tauri IPC command bridge over ADE protocol envelopes.

use crate::{
    diagnostics,
    generated::protocol::{
        IpcCommandPayload, IpcResponsePayload, ProtocolEnvelope, ProtocolProblemDetails,
        PROTOCOL_VERSION,
    },
};

const IPC_COMMAND_KIND: &str = "ipc.command";
const IPC_RESPONSE_KIND: &str = "ipc.response";
const IPC_ERROR_KIND: &str = "ipc.error";
const IPC_ECHO_COMMAND: &str = "ipc.echo";
const DIAGNOSTICS_EXPORT_COMMAND: &str = "diagnostics.export";

/// Tauri command entrypoint for typed ADE IPC envelopes.
#[tauri::command]
pub fn ade_ipc_command(envelope: ProtocolEnvelope) -> ProtocolEnvelope {
    handle_ipc_command(envelope)
}

fn handle_ipc_command(envelope: ProtocolEnvelope) -> ProtocolEnvelope {
    let ProtocolEnvelope { id, kind, payload, ts, v } = envelope;

    if v != PROTOCOL_VERSION {
        return problem_response(
            id,
            ts,
            problem_details(
                "E_PROTOCOL_VERSION_UNSUPPORTED",
                format!("Client requested protocol version {v}."),
                "Protocol version unsupported",
                426,
                "protocol-version-unsupported",
            ),
        );
    }

    if kind != IPC_COMMAND_KIND {
        return problem_response(
            id,
            ts,
            problem_details(
                "E_PROTOCOL_KIND_UNSUPPORTED",
                format!("Expected {IPC_COMMAND_KIND} envelope but received {kind}."),
                "Protocol kind unsupported",
                400,
                "protocol-kind-unsupported",
            ),
        );
    }

    let command_payload = match serde_json::from_value::<IpcCommandPayload>(payload) {
        Ok(command_payload) => command_payload,
        Err(error) => {
            return problem_response(
                id,
                ts,
                problem_details(
                    "E_PROTOCOL_PAYLOAD_INVALID",
                    format!("IPC command payload did not match the protocol schema: {error}."),
                    "Protocol payload invalid",
                    400,
                    "protocol-payload-invalid",
                ),
            );
        }
    };

    let command = command_payload.command;

    if command == IPC_ECHO_COMMAND {
        return success_response(
            id,
            ts,
            command,
            command_payload.params.unwrap_or(serde_json::Value::Null),
        );
    }

    if command == DIAGNOSTICS_EXPORT_COMMAND {
        return match diagnostics::export_default_diagnostics_value() {
            Ok(export) => success_response(id, ts, command, export),
            Err(_) => problem_response(
                id,
                ts,
                problem_details(
                    "E_DIAGNOSTICS_EXPORT_FAILED",
                    String::from("Diagnostics export failed."),
                    "Diagnostics export failed",
                    500,
                    "diagnostics-export-failed",
                ),
            ),
        };
    }

    problem_response(
        id,
        ts,
        problem_details(
            "E_IPC_COMMAND_UNKNOWN",
            format!("IPC command {command} is not registered."),
            "IPC command unknown",
            404,
            "ipc-command-unknown",
        ),
    )
}

fn success_response(
    id: String,
    ts: String,
    command: String,
    result: serde_json::Value,
) -> ProtocolEnvelope {
    let payload = IpcResponsePayload { command, result };

    ProtocolEnvelope {
        id,
        kind: IPC_RESPONSE_KIND.to_owned(),
        payload: value_or_null(payload),
        ts,
        v: PROTOCOL_VERSION,
    }
}

fn problem_response(
    id: String,
    ts: String,
    problem_details: ProtocolProblemDetails,
) -> ProtocolEnvelope {
    ProtocolEnvelope {
        id,
        kind: IPC_ERROR_KIND.to_owned(),
        payload: value_or_null(problem_details),
        ts,
        v: PROTOCOL_VERSION,
    }
}

fn problem_details(
    code: &str,
    detail: String,
    title: &str,
    status: u16,
    slug: &str,
) -> ProtocolProblemDetails {
    ProtocolProblemDetails {
        code: code.to_owned(),
        detail,
        instance: None,
        status,
        title: title.to_owned(),
        problem_type: format!("https://dexroboknix.com/problems/{slug}"),
    }
}

fn value_or_null(payload: impl serde::Serialize) -> serde_json::Value {
    serde_json::to_value(payload).map_or(serde_json::Value::Null, |value| value)
}

#[cfg(test)]
mod tests {
    use super::{handle_ipc_command, IPC_COMMAND_KIND, IPC_ERROR_KIND, IPC_RESPONSE_KIND};
    use crate::generated::protocol::{
        IpcCommandPayload, IpcResponsePayload, ProtocolEnvelope, ProtocolProblemDetails,
        PROTOCOL_VERSION,
    };
    use std::error::Error;

    const FIXED_TIMESTAMP: &str = "2026-05-19T08:30:00.000Z";

    #[test]
    fn round_trips_echo_command_over_protocol_envelope() -> Result<(), Box<dyn Error>> {
        let request = command_envelope("ipc-round-trip-1", "ipc.echo", Some(echo_payload()))?;

        let response = handle_ipc_command(request);
        let response_payload = serde_json::from_value::<IpcResponsePayload>(response.payload)?;

        assert_eq!(response.id, "ipc-round-trip-1");
        assert_eq!(response.kind, IPC_RESPONSE_KIND);
        assert_eq!(response.ts, FIXED_TIMESTAMP);
        assert_eq!(response.v, PROTOCOL_VERSION);
        assert_eq!(response_payload.command, "ipc.echo");
        assert_eq!(response_payload.result, echo_payload());

        Ok(())
    }

    #[test]
    fn rejects_unknown_command_with_problem_details() -> Result<(), Box<dyn Error>> {
        let request = command_envelope("ipc-round-trip-2", "vault.open", None)?;

        let response = handle_ipc_command(request);
        let problem = serde_json::from_value::<ProtocolProblemDetails>(response.payload)?;

        assert_eq!(response.kind, IPC_ERROR_KIND);
        assert_eq!(problem.code, "E_IPC_COMMAND_UNKNOWN");
        assert_eq!(problem.status, 404);

        Ok(())
    }

    #[test]
    fn rejects_protocol_version_mismatch() -> Result<(), Box<dyn Error>> {
        let mut request = command_envelope("ipc-round-trip-3", "ipc.echo", None)?;
        request.v = PROTOCOL_VERSION + 1;

        let response = handle_ipc_command(request);
        let problem = serde_json::from_value::<ProtocolProblemDetails>(response.payload)?;

        assert_eq!(response.kind, IPC_ERROR_KIND);
        assert_eq!(problem.code, "E_PROTOCOL_VERSION_UNSUPPORTED");
        assert_eq!(problem.status, 426);

        Ok(())
    }

    #[test]
    fn diagnostics_export_command_returns_redacted_snapshot() -> Result<(), Box<dyn Error>> {
        let request = command_envelope("ipc-round-trip-4", "diagnostics.export", None)?;

        let response = handle_ipc_command(request);
        let response_payload = serde_json::from_value::<IpcResponsePayload>(response.payload)?;
        let export = response_payload.result.to_string();

        assert_eq!(response.kind, IPC_RESPONSE_KIND);
        assert_eq!(response_payload.command, "diagnostics.export");
        assert!(!export.contains(r"C:\Users"));
        assert!(!export.contains("C:/Users"));

        Ok(())
    }

    fn command_envelope(
        id: &str,
        command: &str,
        params: Option<serde_json::Value>,
    ) -> Result<ProtocolEnvelope, Box<dyn Error>> {
        Ok(ProtocolEnvelope {
            id: id.to_owned(),
            kind: IPC_COMMAND_KIND.to_owned(),
            payload: serde_json::to_value(IpcCommandPayload {
                command: command.to_owned(),
                params,
            })?,
            ts: FIXED_TIMESTAMP.to_owned(),
            v: PROTOCOL_VERSION,
        })
    }

    fn echo_payload() -> serde_json::Value {
        serde_json::json!({
            "text": "hello"
        })
    }
}
