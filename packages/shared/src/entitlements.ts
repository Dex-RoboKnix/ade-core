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

export type EditionTier = 'community' | 'pro' | 'enterprise';

export interface SeatInfo {
  readonly seatId: string;
  readonly accountId: string;
  readonly activatedAt: string;
}

export interface FeatureDefinition {
  readonly tier: EditionTier;
  readonly description: string;
}

export const FEATURE_REGISTRY = {
  'core.shell': {
    tier: 'community',
    description: 'Core desktop shell access.',
  },
  'core.vaults': {
    tier: 'community',
    description: 'Local Vault registration and access through FsBridge.',
  },
  'enterprise.auditExport': {
    tier: 'enterprise',
    description: 'Enterprise audit export surface.',
  },
} as const satisfies Record<string, FeatureDefinition>;

export type FeatureId = keyof typeof FEATURE_REGISTRY;

export interface LicenseClaimSet {
  readonly tier: EditionTier;
  readonly features?: Partial<Record<FeatureId, boolean>>;
  readonly seatInfo?: SeatInfo | null;
  readonly expiresAt?: string;
}

export interface EntitlementProvider {
  isEntitled(feature: FeatureId): boolean;
  tier(): EditionTier;
  seatInfo(): SeatInfo | null;
}

export const COMMUNITY_LICENSE_CLAIMS: LicenseClaimSet = {
  tier: 'community',
};

const TIER_RANK: Record<EditionTier, number> = {
  community: 0,
  pro: 1,
  enterprise: 2,
};

export function createEntitlementProvider(
  claims: LicenseClaimSet = COMMUNITY_LICENSE_CLAIMS,
): EntitlementProvider {
  return {
    isEntitled(feature) {
      const explicitClaim = claims.features?.[feature];

      if (explicitClaim !== undefined) {
        return explicitClaim;
      }

      const requiredTier = FEATURE_REGISTRY[feature].tier;

      return TIER_RANK[claims.tier] >= TIER_RANK[requiredTier];
    },
    seatInfo() {
      return claims.seatInfo ?? null;
    },
    tier() {
      return claims.tier;
    },
  };
}

export const communityEntitlementProvider = createEntitlementProvider(COMMUNITY_LICENSE_CLAIMS);
