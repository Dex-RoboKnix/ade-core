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
  createIpcCommandEnvelope,
  createIpcEventEnvelope,
  createIpcResponseEnvelope,
  IPC_COMMAND_KIND,
  IPC_EVENT_KIND,
  IPC_RESPONSE_KIND,
  parseIpcCommandEnvelope,
  parseIpcEventEnvelope,
  parseIpcResponseEnvelope,
} from './ipc';

const FIXED_TIMESTAMP = '2026-05-19T08:10:00.000Z';

describe('IPC protocol envelopes', () => {
  it('round-trips typed command and response payloads', () => {
    const command = createIpcCommandEnvelope({
      command: 'ipc.echo',
      id: 'ipc-command-1',
      params: { text: 'hello' },
      ts: FIXED_TIMESTAMP,
    });
    const parsedCommand = parseIpcCommandEnvelope(JSON.parse(JSON.stringify(command)));
    const response = createIpcResponseEnvelope({
      command: parsedCommand.payload.command,
      id: parsedCommand.id,
      result: parsedCommand.payload.params,
      ts: parsedCommand.ts,
    });
    const parsedResponse = parseIpcResponseEnvelope<{ text: string }>(
      JSON.parse(JSON.stringify(response)),
    );

    expect(parsedCommand.kind).toBe(IPC_COMMAND_KIND);
    expect(parsedCommand.payload).toEqual({
      command: 'ipc.echo',
      params: { text: 'hello' },
    });
    expect(parsedResponse).toEqual({
      id: 'ipc-command-1',
      kind: IPC_RESPONSE_KIND,
      payload: {
        command: 'ipc.echo',
        result: { text: 'hello' },
      },
      ts: FIXED_TIMESTAMP,
      v: 1,
    });
  });

  it('round-trips typed event payloads', () => {
    const event = createIpcEventEnvelope({
      data: { state: 'ready' },
      id: 'ipc-event-1',
      topic: 'shell.ready',
      ts: FIXED_TIMESTAMP,
    });

    const parsedEvent = parseIpcEventEnvelope<{ state: string }>(JSON.parse(JSON.stringify(event)));

    expect(parsedEvent.kind).toBe(IPC_EVENT_KIND);
    expect(parsedEvent.payload).toEqual({
      data: { state: 'ready' },
      topic: 'shell.ready',
    });
  });

  it('rejects mismatched envelope kinds', () => {
    const event = createIpcEventEnvelope({
      id: 'ipc-event-2',
      topic: 'shell.ready',
      ts: FIXED_TIMESTAMP,
    });

    expect(() => parseIpcCommandEnvelope(event)).toThrow();
  });
});
