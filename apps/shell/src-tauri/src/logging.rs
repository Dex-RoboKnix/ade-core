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

//! Structured logging setup for the ADE shell.

use std::{
    fmt,
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use tracing_subscriber::fmt::MakeWriter;
use tracing_subscriber::util::SubscriberInitExt;

const DEFAULT_LOG_ROTATION_BYTES: u64 = 10 * 1024 * 1024;

#[derive(Debug)]
pub enum LoggingError {
    Io(io::Error),
    Subscriber(String),
}

impl fmt::Display for LoggingError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(error) => write!(formatter, "{error}"),
            Self::Subscriber(error) => formatter.write_str(error),
        }
    }
}

impl std::error::Error for LoggingError {}

impl From<io::Error> for LoggingError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

#[derive(Clone, Debug)]
pub struct LoggingConfig {
    directory: PathBuf,
    file_name: String,
    max_bytes: u64,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            directory: default_log_directory(),
            file_name: String::from("ade-shell.log"),
            max_bytes: DEFAULT_LOG_ROTATION_BYTES,
        }
    }
}

/// Default ADE shell log directory.
pub fn default_log_directory() -> PathBuf {
    std::env::temp_dir().join("dexroboknix").join("ade-shell").join("logs")
}

pub fn init_logging(config: LoggingConfig) -> Result<(), LoggingError> {
    let writer = RotatingLogMakeWriter::new(config.directory, config.file_name, config.max_bytes)?;

    tracing_subscriber::fmt()
        .json()
        .with_current_span(false)
        .with_span_list(false)
        .with_max_level(tracing::Level::INFO)
        .with_writer(writer)
        .finish()
        .try_init()
        .map_err(|error| LoggingError::Subscriber(error.to_string()))?;

    Ok(())
}

#[derive(Clone)]
struct RotatingLogMakeWriter {
    inner: Arc<Mutex<RotatingLogFile>>,
}

impl RotatingLogMakeWriter {
    fn new(
        directory: impl Into<PathBuf>,
        file_name: impl Into<String>,
        max_bytes: u64,
    ) -> io::Result<Self> {
        Ok(Self {
            inner: Arc::new(Mutex::new(RotatingLogFile::open(
                directory.into(),
                file_name.into(),
                max_bytes,
            )?)),
        })
    }
}

impl<'writer> MakeWriter<'writer> for RotatingLogMakeWriter {
    type Writer = RotatingLogWriter;

    fn make_writer(&'writer self) -> Self::Writer {
        RotatingLogWriter { inner: Arc::clone(&self.inner) }
    }
}

struct RotatingLogWriter {
    inner: Arc<Mutex<RotatingLogFile>>,
}

impl Write for RotatingLogWriter {
    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
        let mut file =
            self.inner.lock().map_err(|_| io::Error::other("log writer mutex poisoned"))?;

        file.write(buffer)
    }

    fn flush(&mut self) -> io::Result<()> {
        let mut file =
            self.inner.lock().map_err(|_| io::Error::other("log writer mutex poisoned"))?;

        file.flush()
    }
}

struct RotatingLogFile {
    active_path: PathBuf,
    directory: PathBuf,
    file: Option<File>,
    file_name: String,
    max_bytes: u64,
    rotation_sequence: u64,
    written_bytes: u64,
}

