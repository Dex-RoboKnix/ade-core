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

export interface FeatureFlagDefinition {
  readonly defaultEnabled: boolean;
  readonly description: string;
}

export const FEATURE_FLAGS = {
  'diagnostics.console': {
    defaultEnabled: false,
    description: 'Hidden diagnostics console surface.',
  },
  'boot.benchmark': {
    defaultEnabled: false,
    description: 'Internal boot benchmark page.',
  },
  'shell.reducedMotion': {
    defaultEnabled: false,
    description: 'Force reduced motion behavior for shell transitions.',
  },
  'telemetry.enabled': {
    defaultEnabled: false,
    description: 'Opt-in telemetry event collection.',
  },
} as const satisfies Record<string, FeatureFlagDefinition>;

export type FeatureFlagId = keyof typeof FEATURE_FLAGS;
export type FeatureFlagOverrides = Partial<Record<FeatureFlagId, boolean>>;

export interface FeatureFlagReader {
  isEnabled(flag: FeatureFlagId): boolean;
  overrides(): FeatureFlagOverrides;
}

export function createFeatureFlagReader(overrides: FeatureFlagOverrides = {}): FeatureFlagReader {
  return {
    isEnabled(flag) {
      return overrides[flag] ?? FEATURE_FLAGS[flag].defaultEnabled;
    },
    overrides() {
      return { ...overrides };
    },
  };
}

export function parseFeatureFlagOverrides(values: Record<string, string | undefined>) {
  const overrides: FeatureFlagOverrides = {};

  for (const flag of Object.keys(FEATURE_FLAGS) as FeatureFlagId[]) {
    const rawValue = values[`ADE_FLAG_${flag.toUpperCase().replaceAll('.', '_')}`];

    if (rawValue === undefined) {
      continue;
    }

    if (rawValue === '1' || rawValue.toLowerCase() === 'true') {
      overrides[flag] = true;
    } else if (rawValue === '0' || rawValue.toLowerCase() === 'false') {
      overrides[flag] = false;
    }
  }

  return overrides;
}
