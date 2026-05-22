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

import type { FeatureFlagReader } from './feature-flags';

export const TELEMETRY_REDACTED_VALUE = '[redacted]';

const PII_KEY_PATTERN =
  /(?:email|e-mail|phone|token|secret|password|credential|cookie|session|username|user|name|address|path|directory|folder|file|home)/i;
const EMAIL_VALUE_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const WINDOWS_PATH_VALUE_PATTERN =
  /(?:[A-Za-z]:[\\/][^\s]+|\\\\[^\\/\s]+[\\/][^\\/\s]+[^\s]*|\/(?:Users|home)\/[^\s]+)/;
const SECRET_VALUE_PATTERN = /\b(?:sk|ghp|pat|token)[_-]?[A-Za-z0-9_]{12,}\b/i;

export type TelemetryScalar = string | number | boolean | null;
export type TelemetryValue =
  | TelemetryScalar
  | readonly TelemetryValue[]
  | { readonly [key: string]: TelemetryValue };

export type TelemetryProperties = Readonly<Record<string, TelemetryValue>>;
export type TelemetryMeasurements = Readonly<Record<string, number>>;

export interface TelemetryEventInput {
  readonly name: string;
  readonly measurements?: TelemetryMeasurements;
  readonly properties?: TelemetryProperties;
  readonly ts?: string;
}

export interface TelemetryEvent {
  readonly name: string;
  readonly measurements: TelemetryMeasurements;
  readonly properties: TelemetryProperties;
  readonly ts: string;
}

export type TelemetrySink = (event: TelemetryEvent) => void;

export interface CreateTelemetryClientOptions {
  readonly enabled?: boolean;
  readonly featureFlags?: FeatureFlagReader;
  readonly now?: () => string;
  readonly sink?: TelemetrySink;
}

export interface TelemetryRecordAccepted {
  readonly accepted: true;
  readonly event: TelemetryEvent;
}

export interface TelemetryRecordRejected {
  readonly accepted: false;
  readonly reason: 'disabled';
}

export type TelemetryRecordResult = TelemetryRecordAccepted | TelemetryRecordRejected;

export interface TelemetryClient {
  isEnabled(): boolean;
  record(event: TelemetryEventInput): TelemetryRecordResult;
}

function defaultTelemetryTimestamp(): string {
  return new Date().toISOString();
}

function isTelemetryObject(
  value: TelemetryValue,
): value is { readonly [key: string]: TelemetryValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shouldRedactKey(key: string): boolean {
  return PII_KEY_PATTERN.test(key);
}

function shouldRedactString(value: string): boolean {
  return (
    EMAIL_VALUE_PATTERN.test(value) ||
    WINDOWS_PATH_VALUE_PATTERN.test(value) ||
    SECRET_VALUE_PATTERN.test(value)
  );
}

function redactTelemetryValue(key: string, value: TelemetryValue): TelemetryValue {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return shouldRedactKey(key) || shouldRedactString(value) ? TELEMETRY_REDACTED_VALUE : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactTelemetryValue(key, entry));
  }

  if (isTelemetryObject(value)) {
    return sanitizeTelemetryProperties(value);
  }

  return TELEMETRY_REDACTED_VALUE;
}

export function sanitizeTelemetryProperties(
  properties: TelemetryProperties = {},
): TelemetryProperties {
  const sanitizedProperties: Record<string, TelemetryValue> = {};

  for (const [key, value] of Object.entries(properties)) {
    sanitizedProperties[key] = redactTelemetryValue(key, value);
  }

  return sanitizedProperties;
}

export function sanitizeTelemetryEvent(
  event: TelemetryEventInput,
  now: () => string = defaultTelemetryTimestamp,
): TelemetryEvent {
  return {
    measurements: { ...(event.measurements ?? {}) },
    name: event.name,
    properties: sanitizeTelemetryProperties(event.properties),
    ts: event.ts ?? now(),
  };
}

export function createTelemetryClient(options: CreateTelemetryClientOptions = {}): TelemetryClient {
  const now = options.now ?? defaultTelemetryTimestamp;

  return {
    isEnabled() {
      return options.enabled ?? options.featureFlags?.isEnabled('telemetry.enabled') ?? false;
    },
    record(event) {
      if (!this.isEnabled()) {
        return {
          accepted: false,
          reason: 'disabled',
        };
      }

      const sanitizedEvent = sanitizeTelemetryEvent(event, now);
      options.sink?.(sanitizedEvent);

      return {
        accepted: true,
        event: sanitizedEvent,
      };
    },
  };
}