impl RotatingLogFile {
    fn open(directory: PathBuf, file_name: String, max_bytes: u64) -> io::Result<Self> {
        if max_bytes == 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "log rotation threshold must be greater than zero",
            ));
        }

        fs::create_dir_all(&directory)?;

        let active_path = directory.join(&file_name);
        let written_bytes = active_path.metadata().map_or(0, |metadata| metadata.len());
        let file = open_append_file(&active_path)?;
        let mut log_file = Self {
            active_path,
            directory,
            file: Some(file),
            file_name,
            max_bytes,
            rotation_sequence: 0,
            written_bytes,
        };

        if log_file.written_bytes >= log_file.max_bytes {
            log_file.rotate()?;
        }

        Ok(log_file)
    }

    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
        if buffer.is_empty() {
            return Ok(0);
        }

        let incoming_bytes = u64::try_from(buffer.len()).map_err(|_| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "log write buffer length does not fit into u64",
            )
        })?;

        if self.written_bytes > 0 && self.written_bytes + incoming_bytes > self.max_bytes {
            self.rotate()?;
        }

        let bytes_written = self.file_mut()?.write(buffer)?;
        self.written_bytes += u64::try_from(bytes_written).map_err(|_| {
            io::Error::new(io::ErrorKind::InvalidInput, "written byte count does not fit into u64")
        })?;

        Ok(bytes_written)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.file_mut()?.flush()
    }

    fn rotate(&mut self) -> io::Result<()> {
        if let Some(mut file) = self.file.take() {
            file.flush()?;
        }

        if self.active_path.exists() && self.active_path.metadata()?.len() > 0 {
            let rotated_path = self.next_rotated_path();

            fs::rename(&self.active_path, rotated_path)?;
        }

        self.file = Some(open_append_file(&self.active_path)?);
        self.written_bytes = 0;

        Ok(())
    }

    fn file_mut(&mut self) -> io::Result<&mut File> {
        self.file.as_mut().ok_or_else(|| io::Error::other("active log file is closed"))
    }

    fn next_rotated_path(&mut self) -> PathBuf {
        let timestamp =
            SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |duration| duration.as_secs());
        let rotated_path = self
            .directory
            .join(format!("{}.{}.{}.log", self.file_name, timestamp, self.rotation_sequence));

        self.rotation_sequence += 1;

        rotated_path
    }
}

fn open_append_file(path: &Path) -> io::Result<File> {
    OpenOptions::new().append(true).create(true).open(path)
}

#[cfg(test)]
mod tests {
    use super::{RotatingLogMakeWriter, DEFAULT_LOG_ROTATION_BYTES};
    use std::{
        error::Error,
        fs,
        io::Write,
        path::{Path, PathBuf},
        process,
        time::{SystemTime, UNIX_EPOCH},
    };
    use tracing_subscriber::fmt::MakeWriter;

    #[test]
    fn default_rotation_threshold_is_ten_mebibytes() {
        assert_eq!(DEFAULT_LOG_ROTATION_BYTES, 10 * 1024 * 1024);
    }

    #[test]
    fn rejects_zero_byte_rotation_threshold() {
        let result = RotatingLogMakeWriter::new(std::env::temp_dir(), "ade-zero.log", 0);

        assert!(result.is_err());
    }

    #[test]
    fn rotates_log_file_when_threshold_is_reached() -> Result<(), Box<dyn Error>> {
        let directory = unique_test_directory("rotate")?;
        let writer = RotatingLogMakeWriter::new(&directory, "ade-shell.log", 10)?;

        {
            let mut active_writer = writer.make_writer();
            active_writer.write_all(b"12345")?;
            active_writer.write_all(b"67890")?;
            active_writer.write_all(b"abc")?;
            active_writer.flush()?;
        }

        let active_log = fs::read_to_string(directory.join("ade-shell.log"))?;
        let rotated_logs = rotated_log_paths(&directory)?;

        assert_eq!(active_log, "abc");
        assert_eq!(rotated_logs.len(), 1);
        assert_eq!(fs::read_to_string(&rotated_logs[0])?, "1234567890");

        fs::remove_dir_all(directory)?;

        Ok(())
    }

    fn unique_test_directory(prefix: &str) -> Result<PathBuf, Box<dyn Error>> {
        let timestamp = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
        let directory = std::env::temp_dir()
            .join(format!("ade-logging-{prefix}-{}-{timestamp}", process::id()));

        fs::create_dir_all(&directory)?;

        Ok(directory)
    }

    fn rotated_log_paths(directory: &Path) -> Result<Vec<PathBuf>, Box<dyn Error>> {
        let mut paths = Vec::new();

        for entry in fs::read_dir(directory)? {
            let path = entry?.path();
            let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };

            if file_name.starts_with("ade-shell.log.") && file_name.ends_with(".log") {
                paths.push(path);
            }
        }

        paths.sort();

        Ok(paths)
    }
}
