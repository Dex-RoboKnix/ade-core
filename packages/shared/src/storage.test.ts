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

import { createAdeError } from './errors';
import {
  createMemoryKeyValueStorage,
  createVersionedStorage,
  type KeyValueStorage,
} from './storage';

interface PreferencesV1 {
  readonly theme: 'light' | 'dark';
}

interface PreferencesV2 {
  readonly accent: string;
  readonly theme: 'light' | 'dark';
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePreferencesV1(value: unknown): PreferencesV1 {
  if (isRecord(value) && (value.theme === 'light' || value.theme === 'dark')) {
    return {
      theme: value.theme,
    };
  }

  throw createAdeError('E_VALIDATION_FAILED', 'Preferences v1 state is invalid.');
}

function parsePreferencesV2(value: unknown): PreferencesV2 {
  if (
    isRecord(value) &&
    typeof value.accent === 'string' &&
    (value.theme === 'light' || value.theme === 'dark')
  ) {
    return {
      accent: value.accent,
      theme: value.theme,
    };
  }

  throw createAdeError('E_VALIDATION_FAILED', 'Preferences v2 state is invalid.');
}

function createCountingStorage(initialEntries: Readonly<Record<string, string>>): {
  readonly adapter: KeyValueStorage;
  writes(): number;
} {
  const adapter = createMemoryKeyValueStorage(initialEntries);
  let writeCount = 0;

  return {
    adapter: {
      getItem(key) {
        return adapter.getItem(key);
      },
      removeItem(key) {
        adapter.removeItem(key);
      },
      setItem(key, value) {
        writeCount += 1;
        adapter.setItem(key, value);
      },
    },
    writes() {
      return writeCount;
    },
  };
}

describe('versioned storage', () => {
  it('returns default state when no stored value exists', () => {
    const storage = createVersionedStorage(createMemoryKeyValueStorage(), {
      defaultState: () => ({ accent: 'blue', theme: 'dark' }),
      key: 'preferences',
      parse: parsePreferencesV2,
      version: 2,
    });

    expect(storage.load()).toEqual({ accent: 'blue', theme: 'dark' });
  });

  it('saves and reloads a versioned state envelope', () => {
    const adapter = createMemoryKeyValueStorage();
    const storage = createVersionedStorage(adapter, {
      defaultState: () => ({ accent: 'blue', theme: 'dark' }),
      key: 'preferences',
      parse: parsePreferencesV2,
      version: 2,
    });

    storage.save({ accent: 'green', theme: 'light' });

    expect(storage.load()).toEqual({ accent: 'green', theme: 'light' });
    expect(adapter.getItem('preferences')).toBe(
      JSON.stringify({
        state: { accent: 'green', theme: 'light' },
        version: 2,
      }),
    );
  });

  it('runs a v1-to-v2 migration idempotently', () => {
    const storageKey = 'preferences';
    const { adapter, writes } = createCountingStorage({
      [storageKey]: JSON.stringify({
        state: { theme: 'light' },
        version: 1,
      }),
    });
    const storage = createVersionedStorage(adapter, {
      defaultState: () => ({ accent: 'blue', theme: 'dark' }),
      key: storageKey,
      migrations: {
        1: (state) => ({
          ...parsePreferencesV1(state),
          accent: 'blue',
        }),
      },
      parse: parsePreferencesV2,
      version: 2,
    });

    expect(storage.load()).toEqual({ accent: 'blue', theme: 'light' });
    expect(writes()).toBe(1);
    expect(storage.load()).toEqual({ accent: 'blue', theme: 'light' });
    expect(writes()).toBe(1);
  });

  it('clears stored values', () => {
    const adapter = createMemoryKeyValueStorage({
      preferences: JSON.stringify({
        state: { accent: 'blue', theme: 'light' },
        version: 2,
      }),
    });
    const storage = createVersionedStorage(adapter, {
      defaultState: () => ({ accent: 'blue', theme: 'dark' }),
      key: 'preferences',
      parse: parsePreferencesV2,
      version: 2,
    });

    storage.clear();

    expect(adapter.getItem('preferences')).toBe(null);
  });

  it('rejects malformed and unsupported stored envelopes', () => {
    const malformedStorage = createVersionedStorage(
      createMemoryKeyValueStorage({ preferences: 'not-json' }),
      {
        defaultState: () => ({ accent: 'blue', theme: 'dark' }),
        key: 'preferences',
        parse: parsePreferencesV2,
        version: 2,
      },
    );
    const futureStorage = createVersionedStorage(
      createMemoryKeyValueStorage({
        preferences: JSON.stringify({
          state: { accent: 'blue', theme: 'light' },
          version: 3,
        }),
      }),
      {
        defaultState: () => ({ accent: 'blue', theme: 'dark' }),
        key: 'preferences',
        parse: parsePreferencesV2,
        version: 2,
      },
    );
    const missingMigrationStorage = createVersionedStorage(
      createMemoryKeyValueStorage({
        preferences: JSON.stringify({
          state: { theme: 'light' },
          version: 1,
        }),
      }),
      {
        defaultState: () => ({ accent: 'blue', theme: 'dark' }),
        key: 'preferences',
        parse: parsePreferencesV2,
        version: 2,
      },
    );

    expect(() => malformedStorage.load()).toThrow('Validation failed');
    expect(() => futureStorage.load()).toThrow('Protocol version unsupported');
    expect(() => missingMigrationStorage.load()).toThrow('Protocol version unsupported');
  });
});
