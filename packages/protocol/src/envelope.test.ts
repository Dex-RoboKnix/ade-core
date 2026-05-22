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
  createProtocolEnvelope,
  isProtocolEnvelope,
  isProtocolProblemDetails,
  PROTOCOL_VERSION,
  ProtocolEnvelopeSchema,
  ProtocolProblemDetailsSchema,
  parseProtocolEnvelope,
} from './envelope';

describe('protocol envelope', () => {
  it('round-trips a success payload through JSON and Zod parsing', () => {
    const envelope = createProtocolEnvelope({
      id: 'ipc-0001',
      kind: 'ipc.command',
      payload: {
        command: 'vault.open',
        vaultId: 'vault-local',
      },
      ts: '2026-05-19T08:00:00.000Z',
    });

    const parsed = parseProtocolEnvelope(JSON.parse(JSON.stringify(envelope)));

    expect(parsed).toEqual({
      id: 'ipc-0001',
      kind: 'ipc.command',
      payload: {
        command: 'vault.open',
        vaultId: 'vault-local',
      },
      ts: '2026-05-19T08:00:00.000Z',
      v: PROTOCOL_VERSION,
    });
  });

  it('round-trips a Problem Details error payload', () => {
    const problem = ProtocolProblemDetailsSchema.parse({
      code: 'E_PROTOCOL_VERSION_UNSUPPORTED',
      detail: 'Client requested protocol version 99.',
      instance: '/sessions/local/messages/ipc-0002',
      status: 426,
      title: 'Protocol version unsupported',
      type: 'https://dexroboknix.com/problems/protocol-version-unsupported',
    });

    const envelope = createProtocolEnvelope({
      id: 'ipc-0002',
      kind: 'ipc.error',
      payload: problem,
      ts: '2026-05-19T08:01:00.000Z',
    });

    const parsed = parseProtocolEnvelope(JSON.parse(JSON.stringify(envelope)));

    expect(isProtocolProblemDetails(parsed.payload)).toBe(true);
    expect(parsed.payload).toEqual(problem);
  });

  it('rejects unversioned envelopes', () => {
    expect(() =>
      ProtocolEnvelopeSchema.parse({
        id: 'ipc-0003',
        kind: 'ipc.command',
        payload: null,
        ts: '2026-05-19T08:02:00.000Z',
      }),
    ).toThrow();
  });

  it('rejects message kinds outside dot-delimited lowercase segments', () => {
    expect(() =>
      createProtocolEnvelope({
        id: 'ipc-0004',
        kind: 'IpcCommand',
        payload: null,
        ts: '2026-05-19T08:03:00.000Z',
      }),
    ).toThrow();
  });

  it('rejects non-canonical UTC timestamps', () => {
    expect(
      isProtocolEnvelope({
        id: 'ipc-0005',
        kind: 'ipc.command',
        payload: null,
        ts: '2026-05-19T09:04:00+01:00',
        v: PROTOCOL_VERSION,
      }),
    ).toBe(false);
  });
});
