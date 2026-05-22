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

import { createFeatureFlagReader, parseFeatureFlagOverrides } from './feature-flags';

describe('feature flags', () => {
  it('reads default values from the registry', () => {
    const flags = createFeatureFlagReader();

    expect(flags.isEnabled('diagnostics.console')).toBe(false);
    expect(flags.isEnabled('boot.benchmark')).toBe(false);
  });

  it('uses explicit dev overrides over defaults', () => {
    const flags = createFeatureFlagReader({ 'diagnostics.console': true });

    expect(flags.isEnabled('diagnostics.console')).toBe(true);
    expect(flags.isEnabled('boot.benchmark')).toBe(false);
  });

  it('parses environment-style dev overrides', () => {
    const overrides = parseFeatureFlagOverrides({
      ADE_FLAG_BOOT_BENCHMARK: 'true',
      ADE_FLAG_DIAGNOSTICS_CONSOLE: '0',
      ADE_FLAG_TELEMETRY_ENABLED: 'TRUE',
      IRRELEVANT: 'true',
    });

    expect(overrides).toEqual({
      'boot.benchmark': true,
      'diagnostics.console': false,
      'telemetry.enabled': true,
    });
  });
});
