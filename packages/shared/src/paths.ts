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

const WINDOWS_SEPARATOR = '\\';
const EXTENDED_PATH_PREFIX = '\\\\?\\';
const EXTENDED_UNC_PREFIX = '\\\\?\\UNC\\';
const UNC_PREFIX = '\\\\';
const DRIVE_ROOT_PATTERN = /^([A-Za-z]:)(\\?)/;

interface ParsedWindowsRoot {
  readonly rest: string;
  readonly root: string;
}

function toWindowsSeparators(path: string): string {
  return path.replaceAll('/', WINDOWS_SEPARATOR);
}

function normalizeDriveRoot(drive: string, separator: string): string {
  return `${drive.toUpperCase()}${separator}`;
}

function parseExtendedRoot(path: string): ParsedWindowsRoot | null {
  if (!path.startsWith(EXTENDED_PATH_PREFIX)) {
    return null;
  }

  if (path.startsWith(EXTENDED_UNC_PREFIX)) {
    const [server = '', share = '', ...segments] = path
      .slice(EXTENDED_UNC_PREFIX.length)
      .split('\\');

    if (server.length > 0 && share.length > 0) {
      return {
        rest: segments.join('\\'),
        root: `${EXTENDED_UNC_PREFIX}${server}\\${share}\\`,
      };
    }
  }

  const extendedRest = path.slice(EXTENDED_PATH_PREFIX.length);
  const driveRoot = DRIVE_ROOT_PATTERN.exec(extendedRest);

  if (driveRoot !== null) {
    const [, drive = '', separator = ''] = driveRoot;

    return {
      rest: extendedRest.slice(drive.length + separator.length),
      root: `${EXTENDED_PATH_PREFIX}${normalizeDriveRoot(drive, separator)}`,
    };
  }

  return {
    rest: extendedRest,
    root: EXTENDED_PATH_PREFIX,
  };
}

function parseUncRoot(path: string): ParsedWindowsRoot | null {
  if (!path.startsWith(UNC_PREFIX)) {
    return null;
  }

  const [server = '', share = '', ...segments] = path.slice(UNC_PREFIX.length).split('\\');

  if (server.length === 0 || share.length === 0) {
    return {
      rest: path.slice(UNC_PREFIX.length),
      root: UNC_PREFIX,
    };
  }

  return {
    rest: segments.join('\\'),
    root: `${UNC_PREFIX}${server}\\${share}\\`,
  };
}

function parseDriveRoot(path: string): ParsedWindowsRoot | null {
  const driveRoot = DRIVE_ROOT_PATTERN.exec(path);

  if (driveRoot === null) {
    return null;
  }

  const [, drive = '', separator = ''] = driveRoot;

  return {
    rest: path.slice(drive.length + separator.length),
    root: normalizeDriveRoot(drive, separator),
  };
}

function parseWindowsRoot(path: string): ParsedWindowsRoot {
  const extendedRoot = parseExtendedRoot(path);

  if (extendedRoot !== null) {
    return extendedRoot;
  }

  const uncRoot = parseUncRoot(path);

  if (uncRoot !== null) {
    return uncRoot;
  }

  const driveRoot = parseDriveRoot(path);

  if (driveRoot !== null) {
    return driveRoot;
  }

  if (path.startsWith(WINDOWS_SEPARATOR)) {
    return {
      rest: path.replace(/^\\+/, ''),
      root: WINDOWS_SEPARATOR,
    };
  }

  return {
    rest: path,
    root: '',
  };
}

function rootWithSegments(root: string, segments: readonly string[]): string {
  if (segments.length === 0) {
    return root === '' ? '.' : root;
  }

  return `${root}${segments.join(WINDOWS_SEPARATOR)}`;
}

function normalizedSegments(root: string, rest: string): string[] {
  const segments: string[] = [];

  for (const segment of rest.split(WINDOWS_SEPARATOR)) {
    if (segment.length === 0 || segment === '.') {
      continue;
    }

    if (segment === '..') {
      const lastSegment = segments.at(-1);

      if (lastSegment !== undefined && lastSegment !== '..') {
        segments.pop();
        continue;
      }

      if (root === '') {
        segments.push(segment);
      }

      continue;
    }

    segments.push(segment);
  }

  return segments;
}

/** Normalize a Windows path without relying on Node's `path` module. */
export function normalizeWindowsPath(path: string): string {
  if (path.length === 0) {
    return '.';
  }

  const windowsPath = toWindowsSeparators(path);
  const { rest, root } = parseWindowsRoot(windowsPath);

  return rootWithSegments(root, normalizedSegments(root, rest));
}

/** Join Windows path parts and normalize the result. */
export function joinWindowsPath(...parts: readonly string[]): string {
  const [firstPart, ...otherParts] = parts.filter((part) => part.length > 0);

  if (firstPart === undefined) {
    return '.';
  }

  const joined = otherParts.reduce((currentPath, part) => {
    const left = currentPath.replace(/[\\/]+$/, '');
    const right = part.replace(/^[\\/]+/, '');

    return `${left}${WINDOWS_SEPARATOR}${right}`;
  }, firstPart);

  return normalizeWindowsPath(joined);
}

/** Return the normalized parent path, or null when the path is already at its root. */
export function parentWindowsPath(path: string): string | null {
  const normalizedPath = normalizeWindowsPath(path);
  const { rest, root } = parseWindowsRoot(normalizedPath);
  const segments = rest.split(WINDOWS_SEPARATOR).filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return null;
  }

  if (segments.length === 1) {
    return root === '' ? null : root;
  }

  return rootWithSegments(root, segments.slice(0, -1));
}

/** Return the final path segment extension, including the leading dot. */
export function windowsPathExtension(path: string): string {
  const normalizedPath = normalizeWindowsPath(path);
  const fileName = normalizedPath.split(WINDOWS_SEPARATOR).filter(Boolean).at(-1) ?? '';
  const dotIndex = fileName.lastIndexOf('.');

  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return '';
  }

  return fileName.slice(dotIndex);
}
