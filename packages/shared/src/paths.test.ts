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

import { describe, expect, it } from 'vitest';

import {
  joinWindowsPath,
  normalizeWindowsPath,
  parentWindowsPath,
  windowsPathExtension,
} from './paths';

describe('normalizeWindowsPath', () => {
  it('normalizes drive-rooted paths', () => {
    expect(normalizeWindowsPath('c:/Users//Ada/../Grace/./file.txt')).toBe(
      'C:\\Users\\Grace\\file.txt',
    );
  });

  it('preserves drive-relative paths', () => {
    expect(normalizeWindowsPath('d:folder/child')).toBe('D:folder\\child');
  });

  it('normalizes UNC roots without escaping above the share', () => {
    expect(normalizeWindowsPath('\\\\server\\share\\folder\\..\\..\\file.txt')).toBe(
      '\\\\server\\share\\file.txt',
    );
  });

  it('normalizes incomplete UNC-like roots conservatively', () => {
    expect(normalizeWindowsPath('\\\\server')).toBe('\\\\server');
  });

  it('normalizes extended drive and UNC paths', () => {
    expect(normalizeWindowsPath('\\\\?\\c:\\Long\\..\\Path')).toBe('\\\\?\\C:\\Path');
    expect(normalizeWindowsPath('\\\\?\\UNC\\server\\share\\folder\\..\\file')).toBe(
      '\\\\?\\UNC\\server\\share\\file',
    );
    expect(normalizeWindowsPath('\\\\?\\UNC\\server')).toBe('\\\\?\\UNC\\server');
  });

  it('normalizes unknown extended prefixes and rooted paths', () => {
    expect(normalizeWindowsPath('\\\\?\\Volume{abc}\\dir\\..\\file')).toBe(
      '\\\\?\\Volume{abc}\\file',
    );
    expect(normalizeWindowsPath('\\temp\\..\\file')).toBe('\\file');
  });

  it('preserves unresolved relative parents and handles empty paths', () => {
    expect(normalizeWindowsPath('../folder/./file')).toBe('..\\folder\\file');
    expect(normalizeWindowsPath('.')).toBe('.');
    expect(normalizeWindowsPath('')).toBe('.');
  });
});

describe('joinWindowsPath', () => {
  it('joins path parts with normalization', () => {
    expect(joinWindowsPath('C:\\root\\', '\\folder', 'child', '..\\file.txt')).toBe(
      'C:\\root\\folder\\file.txt',
    );
  });

  it('returns the current path marker when no parts are supplied', () => {
    expect(joinWindowsPath('', '')).toBe('.');
  });
});

describe('parentWindowsPath', () => {
  it('returns parent paths for absolute and relative paths', () => {
    expect(parentWindowsPath('C:\\Users\\Grace\\file.txt')).toBe('C:\\Users\\Grace');
    expect(parentWindowsPath('folder\\child')).toBe('folder');
  });

  it('returns roots when the child is directly under a root', () => {
    expect(parentWindowsPath('C:\\file.txt')).toBe('C:\\');
    expect(parentWindowsPath('\\\\server\\share\\file.txt')).toBe('\\\\server\\share\\');
  });

  it('returns null for root and single-segment relative paths', () => {
    expect(parentWindowsPath('C:\\')).toBe(null);
    expect(parentWindowsPath('folder')).toBe(null);
  });
});

describe('windowsPathExtension', () => {
  it('returns the final extension with the leading dot', () => {
    expect(windowsPathExtension('C:\\logs\\archive.tar.gz')).toBe('.gz');
  });

  it('ignores dotfiles and trailing dots', () => {
    expect(windowsPathExtension('C:\\Users\\Grace\\.env')).toBe('');
    expect(windowsPathExtension('C:\\Users\\Grace\\file.')).toBe('');
    expect(windowsPathExtension('\\')).toBe('');
  });
});
