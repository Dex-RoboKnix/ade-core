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

import { createFeatureFlagReader } from './feature-flags';
import {
  createTelemetryClient,
  sanitizeTelemetryEvent,
  TELEMETRY_REDACTED_VALUE,
  type TelemetryEvent,
} from './telemetry';

describe('telemetry contract', () => {
  it('is off by default and does not emit to the sink', () => {
    const emittedEvents: TelemetryEvent[] = [];
    const client = createTelemetryClient({
      sink(event) {
        emittedEvents.push(event);
      },
    });

    const result = client.record({
      name: 'app.start',
      properties: { safeMode: false },
    });

    expect(client.isEnabled()).toBe(false);
    expect(result).toEqual({ accepted: false, reason: 'disabled' });
    expect(emittedEvents).toEqual([]);
  });

  it('can be enabled explicitly and adds a deterministic timestamp', () => {
    const emittedEvents: TelemetryEvent[] = [];
    const client = createTelemetryClient({
      enabled: true,
      now: () => '2026-05-20T09:00:00.000Z',
      sink(event) {
        emittedEvents.push(event);
      },
    });

    const result = client.record({
      measurements: { durationMs: 42 },
      name: 'feature.used',
      properties: { feature: 'command-palette' },
    });

    expect(result).toEqual({
      accepted: true,
      event: {
        measurements: { durationMs: 42 },
        name: 'feature.used',
        properties: { feature: 'command-palette' },
        ts: '2026-05-20T09:00:00.000Z',
      },
    });

    if (result.accepted) {
      expect(emittedEvents).toEqual([result.event]);
    }
  });

  it('can be enabled through the telemetry feature flag', () => {
    const client = createTelemetryClient({
      featureFlags: createFeatureFlagReader({ 'telemetry.enabled': true }),
      now: () => '2026-05-20T09:01:00.000Z',
    });

    expect(client.isEnabled()).toBe(true);
    expect(
      client.record({
        name: 'app.start',
      }),
    ).toEqual({
      accepted: true,
      event: {
        measurements: {},
        name: 'app.start',
        properties: {},
        ts: '2026-05-20T09:01:00.000Z',
      },
    });
  });

  it('strips PII from event keys and values before emission', () => {
    const sanitizedEvent = sanitizeTelemetryEvent({
      name: 'diagnostic.event',
      properties: {
        accountEmail: 'ada@example.com',
        command: 'openVault',
        details: {
          path: 'C:\\Users\\Ada\\Documents\\secret.txt',
          reason: 'permission denied',
        },
        participants: ['grace@example.com', 'operator'],
        token: 'ghp_abcdefghijklmnopqrstuvwxyz',
        url: 'https://example.test/callback?email=ada@example.com',
      },
      ts: '2026-05-20T09:02:00.000Z',
    });

    expect(sanitizedEvent).toEqual({
      measurements: {},
      name: 'diagnostic.event',
      properties: {
        accountEmail: TELEMETRY_REDACTED_VALUE,
        command: 'openVault',
        details: {
          path: TELEMETRY_REDACTED_VALUE,
          reason: 'permission denied',
        },
        participants: [TELEMETRY_REDACTED_VALUE, 'operator'],
        token: TELEMETRY_REDACTED_VALUE,
        url: TELEMETRY_REDACTED_VALUE,
      },
      ts: '2026-05-20T09:02:00.000Z',
    });
  });

  it('preserves non-PII scalar and measurement values', () => {
    const sanitizedEvent = sanitizeTelemetryEvent({
      measurements: { retries: 2 },
      name: 'storage.migration',
      properties: {
        dryRun: true,
        releaseChannel: 'dev',
        schemaVersion: 2,
        skipped: null,
      },
      ts: '2026-05-20T09:03:00.000Z',
    });

    expect(sanitizedEvent.properties).toEqual({
      dryRun: true,
      releaseChannel: 'dev',
      schemaVersion: 2,
      skipped: null,
    });
    expect(sanitizedEvent.measurements).toEqual({ retries: 2 });
  });
});
