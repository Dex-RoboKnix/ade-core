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

import { communityEntitlementProvider, createEntitlementProvider } from './entitlements';

describe('createEntitlementProvider', () => {
  it('defaults to community claims when no license is present', () => {
    const provider = createEntitlementProvider();

    expect(provider.tier()).toBe('community');
    expect(provider.isEntitled('core.shell')).toBe(true);
    expect(provider.isEntitled('enterprise.auditExport')).toBe(false);
  });

  it('exposes a reusable community provider for core startup', () => {
    expect(communityEntitlementProvider.tier()).toBe('community');
    expect(communityEntitlementProvider.isEntitled('core.shell')).toBe(true);
  });

  it('allows community core features from a community claim set', () => {
    const provider = createEntitlementProvider({ tier: 'community' });

    expect(provider.isEntitled('core.shell')).toBe(true);
    expect(provider.isEntitled('core.vaults')).toBe(true);
    expect(provider.tier()).toBe('community');
  });

  it('does not allow enterprise features from community claims by default', () => {
    const provider = createEntitlementProvider({ tier: 'community' });

    expect(provider.isEntitled('enterprise.auditExport')).toBe(false);
  });

  it('allows enterprise features from an enterprise claim set', () => {
    const provider = createEntitlementProvider({ tier: 'enterprise' });

    expect(provider.isEntitled('enterprise.auditExport')).toBe(true);
  });

  it('uses explicit feature claims before tier defaults', () => {
    const provider = createEntitlementProvider({
      features: { 'enterprise.auditExport': true },
      tier: 'community',
    });

    expect(provider.isEntitled('enterprise.auditExport')).toBe(true);
  });
});
