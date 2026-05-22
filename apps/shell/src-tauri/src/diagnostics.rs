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

//! Crash handling and redacted diagnostics export for the ADE shell.

use crate::logging;
use std::{
    backtrace::Backtrace,
    fmt, fs,
    io::{self},
    panic::{self, PanicHookInfo},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

/// Placeholder used wherever diagnostics strip a local path.
pub const REDACTED_PATH: &str = "[path-redacted]";

/// Diagnostics subsystem error.
#[derive(Debug)]
pub enum DiagnosticsError {
    /// Filesystem error while creating or writing diagnostics artifacts.
    Io(io::Error),
    /// JSON serialization error while preparing a diagnostics export.
    Json(serde_json::Error),
}

impl fmt::Display for DiagnosticsError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(error) => write!(formatter, "{error}"),
            Self::Json(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for DiagnosticsError {}

impl From<io::Error> for DiagnosticsError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<serde_json::Error> for DiagnosticsError {
    fn from(error: serde_json::Error) -> Self {
        Self::Json(error)
    }
}

/// Crash handler configuration.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CrashHandlerConfig {
    /// Directory where redacted crash reports are written.
    pub directory: PathBuf,
}

impl Default for CrashHandlerConfig {
    fn default() -> Self {
        Self { directory: default_crash_directory() }
    }
}

/// Sanitized diagnostics snapshot exported for support/debugging.
#[derive(Clone, Debug, Eq, PartialEq, serde::Serialize)]
pub struct DiagnosticsSnapshot {
    /// Shell app version.
    pub app_version: String,
    /// Directory where crash reports are stored.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub crash_directory: Option<String>,
    /// Directory where structured logs are stored.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_directory: Option<String>,
    /// Most recent crash report content, if the caller has loaded one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recent_crash_report: Option<String>,
    /// Additional diagnostic notes.
    pub notes: Vec<String>,
}

impl DiagnosticsSnapshot {
    /// Collect the default shell diagnostics snapshot.
    pub fn default_shell() -> Self {
        Self {
            app_version: env!("CARGO_PKG_VERSION").to_owned(),
            crash_directory: Some(default_crash_directory().display().to_string()),
            log_directory: Some(logging::default_log_directory().display().to_string()),
            recent_crash_report: None,
            notes: Vec::new(),
        }
    }

    fn redacted(&self) -> Self {
        Self {
            app_version: redact_sensitive_text(&self.app_version),
            crash_directory: redact_optional_text(self.crash_directory.as_deref()),
            log_directory: redact_optional_text(self.log_directory.as_deref()),
            recent_crash_report: redact_optional_text(self.recent_crash_report.as_deref()),
            notes: self.notes.iter().map(|note| redact_sensitive_text(note)).collect(),
        }
    }
}

/// Install a panic hook that writes redacted crash reports.
pub fn install_crash_handler(config: CrashHandlerConfig) -> Result<(), DiagnosticsError> {
    fs::create_dir_all(&config.directory)?;

    let crash_directory = config.directory;
    let previous_hook = panic::take_hook();

    panic::set_hook(Box::new(move |panic_info| {
        let backtrace = Backtrace::force_capture();
        let report = CrashReport::from_panic_info(panic_info, &backtrace);

        match write_crash_report(&crash_directory, &report) {
            Ok(path) => {
                let redacted_path = redact_sensitive_text(&path.display().to_string());
                tracing::error!(crash_report = %redacted_path, "ADE crash report written");
            }
            Err(error) => {
                let redacted_error = redact_sensitive_text(&error.to_string());
                eprintln!("ADE crash report unavailable: {redacted_error}");
            }
        }

        previous_hook(panic_info);
    }));

    Ok(())
}

/// Export the default diagnostics snapshot as a redacted JSON value for IPC responses.
pub fn export_default_diagnostics_value() -> Result<serde_json::Value, DiagnosticsError> {
    export_diagnostics_value(&DiagnosticsSnapshot::default_shell())
}

/// Redact local filesystem paths from diagnostic text.
pub fn redact_sensitive_text(value: &str) -> String {
    let mut redacted = String::with_capacity(value.len());
    let mut index = 0;

    while index < value.len() {
        if has_sensitive_path_prefix(value, index) {
            redacted.push_str(REDACTED_PATH);
            index = path_end_index(value, index);
            continue;
        }

        let Some(character) = value[index..].chars().next() else {
            break;
        };

        redacted.push(character);
        index += character.len_utf8();
    }

    redacted
}

#[derive(Clone, Debug, Eq, PartialEq, serde::Serialize)]
struct CrashReport {
    backtrace: String,
    location: Option<String>,
    message: String,
    thread: Option<String>,
    timestamp_unix_seconds: u64,
}

impl CrashReport {
    fn from_panic_info(panic_info: &PanicHookInfo<'_>, backtrace: &Backtrace) -> Self {
        let thread = std::thread::current();

        Self {
            backtrace: backtrace.to_string(),
            location: panic_info.location().map(|location| {
                format!("{}:{}:{}", location.file(), location.line(), location.column())
            }),
            message: panic_message(panic_info),
            thread: thread.name().map(str::to_owned),
            timestamp_unix_seconds: current_unix_seconds(),
        }
    }

    fn redacted(&self) -> Self {
        Self {
            backtrace: redact_sensitive_text(&self.backtrace),
            location: redact_optional_text(self.location.as_deref()),
            message: redact_sensitive_text(&self.message),
            thread: redact_optional_text(self.thread.as_deref()),
            timestamp_unix_seconds: self.timestamp_unix_seconds,
        }
    }
}

fn default_crash_directory() -> PathBuf {
    std::env::temp_dir().join("dexroboknix").join("ade-shell").join("crashes")
}

fn export_diagnostics_value(
    snapshot: &DiagnosticsSnapshot,
) -> Result<serde_json::Value, DiagnosticsError> {
    serde_json::to_value(snapshot.redacted()).map_err(DiagnosticsError::Json)
}

fn write_crash_report(directory: &Path, report: &CrashReport) -> Result<PathBuf, DiagnosticsError> {
    fs::create_dir_all(directory)?;

    let path =
        directory.join(format!("crash-{}-{}.json", current_unix_seconds(), std::process::id()));
    let payload = serde_json::to_vec_pretty(&report.redacted())?;

    fs::write(&path, payload)?;

    Ok(path)
}

fn panic_message(panic_info: &PanicHookInfo<'_>) -> String {
    if let Some(message) = panic_info.payload().downcast_ref::<&str>() {
        return (*message).to_owned();
    }

    if let Some(message) = panic_info.payload().downcast_ref::<String>() {
        return message.clone();
    }

    String::from("non-string panic payload")
}

fn redact_optional_text(value: Option<&str>) -> Option<String> {
    value.map(redact_sensitive_text)
}

fn current_unix_seconds() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |duration| duration.as_secs())
}

