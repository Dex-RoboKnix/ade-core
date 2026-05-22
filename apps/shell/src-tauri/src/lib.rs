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

//! Library code for ADE shell.

/// Generated bindings shared with TypeScript protocol schemas.
pub mod generated;

mod diagnostics;
mod ipc;
mod logging;

/// Run the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> tauri::Result<()> {
    if let Err(error) = logging::init_logging(logging::LoggingConfig::default()) {
        let redacted_error = diagnostics::redact_sensitive_text(&error.to_string());
        eprintln!("ADE logging unavailable: {redacted_error}");
    }

    if let Err(error) =
        diagnostics::install_crash_handler(diagnostics::CrashHandlerConfig::default())
    {
        let redacted_error = diagnostics::redact_sensitive_text(&error.to_string());
        eprintln!("ADE crash diagnostics unavailable: {redacted_error}");
    }

    tracing::info!("starting ADE shell");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![ipc::ade_ipc_command])
        .run(tauri::generate_context!())
}
