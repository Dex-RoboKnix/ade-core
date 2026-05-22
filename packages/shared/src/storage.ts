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

import { createAdeError } from './errors';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface VersionedStorageEnvelope<TState> {
  readonly state: TState;
  readonly version: number;
}

export type StorageMigration = (state: unknown) => unknown;

export interface VersionedStorageSchema<TState> {
  readonly defaultState: () => TState;
  readonly key: string;
  readonly migrations?: Readonly<Record<number, StorageMigration>>;
  readonly parse: (state: unknown) => TState;
  readonly version: number;
}

export interface VersionedStorage<TState> {
  clear(): void;
  load(): TState;
  save(state: TState): void;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoredEnvelope(value: unknown): value is VersionedStorageEnvelope<unknown> {
  const version = isRecord(value) ? value.version : undefined;

  return (
    isRecord(value) &&
    typeof version === 'number' &&
    Number.isInteger(version) &&
    version > 0 &&
    Object.hasOwn(value, 'state')
  );
}

function parseStoredEnvelope(rawValue: string, key: string): VersionedStorageEnvelope<unknown> {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue) as unknown;
  } catch {
    throw createAdeError('E_VALIDATION_FAILED', `Stored state for "${key}" is not valid JSON.`);
  }

  if (!isStoredEnvelope(parsedValue)) {
    throw createAdeError(
      'E_VALIDATION_FAILED',
      `Stored state for "${key}" is missing a valid versioned envelope.`,
    );
  }

  return parsedValue;
}

function serializeEnvelope<TState>(envelope: VersionedStorageEnvelope<TState>): string {
  return JSON.stringify(envelope);
}

function migrateEnvelope<TState>(
  envelope: VersionedStorageEnvelope<unknown>,
  schema: VersionedStorageSchema<TState>,
): VersionedStorageEnvelope<TState> {
  let state = envelope.state;
  let version = envelope.version;

  if (version > schema.version) {
    throw createAdeError(
      'E_PROTOCOL_VERSION_UNSUPPORTED',
      `Stored state for "${schema.key}" is v${version}, but this build supports v${schema.version}.`,
    );
  }

  while (version < schema.version) {
    const migration = schema.migrations?.[version];

    if (migration === undefined) {
      throw createAdeError(
        'E_PROTOCOL_VERSION_UNSUPPORTED',
        `Stored state for "${schema.key}" has no migration from v${version} to v${version + 1}.`,
      );
    }

    state = migration(state);
    version += 1;
  }

  return {
    state: schema.parse(state),
    version,
  };
}

export function createVersionedStorage<TState>(
  adapter: KeyValueStorage,
  schema: VersionedStorageSchema<TState>,
): VersionedStorage<TState> {
  return {
    clear() {
      adapter.removeItem(schema.key);
    },
    load() {
      const rawValue = adapter.getItem(schema.key);

      if (rawValue === null) {
        return schema.defaultState();
      }

      const storedEnvelope = parseStoredEnvelope(rawValue, schema.key);
      const migratedEnvelope = migrateEnvelope(storedEnvelope, schema);

      if (migratedEnvelope.version !== storedEnvelope.version) {
        adapter.setItem(schema.key, serializeEnvelope(migratedEnvelope));
      }

      return migratedEnvelope.state;
    },
    save(state) {
      adapter.setItem(
        schema.key,
        serializeEnvelope({
          state: schema.parse(state),
          version: schema.version,
        }),
      );
    },
  };
}

export function createMemoryKeyValueStorage(
  initialEntries: Readonly<Record<string, string>> = {},
): KeyValueStorage {
  const entries = new Map(Object.entries(initialEntries));

  return {
    getItem(key) {
      return entries.get(key) ?? null;
    },
    removeItem(key) {
      entries.delete(key);
    },
    setItem(key, value) {
      entries.set(key, value);
    },
  };
}
