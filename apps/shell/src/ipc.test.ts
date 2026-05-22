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

import { createIpcEventEnvelope, createIpcResponseEnvelope } from '@dexroboknix/protocol';
import { describe, expect, it } from 'vitest';

import { createIpcClient, TAURI_IPC_COMMAND, TAURI_IPC_EVENT } from './ipc';

const FIXED_TIMESTAMP = '2026-05-19T08:20:00.000Z';

describe('shell IPC client', () => {
  it('round-trips a command through the configured Tauri invoke channel', async () => {
    const client = createIpcClient({
      createId: () => 'ipc-command-client-1',
      invoke: async (command, args) => {
        expect(command).toBe(TAURI_IPC_COMMAND);
        expect(args.envelope.kind).toBe('ipc.command');
        expect(args.envelope.payload).toEqual({
          command: 'ipc.echo',
          params: { text: 'hello' },
        });

        return createIpcResponseEnvelope({
          command: args.envelope.payload.command,
          id: args.envelope.id,
          result: args.envelope.payload.params,
          ts: args.envelope.ts,
        });
      },
      now: () => FIXED_TIMESTAMP,
    });

    const response = await client.command<{ text: string }>('ipc.echo', { text: 'hello' });

    expect(response).toEqual({
      command: 'ipc.echo',
      result: { text: 'hello' },
    });
  });

  it('parses event envelopes from the configured Tauri event channel', async () => {
    const capturedHandler = new Promise<(payload: unknown) => void>((resolve) => {
      const client = createIpcClient({
        listen: async (eventName, handler) => {
          expect(eventName).toBe(TAURI_IPC_EVENT);
          resolve(handler);

          return () => undefined;
        },
      });

      void client.listen((event) => {
        expect(event.payload).toEqual({
          data: { state: 'ready' },
          topic: 'shell.ready',
        });
      });
    });

    const handler = await capturedHandler;

    handler(
      createIpcEventEnvelope({
        data: { state: 'ready' },
        id: 'ipc-event-client-1',
        topic: 'shell.ready',
        ts: FIXED_TIMESTAMP,
      }),
    );
  });

  it('emits typed event envelopes through the configured Tauri event channel', async () => {
    const client = createIpcClient({
      createId: () => 'ipc-event-client-2',
      emit: async (eventName, payload) => {
        expect(eventName).toBe(TAURI_IPC_EVENT);
        expect(payload).toEqual(
          createIpcEventEnvelope({
            data: { state: 'ready' },
            id: 'ipc-event-client-2',
            topic: 'shell.ready',
            ts: FIXED_TIMESTAMP,
          }),
        );
      },
      now: () => FIXED_TIMESTAMP,
    });

    await client.emit('shell.ready', { state: 'ready' });
  });
});