fn has_sensitive_path_prefix(value: &str, index: usize) -> bool {
    let slice = &value[index..];

    starts_with_drive_path(value.as_bytes(), index)
        || slice.starts_with("\\\\")
        || slice.starts_with("/Users/")
        || slice.starts_with("/home/")
}

fn starts_with_drive_path(bytes: &[u8], index: usize) -> bool {
    let Some(letter) = bytes.get(index) else {
        return false;
    };
    let Some(colon) = bytes.get(index + 1) else {
        return false;
    };
    let Some(separator) = bytes.get(index + 2) else {
        return false;
    };

    letter.is_ascii_alphabetic() && *colon == b':' && (*separator == b'\\' || *separator == b'/')
}

fn path_end_index(value: &str, start: usize) -> usize {
    let bytes = value.as_bytes();
    let mut index = start;

    while index < bytes.len() {
        if is_path_terminator(bytes[index]) {
            return index;
        }

        index += 1;
    }

    index
}

const fn is_path_terminator(byte: u8) -> bool {
    matches!(byte, b'\n' | b'\r' | b'\t' | b'"' | b'\'' | b'<' | b'>' | b'|')
}

#[cfg(test)]
mod tests {
    use super::{
        export_diagnostics_value, write_crash_report, CrashReport, DiagnosticsSnapshot,
        REDACTED_PATH,
    };
    use std::{
        error::Error,
        fs,
        path::PathBuf,
        process,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn diagnostics_export_redacts_raw_user_paths() -> Result<(), Box<dyn Error>> {
        let snapshot = DiagnosticsSnapshot {
            app_version: String::from("0.0.0"),
            crash_directory: Some(String::from("C:/Users/Dan/AppData/Local/Temp/ade/crashes")),
            log_directory: Some(String::from(r"C:\Users\Dan\AppData\Local\Temp\ade\logs")),
            recent_crash_report: Some(String::from(
                r"panic while reading C:\Users\Dan\Documents\Vault Alpha\secret.txt
at /Users/dan/projects/ade/src/main.rs",
            )),
            notes: vec![String::from(r"UNC input \\Server\Share\Dan\secret.txt")],
        };

        let exported = serde_json::to_string_pretty(&export_diagnostics_value(&snapshot)?)?;

        assert!(!exported.contains(r"C:\Users\Dan"));
        assert!(!exported.contains("C:/Users/Dan"));
        assert!(!exported.contains("/Users/dan"));
        assert!(!exported.contains(r"\\Server\Share"));
        assert!(exported.contains(REDACTED_PATH));

        Ok(())
    }

    #[test]
    fn crash_report_writer_redacts_report_content() -> Result<(), Box<dyn Error>> {
        let directory = unique_test_directory("crash-report")?;
        let report = CrashReport {
            backtrace: String::from(r"frame at C:\Users\Dan\Documents\ADE\src\lib.rs:10"),
            location: Some(String::from(r"C:\Users\Dan\Documents\ADE\src\lib.rs:10:2")),
            message: String::from(r"panic at C:\Users\Dan\Documents\ADE\vault.txt"),
            thread: Some(String::from("main")),
            timestamp_unix_seconds: 0,
        };

        let path = write_crash_report(&directory, &report)?;
        let contents = fs::read_to_string(path)?;

        assert!(!contents.contains(r"C:\Users\Dan"));
        assert!(contents.contains(REDACTED_PATH));

        fs::remove_dir_all(directory)?;

        Ok(())
    }

    fn unique_test_directory(prefix: &str) -> Result<PathBuf, Box<dyn Error>> {
        let timestamp = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
        let directory = std::env::temp_dir()
            .join(format!("ade-diagnostics-{prefix}-{}-{timestamp}", process::id()));

        fs::create_dir_all(&directory)?;

        Ok(directory)
    }
}
