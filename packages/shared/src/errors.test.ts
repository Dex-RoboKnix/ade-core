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

import { AdeError, createAdeError, createProblemDetails } from './errors';

describe('ADE errors', () => {
  it('creates RFC 9457-style Problem Details with a stable code', () => {
    const problem = createProblemDetails(
      'E_FS_PERMISSION_DENIED',
      'Vault write access is not granted.',
      { instance: '/sessions/example' },
    );

    expect(problem).toEqual({
      code: 'E_FS_PERMISSION_DENIED',
      detail: 'Vault write access is not granted.',
      instance: '/sessions/example',
      status: 403,
      title: 'Filesystem permission denied',
      type: 'https://dexroboknix.com/problems/fs-permission-denied',
    });
  });

  it('wraps coded Problem Details in AdeError', () => {
    const error = createAdeError('E_ENTITLEMENT_REQUIRED', 'Audit export needs enterprise.');

    expect(error).toBeInstanceOf(AdeError);
    expect(error.code).toBe('E_ENTITLEMENT_REQUIRED');
    expect(error.toProblemDetails().status).toBe(402);
  });
});
